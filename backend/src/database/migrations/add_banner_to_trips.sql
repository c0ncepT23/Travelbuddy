-- Add banner_url column to trip_groups table
-- Migration: add_banner_to_trips
-- Date: 2025-10-11

ALTER TABLE trip_groups 
ADD COLUMN IF NOT EXISTS banner_url TEXT;

-- Add comment
COMMENT ON COLUMN trip_groups.banner_url IS 'URL or base64 data URI for trip banner image';

