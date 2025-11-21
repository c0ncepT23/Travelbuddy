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

CREATE INDEX idx_users_email ON users(email);

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

CREATE INDEX idx_trip_groups_invite_code ON trip_groups(invite_code);
CREATE INDEX idx_trip_groups_created_by ON trip_groups(created_by);

-- Trip Members Table
CREATE TABLE IF NOT EXISTS trip_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trip_group_id UUID REFERENCES trip_groups(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'member')),
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(trip_group_id, user_id)
);

CREATE INDEX idx_trip_members_trip_group ON trip_members(trip_group_id);
CREATE INDEX idx_trip_members_user ON trip_members(user_id);

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

CREATE INDEX idx_chat_messages_trip_group ON chat_messages(trip_group_id);
CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at DESC);

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
    source_title VARCHAR(500)
);

CREATE INDEX idx_saved_items_trip_group ON saved_items(trip_group_id);
CREATE INDEX idx_saved_items_category ON saved_items(category);
CREATE INDEX idx_saved_items_status ON saved_items(status);
CREATE INDEX idx_saved_items_location ON saved_items(location_lat, location_lng);
CREATE INDEX idx_saved_items_area_name ON saved_items(area_name);
CREATE INDEX idx_saved_items_google_place_id ON saved_items(google_place_id);

-- Item Visits Table
CREATE TABLE IF NOT EXISTS item_visits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    saved_item_id UUID REFERENCES saved_items(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    visited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    UNIQUE(saved_item_id, user_id)
);

CREATE INDEX idx_item_visits_saved_item ON item_visits(saved_item_id);
CREATE INDEX idx_item_visits_user ON item_visits(user_id);

-- Refresh Tokens Table (for JWT refresh)
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token ON refresh_tokens(token);

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

CREATE INDEX idx_user_locations_user ON user_locations(user_id);
CREATE INDEX idx_user_locations_trip_group ON user_locations(trip_group_id);
CREATE INDEX idx_user_locations_coords ON user_locations(latitude, longitude);

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

CREATE INDEX idx_processing_jobs_status ON processing_jobs(status);
CREATE INDEX idx_processing_jobs_trip_group ON processing_jobs(trip_group_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trip_groups_updated_at BEFORE UPDATE ON trip_groups
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_saved_items_updated_at BEFORE UPDATE ON saved_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_processing_jobs_updated_at BEFORE UPDATE ON processing_jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_locations_updated_at BEFORE UPDATE ON user_locations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

