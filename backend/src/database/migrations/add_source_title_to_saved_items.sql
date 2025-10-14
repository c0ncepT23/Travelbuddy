-- Add source_title column to saved_items table for better UX display
ALTER TABLE saved_items
ADD COLUMN IF NOT EXISTS source_title TEXT;

COMMENT ON COLUMN saved_items.source_title IS 'User-friendly name of the source (e.g., YouTube video title, Reddit post title)';

