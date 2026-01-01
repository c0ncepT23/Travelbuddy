-- Migration: Add is_completed flag to trip_groups
-- Purpose: Allow users to mark trips as completed for "trophy" display on globe

ALTER TABLE trip_groups 
ADD COLUMN IF NOT EXISTS is_completed BOOLEAN DEFAULT FALSE;

-- Add index for filtering active vs completed trips
CREATE INDEX IF NOT EXISTS idx_trip_groups_is_completed ON trip_groups(is_completed);

-- Comment for documentation
COMMENT ON COLUMN trip_groups.is_completed IS 'True when user marks trip as completed (past trip)';

