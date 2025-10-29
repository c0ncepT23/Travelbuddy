-- Add Check-In System & Trip Stories
-- Migration: 005_add_checkins
-- Date: 2025-10-26

-- ============================================
-- CHECK-INS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trip_group_id UUID NOT NULL REFERENCES trip_groups(id) ON DELETE CASCADE,
  saved_item_id UUID NOT NULL REFERENCES saved_items(id) ON DELETE CASCADE,
  
  -- Check-in timestamps
  checked_in_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  checked_out_at TIMESTAMP WITH TIME ZONE,
  duration_minutes INTEGER GENERATED ALWAYS AS (
    CASE 
      WHEN checked_out_at IS NOT NULL 
      THEN EXTRACT(EPOCH FROM (checked_out_at - checked_in_at)) / 60
      ELSE NULL
    END
  ) STORED,
  
  -- User content
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  note TEXT,
  cost DECIMAL(10,2),
  currency VARCHAR(3) DEFAULT 'USD',
  photos JSONB DEFAULT '[]', -- Array of photo URLs
  
  -- Location data (in case it differs from saved_item)
  actual_location_lat DECIMAL(10, 8),
  actual_location_lng DECIMAL(11, 8),
  
  -- Additional metadata
  weather VARCHAR(50), -- "sunny", "rainy", "cloudy", etc.
  with_users JSONB DEFAULT '[]', -- Array of user IDs who were with them
  is_auto_checkin BOOLEAN DEFAULT false, -- Was it automatic or manual?
  
  -- Social/sharing
  is_visible BOOLEAN DEFAULT true, -- Can friends see this?
  shared_publicly BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for check_ins
CREATE INDEX idx_checkins_user ON check_ins(user_id);
CREATE INDEX idx_checkins_trip ON check_ins(trip_group_id);
CREATE INDEX idx_checkins_item ON check_ins(saved_item_id);
CREATE INDEX idx_checkins_time ON check_ins(checked_in_at);
CREATE INDEX idx_checkins_trip_time ON check_ins(trip_group_id, checked_in_at);

-- ============================================
-- TRIP STORIES TABLE (Shareable Links)
-- ============================================
CREATE TABLE IF NOT EXISTS trip_stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_group_id UUID NOT NULL REFERENCES trip_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Sharing configuration
  share_code VARCHAR(12) UNIQUE NOT NULL, -- Short code for URL: travelagent.app/trip/abc123
  slug VARCHAR(100) UNIQUE, -- Pretty URL: travelagent.app/trip/tokyo-sarah-2025
  is_public BOOLEAN DEFAULT false,
  
  -- Story content
  title VARCHAR(200),
  description TEXT,
  hero_image_url TEXT,
  cover_photos JSONB DEFAULT '[]', -- Array of cover photo URLs
  
  -- Customization
  theme_color VARCHAR(7) DEFAULT '#6366F1', -- Hex color for branding
  show_ratings BOOLEAN DEFAULT true,
  show_photos BOOLEAN DEFAULT true,
  show_costs BOOLEAN DEFAULT false,
  show_notes BOOLEAN DEFAULT true,
  show_companions BOOLEAN DEFAULT false,
  
  -- Stats & analytics
  views_count INTEGER DEFAULT 0,
  copies_count INTEGER DEFAULT 0, -- How many times "Copy Trip" was used
  shares_count INTEGER DEFAULT 0,
  last_viewed_at TIMESTAMP WITH TIME ZONE,
  
  -- Expiry
  expires_at TIMESTAMP WITH TIME ZONE, -- Optional expiry date
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for trip_stories
CREATE INDEX idx_stories_code ON trip_stories(share_code);
CREATE INDEX idx_stories_slug ON trip_stories(slug);
CREATE INDEX idx_stories_trip ON trip_stories(trip_group_id);
CREATE INDEX idx_stories_user ON trip_stories(user_id);
CREATE INDEX idx_stories_public ON trip_stories(is_public) WHERE is_public = true;

-- ============================================
-- TRIP FOLLOWERS TABLE (Social Features)
-- ============================================
CREATE TABLE IF NOT EXISTS trip_followers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_group_id UUID NOT NULL REFERENCES trip_groups(id) ON DELETE CASCADE,
  follower_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Notification preferences
  notify_on_checkin BOOLEAN DEFAULT true,
  notify_on_new_place BOOLEAN DEFAULT true,
  
  followed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(trip_group_id, follower_user_id)
);

-- Indexes for trip_followers
CREATE INDEX idx_followers_trip ON trip_followers(trip_group_id);
CREATE INDEX idx_followers_user ON trip_followers(follower_user_id);

-- ============================================
-- TRIP COPIES TABLE (Track "Copy Trip")
-- ============================================
CREATE TABLE IF NOT EXISTS trip_copies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_trip_id UUID NOT NULL REFERENCES trip_groups(id) ON DELETE CASCADE,
  new_trip_id UUID NOT NULL REFERENCES trip_groups(id) ON DELETE CASCADE,
  copied_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- What was copied
  items_copied INTEGER DEFAULT 0,
  include_notes BOOLEAN DEFAULT true,
  include_ratings BOOLEAN DEFAULT true,
  
  copied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for trip_copies
CREATE INDEX idx_copies_original ON trip_copies(original_trip_id);
CREATE INDEX idx_copies_new ON trip_copies(new_trip_id);
CREATE INDEX idx_copies_user ON trip_copies(copied_by_user_id);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to generate random share code
CREATE OR REPLACE FUNCTION generate_share_code(length INTEGER DEFAULT 8)
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'abcdefghijklmnopqrstuvwxyz0123456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..length LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::INTEGER, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_checkins_updated_at
  BEFORE UPDATE ON check_ins
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stories_updated_at
  BEFORE UPDATE ON trip_stories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- VIEWS FOR EASY QUERYING
-- ============================================

-- View: Trip timeline with all check-ins and place details
CREATE OR REPLACE VIEW trip_timeline AS
SELECT 
  ci.id as checkin_id,
  ci.trip_group_id,
  ci.user_id,
  ci.checked_in_at,
  ci.checked_out_at,
  ci.duration_minutes,
  ci.rating,
  ci.note,
  ci.cost,
  ci.currency,
  ci.photos,
  ci.weather,
  ci.with_users,
  ci.is_auto_checkin,
  si.id as place_id,
  si.name as place_name,
  si.category as place_category,
  si.description as place_description,
  si.location_name,
  si.location_lat,
  si.location_lng,
  si.location_confidence,
  u.email as username,
  u.email
FROM check_ins ci
JOIN saved_items si ON ci.saved_item_id = si.id
JOIN users u ON ci.user_id = u.id
ORDER BY ci.checked_in_at DESC;

-- View: Trip statistics
CREATE OR REPLACE VIEW trip_stats AS
SELECT 
  tg.id as trip_id,
  tg.name as trip_name,
  tg.destination,
  COUNT(DISTINCT ci.id) as total_checkins,
  COUNT(DISTINCT ci.saved_item_id) as unique_places,
  COUNT(DISTINCT DATE(ci.checked_in_at)) as days_active,
  AVG(ci.rating) FILTER (WHERE ci.rating IS NOT NULL) as avg_rating,
  SUM(ci.cost) FILTER (WHERE ci.cost IS NOT NULL) as total_cost,
  SUM(ci.duration_minutes) FILTER (WHERE ci.duration_minutes IS NOT NULL) as total_time_minutes,
  MIN(ci.checked_in_at) as first_checkin,
  MAX(ci.checked_in_at) as last_checkin
FROM trip_groups tg
LEFT JOIN check_ins ci ON tg.id = ci.trip_group_id
GROUP BY tg.id, tg.name, tg.destination;

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON TABLE check_ins IS 'User check-ins at saved places during trips';
COMMENT ON TABLE trip_stories IS 'Shareable trip stories with public links';
COMMENT ON TABLE trip_followers IS 'Users following other users trips';
COMMENT ON TABLE trip_copies IS 'Track when users copy others trips';

COMMENT ON COLUMN check_ins.is_auto_checkin IS 'True if check-in was automatic via geofencing';
COMMENT ON COLUMN check_ins.with_users IS 'Array of user IDs who were checked in together';
COMMENT ON COLUMN trip_stories.share_code IS 'Short random code for URLs (e.g., "abc123xy")';
COMMENT ON COLUMN trip_stories.slug IS 'Human-readable URL slug (e.g., "tokyo-sarah-2025")';

