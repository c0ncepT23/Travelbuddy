/**
 * Push Notification Service
 * Sends push notifications via Expo Push API
 */

import { GroupMessageModel } from '../models/groupMessage.model';
import logger from '../config/logger';

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: 'default' | null;
  badge?: number;
  channelId?: string;
  priority?: 'default' | 'normal' | 'high';
  ttl?: number;
}

interface ExpoPushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: any;
}

export class PushNotificationService {
  private static EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

  /**
   * Send push notification to a user
   */
  static async sendToUser(
    userId: number,
    notification: {
      title: string;
      body: string;
      data?: Record<string, any>;
      channelId?: string;
    }
  ): Promise<void> {
    try {
      const tokens = await GroupMessageModel.getUserTokens(userId);
      
      if (tokens.length === 0) {
        logger.info(`[PushNotification] No tokens for user ${userId}`);
        return;
      }

      const messages: ExpoPushMessage[] = tokens.map((token) => ({
        to: token,
        title: notification.title,
        body: notification.body,
        data: notification.data,
        sound: 'default',
        channelId: notification.channelId || 'default',
        priority: 'high',
      }));

      await this.sendPushNotifications(messages);
      logger.info(`[PushNotification] Sent to user ${userId} (${tokens.length} devices)`);
    } catch (error) {
      logger.error(`[PushNotification] Error sending to user ${userId}:`, error);
    }
  }

  /**
   * Send push notification to multiple users
   */
  static async sendToUsers(
    userIds: number[],
    notification: {
      title: string;
      body: string;
      data?: Record<string, any>;
      channelId?: string;
    }
  ): Promise<void> {
    const promises = userIds.map((userId) => this.sendToUser(userId, notification));
    await Promise.all(promises);
  }

  /**
   * Send push notification to all members of a trip (except sender)
   */
  static async sendToTripMembers(
    tripGroupId: number,
    excludeUserId: number,
    notification: {
      title: string;
      body: string;
      data?: Record<string, any>;
      channelId?: string;
    }
  ): Promise<void> {
    try {
      // Get all trip members' tokens except the sender
      const tokens = await this.getTripMemberTokens(tripGroupId, excludeUserId);
      
      if (tokens.length === 0) {
        logger.info(`[PushNotification] No tokens for trip ${tripGroupId} members`);
        return;
      }

      const messages: ExpoPushMessage[] = tokens.map((token) => ({
        to: token,
        title: notification.title,
        body: notification.body,
        data: notification.data,
        sound: 'default',
        channelId: notification.channelId || 'chat',
        priority: 'high',
      }));

      await this.sendPushNotifications(messages);
      logger.info(`[PushNotification] Sent to trip ${tripGroupId} (${tokens.length} devices)`);
    } catch (error) {
      logger.error(`[PushNotification] Error sending to trip ${tripGroupId}:`, error);
    }
  }

  /**
   * Get all push tokens for trip members (excluding one user)
   */
  private static async getTripMemberTokens(tripGroupId: number, excludeUserId: number): Promise<string[]> {
    const { pool } = await import('../config/database');
    
    const query = `
      SELECT DISTINCT pt.token
      FROM push_notification_tokens pt
      INNER JOIN trip_group_members tgm ON pt.user_id = tgm.user_id
      WHERE tgm.trip_group_id = $1 
        AND pt.user_id != $2
        AND pt.is_active = TRUE
    `;
    
    const result = await pool.query(query, [tripGroupId, excludeUserId]);
    return result.rows.map((row: any) => row.token);
  }

  /**
   * Send push notifications via Expo Push API
   */
  private static async sendPushNotifications(messages: ExpoPushMessage[]): Promise<ExpoPushTicket[]> {
    // Filter to only valid Expo push tokens
    const validMessages = messages.filter((msg) => 
      msg.to.startsWith('ExponentPushToken[') || msg.to.startsWith('ExpoPushToken[')
    );

    if (validMessages.length === 0) {
      logger.info('[PushNotification] No valid Expo tokens to send to');
      return [];
    }

    // Expo recommends batching in groups of 100
    const batches: ExpoPushMessage[][] = [];
    for (let i = 0; i < validMessages.length; i += 100) {
      batches.push(validMessages.slice(i, i + 100));
    }

    const tickets: ExpoPushTicket[] = [];

    for (const batch of batches) {
      try {
        const response = await fetch(this.EXPO_PUSH_URL, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Accept-Encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(batch),
        });

        const data = await response.json();
        
        if (data.data) {
          tickets.push(...data.data);
          
          // Log any errors
          data.data.forEach((ticket: ExpoPushTicket, index: number) => {
            if (ticket.status === 'error') {
              logger.warn(`[PushNotification] Error for token ${batch[index].to}:`, ticket.message);
              
              // Handle invalid tokens
              if (ticket.details?.error === 'DeviceNotRegistered') {
                this.markTokenAsInactive(batch[index].to);
              }
            }
          });
        }
      } catch (error) {
        logger.error('[PushNotification] Batch send error:', error);
      }
    }

    return tickets;
  }

  /**
   * Mark a token as inactive (device unregistered)
   */
  private static async markTokenAsInactive(token: string): Promise<void> {
    try {
      const { pool } = await import('../config/database');
      
      await pool.query(
        'UPDATE push_notification_tokens SET is_active = FALSE WHERE token = $1',
        [token]
      );
      
      logger.info(`[PushNotification] Marked token as inactive: ${token.substring(0, 30)}...`);
    } catch (error) {
      logger.error('[PushNotification] Error marking token inactive:', error);
    }
  }

  /**
   * Send new message notification
   */
  static async notifyNewMessage(
    tripGroupId: number,
    senderId: number,
    senderName: string,
    tripName: string,
    messagePreview: string
  ): Promise<void> {
    await this.sendToTripMembers(tripGroupId, senderId, {
      title: `${senderName} in ${tripName}`,
      body: messagePreview.length > 100 ? messagePreview.substring(0, 97) + '...' : messagePreview,
      data: {
        type: 'new_message',
        tripId: tripGroupId.toString(),
        screen: 'GroupChat',
      },
      channelId: 'chat',
    });
  }

  /**
   * Send new place added notification
   */
  static async notifyNewPlace(
    tripGroupId: number,
    addedByUserId: number,
    addedByName: string,
    tripName: string,
    placeName: string
  ): Promise<void> {
    await this.sendToTripMembers(tripGroupId, addedByUserId, {
      title: `New place in ${tripName}`,
      body: `${addedByName} added ${placeName}`,
      data: {
        type: 'new_place',
        tripId: tripGroupId.toString(),
        screen: 'TripDetail',
      },
      channelId: 'trips',
    });
  }

  /**
   * Send trip invite notification
   */
  static async notifyTripInvite(
    userId: number,
    inviterName: string,
    tripName: string,
    tripId: number
  ): Promise<void> {
    await this.sendToUser(userId, {
      title: 'Trip Invitation',
      body: `${inviterName} invited you to join "${tripName}"`,
      data: {
        type: 'trip_invite',
        tripId: tripId.toString(),
        screen: 'TripDetail',
      },
      channelId: 'trips',
    });
  }
}

