-- Fix group_messages table to use UUID for trip_group_id
-- This migration fixes the type mismatch where trip_groups uses UUID but group_messages used INTEGER

-- STEP 1: Drop the view first (it depends on the columns we're changing)
DROP VIEW IF EXISTS group_messages_view;

-- STEP 2: Drop all foreign key constraints
ALTER TABLE group_messages DROP CONSTRAINT IF EXISTS group_messages_trip_group_id_fkey;
ALTER TABLE group_messages DROP CONSTRAINT IF EXISTS group_messages_sender_id_fkey;
ALTER TABLE typing_indicators DROP CONSTRAINT IF EXISTS typing_indicators_trip_group_id_fkey;
ALTER TABLE typing_indicators DROP CONSTRAINT IF EXISTS typing_indicators_user_id_fkey;
ALTER TABLE typing_indicators DROP CONSTRAINT IF EXISTS typing_indicators_pkey;
ALTER TABLE user_online_status DROP CONSTRAINT IF EXISTS user_online_status_trip_group_id_fkey;
ALTER TABLE user_online_status DROP CONSTRAINT IF EXISTS user_online_status_user_id_fkey;
ALTER TABLE user_online_status DROP CONSTRAINT IF EXISTS user_online_status_pkey;
ALTER TABLE message_read_status DROP CONSTRAINT IF EXISTS message_read_status_user_id_fkey;
ALTER TABLE push_notification_tokens DROP CONSTRAINT IF EXISTS push_notification_tokens_user_id_fkey;

-- STEP 3: Clear existing data (the old data with INTEGER IDs won't work anyway)
DELETE FROM message_read_status;
DELETE FROM group_messages;
DELETE FROM typing_indicators;
DELETE FROM user_online_status;

-- STEP 4: Change column types to UUID
ALTER TABLE group_messages 
  ALTER COLUMN trip_group_id TYPE UUID USING NULL;
ALTER TABLE group_messages 
  ALTER COLUMN sender_id TYPE UUID USING NULL;

ALTER TABLE typing_indicators 
  ALTER COLUMN trip_group_id TYPE UUID USING NULL;
ALTER TABLE typing_indicators 
  ALTER COLUMN user_id TYPE UUID USING NULL;

ALTER TABLE user_online_status 
  ALTER COLUMN trip_group_id TYPE UUID USING NULL;
ALTER TABLE user_online_status 
  ALTER COLUMN user_id TYPE UUID USING NULL;

ALTER TABLE message_read_status 
  ALTER COLUMN user_id TYPE UUID USING NULL;

ALTER TABLE push_notification_tokens 
  ALTER COLUMN user_id TYPE UUID USING NULL;

-- STEP 5: Add back foreign key constraints
ALTER TABLE group_messages 
  ADD CONSTRAINT group_messages_trip_group_id_fkey 
  FOREIGN KEY (trip_group_id) REFERENCES trip_groups(id) ON DELETE CASCADE;

ALTER TABLE group_messages 
  ADD CONSTRAINT group_messages_sender_id_fkey 
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE typing_indicators ADD PRIMARY KEY (trip_group_id, user_id);
ALTER TABLE typing_indicators 
  ADD CONSTRAINT typing_indicators_trip_group_id_fkey 
  FOREIGN KEY (trip_group_id) REFERENCES trip_groups(id) ON DELETE CASCADE;
ALTER TABLE typing_indicators 
  ADD CONSTRAINT typing_indicators_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE user_online_status ADD PRIMARY KEY (user_id, trip_group_id);
ALTER TABLE user_online_status 
  ADD CONSTRAINT user_online_status_trip_group_id_fkey 
  FOREIGN KEY (trip_group_id) REFERENCES trip_groups(id) ON DELETE CASCADE;
ALTER TABLE user_online_status 
  ADD CONSTRAINT user_online_status_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE message_read_status 
  ADD CONSTRAINT message_read_status_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE push_notification_tokens 
  ADD CONSTRAINT push_notification_tokens_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- STEP 6: Recreate the view
CREATE OR REPLACE VIEW group_messages_view AS
SELECT 
  gm.id,
  gm.trip_group_id,
  gm.sender_id,
  gm.message_type,
  gm.content,
  gm.metadata,
  gm.reply_to_message_id,
  gm.is_edited,
  gm.edited_at,
  gm.created_at,
  gm.updated_at,
  u.email as sender_email,
  u.name as sender_name,
  COALESCE(COUNT(mrs.id), 0) as read_count
FROM group_messages gm
JOIN users u ON gm.sender_id = u.id
LEFT JOIN message_read_status mrs ON gm.id = mrs.message_id
GROUP BY gm.id, gm.trip_group_id, gm.sender_id, gm.message_type, 
         gm.content, gm.metadata, gm.reply_to_message_id, gm.is_edited, 
         gm.edited_at, gm.created_at, gm.updated_at, u.email, u.name;
