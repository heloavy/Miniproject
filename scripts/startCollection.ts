import { NewsAPIFetcher } from '../src/services/data-collection/fetchers/NewsAPIFetcher';
import { config } from 'dotenv';
import path from 'path';

// Load environment variables
config({ path: path.resolve(process.cwd(), '.env.local') });
import { DataCollectionService } from '../src/services/data-collection/DataCollectionService';

async function main() {
  if (!process.env.NEWS_API_KEY) {
    console.error('Missing required environment variable: NEWS_API_KEY');
    process.exit(1);
  }

  const newsFetcher = new NewsAPIFetcher(process.env.NEWS_API_KEY);
  const dataService = new DataCollectionService(
    newsFetcher,
    process.env.TWITTER_BEARER_TOKEN || ''
  );

  console.log('Starting data collection...');

  // Start with historical data (last 7 days as an example)
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  
  try {
    console.log('Fetching historical data...');
    const articles = await dataService.fetchHistoricalData({
      startDate: oneWeekAgo,
      endDate: new Date(),
      query: 'technology'
    });
    
    console.log(`Successfully fetched ${articles.length} articles`);
    
  } catch (error) {
    console.error('Error during data collection:', error);
    process.exit(1);
  }
}

main().catch(console.error);