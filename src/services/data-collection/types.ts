import { NewsArticle, NewsSource } from '@/lib/news/types';

export interface NewsFetchOptions {
  query?: string;
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
  language?: string;
  sortBy?: 'relevancy' | 'popularity' | 'publishedAt';
}

// src/services/data-collection/types.ts
export interface NewsFetchResult {
  articles: NewsArticle[];
  totalResults: number;
  status: 'ok' | 'error';
  code: number;
  message?: string;
}

export interface IDataCollector {
  fetchHistoricalData(options: {
    startDate: Date;
    endDate: Date;
    query?: string;
  }): Promise<void>;

  startRealTimeCollection(options: {
    interval?: number;
    query?: string;
  }): void;

  stopRealTimeCollection(): void;
}

export interface SocialMediaReaction {
  id: string;
  platform: 'twitter' | 'reddit' | 'other';
  content: string;
  author: string;
  createdAt: Date;
  url: string;
  metrics: {
    likes?: number;
    shares?: number;
    comments?: number;
  };
  sentimentScore?: number;
}

export interface NewsWithReactions extends NewsArticle {
  reactions: SocialMediaReaction[];
  reactionMetrics: {
    totalReactions: number;
    averageSentiment: number;
    platforms: Record<string, number>;
  };
}

export interface DataCollectionStats {
  totalArticlesCollected: number;
  lastCollectionTime: Date | null;
  nextScheduledCollection: Date | null;
  errorCount: number;
  lastError: string | null;
  sources: Record<string, number>;
}
