-- Clean up all trips and related data for fresh start
-- Run this in Supabase SQL Editor

-- Delete in correct order to respect foreign key constraints

-- 1. Delete check-ins
DELETE FROM check_ins;

-- 2. Delete saved items
DELETE FROM saved_items;

-- 3. Delete chat messages
DELETE FROM chat_messages;

-- 4. Delete group messages (if exists)
DELETE FROM group_messages WHERE true;

-- 5. Delete trip stories (if exists)
DELETE FROM trip_stories WHERE true;

-- 6. Delete trip members
DELETE FROM trip_members;

-- 7. Delete trip groups
DELETE FROM trip_groups;

-- 8. Delete typing indicators (if exists)
DELETE FROM typing_indicators WHERE true;

-- 9. Delete online status (if exists)
DELETE FROM user_online_status WHERE true;

-- 10. Delete message read status (if exists)
DELETE FROM message_read_status WHERE true;

-- Reset auto-increment sequences (optional)
-- ALTER SEQUENCE trip_groups_id_seq RESTART WITH 1;
-- ALTER SEQUENCE saved_items_id_seq RESTART WITH 1;

SELECT 'Database cleaned! Ready for fresh start! 🎉' as status;

