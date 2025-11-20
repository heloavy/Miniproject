// src/services/data-collection/fetchers/NewsAPIFetcher.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { NewsFetcher } from '../../../lib/news/fetcher';
import { NewsSource, NewsArticle } from '../../../lib/news/types';

export interface NewsAPIFetcherParams {
  pageSize?: number;
  sortBy?: 'relevancy' | 'popularity' | 'publishedAt';
  q?: string;
  language?: string;
  skipSentiment?: boolean;
}

export class NewsAPIFetcher extends NewsFetcher {
  private baseUrl = 'https://newsapi.org/v2';
  private supabase: SupabaseClient;

  constructor(apiKey: string, supabase?: SupabaseClient) {
    super(apiKey, 'newsapi');
    if (!apiKey) {
      throw new Error('API key is required');
    }

    // Use provided Supabase client or create a new one
    this.supabase = supabase || createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: { persistSession: false },
      }
    );
  }

  protected validateArticle(article: any): article is NewsArticle {
    return (
      article &&
      article.headline &&
      article.url &&
      article.publishedAt
    ) as boolean;
  }

  protected formatDate(dateString: string): string {
    return new Date(dateString).toISOString();
  } // <-- FIX 1: Added closing brace } here

  // FIX 2: Correctly defined fetchNews as its own method
  async fetchNews(params: NewsAPIFetcherParams = {}): Promise<NewsArticle[]> {
    const {
      pageSize = 10,
      sortBy = 'publishedAt',
      q = 'technology',
      language = 'en',
      skipSentiment = false
    } = params;

    console.log('🔵 fetchNews called with params:', { pageSize, sortBy, q, language, skipSentiment });

    try {
      const queryParams = new URLSearchParams({
        q,
        language,
        sortBy,
        pageSize: pageSize.toString(),
      });

      const url = `${this.baseUrl}/everything?${queryParams}`;
      console.log('🌐 Fetching news from:', url);

      const response = await fetch(url, {
        headers: {
          'X-Api-Key': this.apiKey,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API Error:', response.status, errorText);
        throw new Error(`API Error: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      console.log('📊 API Response Status:', response.status);
      console.log('📥 Received response with', data.articles?.length || 0, 'articles');
      if (data.articles?.length > 0) {
        console.log('Sample article:', {
          title: data.articles[0].title,
          url: data.articles[0].url,
          source: data.articles[0].source?.name
        });
      }
      // Process articles
      const validArticles: NewsArticle[] = [];
      for (const article of data.articles) {
        try {
          // This assumes your NewsArticle type includes an optional 'id'
          const articleData: NewsArticle = {
            id: article.url ? article.url.replace(/[^a-zA-Z0-9]/g, '-') : uuidv4(),
            source: this.source,
            headline: article.title || 'No title',
            description: article.description || '',
            content: article.content || article.description || '',
            url: article.url,
            publishedAt: this.formatDate(article.publishedAt || new Date().toISOString()),
            author: article.author,
            imageUrl: article.urlToImage,
            rawData: article,
          };

          console.log('Storing article:', {
            id: articleData.id,
            headline: articleData.headline.substring(0, 50) + '...',
            url: articleData.url,
          });
          console.log('🔌 Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30) + '...');

          // Store the article in the database
          // storeArticle returns the article with a DB-generated ID if new, or null if it exists
          const storedArticle = await this.storeArticle(articleData);
          console.log('Stored article result:', storedArticle ? 'Success (New)' : 'Skipped (Exists)');

          // Use the newly stored article (with DB ID) or the original one
          const finalArticle = storedArticle || articleData;

          // Only analyze sentiment if not skipped and we have an ID
          // This favors the storedArticle's ID if it was newly created
          if (!skipSentiment && finalArticle.id) {
            this.analyzeAndStoreSentiment(finalArticle.id, finalArticle)
              .catch(error => {
                console.error('Error in analyzeAndStoreSentiment (non-blocking):', error);
              });
          }

          validArticles.push(finalArticle);
        } catch (error) {
          console.error('Error processing article:', article.url, error);
        }
      }

      return validArticles;

      // FIX 3: Corrected the malformed/nested try...catch blocks
    } catch (error) {
      console.error('Error in fetchNews:', error);
      return []; // Return empty array on failure
    }
  }

  private async storeArticle(article: NewsArticle): Promise<NewsArticle | null> {
    console.log('\n🔵 Storing article:', {
      url: article.url,
      headline: article.headline?.substring(0, 50) + '...',
      source: article.source,
      publishedAt: article.publishedAt
    });

    if (!article.url) {
      console.error('❌ Article missing URL, cannot store');
      return null;
    }

    try {
      // Check if article exists using external_id (URL)
      const { data: existing, error: existingError } = await this.supabase
        .from('articles')
        .select('id')
        .eq('external_id', article.url)
        .maybeSingle();

      if (existingError) {
        console.error('❌ Error checking for existing article:', existingError);
      }

      if (existing) {
        console.log('✅ Article already exists, skipping');
        return null;
      }

      // Resolve Source ID
      let sourceId: number | null = null;
      const sourceName = article.source || 'Unknown';
      const sourceSlug = sourceName.toLowerCase().replace(/[^a-z0-9]/g, '-');

      // 1. Try to find existing source
      const { data: existingSource } = await this.supabase
        .from('sources')
        .select('id')
        .or(`name.eq.${sourceName},source_id.eq.${sourceSlug}`)
        .maybeSingle();

      if (existingSource) {
        sourceId = existingSource.id;
      } else {
        // 2. Create new source if not found
        console.log(`🆕 Creating new source: ${sourceName}`);
        const { data: newSource, error: sourceError } = await this.supabase
          .from('sources')
          .insert({
            name: sourceName,
            source_id: sourceSlug,
            url: `https://${sourceSlug}.com`, // Placeholder
            category: 'general',
            language: 'en'
          })
          .select('id')
          .single();

        if (sourceError) {
          console.error('❌ Error creating source:', sourceError);
          // Fallback to default 'newsapi' source if creation fails
          const { data: defaultSource } = await this.supabase
            .from('sources')
            .select('id')
            .eq('source_id', 'newsapi')
            .single();
          sourceId = defaultSource?.id || null;
        } else {
          sourceId = newSource.id;
        }
      }

      // Prepare article data for database
      const articleData = {
        external_id: article.url,
        headline: article.headline || 'No title',
        description: article.description || '',
        content: article.content || article.description || '',
        url: article.url,
        image_url: article.imageUrl || null,
        author: article.author || 'Unknown',
        source_id: sourceId, // Use the resolved FK
        published_at: new Date(article.publishedAt).toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      console.log('📝 Inserting article data:', {
        title: articleData.headline,
        source_id: articleData.source_id,
        url: articleData.url
      });

      // Insert article
      const { data: newArticle, error: insertError } = await this.supabase
        .from('articles')
        .insert(articleData)
        .select()
        .single();

      if (insertError) {
        console.error('❌ Error inserting article:', insertError);
        return null;
      }

      console.log('✅ Successfully stored article with ID:', newArticle?.id);
      return {
        ...article,
        id: newArticle.id.toString()
      };

    } catch (error) {
      console.error('Error in storeArticle:', error);
      return null;
    }
  }

  private async analyzeAndStoreSentiment(articleId: string | number, article: NewsArticle): Promise<void> {
    if (!articleId) {
      console.log('⚠️ No article ID provided for sentiment analysis');
      return;
    }

    console.log(`\n🔍 Analyzing sentiment for article: ${articleId}`);

    try {
      const textToAnalyze = (article.content || article.headline || article.description || '').substring(0, 1000);

      if (!textToAnalyze) {
        console.log('⚠️ No text available for sentiment analysis');
        return;
      }

      // Import the sentiment analyzer
      const { analyzeSentiment } = await import('../../../lib/sentiment/fusion');

      console.log('🧠 Analyzing sentiment...');
      const sentiment = await analyzeSentiment(textToAnalyze);

      console.log('📊 Sentiment analysis result:', {
        vader: sentiment.vader ? '✅' : '❌',
        transformer: sentiment.transformer ? '✅' : '❌',
        finalScore: sentiment.finalScore,
      });

      const sentimentData = {
        article_id: articleId.toString(),
        vader_compound: sentiment.vader?.score || 0,
        vader_positive: sentiment.vader?.positive || 0,
        vader_negative: sentiment.vader?.negative || 0,
        vader_neutral: sentiment.vader?.neutral || 0,
        transformer_score: sentiment.transformer?.score || 0,
        final_score: sentiment.finalScore || 0,
        analysis_text: textToAnalyze.substring(0, 500),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      console.log('💾 Storing sentiment analysis...');
      const { data, error } = await this.supabase
        .from('sentiment_scores')
        .insert(sentimentData)
        .select()
        .single();

      if (error) {
        console.error('❌ Error storing sentiment score:', error);
      } else {
        console.log(`✅ Successfully stored sentiment score with ID: ${data?.id}`);
      }
    } catch (error) {
      console.error('❌ Error in analyzeAndStoreSentiment:', error);
    }
  }
} // End of NewsAPIFetcher class