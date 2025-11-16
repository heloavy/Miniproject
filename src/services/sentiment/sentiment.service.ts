import { SupabaseClient } from '@supabase/supabase-js';
import { analyzeSentiment } from '../../lib/sentiment/fusion';

export class SentimentService {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  async analyzeArticle(article: any) {
    const { finalScore, sentiment, confidence, vader, transformer } = await analyzeSentiment(article.content || '');
    
    // First, get the actual article ID from the database using the URL
    const { data: articleData, error: fetchError } = await this.supabase
      .from('articles')
      .select('id')
      .eq('url', article.url || article.id)
      .single();
    
    if (fetchError || !articleData) {
      console.error('Error fetching article ID:', fetchError);
      throw new Error(`Article not found: ${article.url || article.id}`);
    }
    
    // Store in sentiment_scores table with the correct integer article_id
    const { data: score, error: scoreError } = await this.supabase
      .from('sentiment_scores')
      .upsert({
        article_id: articleData.id, // Use the integer ID from database
        vader_compound: vader?.score || 0,
        transformer_score: transformer?.score || 0,
        final_score: finalScore,
        sentiment: sentiment,
        confidence: confidence,
        analysis_text: article.content?.substring(0, 1000) || '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'article_id'
      })
      .select()
      .single();

    if (scoreError) {
      console.error('Error storing sentiment score:', scoreError);
      throw scoreError;
    }

    // Also update the article with a summary for quick access
    const { error: articleError } = await this.supabase
      .from('articles')
      .update({
        sentiment_score: finalScore,
        sentiment_label: sentiment,
        sentiment_confidence: confidence,
        updated_at: new Date().toISOString()
      })
      .eq('id', article.id);

    if (articleError) {
      console.error('Error updating article sentiment:', articleError);
      throw articleError;
    }

    return { finalScore, sentiment, confidence, score };
  }

  async processNewArticles(batchSize = 10) {
    // Get articles that don't have sentiment scores yet
    const { data: articles, error } = await this.supabase
      .from('articles')
      .select('id')
      .limit(batchSize);

    if (error) {
      console.error('Error fetching articles:', error);
      return [];
    }

    if (!articles?.length) return [];

    // Check which articles don't have sentiment scores
    const articleIds = articles.map(a => a.id);
    const { data: existingScores, error: scoreError } = await this.supabase
      .from('sentiment_scores')
      .select('article_id')
      .in('article_id', articleIds);

    if (scoreError) {
      console.error('Error checking sentiment scores:', scoreError);
      return [];
    }

    const scoredIds = new Set(existingScores?.map(s => s.article_id) || []);
    const unscoredArticles = articles.filter(a => !scoredIds.has(a.id));

    if (!unscoredArticles.length) return [];

    // Fetch full article data for those without scores
    const { data: fullArticles, error: fetchError } = await this.supabase
      .from('articles')
      .select('*')
      .in('id', unscoredArticles.map(a => a.id));

    if (fetchError) {
      console.error('Error fetching full articles:', fetchError);
      return [];
    }

    console.log(`Processing ${fullArticles.length} articles...`);
    return Promise.all(fullArticles.map(article => this.analyzeArticle(article)));
  }

  async getSentimentStats() {
    const { data, error } = await this.supabase
      .from('articles')
      .select('sentiment_label')
      .not('sentiment_label', 'is', null);

    if (error) throw error;

    const total = data.length;
    const stats = data.reduce((acc, { sentiment_label }) => {
      acc[sentiment_label] = (acc[sentiment_label] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      total,
      positive: (stats['positive'] || 0) / total * 100,
      negative: (stats['negative'] || 0) / total * 100,
      neutral: (stats['neutral'] || 0) / total * 100
    };
  }
}
