-- Add favorites and must-visit columns to saved_items table
-- Sprint 1: Quick Wins - Favorites/Must-visit feature

ALTER TABLE saved_items ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT FALSE;
ALTER TABLE saved_items ADD COLUMN IF NOT EXISTS is_must_visit BOOLEAN DEFAULT FALSE;

-- Add index for faster filtering
CREATE INDEX IF NOT EXISTS idx_saved_items_is_favorite ON saved_items(is_favorite) WHERE is_favorite = TRUE;
CREATE INDEX IF NOT EXISTS idx_saved_items_is_must_visit ON saved_items(is_must_visit) WHERE is_must_visit = TRUE;

-- Add comment for documentation
COMMENT ON COLUMN saved_items.is_favorite IS 'User marked this place as a favorite';
COMMENT ON COLUMN saved_items.is_must_visit IS 'User marked this place as must-visit priority';

