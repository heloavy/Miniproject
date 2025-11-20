
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
    const migrationPath = path.join(__dirname, '../db/migrations/20241120000000_add_get_sentiment_stats.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('Running migration...');

    // We use the pg driver directly or use a raw SQL execution if available.
    // Since supabase-js doesn't support raw SQL execution easily without an extension,
    // we will try to use the 'rpc' if there is a 'exec_sql' function, OR
    // we can try to use the 'pg' library if it's installed (it is in package.json).

    const { Client } = require('pg');
    const dbUrl = process.env.DATABASE_URL; // We need the connection string

    // If DATABASE_URL is not in .env, we might need to ask the user or try to construct it?
    // But wait, the user's .env usually has it.

    if (!process.env.DATABASE_URL) {
        console.log("DATABASE_URL not found in env, trying to use Supabase REST API to create function (this might fail if no exec_sql function exists).");
        // Fallback: This usually fails unless you have a specific setup.
        // But let's check if we can use the 'pg' client with a constructed URL if possible?
        // Actually, let's just try to assume the user has a way to run SQL.
        // Or, we can try to use the 'postgres' connection string if we can find it.
        console.error("Cannot run migration without DATABASE_URL.");
        return;
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
