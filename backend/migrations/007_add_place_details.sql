-- Add Google Places details columns to saved_items
ALTER TABLE saved_items
ADD COLUMN IF NOT EXISTS google_place_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS rating DECIMAL(3, 1),
ADD COLUMN IF NOT EXISTS user_ratings_total INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS price_level INTEGER,
ADD COLUMN IF NOT EXISTS formatted_address TEXT,
ADD COLUMN IF NOT EXISTS area_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS photos_json JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS opening_hours_json JSONB DEFAULT '{}'::jsonb;

-- Create index for area lookups
CREATE INDEX IF NOT EXISTS idx_saved_items_area_name ON saved_items(area_name);
CREATE INDEX IF NOT EXISTS idx_saved_items_google_place_id ON saved_items(google_place_id);

