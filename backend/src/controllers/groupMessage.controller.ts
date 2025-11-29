import { Response } from 'express';
import { GroupMessageModel } from '../models/groupMessage.model';
import { AuthRequest } from '../types';

export class GroupMessageController {
  // Get messages for a trip
  static async getMessages(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { tripId } = req.params;
      const { limit = '50', offset = '0' } = req.query;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Authorization check could be added here to verify user is trip member

      const messages = await GroupMessageModel.getMessages(
        tripId, // UUID string
        parseInt(limit as string),
        parseInt(offset as string)
      );

      res.json({ success: true, data: messages });
    } catch (error: any) {
      console.error('Get messages error:', error);
      res.status(500).json({ error: 'Failed to fetch messages' });
    }
  }

  // Send a message (REST fallback, prefer WebSocket)
  static async sendMessage(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { tripId } = req.params;
      const { content, messageType, metadata, replyToMessageId } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      if (!content || content.trim() === '') {
        res.status(400).json({ error: 'Message content is required' });
        return;
      }

      const message = await GroupMessageModel.create(
        tripId, // UUID string
        userId, // UUID string
        content,
        messageType || 'text',
        metadata,
        replyToMessageId
      );

      res.json({ success: true, data: message });
    } catch (error: any) {
      console.error('Send message error:', error);
      res.status(500).json({ error: 'Failed to send message' });
    }
  }

  // Update a message
  static async updateMessage(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { messageId } = req.params;
      const { content } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      if (!content || content.trim() === '') {
        res.status(400).json({ error: 'Message content is required' });
        return;
      }

      const message = await GroupMessageModel.update(
        parseInt(messageId),
        userId, // UUID string
        content
      );

      if (!message) {
        res.status(404).json({ error: 'Message not found or unauthorized' });
        return;
      }

      res.json({ success: true, data: message });
    } catch (error: any) {
      console.error('Update message error:', error);
      res.status(500).json({ error: 'Failed to update message' });
    }
  }

  // Delete a message
  static async deleteMessage(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { messageId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const deleted = await GroupMessageModel.delete(
        parseInt(messageId),
        userId // UUID string
      );

      if (!deleted) {
        res.status(404).json({ error: 'Message not found or unauthorized' });
        return;
      }

      res.json({ success: true, message: 'Message deleted' });
    } catch (error: any) {
      console.error('Delete message error:', error);
      res.status(500).json({ error: 'Failed to delete message' });
    }
  }

  // Get unread count
  static async getUnreadCount(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { tripId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const count = await GroupMessageModel.getUnreadCount(
        tripId, // UUID string
        userId  // UUID string
      );

      res.json({ success: true, data: { count } });
    } catch (error: any) {
      console.error('Get unread count error:', error);
      res.status(500).json({ error: 'Failed to get unread count' });
    }
  }

  // Mark messages as read
  static async markAsRead(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { tripId } = req.params;
      const { messageId } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      if (messageId) {
        await GroupMessageModel.markAsRead(parseInt(messageId), userId);
      } else {
        await GroupMessageModel.markAllAsRead(tripId, userId);
      }

      res.json({ success: true, message: 'Marked as read' });
    } catch (error: any) {
      console.error('Mark as read error:', error);
      res.status(500).json({ error: 'Failed to mark as read' });
    }
  }

  // Save push notification token
  static async savePushToken(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { token, deviceType, deviceId } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      if (!token || !deviceType) {
        res.status(400).json({ error: 'Token and device type are required' });
        return;
      }

      await GroupMessageModel.savePushToken(
        userId, // UUID string
        token,
        deviceType,
        deviceId
      );

      res.json({ success: true, message: 'Push token saved' });
    } catch (error: any) {
      console.error('Save push token error:', error);
      res.status(500).json({ error: 'Failed to save push token' });
    }
  }
}
