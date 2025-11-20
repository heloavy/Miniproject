
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { NewsFetcher } from '../../../lib/news/fetcher';
import { NewsSource, NewsArticle } from '../../../lib/news/types';

export class RedditFetcher extends NewsFetcher {
    private baseUrl = 'https://www.reddit.com';
    private supabase: SupabaseClient;

    constructor(apiKey: string, supabase?: SupabaseClient) {
        super(apiKey || 'public', 'reddit'); // API key not strictly needed for public JSON

        this.supabase = supabase || createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            { auth: { persistSession: false } }
        );
    }

    async fetchNews(params: { q?: string; subreddit?: string; limit?: number } = {}): Promise<NewsArticle[]> {
        const { q, subreddit = 'news', limit = 25 } = params;

        let url = '';
        if (q) {
            url = `${this.baseUrl}/r/${subreddit}/search.json?q=${encodeURIComponent(q)}&sort=new&limit=${limit}&restrict_sr=1`;
        } else {
            url = `${this.baseUrl}/r/${subreddit}/new.json?limit=${limit}`;
        }

        console.log('👽 Fetching Reddit posts from:', url);

        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'NewsSentimentBot/1.0', // Required by Reddit
                },
            });

            if (!response.ok) {
                console.error('❌ Reddit API Error:', response.status);
                return [];
            }

            const data = await response.json();

            if (!data.data || !data.data.children) {
                console.log('No Reddit posts found.');
                return [];
            }

            const articles: NewsArticle[] = [];

            for (const child of data.data.children) {
                const post = child.data;

                // Skip stickied posts or non-news
                if (post.stickied) continue;

                const article: NewsArticle = {
                    id: uuidv4(),
                    source: 'reddit',
                    headline: post.title,
                    url: `https://reddit.com${post.permalink}`,
                    publishedAt: new Date(post.created_utc * 1000).toISOString(),
                    description: post.selftext ? post.selftext.substring(0, 200) + '...' : '',
                    content: post.selftext || post.title,
                    author: post.author,
                    imageUrl: post.thumbnail && post.thumbnail.startsWith('http') ? post.thumbnail : undefined,
                    rawData: post,
                };

                await this.processArticle(article);
                articles.push(article);
            }

            return articles;

        } catch (error) {
            console.error('Error fetching Reddit posts:', error);
            return [];
        }
    }

    private async processArticle(article: NewsArticle) {
        const stored = await this.storeArticle(article);
        if (stored && stored.id) {
            await this.analyzeAndStoreSentiment(stored.id, stored);
        }
    }

    private async storeArticle(article: NewsArticle): Promise<NewsArticle | null> {
        try {
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
                .eq('source_id', 'reddit')
                .maybeSingle();

            if (sourceData) {
                sourceId = sourceData.id;
            } else {
                const { data: newSource } = await this.supabase
                    .from('sources')
                    .insert({
                        name: 'Reddit',
                        source_id: 'reddit',
                        url: 'https://reddit.com',
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
                published_at: article.publishedAt,
            };

            const { data: newArticle, error } = await this.supabase
                .from('articles')
                .insert(articleData)
                .select()
                .single();

            if (error) {
                console.error('Error inserting Reddit post:', error);
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

            console.log(`✅ Analyzed Reddit post: ${articleId}`);
        } catch (error) {
            console.error('Error analyzing Reddit post:', error);
        }
    }
}
