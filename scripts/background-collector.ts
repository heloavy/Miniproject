// scripts/background-collector.ts
import { createClient } from '@supabase/supabase-js';
import { NewsAPIFetcher } from '../src/services/data-collection/fetchers/NewsAPIFetcher';
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
const fetcher = new NewsAPIFetcher(process.env.NEWS_API_KEY!, supabase);

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
    const articles = await fetcher.fetchNews({ 
      q: 'technology OR finance OR business', 
      pageSize: 20 
    });
    
    log(`📥 Fetched ${articles.length} new articles`);
    
    // Process articles in batches
    for (let i = 0; i < articles.length; i += BATCH_SIZE) {
      const batch = articles.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(article => processArticle(article)));
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log(`❌ Error fetching news: ${errorMessage}`);
  }
}

async function processArticle(article: any) {
  try {
    // Check if article exists
    const { data: existing } = await supabase
      .from('articles')
      .select('id, sentiment_score')
      .eq('url', article.url)
      .single();

    if (existing) {
      // Check if article has sentiment analysis
      const { data: sentimentScore, error: sentimentError } = await supabase
        .from('sentiment_scores')
        .select('article_id')
        .eq('article_id', existing.id)
        .single();
      
      if (sentimentError || !sentimentScore) {
        // No sentiment analysis exists, analyze it
        await sentimentService.analyzeArticle(existing);
      }
      return;
    }

    // Insert new article
    // First, get or create the source
    const sourceName = article.source?.name || 'unknown';
    let { data: source, error: sourceError } = await supabase
      .from('sources')
      .select('id')
      .eq('name', sourceName)
      .single();
    
    if (sourceError || !source) {
      // Create the source if it doesn't exist
      const { data: newSource, error: createError } = await supabase
        .from('sources')
        .insert([{
          source_id: sourceName.toLowerCase().replace(/\s+/g, '-'),
          name: sourceName,
          category: 'general'
        }])
        .select()
        .single();
      
      if (createError) throw createError;
      source = newSource;
    }
    
    const { data: newArticle, error } = await supabase
      .from('articles')
      .insert([{
        headline: article.title,
        summary: article.description,
        content: article.content,
        url: article.url,
        published_at: article.publishedAt || new Date().toISOString(),
        author: article.author || article.source?.name || 'unknown',
        image_url: article.urlToImage,
        external_id: article.url, // Using URL as external_id for uniqueness
        source_id: source.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw error;
    
    // Analyze sentiment for new article
    if (newArticle) {
      await sentimentService.analyzeArticle(newArticle);
      log(`✅ Processed: ${article.title.substring(0, 60)}...`);
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log(`❌ Error processing article: ${errorMessage}`);
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
      // Update if no sentiment analysis yet
      if (existing.sentiment_score === null) {
        await sentimentService.analyzeArticle(existing);
      }
      return;
    }

    // Insert new article
    // First, get or create the source
    const sourceName = article.source?.name || 'unknown';
    let { data: source, error: sourceError } = await supabase
      .from('sources')
      .select('id')
      .eq('name', sourceName)
      .single();
    
    if (sourceError || !source) {
      // Create the source if it doesn't exist
      const { data: newSource, error: createError } = await supabase
        .from('sources')
        .insert([{
          source_id: sourceName.toLowerCase().replace(/\s+/g, '-'),
          name: sourceName,
          category: 'general'
        }])
        .select()
        .single();
      
      if (createError) throw createError;
      source = newSource;
    }
    
    const { data: newArticle, error } = await supabase
      .from('articles')
      .insert([{
        headline: article.title,
        summary: article.description,
        content: article.content,
        url: article.url,
        published_at: article.publishedAt || new Date().toISOString(),
        author: article.author || article.source?.name || 'unknown',
        image_url: article.urlToImage,
        external_id: article.url, // Using URL as external_id for uniqueness
        source_id: source.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw error;
    
    // Analyze sentiment for new article
    await sentimentService.analyzeArticle(newArticle);
    console.log(`✅ Processed: ${article.title.substring(0, 60)}...`);
    
  } catch (error) {
    console.error('Error processing article:', error);
  }
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down gracefully...');
  process.exit(0);
});

// Start the collector
console.log('🚀 Starting news sentiment collector...');
runCollector();