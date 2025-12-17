-- Travel Agent Database Schema
-- Version 1.0

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    name VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Trip Groups Table
CREATE TABLE IF NOT EXISTS trip_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    destination VARCHAR(255) NOT NULL,
    start_date DATE,
    end_date DATE,
    invite_code VARCHAR(6) UNIQUE NOT NULL,
    created_by UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_trip_groups_invite_code ON trip_groups(invite_code);
CREATE INDEX IF NOT EXISTS idx_trip_groups_created_by ON trip_groups(created_by);

-- Trip Members Table
CREATE TABLE IF NOT EXISTS trip_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trip_group_id UUID REFERENCES trip_groups(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'member')),
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(trip_group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_trip_members_trip_group ON trip_members(trip_group_id);
CREATE INDEX IF NOT EXISTS idx_trip_members_user ON trip_members(user_id);

-- Chat Messages Table
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trip_group_id UUID REFERENCES trip_groups(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
    sender_type VARCHAR(10) NOT NULL CHECK (sender_type IN ('user', 'agent')),
    message_type VARCHAR(20) NOT NULL CHECK (message_type IN ('text', 'link', 'photo', 'voice', 'system')),
    content TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_trip_group ON chat_messages(trip_group_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at DESC);

-- Saved Items Table
CREATE TABLE IF NOT EXISTS saved_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trip_group_id UUID REFERENCES trip_groups(id) ON DELETE CASCADE,
    added_by UUID REFERENCES users(id) ON DELETE SET NULL,
    name VARCHAR(500) NOT NULL,
    category VARCHAR(20) NOT NULL CHECK (category IN ('food', 'accommodation', 'place', 'shopping', 'activity', 'tip')),
    description TEXT NOT NULL,
    location_name VARCHAR(500),
    location_lat DECIMAL(10, 8),
    location_lng DECIMAL(11, 8),
    original_source_type VARCHAR(20) NOT NULL CHECK (original_source_type IN ('youtube', 'instagram', 'reddit', 'url', 'photo', 'voice', 'text')),
    original_source_url TEXT,
    original_content JSONB,
    status VARCHAR(20) NOT NULL DEFAULT 'saved' CHECK (status IN ('saved', 'visited')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- Google Places enrichment fields
    google_place_id VARCHAR(255),
    rating DECIMAL(3, 1),
    user_ratings_total INTEGER DEFAULT 0,
    price_level INTEGER,
    formatted_address TEXT,
    area_name VARCHAR(255),
    photos_json JSONB DEFAULT '[]'::jsonb,
    opening_hours_json JSONB DEFAULT '{}'::jsonb,
    location_confidence VARCHAR(20) DEFAULT 'low',
    location_confidence_score DECIMAL(5, 4) DEFAULT 0,
    source_title VARCHAR(500),
    -- User preference fields
    is_favorite BOOLEAN DEFAULT FALSE,
    is_must_visit BOOLEAN DEFAULT FALSE,
    -- Day planner fields
    planned_day INTEGER,
    day_order INTEGER DEFAULT 0,
    -- Tags and destination fields for smart sub-clustering
    tags JSONB DEFAULT '[]'::jsonb,
    destination VARCHAR(255),
    destination_country VARCHAR(255),
    primary_tag VARCHAR(255),
    primary_tag_group VARCHAR(255),
    primary_tag_confidence DECIMAL(5, 4) DEFAULT 0,
    cuisine_type VARCHAR(100),
    place_type VARCHAR(100),
    destination_id UUID
);

CREATE INDEX IF NOT EXISTS idx_saved_items_trip_group ON saved_items(trip_group_id);
CREATE INDEX IF NOT EXISTS idx_saved_items_category ON saved_items(category);
CREATE INDEX IF NOT EXISTS idx_saved_items_status ON saved_items(status);
CREATE INDEX IF NOT EXISTS idx_saved_items_location ON saved_items(location_lat, location_lng);
CREATE INDEX IF NOT EXISTS idx_saved_items_area_name ON saved_items(area_name);
CREATE INDEX IF NOT EXISTS idx_saved_items_google_place_id ON saved_items(google_place_id);
CREATE INDEX IF NOT EXISTS idx_saved_items_is_favorite ON saved_items(is_favorite) WHERE is_favorite = TRUE;
CREATE INDEX IF NOT EXISTS idx_saved_items_is_must_visit ON saved_items(is_must_visit) WHERE is_must_visit = TRUE;
CREATE INDEX IF NOT EXISTS idx_saved_items_planned_day ON saved_items(trip_group_id, planned_day);
CREATE INDEX IF NOT EXISTS idx_saved_items_day_order ON saved_items(trip_group_id, planned_day, day_order);
-- Add new columns to existing saved_items table (for upgrades)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'saved_items' AND column_name = 'tags') THEN
        ALTER TABLE saved_items ADD COLUMN tags JSONB DEFAULT '[]'::jsonb;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'saved_items' AND column_name = 'destination') THEN
        ALTER TABLE saved_items ADD COLUMN destination VARCHAR(255);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'saved_items' AND column_name = 'destination_country') THEN
        ALTER TABLE saved_items ADD COLUMN destination_country VARCHAR(255);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'saved_items' AND column_name = 'primary_tag') THEN
        ALTER TABLE saved_items ADD COLUMN primary_tag VARCHAR(255);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'saved_items' AND column_name = 'primary_tag_group') THEN
        ALTER TABLE saved_items ADD COLUMN primary_tag_group VARCHAR(255);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'saved_items' AND column_name = 'primary_tag_confidence') THEN
        ALTER TABLE saved_items ADD COLUMN primary_tag_confidence DECIMAL(5, 4) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'saved_items' AND column_name = 'cuisine_type') THEN
        ALTER TABLE saved_items ADD COLUMN cuisine_type VARCHAR(100);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'saved_items' AND column_name = 'place_type') THEN
        ALTER TABLE saved_items ADD COLUMN place_type VARCHAR(100);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'saved_items' AND column_name = 'destination_id') THEN
        ALTER TABLE saved_items ADD COLUMN destination_id UUID;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_saved_items_tags ON saved_items USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_saved_items_destination ON saved_items(destination);
CREATE INDEX IF NOT EXISTS idx_saved_items_destination_country ON saved_items(destination_country);
CREATE INDEX IF NOT EXISTS idx_saved_items_primary_tag ON saved_items(primary_tag);
CREATE INDEX IF NOT EXISTS idx_saved_items_primary_tag_group ON saved_items(primary_tag_group);

-- Destinations Table (for auto-created destinations)
CREATE TABLE IF NOT EXISTS destinations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    country VARCHAR(100),
    country_code VARCHAR(3),
    cover_image_url TEXT,
    total_places INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_destinations_user ON destinations(user_id);
CREATE INDEX IF NOT EXISTS idx_destinations_country ON destinations(country);

-- Add foreign key for destination_id (after destinations table exists)
-- Note: The column is already in saved_items, just adding reference constraint
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'saved_items_destination_id_fkey' 
        AND table_name = 'saved_items'
    ) THEN
        ALTER TABLE saved_items 
        ADD CONSTRAINT saved_items_destination_id_fkey 
        FOREIGN KEY (destination_id) REFERENCES destinations(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_saved_items_destination_id ON saved_items(destination_id);

-- Item Visits Table
CREATE TABLE IF NOT EXISTS item_visits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    saved_item_id UUID REFERENCES saved_items(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    visited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    UNIQUE(saved_item_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_item_visits_saved_item ON item_visits(saved_item_id);
CREATE INDEX IF NOT EXISTS idx_item_visits_user ON item_visits(user_id);

-- Refresh Tokens Table (for JWT refresh)
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);

-- User Locations Table (for location-based features)
CREATE TABLE IF NOT EXISTS user_locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    trip_group_id UUID REFERENCES trip_groups(id) ON DELETE CASCADE,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, trip_group_id)
);

CREATE INDEX IF NOT EXISTS idx_user_locations_user ON user_locations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_locations_trip_group ON user_locations(trip_group_id);
CREATE INDEX IF NOT EXISTS idx_user_locations_coords ON user_locations(latitude, longitude);

-- Processing Jobs Table (for async content processing)
CREATE TABLE IF NOT EXISTS processing_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trip_group_id UUID REFERENCES trip_groups(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    content_url TEXT,
    content_type VARCHAR(20),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    result JSONB,
    error TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_processing_jobs_status ON processing_jobs(status);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_trip_group ON processing_jobs(trip_group_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_trip_groups_updated_at ON trip_groups;
CREATE TRIGGER update_trip_groups_updated_at BEFORE UPDATE ON trip_groups
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_saved_items_updated_at ON saved_items;
CREATE TRIGGER update_saved_items_updated_at BEFORE UPDATE ON saved_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_processing_jobs_updated_at ON processing_jobs;
CREATE TRIGGER update_processing_jobs_updated_at BEFORE UPDATE ON processing_jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_locations_updated_at ON user_locations;
CREATE TRIGGER update_user_locations_updated_at BEFORE UPDATE ON user_locations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_destinations_updated_at ON destinations;
CREATE TRIGGER update_destinations_updated_at BEFORE UPDATE ON destinations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update destinations.total_places count
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

