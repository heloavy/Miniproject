// scripts/background-collector-clean.ts
import { createClient } from '@supabase/supabase-js';
import { NewsAPIFetcher } from '../src/services/data-collection/fetchers/NewsAPIFetcher';
import { RedditFetcher } from '../src/services/data-collection/fetchers/RedditFetcher';
import { TwitterFetcher } from '../src/services/data-collection/fetchers/TwitterFetcher';
import { SentimentService } from '../src/services/sentiment/sentiment.service';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Log to console with timestamp
function log(message: string) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

// Initialize services
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
);

const sentimentService = new SentimentService(supabase);
const newsAPIFetcher = new NewsAPIFetcher(process.env.NEWS_API_KEY!, supabase);
const redditFetcher = new RedditFetcher('public', supabase);
const twitterFetcher = process.env.TWITTER_BEARER_TOKEN
  ? new TwitterFetcher(process.env.TWITTER_BEARER_TOKEN, supabase)
  : null;

// Configuration
const COLLECTION_INTERVAL = 15 * 60 * 1000; // 15 minutes
const BATCH_SIZE = 10;

async function processPendingArticles() {
  try {
    const results = await sentimentService.processNewArticles(BATCH_SIZE);
    if (results.length > 0) {
      log(`✅ Processed ${results.length} pending articles`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log(`❌ Error processing pending articles: ${errorMessage}`);
  }
}

async function fetchAndProcessNews() {
  try {
    // 1. Fetch from NewsAPI
    log('📰 Fetching from NewsAPI...');
    const newsAPIArticles = await newsAPIFetcher.fetchNews({
      q: 'technology OR finance OR business',
      pageSize: 15
    });
    log(`📥 NewsAPI: ${newsAPIArticles.length} articles`);

    // 2. Fetch from Reddit
    log('👽 Fetching from Reddit...');
    const redditArticles = await redditFetcher.fetchNews({
      subreddit: 'technology',
      limit: 10
    });
    log(`📥 Reddit: ${redditArticles.length} posts`);

    // 3. Fetch from Twitter (if configured)
    let twitterArticles: any[] = [];
    if (twitterFetcher) {
      log('🐦 Fetching from Twitter...');
      twitterArticles = await twitterFetcher.fetchNews({
        q: 'technology OR AI OR crypto OR finance',
        maxResults: 10
      });
      log(`📥 Twitter: ${twitterArticles.length} tweets`);
    } else {
      log('⚠️ Twitter disabled: Add TWITTER_BEARER_TOKEN to .env to enable');
    }

    const totalArticles = newsAPIArticles.length + redditArticles.length + twitterArticles.length;
    log(`✅ Total collected: ${totalArticles} items from all sources`);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log(`❌ Error fetching news: ${errorMessage}`);
  }
}

async function runCollector() {
  log('🚀 Starting news collection and sentiment analysis...');

  try {
    // 1. Process any pending articles first
    log('🔄 Checking for unprocessed articles...');
    await processPendingArticles();

    // 2. Fetch new articles
    log('📰 Fetching latest news...');
    await fetchAndProcessNews();

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log(`❌ Error in collector: ${errorMessage}`);
  } finally {
    // Schedule next run
    log(`⏳ Next collection in ${COLLECTION_INTERVAL / 60000} minutes`);
    setTimeout(runCollector, COLLECTION_INTERVAL);
  }
}

// Handle process termination
process.on('SIGINT', () => {
  log('\n👋 Shutting down gracefully...');
  process.exit(0);
});

// Start the collector
runCollector();
