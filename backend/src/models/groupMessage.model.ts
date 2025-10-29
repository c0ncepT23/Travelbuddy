import { pool } from '../config/database';

export interface GroupMessage {
  id: number;
  trip_group_id: number;
  sender_id: number;
  message_type: 'text' | 'ai_response' | 'system';
  content: string;
  metadata?: any;
  reply_to_message_id?: number;
  is_edited: boolean;
  edited_at?: Date;
  created_at: Date;
  updated_at: Date;
  sender_email?: string;
  sender_name?: string;
  read_count?: number;
}

export interface TypingIndicator {
  trip_group_id: number;
  user_id: number;
  started_at: Date;
}

export interface OnlineStatus {
  user_id: number;
  trip_group_id: number;
  is_online: boolean;
  last_seen: Date;
  socket_id?: string;
}

export class GroupMessageModel {
  // Create a new message
  static async create(
    tripGroupId: number,
    senderId: number,
    content: string,
    messageType: 'text' | 'ai_response' | 'system' = 'text',
    metadata?: any,
    replyToMessageId?: number
  ): Promise<GroupMessage> {
    const query = `
      INSERT INTO group_messages (
        trip_group_id, sender_id, message_type, content, metadata, reply_to_message_id
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    
    const values = [
      tripGroupId,
      senderId,
      messageType,
      content,
      metadata ? JSON.stringify(metadata) : null,
      replyToMessageId
    ];
    
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  // Get messages for a trip group
  static async getMessages(
    tripGroupId: number,
    limit: number = 50,
    offset: number = 0
  ): Promise<GroupMessage[]> {
    const query = `
      SELECT * FROM group_messages_view
      WHERE trip_group_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;
    
    const result = await pool.query(query, [tripGroupId, limit, offset]);
    return result.rows;
  }

  // Update a message
  static async update(
    messageId: number,
    senderId: number,
    content: string
  ): Promise<GroupMessage | null> {
    const query = `
      UPDATE group_messages
      SET content = $1, is_edited = TRUE, edited_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND sender_id = $3
      RETURNING *
    `;
    
    const result = await pool.query(query, [content, messageId, senderId]);
    return result.rows[0] || null;
  }

  // Delete a message
  static async delete(messageId: number, senderId: number): Promise<boolean> {
    const query = `
      DELETE FROM group_messages
      WHERE id = $1 AND sender_id = $2
    `;
    
    const result = await pool.query(query, [messageId, senderId]);
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Mark message as read
  static async markAsRead(messageId: number, userId: number): Promise<void> {
    const query = `
      INSERT INTO message_read_status (message_id, user_id)
      VALUES ($1, $2)
      ON CONFLICT (message_id, user_id) DO NOTHING
    `;
    
    await pool.query(query, [messageId, userId]);
  }

  // Mark all messages in a trip as read
  static async markAllAsRead(tripGroupId: number, userId: number): Promise<void> {
    const query = `
      INSERT INTO message_read_status (message_id, user_id)
      SELECT id, $2 FROM group_messages
      WHERE trip_group_id = $1 AND sender_id != $2
      ON CONFLICT (message_id, user_id) DO NOTHING
    `;
    
    await pool.query(query, [tripGroupId, userId]);
  }

  // Get unread message count
  static async getUnreadCount(tripGroupId: number, userId: number): Promise<number> {
    const query = `
      SELECT COUNT(*) as count
      FROM group_messages gm
      LEFT JOIN message_read_status mrs ON gm.id = mrs.message_id AND mrs.user_id = $2
      WHERE gm.trip_group_id = $1 
        AND gm.sender_id != $2
        AND mrs.id IS NULL
    `;
    
    const result = await pool.query(query, [tripGroupId, userId]);
    return parseInt(result.rows[0]?.count || '0');
  }

  // Typing indicators
  static async setTyping(tripGroupId: number, userId: number): Promise<void> {
    const query = `
      INSERT INTO typing_indicators (trip_group_id, user_id, started_at)
      VALUES ($1, $2, CURRENT_TIMESTAMP)
      ON CONFLICT (trip_group_id, user_id) 
      DO UPDATE SET started_at = CURRENT_TIMESTAMP
    `;
    
    await pool.query(query, [tripGroupId, userId]);
  }

  static async removeTyping(tripGroupId: number, userId: number): Promise<void> {
    const query = `
      DELETE FROM typing_indicators
      WHERE trip_group_id = $1 AND user_id = $2
    `;
    
    await pool.query(query, [tripGroupId, userId]);
  }

  static async getTypingUsers(tripGroupId: number): Promise<number[]> {
    // Clean up old indicators first
    await pool.query('SELECT cleanup_old_typing_indicators()');
    
    const query = `
      SELECT user_id FROM typing_indicators
      WHERE trip_group_id = $1
    `;
    
    const result = await pool.query(query, [tripGroupId]);
    return result.rows.map((row: any) => row.user_id);
  }

  // Online status
  static async setOnlineStatus(
    userId: number,
    tripGroupId: number,
    isOnline: boolean,
    socketId?: string
  ): Promise<void> {
    const query = `
      INSERT INTO user_online_status (user_id, trip_group_id, is_online, last_seen, socket_id)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4)
      ON CONFLICT (user_id, trip_group_id)
      DO UPDATE SET 
        is_online = $3, 
        last_seen = CURRENT_TIMESTAMP,
        socket_id = $4
    `;
    
    await pool.query(query, [userId, tripGroupId, isOnline, socketId]);
  }

  static async getOnlineUsers(tripGroupId: number): Promise<OnlineStatus[]> {
    const query = `
      SELECT * FROM user_online_status
      WHERE trip_group_id = $1 AND is_online = TRUE
    `;
    
    const result = await pool.query(query, [tripGroupId]);
    return result.rows;
  }

  // Push notification tokens
  static async savePushToken(
    userId: number,
    token: string,
    deviceType: 'ios' | 'android' | 'web',
    deviceId?: string
  ): Promise<void> {
    const query = `
      INSERT INTO push_notification_tokens (user_id, token, device_type, device_id)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id, token)
      DO UPDATE SET 
        is_active = TRUE,
        device_type = $3,
        device_id = $4,
        updated_at = CURRENT_TIMESTAMP
    `;
    
    await pool.query(query, [userId, token, deviceType, deviceId]);
  }

  static async getUserTokens(userId: number): Promise<string[]> {
    const query = `
      SELECT token FROM push_notification_tokens
      WHERE user_id = $1 AND is_active = TRUE
    `;
    
    const result = await pool.query(query, [userId]);
    return result.rows.map((row: any) => row.token);
  }
}

