
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const dotenv = require('dotenv');

// Load env vars
const envPath = path.join(__dirname, '../.env');
const envLocalPath = path.join(__dirname, '../.env.local');
dotenv.config({ path: envPath });
dotenv.config({ path: envLocalPath });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function inspectSources() {
    console.log('Inspecting sources table...');
    const { data, error } = await supabase.from('sources').select('*').limit(1);
    if (data && data.length > 0) {
        console.log('Columns:', Object.keys(data[0]));
        console.log('Sample:', data[0]);
    } else {
        console.log('Empty or error:', error);
    }
}

inspectSources();
