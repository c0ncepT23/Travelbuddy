-- Add User Notes to Saved Items
-- Migration: 010_add_user_notes
-- Date: 2025-11-28

-- Add user_notes column to saved_items table
ALTER TABLE saved_items ADD COLUMN IF NOT EXISTS user_notes TEXT;

-- Add comment for documentation
COMMENT ON COLUMN saved_items.user_notes IS 'Personal notes added by the user about this place';

