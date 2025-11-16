const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkArticles() {
  console.log('Checking articles table structure...\n');
  
  // Get a sample of articles
  const { data: articles, error } = await supabase
    .from('articles')
    .select('id, headline, url, external_id')
    .limit(5);
  
  if (error) {
    console.error('Error fetching articles:', error);
    return;
  }
  
  console.log('Sample articles:');
  articles.forEach(article => {
    console.log(`  ID: ${article.id}`);
    console.log(`  Headline: ${article.headline?.substring(0, 50)}...`);
    console.log(`  URL: ${article.url}`);
    console.log(`  External ID: ${article.external_id}`);
    console.log('---');
  });
  
  // Check sentiment scores
  console.log('\nChecking sentiment_scores table...\n');
  const { data: scores, error: scoreError } = await supabase
    .from('sentiment_scores')
    .select('article_id, final_score')
    .limit(5);
  
  if (scoreError) {
    console.error('Error fetching sentiment scores:', scoreError);
    return;
  }
  
  console.log('Sample sentiment scores:');
  scores.forEach(score => {
    console.log(`  Article ID: ${score.article_id} (type: ${typeof score.article_id})`);
    console.log(`  Final Score: ${score.final_score}`);
    console.log('---');
  });
}

checkArticles().catch(console.error);
