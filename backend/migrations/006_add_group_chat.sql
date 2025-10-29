-- Group Chat Messages
-- Stores all messages sent in trip group chats

CREATE TABLE IF NOT EXISTS group_messages (
  id SERIAL PRIMARY KEY,
  trip_group_id INTEGER NOT NULL REFERENCES trip_groups(id) ON DELETE CASCADE,
  sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_type VARCHAR(20) NOT NULL DEFAULT 'text', -- text, ai_response, system
  content TEXT NOT NULL,
  metadata JSONB, -- For storing AI response data, mentions, attachments, etc.
  reply_to_message_id INTEGER REFERENCES group_messages(id) ON DELETE SET NULL,
  is_edited BOOLEAN DEFAULT FALSE,
  edited_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Message Read Status
-- Track who has read which messages
CREATE TABLE IF NOT EXISTS message_read_status (
  id SERIAL PRIMARY KEY,
  message_id INTEGER NOT NULL REFERENCES group_messages(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(message_id, user_id)
);

-- Typing Indicators
-- Track who is currently typing
CREATE TABLE IF NOT EXISTS typing_indicators (
  trip_group_id INTEGER NOT NULL REFERENCES trip_groups(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (trip_group_id, user_id)
);

-- Online Status
-- Track user online/offline status per trip
CREATE TABLE IF NOT EXISTS user_online_status (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trip_group_id INTEGER NOT NULL REFERENCES trip_groups(id) ON DELETE CASCADE,
  is_online BOOLEAN DEFAULT FALSE,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  socket_id VARCHAR(255),
  PRIMARY KEY (user_id, trip_group_id)
);

-- Push Notification Tokens
-- Store device tokens for push notifications
CREATE TABLE IF NOT EXISTS push_notification_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  device_type VARCHAR(20) NOT NULL, -- ios, android, web
  device_id VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, token)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_group_messages_trip ON group_messages(trip_group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_group_messages_sender ON group_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_message_read_status_message ON message_read_status(message_id);
CREATE INDEX IF NOT EXISTS idx_message_read_status_user ON message_read_status(user_id);
CREATE INDEX IF NOT EXISTS idx_typing_indicators_trip ON typing_indicators(trip_group_id);
CREATE INDEX IF NOT EXISTS idx_user_online_status_trip ON user_online_status(trip_group_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_user ON push_notification_tokens(user_id) WHERE is_active = TRUE;

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for auto-updating timestamps
CREATE TRIGGER update_group_messages_updated_at BEFORE UPDATE ON group_messages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_push_tokens_updated_at BEFORE UPDATE ON push_notification_tokens
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- View for message list with sender info
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
  u.email as sender_email,
  u.name as sender_name,
  COUNT(mrs.id) as read_count
FROM group_messages gm
JOIN users u ON gm.sender_id = u.id
LEFT JOIN message_read_status mrs ON gm.id = mrs.message_id
GROUP BY gm.id, u.email, u.name
ORDER BY gm.created_at DESC;

-- Function to clean up old typing indicators (older than 5 seconds)
CREATE OR REPLACE FUNCTION cleanup_old_typing_indicators()
RETURNS void AS $$
BEGIN
  DELETE FROM typing_indicators 
  WHERE started_at < NOW() - INTERVAL '5 seconds';
END;
$$ LANGUAGE plpgsql;

