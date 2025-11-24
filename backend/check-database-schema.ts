import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function checkSchema() {
  try {
    console.log('🔍 Checking saved_items table schema...\n');

    // Check if new columns exist
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'saved_items' 
      AND column_name IN (
        'google_place_id', 'rating', 'user_ratings_total', 
        'price_level', 'formatted_address', 'area_name', 
        'photos_json', 'opening_hours_json'
      )
      ORDER BY column_name;
    `);

    console.log('✅ New Google Places columns:');
    console.log('──────────────────────────────────');
    result.rows.forEach(row => {
      console.log(`  ${row.column_name.padEnd(25)} ${row.data_type.padEnd(20)} ${row.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });
    console.log('');

    if (result.rows.length === 0) {
      console.log('❌ NO COLUMNS FOUND! Migration not applied!');
      console.log('');
      console.log('Run this SQL in Supabase dashboard:');
      console.log('──────────────────────────────────');
      console.log(`
ALTER TABLE saved_items
ADD COLUMN IF NOT EXISTS google_place_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS rating DECIMAL(3, 1),
ADD COLUMN IF NOT EXISTS user_ratings_total INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS price_level INTEGER,
ADD COLUMN IF NOT EXISTS formatted_address TEXT,
ADD COLUMN IF NOT EXISTS area_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS photos_json JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS opening_hours_json JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_saved_items_area_name ON saved_items(area_name);
CREATE INDEX IF NOT EXISTS idx_saved_items_google_place_id ON saved_items(google_place_id);
      `);
    } else {
      console.log(`✅ Found ${result.rows.length}/8 columns - Migration applied!`);
    }

    // Check if any existing items have enriched data
    const dataCheck = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(google_place_id) as has_google_id,
        COUNT(rating) as has_rating,
        COUNT(area_name) as has_area
      FROM saved_items;
    `);

    console.log('📊 Data enrichment status:');
    console.log('──────────────────────────────────');
    console.log(`  Total places: ${dataCheck.rows[0].total}`);
    console.log(`  With Google Place ID: ${dataCheck.rows[0].has_google_id}`);
    console.log(`  With rating: ${dataCheck.rows[0].has_rating}`);
    console.log(`  With area name: ${dataCheck.rows[0].has_area}`);
    console.log('');

    await pool.end();
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

checkSchema();

