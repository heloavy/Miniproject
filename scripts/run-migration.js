
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { Client } = require('pg');

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  // process.exit(1); // Don't exit yet, maybe we have DATABASE_URL
}

async function runMigration() {
  const migrationPath = path.join(__dirname, '../db/migrations/20241120000000_add_get_sentiment_stats.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  console.log('Running migration...');

  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL not found in env.");
    process.exit(1);
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    await client.query(sql);
    console.log('Migration executed successfully.');
  } catch (err) {
    console.error('Error running migration:', err);
  } finally {
    await client.end();
  }
}

runMigration();
