const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Create Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function removeDuplicateArticles() {
  try {
    console.log('Finding duplicate articles...');
    
    // Find duplicates based on url or headline
    const { data: duplicates, error: findError } = await supabase
      .from('articles')
      .select('url, headline, count')
      .group('url, headline')
      .having('count > 1');
    
    if (findError) {
      console.error('Error finding duplicates:', findError);
      return;
    }
    
    if (!duplicates || duplicates.length === 0) {
      console.log('No duplicate articles found');
      return;
    }
    
    console.log(`Found ${duplicates.length} groups of duplicates`);
    
    // For each duplicate group, keep the newest one and delete the rest
    for (const duplicate of duplicates) {
      const { data: articles, error: fetchError } = await supabase
        .from('articles')
        .select('*')
        .or(`url.eq.${duplicate.url},headline.eq.${duplicate.headline}`)
        .order('published_at', { ascending: false });
      
      if (fetchError) {
        console.error('Error fetching duplicate group:', fetchError);
        continue;
      }
      
      if (articles && articles.length > 1) {
        // Keep the first (newest) article, delete the rest
        const toDelete = articles.slice(1);
        const idsToDelete = toDelete.map(a => a.id);
        
        console.log(`Deleting ${idsToDelete.length} duplicates for: ${articles[0].headline.substring(0, 50)}...`);
        
        // First delete sentiment scores for these articles
        await supabase
          .from('sentiment_scores')
          .delete()
          .in('article_id', idsToDelete);
        
        // Then delete the articles
        const { error: deleteError } = await supabase
          .from('articles')
          .delete()
          .in('id', idsToDelete);
        
        if (deleteError) {
          console.error('Error deleting duplicates:', deleteError);
        } else {
          console.log(`Successfully deleted ${idsToDelete.length} duplicates`);
        }
      }
    }
    
    // Get final count
    const { count: finalCount } = await supabase
      .from('articles')
      .select('*', { count: 'exact', head: true });
    
    console.log(`Final article count: ${finalCount}`);
    
  } catch (err) {
    console.error('Error removing duplicates:', err);
  }
}

// Alternative approach using SQL
async function removeDuplicatesWithSQL() {
  try {
    console.log('Removing duplicates using SQL...');
    
    // This SQL will keep the article with the most recent published_at for each url/headline combination
    const { error } = await supabase.rpc('remove_duplicate_articles');
    
    if (error) {
      console.error('Error removing duplicates with SQL:', error);
    } else {
      console.log('Successfully removed duplicates');
    }
    
    // Get final count
    const { count: finalCount } = await supabase
      .from('articles')
      .select('*', { count: 'exact', head: true });
    
    console.log(`Final article count: ${finalCount}`);
    
  } catch (err) {
    console.error('Error removing duplicates:', err);
  }
}

// Run the duplicate removal
removeDuplicateArticles().then(() => {
  console.log('Duplicate removal completed');
});
