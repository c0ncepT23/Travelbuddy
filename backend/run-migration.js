// Quick script to run a SQL migration file
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  const migrationFile = process.argv[2] || 'migrations/009_add_day_planner.sql';
  const filePath = path.join(__dirname, migrationFile);
  
  console.log(`📦 Running migration: ${migrationFile}`);
  
  try {
    const sql = fs.readFileSync(filePath, 'utf8');
    console.log('\n📄 SQL to execute:');
    console.log(sql);
    console.log('\n⏳ Executing...\n');
    
    await pool.query(sql);
    
    console.log('✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();

