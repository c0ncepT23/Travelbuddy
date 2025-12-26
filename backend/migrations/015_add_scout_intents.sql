-- Migration 015: Add scout_intents table for persistent AI scouting
-- This enables:
-- 1. Persistent "ghost pins" on the map
-- 2. Interactive AI scouts that can be revisited later
-- 3. Storing results of discovery intents

CREATE TABLE IF NOT EXISTS scout_intents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trip_group_id UUID REFERENCES trip_groups(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    intent_type VARCHAR(50) NOT NULL, -- CULINARY_GOAL, ACTIVITY_GOAL, SIGHTSEEING_GOAL
    item TEXT NOT NULL,               -- "Cheesecake"
    city TEXT NOT NULL,               -- "New York"
    vibe TEXT,                        -- "legendary"
    scout_query TEXT,                 -- "best legendary cheesecake in New York City"
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'dismissed')),
    scout_results JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_scout_intents_trip_group ON scout_intents(trip_group_id);
CREATE INDEX IF NOT EXISTS idx_scout_intents_status ON scout_intents(status) WHERE status = 'active';

-- Trigger for updated_at
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_scout_intents_updated_at') THEN
        CREATE TRIGGER update_scout_intents_updated_at BEFORE UPDATE ON scout_intents
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

