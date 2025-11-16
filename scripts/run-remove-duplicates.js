const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

// Create Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function runDuplicateRemoval() {
  try {
    console.log('Running duplicate removal...');
    
    // Read the SQL file
    const sqlPath = path.join(__dirname, 'remove-duplicates.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Split SQL into individual statements
    const statements = sql.split(';').filter(s => s.trim());
    
    for (const statement of statements) {
      if (statement.trim()) {
        // Try to execute via RPC first
        const { error } = await supabase.rpc('exec_sql', { sql_query: statement });
        
        if (error) {
          console.log('RPC failed for statement, trying direct execution...');
          console.log('Statement:', statement.substring(0, 100) + '...');
          
          // For CREATE FUNCTION, we need a different approach
          if (statement.includes('CREATE OR REPLACE FUNCTION')) {
            // This won't work with the JS client, need to use SQL editor or direct connection
            console.log('Please run the SQL manually in Supabase SQL Editor:');
            console.log(statement);
          }
        } else {
          console.log('Statement executed successfully');
        }
      }
    }
    
    // Get final counts
    const { count: articleCount } = await supabase
      .from('articles')
      .select('*', { count: 'exact', head: true });
    
    const { count: sentimentCount } = await supabase
      .from('sentiment_scores')
      .select('*', { count: 'exact', head: true });
    
    console.log(`\nFinal counts:`);
    console.log(`Articles: ${articleCount}`);
    console.log(`Sentiment scores: ${sentimentCount}`);
    
  } catch (err) {
    console.error('Error running duplicate removal:', err);
  }
}

runDuplicateRemoval();
