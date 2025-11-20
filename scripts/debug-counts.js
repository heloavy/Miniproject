
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

// Debug: Print keys (masked)
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('URL:', url ? 'Found' : 'Missing');
console.log('Service Key:', key ? 'Found' : 'Missing');
console.log('Anon Key:', anon ? 'Found' : 'Missing');

// Fallback to Anon key if Service key is missing (though RPC might need service key depending on RLS)
// But for counting, Anon might work if RLS allows.
const supabaseUrl = url;
const supabaseKey = key || anon;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCounts() {
    console.log('Checking database counts...');

    // 1. Total Articles
    const { count: totalArticles, error: err1 } = await supabase
        .from('articles')
        .select('*', { count: 'exact', head: true });

    if (err1) console.error('Error counting articles:', err1);
    else console.log('Total Articles in DB:', totalArticles);

    // 2. Articles with Sentiment Scores (Inner Join equivalent)
    // We can count rows in sentiment_scores
    const { count: totalScores, error: err2 } = await supabase
        .from('sentiment_scores')
        .select('*', { count: 'exact', head: true });

    if (err2) console.error('Error counting scores:', err2);
    else console.log('Total Sentiment Scores:', totalScores);

    // 3. Articles in last 7 days
    const date7d = new Date();
    date7d.setDate(date7d.getDate() - 7);

    const { count: recentArticles, error: err3 } = await supabase
        .from('articles')
        .select('*', { count: 'exact', head: true })
        .gte('published_at', date7d.toISOString());

    if (err3) console.error('Error counting recent articles:', err3);
    else console.log('Articles in last 7 days:', recentArticles);

    // 4. RPC Stats
    const { data: rpcStats, error: rpcError } = await supabase.rpc('get_sentiment_stats', {
        date_range_start: date7d.toISOString(),
        source_filter: null,
        search_term: null,
    });

    if (rpcError) console.error('RPC Error:', rpcError);
    else {
        console.log('RPC Stats (Last 7 Days):');
        console.log(rpcStats);
    }

    // Check RPC without date filter
    const { data: rpcStatsAll, error: rpcErrorAll } = await supabase.rpc('get_sentiment_stats', {
        date_range_start: null,
        source_filter: null,
        search_term: null,
    });

    if (rpcErrorAll) console.error('RPC Error (All Time):', rpcErrorAll);
    else {
        console.log('RPC Stats (All Time):');
        console.log(rpcStatsAll);
    }
}

checkCounts();
