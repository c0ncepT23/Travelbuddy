import { Response } from 'express';
import { AuthRequest } from '../types';
import { ChatService } from '../services/chat.service';
import logger from '../config/logger';

export class ChatController {
  /**
   * Send a message
   */
  static async sendMessage(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { id: tripGroupId } = req.params;
      const { content, messageType, metadata } = req.body;

      const result = await ChatService.sendMessage(
        req.user.id,
        tripGroupId,
        content,
        messageType,
        metadata
      );

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('Send message error:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to send message',
      });
    }
  }

  /**
   * Get messages
   */
  static async getMessages(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { id: tripGroupId } = req.params;
      const { limit, offset } = req.query;

      const messages = await ChatService.getMessages(
        req.user.id,
        tripGroupId,
        limit ? parseInt(limit as string) : 50,
        offset ? parseInt(offset as string) : 0
      );

      res.status(200).json({
        success: true,
        data: messages,
      });
    } catch (error: any) {
      logger.error('Get messages error:', error);
      res.status(403).json({
        success: false,
        error: error.message || 'Failed to fetch messages',
      });
    }
  }

  /**
   * Upload and process image
   */
  static async uploadImage(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { id: tripGroupId } = req.params;

      if (!req.file) {
        res.status(400).json({
          success: false,
          error: 'No image file provided',
        });
        return;
      }

      // In production, upload to S3 first
      const imageUrl = `/uploads/${req.file.filename}`; // Placeholder

      const message = await ChatService.processImageUpload(
        req.user.id,
        tripGroupId,
        req.file.buffer,
        imageUrl
      );

      res.status(201).json({
        success: true,
        data: message,
        message: 'Image uploaded and processed',
      });
    } catch (error: any) {
      logger.error('Upload image error:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to process image',
      });
    }
  }
}

