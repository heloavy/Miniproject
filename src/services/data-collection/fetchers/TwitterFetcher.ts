
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { NewsFetcher } from '../../../lib/news/fetcher';
import { NewsSource, NewsArticle } from '../../../lib/news/types';

export class TwitterFetcher extends NewsFetcher {
    private baseUrl = 'https://api.twitter.com/2';
    private supabase: SupabaseClient;
    private bearerToken: string;

    constructor(apiKey: string, supabase?: SupabaseClient) {
        super(apiKey, 'twitter');
        this.bearerToken = apiKey;

        this.supabase = supabase || createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            { auth: { persistSession: false } }
        );
    }

    async fetchNews(params: { q?: string; maxResults?: number } = {}): Promise<NewsArticle[]> {
        const { q = 'technology', maxResults = 10 } = params;

        // Twitter API v2 Search
        // Note: Recent Search is available in Basic tier
        const url = `${this.baseUrl}/tweets/search/recent?query=${encodeURIComponent(q)}&max_results=${Math.min(maxResults, 100)}&tweet.fields=created_at,author_id,public_metrics`;

        console.log('🐦 Fetching tweets from:', url);

        try {
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${this.bearerToken}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Twitter API Error:', response.status, errorText);
                return [];
            }

            const data = await response.json();

            if (!data.data) {
                console.log('No tweets found.');
                return [];
            }

            const articles: NewsArticle[] = [];

            for (const tweet of data.data) {
                const article: NewsArticle = {
                    id: uuidv4(),
                    source: 'twitter',
                    headline: tweet.text, // Tweets don't have headlines, use text
                    url: `https://twitter.com/user/status/${tweet.id}`,
                    publishedAt: tweet.created_at,
                    description: tweet.text,
                    content: tweet.text,
                    author: tweet.author_id, // We'd need another call to get username, skipping for now
                    imageUrl: undefined,
                    rawData: tweet,
                };

                await this.processArticle(article);
                articles.push(article);
            }

            return articles;

        } catch (error) {
            console.error('Error fetching tweets:', error);
            return [];
        }
    }

    private async processArticle(article: NewsArticle) {
        // 1. Store Article
        const stored = await this.storeArticle(article);

        // 2. Analyze Sentiment (if stored successfully and new)
        if (stored && stored.id) {
            await this.analyzeAndStoreSentiment(stored.id, stored);
        }
    }

    // Duplicated from NewsAPIFetcher - ideally refactor to base class or mixin
    private async storeArticle(article: NewsArticle): Promise<NewsArticle | null> {
        try {
            // Check existence
            const { data: existing } = await this.supabase
                .from('articles')
                .select('id')
                .eq('external_id', article.url)
                .maybeSingle();

            if (existing) return null;

            // Resolve Source
            let sourceId: number | null = null;
            const { data: sourceData } = await this.supabase
                .from('sources')
                .select('id')
                .eq('source_id', 'twitter')
                .maybeSingle();

            if (sourceData) {
                sourceId = sourceData.id;
            } else {
                // Create Twitter source if missing
                const { data: newSource } = await this.supabase
                    .from('sources')
                    .insert({
                        name: 'Twitter',
                        source_id: 'twitter',
                        url: 'https://twitter.com',
                        category: 'social',
                        language: 'en'
                    })
                    .select('id')
                    .single();
                sourceId = newSource?.id || null;
            }

            const articleData = {
                external_id: article.url,
                headline: article.headline,
                description: article.description,
                content: article.content,
                url: article.url,
                image_url: article.imageUrl,
                author: article.author,
                source_id: sourceId,
                published_at: new Date(article.publishedAt).toISOString(),
            };

            const { data: newArticle, error } = await this.supabase
                .from('articles')
                .insert(articleData)
                .select()
                .single();

            if (error) {
                console.error('Error inserting tweet:', error);
                return null;
            }

            return { ...article, id: newArticle.id.toString() };

        } catch (error) {
            console.error('Error in storeArticle:', error);
            return null;
        }
    }

    private async analyzeAndStoreSentiment(articleId: string, article: NewsArticle) {
        try {
            const text = article.content || '';
            if (!text) return;

            const { analyzeSentiment } = await import('../../../lib/sentiment/fusion');
            const sentiment = await analyzeSentiment(text);

            await this.supabase.from('sentiment_scores').insert({
                article_id: articleId,
                vader_compound: sentiment.vader?.score || 0,
                vader_positive: sentiment.vader?.positive || 0,
                vader_negative: sentiment.vader?.negative || 0,
                vader_neutral: sentiment.vader?.neutral || 0,
                transformer_score: sentiment.transformer?.score || 0,
                final_score: sentiment.finalScore || 0,
                analysis_text: text.substring(0, 500),
            });

            console.log(`✅ Analyzed tweet: ${articleId}`);
        } catch (error) {
            console.error('Error analyzing tweet:', error);
        }
    }
}
