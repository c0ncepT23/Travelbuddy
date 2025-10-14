import { query } from '../config/database';
import { ChatMessage, MessageSenderType, MessageType } from '../types';

export class ChatMessageModel {
  /**
   * Create a new message
   */
  static async create(
    tripGroupId: string,
    senderId: string | null,
    senderType: MessageSenderType,
    messageType: MessageType,
    content: string,
    metadata?: any
  ): Promise<ChatMessage> {
    const result = await query(
      `INSERT INTO chat_messages 
       (trip_group_id, sender_id, sender_type, message_type, content, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        tripGroupId,
        senderId,
        senderType,
        messageType,
        content,
        metadata ? JSON.stringify(metadata) : null,
      ]
    );

    return result.rows[0];
  }

  /**
   * Get messages for a trip
   */
  static async findByTrip(
    tripGroupId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<ChatMessage[]> {
    const result = await query(
      `SELECT cm.*, u.name as sender_name, u.avatar_url as sender_avatar
       FROM chat_messages cm
       LEFT JOIN users u ON cm.sender_id = u.id
       WHERE cm.trip_group_id = $1
       ORDER BY cm.created_at DESC
       LIMIT $2 OFFSET $3`,
      [tripGroupId, limit, offset]
    );

    return result.rows.reverse(); // Return in chronological order
  }

  /**
   * Get recent conversation history for AI context
   */
  static async getRecentHistory(
    tripGroupId: string,
    limit: number = 10
  ): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
    const result = await query(
      `SELECT sender_type, content
       FROM chat_messages
       WHERE trip_group_id = $1
       AND sender_type IN ('user', 'agent')
       ORDER BY created_at DESC
       LIMIT $2`,
      [tripGroupId, limit]
    );

    return result.rows
      .reverse()
      .map((row) => ({
        role: row.sender_type === 'agent' ? ('assistant' as const) : ('user' as const),
        content: row.content,
      }));
  }

  /**
   * Delete message
   */
  static async delete(messageId: string): Promise<boolean> {
    const result = await query('DELETE FROM chat_messages WHERE id = $1', [messageId]);
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Get message count for trip
   */
  static async getMessageCount(tripGroupId: string): Promise<number> {
    const result = await query(
      'SELECT COUNT(*) as count FROM chat_messages WHERE trip_group_id = $1',
      [tripGroupId]
    );
    return parseInt(result.rows[0].count);
  }
}

