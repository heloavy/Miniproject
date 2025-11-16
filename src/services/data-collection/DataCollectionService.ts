// src/services/data-collection/DataCollectionService.ts
import { NewsFetcher } from '@/lib/news/fetcher';
import { createClient } from '@supabase/supabase-js';

export class DataCollectionService {
  private isRunning = false;
  private intervalId?: NodeJS.Timeout;

  constructor(private newsFetcher: NewsFetcher) {}

  async startCollection(intervalMinutes: number = 15) {
    if (this.isRunning) return;
    
    this.isRunning = true;
    
    // Initial fetch
    await this.fetchAndStoreNews();
    
    // Schedule periodic fetching
    this.intervalId = setInterval(
      () => this.fetchAndStoreNews(),
      intervalMinutes * 60 * 1000
    );
  }

  stopCollection() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.isRunning = false;
    }
  }

  private async fetchAndStoreNews() {
    try {
      console.log('Fetching latest news...');
      // Define search terms - you can customize these based on your needs
      const searchTerms = [
        'technology',
        'artificial intelligence',
        'machine learning',
        'cryptocurrency',
        'blockchain',
        'startup',
        'programming',
        'software development'
      ];
      
      // Get a random search term
      const randomTerm = searchTerms[Math.floor(Math.random() * searchTerms.length)];
      
      const articles = await this.newsFetcher.fetchNews({
        q: randomTerm,
        pageSize: 20,  // Reduced from 50 to avoid hitting rate limits
        sortBy: 'publishedAt',
        language: 'en',
        from: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0] // Last 24 hours
      });
      
      console.log(`Fetched ${articles.length} articles`);
      
      // Log collection run
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      
      await supabase.from('collection_runs').insert({
        start_time: new Date().toISOString(),
        status: 'completed',
        articles_collected: articles.length
      });
      
    } catch (error) {
      console.error('Error in fetchAndStoreNews:', error);
    }
  }
}