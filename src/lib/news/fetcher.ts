import { NewsSource, NewsArticle } from './types';

export abstract class NewsFetcher {
  protected apiKey: string;
  protected source: NewsSource;

  constructor(apiKey: string, source: NewsSource) {
    this.apiKey = apiKey;
    this.source = source;
  }

  abstract fetchNews(params?: any): Promise<NewsArticle[]>;
  
  protected validateArticle(article: Partial<NewsArticle>): article is NewsArticle {
    return (
      !!article.headline &&
      !!article.url &&
      !!article.publishedAt
    );
  }

  protected formatDate(date: Date | string): string {
    if (typeof date === 'string') {
      return new Date(date).toISOString();
    }
    return date.toISOString();
  }
}

export class NewsAPIFetcher extends NewsFetcher {
  private baseUrl = 'https://newsapi.org/v2';

  async fetchNews(params: {
    q?: string;
    from?: string;
    to?: string;
    language?: string;
    sortBy?: 'relevancy' | 'popularity' | 'publishedAt';
    pageSize?: number;
    page?: number;
  } = {}): Promise<NewsArticle[]> {
    const { q, from, to, language = 'en', sortBy = 'publishedAt', pageSize = 100, page = 1 } = params;
    
    const queryParams = new URLSearchParams({
      ...(q && { q }),
      ...(from && { from }),
      ...(to && { to }),
      language,
      sortBy,
      pageSize: pageSize.toString(),
      page: page.toString(),
      apiKey: this.apiKey,
    });

    try {
      const response = await fetch(`${this.baseUrl}/everything?${queryParams}`);
      const data = await response.json();

      if (data.status !== 'ok') {
        throw new Error(data.message || 'Failed to fetch news');
      }

      return data.articles
        .map((article: any) => ({
          source: this.source,
          headline: article.title,
          url: article.url,
          publishedAt: article.publishedAt,
          description: article.description,
          content: article.content,
          author: article.author,
          imageUrl: article.urlToImage,
          rawData: article,
        }))
        .filter(this.validateArticle);
    } catch (error) {
      console.error('Error fetching news:', error);
      throw error;
    }
  }
}

// Factory function to create appropriate fetcher based on source
export function createNewsFetcher(source: NewsSource, apiKey: string): NewsFetcher {
  switch (source) {
    case 'newsapi':
      return new NewsAPIFetcher(apiKey, source);
    // Add more sources here as needed
    default:
      throw new Error(`Unsupported news source: ${source}`);
  }
}
