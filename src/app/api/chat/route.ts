import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { supabase as supabaseClient } from '@/lib/supabase/client';

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

export async function POST(req: NextRequest) {
    try {
        const { message } = await req.json();

        if (!message) {
            return NextResponse.json({ error: 'Message is required' }, { status: 400 });
        }

        // 1. Retrieve relevant context from Supabase
        // Expanded stop words list to reduce noise
        const stopWords = new Set([
            'the', 'is', 'at', 'which', 'on', 'a', 'an', 'in', 'to', 'of', 'for', 'and', 'or', 'but', 'so',
            'what', 'how', 'why', 'when', 'who', 'where', 'tell', 'me', 'about', 'are', 'they', 'them', 'their',
            'it', 'its', 'be', 'has', 'have', 'had', 'do', 'does', 'did', 'can', 'could', 'will', 'would',
            'should', 'may', 'might', 'must', 'i', 'you', 'he', 'she', 'we', 'us', 'this', 'that', 'these', 'those'
        ]);

        // Sanitize and extract keywords
        // Remove special characters but keep alphanumeric and hyphens
        const cleanedMessage = message.replace(/[^\w\s-]/g, '').toLowerCase();
        const words = cleanedMessage.split(/\s+/);

        const keywords = words.filter((word: string) =>
            !stopWords.has(word) && word.length > 2 && !/^\d+$/.test(word) // Filter out pure numbers unless relevant? Keeping numbers might be good for "14a", but "1" is bad.
        );

        // Limit to top 8 unique keywords to prevent query overflow
        const uniqueKeywords = Array.from(new Set(keywords)).slice(0, 8);

        let query = supabaseClient
            .from('articles')
            .select(`
        headline,
        summary,
        content,
        published_at,
        sources(name),
        sentiment_scores(final_score, vader_compound, transformer_score)
      `)
            .order('published_at', { ascending: false })
            .limit(10);

        if (uniqueKeywords.length > 0) {
            const searchConditions = uniqueKeywords.map((k) =>
                `headline.ilike.%${k}%,summary.ilike.%${k}%`
            ).join(',');
            query = query.or(searchConditions);
        }

        const { data: articles, error } = await query;

        if (error) {
            console.error('Supabase error:', error);
        }

        // 2. Format context with richer details
        let contextText = "No specific news articles found matching the query.";
        if (articles && articles.length > 0) {
            contextText = articles.map((a: any) => `
        Title: ${a.headline}
        Source: ${a.sources?.name || 'Unknown'}
        Date: ${new Date(a.published_at).toLocaleDateString()}
        Summary: ${a.summary}
        Sentiment Analysis:
          - Overall Score: ${a.sentiment_scores?.final_score?.toFixed(2) || 'N/A'}
          - VADER Score: ${a.sentiment_scores?.vader_compound?.toFixed(2) || 'N/A'}
          - Transformer Score: ${a.sentiment_scores?.transformer_score?.toFixed(2) || 'N/A'}
      `).join('\n---\n');
        }

        // 3. Call Groq API
        const systemPrompt = `You are an intelligent news assistant for a sentiment analysis project. 
    You have access to a database of news articles with sentiment analysis scores.
    
    Context (Recent/Relevant News):
    ${contextText}
    
    Your goal is to answer the user's question based strictly on the provided context if possible.
    If the context doesn't contain the answer, you can use your general knowledge but explicitly state that "Based on the available news data, I couldn't find specific details, but generally...".
    Do not hallucinate or make up news.
    The sentiment score ranges from -1 (Negative) to 1 (Positive).
    Be concise, professional, and helpful.`;

        const completion = await groq.chat.completions.create({
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: message },
            ],
            model: 'llama-3.3-70b-versatile',
            temperature: 0.5,
            max_tokens: 1024,
        });

        // Calculate aggregated sentiment from top relevant articles only
        let sentimentLabel = 'neutral';
        if (articles && articles.length > 0) {
            // Use only top 5 most relevant articles for sentiment (they appear first in results)
            const topArticles = articles.slice(0, 5);
            const totalScore = topArticles.reduce((sum: number, a: any) => sum + (a.sentiment_scores?.final_score || 0), 0);
            const avgScore = totalScore / topArticles.length;

            // More lenient thresholds for better accuracy
            if (avgScore > 0.1) sentimentLabel = 'positive';
            else if (avgScore < -0.1) sentimentLabel = 'negative';
        }

        const responseMessage = completion.choices[0]?.message?.content || "I couldn't generate a response.";

        return NextResponse.json({
            response: responseMessage,
            sentiment: sentimentLabel
        });

    } catch (error: any) {
        console.error('Chat API Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
