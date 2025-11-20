
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const dotenv = require('dotenv');

// Load env vars - try absolute paths and check if they exist
const envPath = path.join(__dirname, '../.env');
const envLocalPath = path.join(__dirname, '../.env.local');

console.log('Loading env from:', envPath);
dotenv.config({ path: envPath });
console.log('Loading env from:', envLocalPath);
dotenv.config({ path: envLocalPath });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectTable() {
    console.log('Inspecting articles table...');

    // Fetch one row to see the structure
    const { data, error } = await supabase
        .from('articles')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error fetching articles:', error);
        return;
    }

    if (data && data.length > 0) {
        console.log('Columns:', Object.keys(data[0]));
    } else {
        console.log('Table is empty or no access.');
    }
}

inspectTable();
