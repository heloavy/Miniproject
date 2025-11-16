import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

async function inspectTable() {
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
    // Get table columns from information_schema
    const { data: columns, error } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable')
      .eq('table_name', 'articles');

    if (error) {
      console.error('❌ Error fetching table schema:', error);
      return;
    }

    console.log('\n📋 Articles Table Schema:');
    console.table(columns);

    // Check if required columns exist
    const requiredColumns = ['title', 'description', 'content', 'url', 'published_at'];
    const missingColumns = requiredColumns.filter(
      col => !columns?.some(c => c.column_name === col)
    );

    if (missingColumns.length > 0) {
      console.log('\n❌ Missing required columns:', missingColumns.join(', '));
    } else {
      console.log('\n✅ All required columns exist');
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

inspectTable()
  .then(() => console.log('\n🏁 Inspection complete'))
  .catch(console.error);
