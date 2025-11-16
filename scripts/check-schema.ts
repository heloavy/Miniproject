import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

async function checkSchema() {
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

  try {
    // Try to get a single row from the articles table to see its structure
    console.log('\n📋 Checking articles table structure...');
    const { data: sampleArticle, error: sampleError } = await supabase
      .from('articles')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (sampleError) {
      console.error('❌ Error fetching sample article:', sampleError);
      
      // If we can't fetch, try to get the table schema using a raw SQL query
      console.log('\n🔍 Trying to get table schema...');
      const { data: schema, error: schemaError } = await supabase.rpc('get_table_schema', { 
        table_name: 'articles' 
      }).single();

      if (schemaError) {
        console.error('❌ Error getting table schema:', schemaError);
        console.log('\n💡 Try running this SQL in your Supabase SQL editor:');
        console.log(`
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_name = 'articles';
        `);
        return;
      }

      console.log('\n📋 Table Schema:', schema);
      return;
    }

    if (!sampleArticle) {
      console.log('No articles found in the table');
      
      // Try to get the table structure from information_schema using a direct query
      console.log('\n🔍 Checking table columns...');
      const { data: columns, error: columnsError } = await supabase
        .from('pg_catalog.pg_attribute')
        .select('attname as column_name, format_type(atttypid, atttypmod) as data_type, attnotnull as not_null')
        .eq('attrelid', 'articles'::regclass)
        .eq('attnum', 0, { referencedTable: 'pg_catalog.pg_attribute' });

      if (columnsError) {
        console.error('❌ Error getting columns:', columnsError);
        return;
      }

      console.log('\n📋 Table Columns:');
      console.table(columns || []);
      return;
    }

    // If we got here, we have a sample article
    console.log('\n📋 Sample Article Structure:');
    console.log(Object.keys(sampleArticle).map(key => ({
      column: key,
      type: typeof sampleArticle[key],
      value: sampleArticle[key] !== null ? String(sampleArticle[key]).substring(0, 50) + '...' : 'null'
    })));

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

checkSchema()
  .then(() => console.log('\n🏁 Schema check complete'))
  .catch(console.error);
