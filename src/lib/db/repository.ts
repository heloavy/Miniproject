import { supabase, getServiceSupabase } from '../supabase/client';
import { NewsArticle } from '../news/types';
import { v4 as uuidv4 } from 'uuid';

export class NewsRepository {
  private tableName = 'news';
  private sentimentTable = 'sentiment';
  private socialReactionsTable = 'social_reactions';
  private ragDocumentsTable = 'rag_documents';

  // Insert or update a news article
  async upsertArticle(article: NewsArticle) {
    const { data, error } = await getServiceSupabase()
      .from(this.tableName)
      .upsert(
        {
          id: article.id || uuidv4(),
          source_id: article.sourceId,
          headline: article.headline,
          url: article.url,
          published_at: article.publishedAt,
          summary: article.description,
          raw_payload: article.rawData,
        },
        { onConflict: 'url' }
      )
      .select()
      .single();

    if (error) {
      console.error('Error upserting article:', error);
      throw error;
    }

    return data;
  }

  // Save sentiment analysis results
  async saveSentimentAnalysis(articleId: string, sentimentData: any) {
    const { error } = await getServiceSupabase()
      .from(this.sentimentTable)
      .upsert({
        news_id: articleId,
        score_vader: sentimentData.vaderScore,
        score_bert: sentimentData.transformerScore,
        fused_score: sentimentData.fusedScore,
        details_json: sentimentData,
      });

    if (error) {
      console.error('Error saving sentiment analysis:', error);
      throw error;
    }
  }

  // Save social reactions
  async saveSocialReactions(articleId: string, platform: string, reactions: any) {
    const { error } = await getServiceSupabase()
      .from(this.socialReactionsTable)
      .upsert({
        news_id: articleId,
        platform,
        reaction_count: reactions.reaction_count || 0,
        likes: reactions.likes || 0,
        comments: reactions.comments || 0,
        shares: reactions.shares || 0,
        sentiment_summary: reactions.sentiment_summary,
      });

    if (error) {
      console.error('Error saving social reactions:', error);
      throw error;
    }
  }

  // Save document for RAG
  async saveRAGDocument(articleId: string, text: string, metadata: any = {}) {
    // In a real implementation, you would generate embeddings here
    const embedding = null; // This would be generated using an embeddings API

    const { error } = await getServiceSupabase()
      .from(this.ragDocumentsTable)
      .insert({
        news_id: articleId,
        embedding,
        chunk_text: text,
        metadata,
      });

    if (error) {
      console.error('Error saving RAG document:', error);
      throw error;
    }
  }

  // Search news with filters
  async searchNews(filters: {
    query?: string;
    fromDate?: Date;
    toDate?: Date;
    sourceIds?: string[];
    minSentiment?: number;
    maxSentiment?: number;
    limit?: number;
    offset?: number;
  }) {
    let query = supabase
      .from(this.tableName)
      .select(
        `
        *,
        sentiment: ${this.sentimentTable}(*),
        social_reactions: ${this.socialReactionsTable}(*)
      `,
        { count: 'exact' }
      )
      .order('published_at', { ascending: false });

    if (filters.query) {
      // This is a simplified search - in production, you'd use full-text search
      query = query.ilike('headline', `%${filters.query}%`);
    }

    if (filters.fromDate) {
      query = query.gte('published_at', filters.fromDate.toISOString());
    }

    if (filters.toDate) {
      query = query.lte('published_at', filters.toDate.toISOString());
    }

    if (filters.sourceIds?.length) {
      query = query.in('source_id', filters.sourceIds);
    }

    if (filters.minSentiment !== undefined || filters.maxSentiment !== undefined) {
      query = query
        .select(
          `
          *,
          sentiment: ${this.sentimentTable}(*)
        `
        )
        .not('sentiment', 'is', null);

      if (filters.minSentiment !== undefined) {
        query = query.gte('sentiment.fused_score', filters.minSentiment);
      }

      if (filters.maxSentiment !== undefined) {
        query = query.lte('sentiment.fused_score', filters.maxSentiment);
      }
    }

    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    if (filters.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Error searching news:', error);
      throw error;
    }

    return {
      data: data || [],
      count: count || 0,
    };
  }

  // Get sentiment trends over time
  async getSentimentTrends(timeRange: 'day' | 'week' | 'month' = 'day') {
    const { data, error } = await getServiceSupabase().rpc('get_sentiment_trends', {
      time_range: timeRange,
    });

    if (error) {
      console.error('Error getting sentiment trends:', error);
      throw error;
    }

    return data;
  }

  // Get sources with sentiment statistics
  async getSourceSentimentStats() {
    const { data, error } = await getServiceSupabase()
      .from('sources')
      .select(
        `
        *,
        news_articles:news(
          id,
          sentiment:${this.sentimentTable}(fused_score)
        )
      `
      )
      .order('name');

    if (error) {
      console.error('Error getting source sentiment stats:', error);
      throw error;
    }

    return data?.map((source) => {
      const scores = source.news_articles
        ?.filter((article: any) => article.sentiment?.[0]?.fused_score !== undefined)
        .map((article: any) => article.sentiment[0].fused_score) as number[];

      const avgScore = scores?.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

      return {
        ...source,
        articleCount: source.news_articles?.length || 0,
        averageSentiment: avgScore,
      };
    });
  }
}

export const newsRepository = new NewsRepository();
