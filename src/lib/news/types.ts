export type NewsSource = 'newsapi' | 'reddit' | 'twitter'; // Add more sources as needed

export interface NewsArticle {
  id?: string;
  source: NewsSource;
  headline: string;
  url: string;
  publishedAt: string;
  description?: string;
  content?: string;
  author?: string;
  imageUrl?: string;
  rawData?: any;
  sentiment?: {
    vaderScore?: number;
    transformerScore?: number;
    fusedScore?: number;
    analyzedAt?: string;
  };
  socialReactions?: {
    platform: string;
    likes?: number;
    comments?: number;
    shares?: number;
    sentimentSummary?: string;
    collectedAt?: string;
  }[];
}

export interface NewsFetchOptions {
  query?: string;
  fromDate?: Date;
  toDate?: Date;
  language?: string;
  limit?: number;
  page?: number;
  sortBy?: 'relevancy' | 'popularity' | 'publishedAt';
  // Add more options as needed
}

export interface NewsFetchResult {
  articles: NewsArticle[];
  totalResults: number;
  currentPage: number;
  totalPages: number;
  hasMore: boolean;
}
