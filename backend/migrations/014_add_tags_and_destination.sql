-- Migration 014: Add tags (subcategories) and destination-level organization
-- This enables:
-- 1. Smart sub-clustering within categories (e.g., "ramen", "wagyu", "cheesecake" within food)
-- 2. Auto-destination detection (places saved directly without explicit trip creation)

-- Add tags field for sub-categorization
ALTER TABLE saved_items 
ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb;

-- Add destination field for auto-grouping
-- This is separate from location_name (which is specific address)
-- destination = "Tokyo, Japan" or "Japan" (broader)
ALTER TABLE saved_items 
ADD COLUMN IF NOT EXISTS destination VARCHAR(255);

-- Add destination_country for country-level grouping
ALTER TABLE saved_items 
ADD COLUMN IF NOT EXISTS destination_country VARCHAR(255);

-- Add primary_tag for smart sub-clustering (e.g., "ramen", "wagyu", "cheesecake")
ALTER TABLE saved_items 
ADD COLUMN IF NOT EXISTS primary_tag VARCHAR(255);

-- Add primary_tag_group for tag categorization (e.g., "cuisine", "landmark_type")
ALTER TABLE saved_items 
ADD COLUMN IF NOT EXISTS primary_tag_group VARCHAR(255);

-- Add primary_tag_confidence for ranking
ALTER TABLE saved_items 
ADD COLUMN IF NOT EXISTS primary_tag_confidence DECIMAL(5, 4) DEFAULT 0;

-- Add cuisine_type specifically for food items (e.g., "ramen", "sushi", "wagyu")
ALTER TABLE saved_items 
ADD COLUMN IF NOT EXISTS cuisine_type VARCHAR(100);

-- Add place_type for non-food items (e.g., "temple", "shrine", "viewpoint", "market")
ALTER TABLE saved_items 
ADD COLUMN IF NOT EXISTS place_type VARCHAR(100);

-- Add index for tag searching (GIN index for JSONB)
CREATE INDEX IF NOT EXISTS idx_saved_items_tags ON saved_items USING GIN (tags);

-- Add index for destination-based queries
CREATE INDEX IF NOT EXISTS idx_saved_items_destination ON saved_items(destination);

-- Add index for cuisine type filtering
CREATE INDEX IF NOT EXISTS idx_saved_items_cuisine_type ON saved_items(cuisine_type);

-- Add index for place type filtering
CREATE INDEX IF NOT EXISTS idx_saved_items_place_type ON saved_items(place_type);

-- Add index for primary_tag filtering
CREATE INDEX IF NOT EXISTS idx_saved_items_primary_tag ON saved_items(primary_tag);

-- Add index for primary_tag_group filtering
CREATE INDEX IF NOT EXISTS idx_saved_items_primary_tag_group ON saved_items(primary_tag_group);

-- Add index for destination_country filtering
CREATE INDEX IF NOT EXISTS idx_saved_items_destination_country ON saved_items(destination_country);

-- Create a destinations table for auto-created destinations
-- This replaces the need for explicit "trip creation"
CREATE TABLE IF NOT EXISTS destinations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,  -- e.g., "Japan", "Tokyo", "Paris"
    country VARCHAR(100),
    country_code VARCHAR(3),  -- ISO country code
    cover_image_url TEXT,
    total_places INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_destinations_user ON destinations(user_id);
CREATE INDEX IF NOT EXISTS idx_destinations_country ON destinations(country);

-- Link saved_items to destinations (optional - for direct saves without trips)
ALTER TABLE saved_items 
ADD COLUMN IF NOT EXISTS destination_id UUID REFERENCES destinations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_saved_items_destination_id ON saved_items(destination_id);

-- Trigger to update destinations.total_places count
CREATE OR REPLACE FUNCTION update_destination_place_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE destinations SET total_places = total_places + 1 WHERE id = NEW.destination_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE destinations SET total_places = total_places - 1 WHERE id = OLD.destination_id;
    ELSIF TG_OP = 'UPDATE' AND OLD.destination_id IS DISTINCT FROM NEW.destination_id THEN
        IF OLD.destination_id IS NOT NULL THEN
            UPDATE destinations SET total_places = total_places - 1 WHERE id = OLD.destination_id;
        END IF;
        IF NEW.destination_id IS NOT NULL THEN
            UPDATE destinations SET total_places = total_places + 1 WHERE id = NEW.destination_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_destination_count ON saved_items;
CREATE TRIGGER trigger_update_destination_count
AFTER INSERT OR UPDATE OR DELETE ON saved_items
FOR EACH ROW EXECUTE FUNCTION update_destination_place_count();

-- Update trigger for updated_at
DROP TRIGGER IF EXISTS update_destinations_updated_at ON destinations;
CREATE TRIGGER update_destinations_updated_at BEFORE UPDATE ON destinations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

