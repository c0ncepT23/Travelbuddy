-- Add location confidence scoring columns to saved_items table
-- Migration: 004_add_location_confidence
-- Date: 2025-10-26

ALTER TABLE saved_items
ADD COLUMN IF NOT EXISTS location_confidence VARCHAR(10) DEFAULT 'low',
ADD COLUMN IF NOT EXISTS location_confidence_score INTEGER DEFAULT 0;

-- Add check constraint for confidence level
ALTER TABLE saved_items
ADD CONSTRAINT check_confidence_level 
CHECK (location_confidence IN ('high', 'medium', 'low'));

-- Add check constraint for confidence score (0-100)
ALTER TABLE saved_items
ADD CONSTRAINT check_confidence_score
CHECK (location_confidence_score >= 0 AND location_confidence_score <= 100);

-- Create index for querying by confidence
CREATE INDEX IF NOT EXISTS idx_saved_items_confidence 
ON saved_items(location_confidence);

COMMENT ON COLUMN saved_items.location_confidence IS 'Geocoding confidence level: high (exact match), medium (approximate), low (uncertain)';
COMMENT ON COLUMN saved_items.location_confidence_score IS 'Geocoding confidence score 0-100';

