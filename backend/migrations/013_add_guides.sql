-- Migration 013: Add Guides feature
-- Guides store YouTube/Instagram video metadata separately from places
-- Allows users to see places organized by source guide with day structure preserved

-- Guides table: Store guide metadata
CREATE TABLE IF NOT EXISTS guides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_group_id UUID NOT NULL REFERENCES trip_groups(id) ON DELETE CASCADE,
  
  -- Source info
  source_url VARCHAR(500) NOT NULL,
  source_type VARCHAR(50) DEFAULT 'youtube', -- youtube, instagram, reddit, tiktok, etc.
  
  -- Guide metadata (extracted from source)
  title VARCHAR(255),
  creator_name VARCHAR(100),
  creator_channel_id VARCHAR(100),
  thumbnail_url VARCHAR(500),
  
  -- Structure info
  has_day_structure BOOLEAN DEFAULT false, -- true if guide has Day 1, Day 2 breakdown
  total_days INTEGER DEFAULT 0, -- number of days in the guide (0 if no structure)
  total_places INTEGER DEFAULT 0, -- total places extracted from this guide
  
  -- Summary from AI
  summary TEXT,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  added_by UUID REFERENCES users(id),
  
  -- No duplicate guides per trip (same URL)
  UNIQUE(trip_group_id, source_url)
);

-- Junction table: Links saved_items to guides with day info
-- A place can appear in multiple guides, each with different day numbers
CREATE TABLE IF NOT EXISTS guide_places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guide_id UUID NOT NULL REFERENCES guides(id) ON DELETE CASCADE,
  saved_item_id UUID NOT NULL REFERENCES saved_items(id) ON DELETE CASCADE,
  
  -- Position in guide's structure
  guide_day_number INTEGER, -- Which day in the GUIDE (1, 2, 3...) - NULL if guide has no day structure
  order_in_day INTEGER DEFAULT 0, -- Order within that day (for display order)
  
  -- Optional notes specific to this guide's mention of the place
  guide_notes TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- A place appears only once per guide
  UNIQUE(guide_id, saved_item_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_guides_trip ON guides(trip_group_id);
CREATE INDEX IF NOT EXISTS idx_guides_source_type ON guides(source_type);
CREATE INDEX IF NOT EXISTS idx_guides_created ON guides(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_guide_places_guide ON guide_places(guide_id);
CREATE INDEX IF NOT EXISTS idx_guide_places_item ON guide_places(saved_item_id);
CREATE INDEX IF NOT EXISTS idx_guide_places_day ON guide_places(guide_id, guide_day_number);

-- Comments for documentation
COMMENT ON TABLE guides IS 'Stores metadata for imported travel guides (YouTube videos, etc.)';
COMMENT ON TABLE guide_places IS 'Links saved places to guides with day structure preserved';
COMMENT ON COLUMN guides.has_day_structure IS 'True if guide has Day 1, Day 2 breakdown';
COMMENT ON COLUMN guide_places.guide_day_number IS 'Day number in the guide structure (not users plan)';

