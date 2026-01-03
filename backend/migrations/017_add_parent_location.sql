-- Add parent_location to saved_items and video_cache
ALTER TABLE saved_items ADD COLUMN IF NOT EXISTS parent_location TEXT;

-- Update video_cache to include parent_location in its places_json storage if needed
-- (The JSONB column places_json will naturally store it, but we should update the cache metadata)
ALTER TABLE video_cache ADD COLUMN IF NOT EXISTS parent_location TEXT;

