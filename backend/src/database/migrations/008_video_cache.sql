-- Video Cache Table
-- Caches extracted places/intents from videos so same video shared by different users = instant results
-- Saves API costs and processing time

CREATE TABLE IF NOT EXISTS video_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Video identification
    video_id VARCHAR(50) NOT NULL,           -- YouTube: 11-char ID, Instagram: post ID
    platform VARCHAR(20) NOT NULL,            -- "youtube", "instagram", "tiktok"
    url TEXT NOT NULL,                        -- Original URL (for reference)
    
    -- Extracted content (cached)
    title VARCHAR(500),
    channel_name VARCHAR(255),
    thumbnail_url TEXT,
    transcript TEXT,                          -- Full transcript if available
    
    -- AI Analysis results (the expensive part we're caching)
    summary TEXT,
    video_type VARCHAR(20),                   -- "places", "guide", "howto"
    destination VARCHAR(255),
    destination_country VARCHAR(100),
    places_json JSONB,                        -- Array of extracted places
    discovery_intent_json JSONB,              -- Discovery intent if no places found
    
    -- Cache metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,                     -- Optional expiration
    hit_count INTEGER DEFAULT 0,              -- How many times this cache was used
    last_hit_at TIMESTAMP
);

-- Indexes for fast lookup
CREATE UNIQUE INDEX IF NOT EXISTS idx_video_cache_video_platform 
ON video_cache(video_id, platform);

CREATE INDEX IF NOT EXISTS idx_video_cache_created 
ON video_cache(created_at DESC);

-- Comments
COMMENT ON TABLE video_cache IS 'Caches AI extraction results from videos to avoid reprocessing same content';
COMMENT ON COLUMN video_cache.hit_count IS 'Number of times this cached result was used by different users';

