import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

async function checkDatabase() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error('❌ Missing Supabase environment variables');
    return;
  }

  console.log('🔍 Connecting to Supabase...');
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: { persistSession: false }
    }
  );

  // Check connection by querying a known table
  console.log('\n🔌 Testing database connection...');
  const { data: testData, error: testError } = await supabase
    .from('sources')
    .select('*')
    .limit(1);

  if (testError) {
    console.error('❌ Database connection failed:', testError);
    return;
  }
  console.log('✅ Successfully connected to database');

  // List of tables to check
  const tables = [
    'sources',
    'articles',
    'sentiment_scores',
    'sentiment_trends',
    'article_keywords',
    'keywords',
    'social_media_reactions',
    'collection_runs'
  ];

  // Check each table
  for (const table of tables) {
    console.log(`\n📊 Table: ${table}`);
    
    // Get row count
    const { count, error: countError } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.log(`  ❌ Error: ${countError.message}`);
      continue;
    }

    console.log(`  📋 Rows: ${count || 0}`);
    
    // Get sample data if table is not empty
    if (count && count > 0) {
      const { data: sample, error: sampleError } = await supabase
        .from(table)
        .select('*')
        .limit(1);
      
      if (!sampleError && sample && sample.length > 0) {
        console.log('  🖥️  Sample row:');
        // Format the sample data for better readability
        const sampleData = sample[0];
        Object.entries(sampleData).forEach(([key, value]) => {
          const val = typeof value === 'string' && value.length > 50 
            ? `${value.substring(0, 50)}...` 
            : value;
          console.log(`    ${key}: ${JSON.stringify(val)}`);
        });
      }
    }
  }

  // Check latest collection run
  console.log('\n🔄 Latest Collection Run');
  const { data: latestRun, error: runError } = await supabase
    .from('collection_runs')
    .select('*')
    .order('start_time', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (runError || !latestRun) {
    console.log('  No collection runs found');
  } else {
    console.log('  Last run:', new Date(latestRun.start_time).toLocaleString());
    console.log('  Status:', latestRun.status);
    console.log('  Articles collected:', latestRun.articles_collected || 0);
    if (latestRun.error_message) {
      console.log('  Error:', latestRun.error_message);
    }
  }
}

// Run the check
checkDatabase()
  .then(() => console.log('\n✅ Database check complete'))
  .catch((error) => console.error('\n❌ Error during database check:', error));
