// scripts/run-collector.ts
import dotenv from 'dotenv';
import { createNewsFetcher } from '../src/lib/news/fetcher';
import { DataCollectionService } from '../src/services/data-collection/DataCollectionService';
import cron from 'node-cron';

// Load environment variables from .env file
dotenv.config({ path: '.env' });

async function main() {
  if (!process.env.NEWS_API_KEY) {
    throw new Error('NEWS_API_KEY is not set in environment variables');
  }

  // Use the factory function to create the fetcher
  const newsFetcher = createNewsFetcher('newsapi', process.env.NEWS_API_KEY);
  const collectionService = new DataCollectionService(newsFetcher);

  console.log('Starting data collection service...');
  
  // Run immediately
  await collectionService.startCollection(15);
  
  // Schedule to run every 15 minutes
  cron.schedule('*/15 * * * *', async () => {
    console.log('Running scheduled collection...');
    await collectionService.startCollection(15);
  });

  console.log('Data collection service is running. Press Ctrl+C to stop.');
}

main().catch(console.error);