-- Migration: Add cover_url column to users table
-- Date: 2025-11-29
-- Description: Allows users to have a profile cover photo

-- Add cover_url column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS cover_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN users.cover_url IS 'URL or base64 data URI of user profile cover photo';

