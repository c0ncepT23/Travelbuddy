-- Migration: 006_trip_segments.sql
-- Description: Add trip segments for itinerary tracking
-- Date: 2025-11-30

-- Trip segments represent portions of a trip in specific cities
CREATE TABLE IF NOT EXISTS trip_segments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_group_id UUID NOT NULL REFERENCES trip_groups(id) ON DELETE CASCADE,
  
  -- Location info
  city VARCHAR(255) NOT NULL,
  area VARCHAR(255),
  country VARCHAR(100),
  timezone VARCHAR(50) DEFAULT 'UTC',
  
  -- Dates
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  
  -- Accommodation (optional but helpful for recommendations)
  accommodation_name VARCHAR(255),
  accommodation_address TEXT,
  accommodation_lat DECIMAL(10, 8),
  accommodation_lng DECIMAL(11, 8),
  accommodation_place_id VARCHAR(255),
  
  -- Metadata
  order_index INTEGER DEFAULT 0,
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES users(id)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_trip_segments_trip ON trip_segments(trip_group_id);
CREATE INDEX IF NOT EXISTS idx_trip_segments_dates ON trip_segments(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_trip_segments_city ON trip_segments(city);
CREATE INDEX IF NOT EXISTS idx_trip_segments_order ON trip_segments(trip_group_id, order_index);

-- Add segment reference to saved_items for optional direct linking
ALTER TABLE saved_items 
ADD COLUMN IF NOT EXISTS segment_id UUID REFERENCES trip_segments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_saved_items_segment ON saved_items(segment_id);

-- Daily plans table for locked itineraries
CREATE TABLE IF NOT EXISTS daily_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_group_id UUID NOT NULL REFERENCES trip_groups(id) ON DELETE CASCADE,
  segment_id UUID REFERENCES trip_segments(id) ON DELETE CASCADE,
  
  -- Plan details
  plan_date DATE NOT NULL,
  title VARCHAR(255),
  
  -- Ordered list of stops as JSON
  stops JSONB NOT NULL DEFAULT '[]',
  
  -- Cached route data from Google Directions
  route_data JSONB,
  total_duration_minutes INTEGER,
  total_distance_meters INTEGER,
  
  -- Status
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES users(id),
  
  UNIQUE(trip_group_id, plan_date)
);

-- Indexes for daily plans
CREATE INDEX IF NOT EXISTS idx_daily_plans_trip ON daily_plans(trip_group_id);
CREATE INDEX IF NOT EXISTS idx_daily_plans_date ON daily_plans(plan_date);
CREATE INDEX IF NOT EXISTS idx_daily_plans_segment ON daily_plans(segment_id);

-- Notification preferences for proactive alerts
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trip_group_id UUID REFERENCES trip_groups(id) ON DELETE CASCADE,
  
  -- Notification types
  morning_briefing BOOLEAN DEFAULT true,
  meal_suggestions BOOLEAN DEFAULT true,
  nearby_alerts BOOLEAN DEFAULT true,
  evening_recap BOOLEAN DEFAULT true,
  segment_alerts BOOLEAN DEFAULT true,
  
  -- Quiet hours (in user's local time)
  quiet_start TIME DEFAULT '22:00',
  quiet_end TIME DEFAULT '07:00',
  
  -- Frequency limits
  max_daily_notifications INTEGER DEFAULT 5,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(user_id, trip_group_id)
);

CREATE INDEX IF NOT EXISTS idx_notification_prefs_user ON notification_preferences(user_id);

-- Trigger for updated_at on trip_segments
CREATE TRIGGER update_trip_segments_updated_at 
BEFORE UPDATE ON trip_segments
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger for updated_at on daily_plans
CREATE TRIGGER update_daily_plans_updated_at 
BEFORE UPDATE ON daily_plans
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger for updated_at on notification_preferences
CREATE TRIGGER update_notification_preferences_updated_at 
BEFORE UPDATE ON notification_preferences
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

