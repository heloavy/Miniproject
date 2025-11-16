import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

import { NewsAPIFetcher } from '../src/services/data-collection/fetchers/NewsAPIFetcher';

async function testFetcher() {
  if (!process.env.NEWS_API_KEY) {
    console.error('Error: NEWS_API_KEY is not set in .env file');
    process.exit(1);
  }

  console.log('Testing NewsAPIFetcher...');
  
  const fetcher = new NewsAPIFetcher(process.env.NEWS_API_KEY);
  
  try {
    console.log('Fetching news...');
    // Fetch articles with sentiment analysis enabled
    const articles = await fetcher.fetchNews({ 
      pageSize: 5,  // Get 5 articles for better testing
      skipSentiment: false  // Enable sentiment analysis
    });
    
    console.log('\nResults:');
    console.log(`Fetched ${articles.length} articles`);
    
    articles.forEach((article, index) => {
      console.log(`\n--- Article ${index + 1} ---`);
      console.log(`Headline: ${article.headline}`);
      console.log(`Source: ${article.source}`);
      console.log(`Author: ${article.author || 'Unknown'}`);
      console.log(`Published: ${article.publishedAt}`);
      console.log(`URL: ${article.url}`);
      
      // If we have sentiment data, show it
      if (article.sentiment) {
        console.log('Sentiment Analysis:');
        if (article.sentiment.vaderScore !== undefined) {
          console.log(`  - VADER: ${(article.sentiment.vaderScore * 100).toFixed(1)}%`);
        }
        if (article.sentiment.transformerScore !== undefined) {
          console.log(`  - Transformer: ${(article.sentiment.transformerScore * 100).toFixed(1)}%`);
        }
        if (article.sentiment.fusedScore !== undefined) {
          console.log(`  - Final Score: ${(article.sentiment.fusedScore * 100).toFixed(1)}%`);
        }
        if (article.sentiment.analyzedAt) {
          console.log(`  - Analyzed At: ${article.sentiment.analyzedAt}`);
        }
      }
      if (article.imageUrl) {
        console.log(`Image: ${article.imageUrl}`);
      }
      console.log(`Content: ${article.content?.substring(0, 100)}${article.content && article.content.length > 100 ? '...' : ''}`);
    });
    
  } catch (error) {
    console.error('Error in testFetcher:', error);
  }
}

testFetcher().catch(console.error);
