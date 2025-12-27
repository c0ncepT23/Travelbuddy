-- Discovery Queue Table
-- Stores food/activity intents from videos where no specific places were mentioned
-- These appear as chips in AI Chat for the user to explore

CREATE TABLE IF NOT EXISTS discovery_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    trip_group_id UUID REFERENCES trip_groups(id) ON DELETE CASCADE,
    
    -- What the user is looking for
    item VARCHAR(255) NOT NULL,           -- "Pad Thai", "Tacos", "Surfing"
    city VARCHAR(255) NOT NULL,           -- "Bangkok", "Mexico City"
    country VARCHAR(100),                 -- "Thailand", "Mexico"
    vibe VARCHAR(100),                    -- "legendary", "street food", "hidden gem"
    
    -- Source information
    source_url TEXT,                      -- Original video URL
    source_title VARCHAR(500),            -- Video title
    source_platform VARCHAR(50),          -- "youtube", "instagram", "tiktok"
    
    -- Status tracking
    status VARCHAR(20) NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'explored', 'saved', 'dismissed')),
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    explored_at TIMESTAMP,                -- When user tapped to explore
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_discovery_queue_user ON discovery_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_discovery_queue_trip ON discovery_queue(trip_group_id);
CREATE INDEX IF NOT EXISTS idx_discovery_queue_status ON discovery_queue(status);
CREATE INDEX IF NOT EXISTS idx_discovery_queue_city ON discovery_queue(city);
CREATE INDEX IF NOT EXISTS idx_discovery_queue_country ON discovery_queue(country);

-- Unique constraint to prevent duplicate items for same user/city
CREATE UNIQUE INDEX IF NOT EXISTS idx_discovery_queue_unique_item 
ON discovery_queue(user_id, LOWER(item), LOWER(city)) 
WHERE status = 'pending';

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_discovery_queue_updated_at ON discovery_queue;
CREATE TRIGGER update_discovery_queue_updated_at BEFORE UPDATE ON discovery_queue
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

