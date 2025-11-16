const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Create Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkSentimentStatus() {
  try {
    console.log('Checking sentiment analysis status...\n');
    
    // Get total articles
    const { count: totalArticles } = await supabase
      .from('articles')
      .select('*', { count: 'exact', head: true });
    
    console.log(`Total articles in database: ${totalArticles}`);
    
    // Get articles with sentiment scores
    const { count: articlesWithSentiment } = await supabase
      .from('articles')
      .select('*', { count: 'exact', head: true })
      .not('sentiment_scores', 'is', null);
    
    console.log(`Articles with sentiment analysis: ${articlesWithSentiment}`);
    console.log(`Articles without sentiment: ${totalArticles - articlesWithSentiment}\n`);
    
    // Get sentiment breakdown
    const { data: sentimentScores } = await supabase
      .from('sentiment_scores')
      .select('final_score');
    
    if (sentimentScores) {
      const positive = sentimentScores.filter(s => s.final_score > 0.2).length;
      const negative = sentimentScores.filter(s => s.final_score < -0.2).length;
      const neutral = sentimentScores.filter(s => s.final_score >= -0.2 && s.final_score <= 0.2).length;
      
      console.log('Sentiment breakdown (based on final_score):');
      console.log(`  Positive (>0.2): ${positive} (${Math.round(positive / sentimentScores.length * 100)}%)`);
      console.log(`  Negative (<-0.2): ${negative} (${Math.round(negative / sentimentScores.length * 100)}%)`);
      console.log(`  Neutral (-0.2 to 0.2): ${neutral} (${Math.round(neutral / sentimentScores.length * 100)}%)`);
    }
    
    // Check recent articles without sentiment
    const { data: recentWithoutSentiment } = await supabase
      .from('articles')
      .select('id, headline, published_at')
      .is('sentiment_scores', 'null')
      .order('published_at', { ascending: false })
      .limit(5);
    
    if (recentWithoutSentiment && recentWithoutSentiment.length > 0) {
      console.log('\nRecent articles without sentiment analysis:');
      recentWithoutSentiment.forEach(article => {
        console.log(`  - ${article.headline.substring(0, 50)}... (${new Date(article.published_at).toLocaleDateString()})`);
      });
    }
    
    // Get sample of sentiment scores with final_score
    const { data: sampleScores } = await supabase
      .from('sentiment_scores')
      .select('sentiment, final_score, vader_compound, transformer_score')
      .limit(10);
    
    if (sampleScores) {
      console.log('\nSample sentiment scores:');
      sampleScores.forEach(score => {
        console.log(`  ${score.sentiment || 'NULL'}: final=${score.final_score?.toFixed(3) || 'NULL'}, vader=${score.vader_compound?.toFixed(3) || 'NULL'}, transformer=${score.transformer_score?.toFixed(3) || 'NULL'}`);
      });
    }
    
  } catch (err) {
    console.error('Error checking sentiment status:', err);
  }
}

checkSentimentStatus();
