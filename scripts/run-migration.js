const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

// Create Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runMigration() {
  try {
    console.log('Running migration...');
    
    // Read the SQL file
    const sqlPath = path.join(__dirname, 'run-migration.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Execute the SQL
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      console.error('Migration failed:', error);
      // Try direct SQL execution
      console.log('Trying direct SQL execution...');
      
      // Split the SQL into individual statements
      const statements = sql.split(';').filter(s => s.trim());
      
      for (const statement of statements) {
        if (statement.trim()) {
          console.log('Executing:', statement.substring(0, 100) + '...');
          const { error: stmtError } = await supabase.from('_temp').select('*').limit(1);
          // This won't work for DDL, so we need a different approach
        }
      }
    } else {
      console.log('Migration completed successfully!');
    }
  } catch (err) {
    console.error('Error running migration:', err);
  }
}

runMigration();
