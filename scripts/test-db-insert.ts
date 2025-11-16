import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

async function testDbInsert() {
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

  // Test data
  const testArticle = {
    source_id: 1, // Using the existing NewsAPI source
    source_name: 'Test Source',
    author: 'Test Author',
    title: 'Test Article',
    description: 'This is a test article',
    url: 'https://example.com/test-article',
    url_to_image: 'https://via.placeholder.com/300',
    published_at: new Date().toISOString(),
    content: 'This is the content of the test article',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  try {
    console.log('\n📝 Inserting test article...');
    const { data, error } = await supabase
      .from('articles')
      .insert(testArticle)
      .select()
      .single();

    if (error) {
      console.error('❌ Error inserting article:', error);
      return;
    }

    console.log('✅ Successfully inserted test article:', data);

    // Verify the article was inserted
    console.log('\n🔍 Verifying article was inserted...');
    const { data: insertedArticle, error: fetchError } = await supabase
      .from('articles')
      .select('*')
      .eq('id', data.id)
      .single();

    if (fetchError) {
      console.error('❌ Error fetching inserted article:', fetchError);
      return;
    }

    console.log('✅ Found inserted article:', insertedArticle);

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

testDbInsert()
  .then(() => console.log('\n🏁 Test complete'))
  .catch(console.error);
