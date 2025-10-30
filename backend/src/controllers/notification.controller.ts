import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import pool from '../config/database';

export class NotificationController {
  /**
   * Register push notification token
   */
  static async registerToken(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { token, platform } = req.body;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
        return;
      }

      if (!token) {
        res.status(400).json({
          success: false,
          message: 'Token is required',
        });
        return;
      }

      // Store or update push token
      await pool.query(
        `INSERT INTO push_notification_tokens (user_id, token, platform, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (user_id, token)
         DO UPDATE SET 
           platform = EXCLUDED.platform,
           updated_at = NOW(),
           is_active = true`,
        [userId, token, platform || 'unknown']
      );

      console.log(`[Notifications] Token registered for user ${userId}`);

      res.json({
        success: true,
        message: 'Push token registered successfully',
      });
      return;
    } catch (error) {
      console.error('[Notifications] Register token error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to register push token',
      });
      return;
    }
  }

  /**
   * Unregister push notification token
   */
  static async unregisterToken(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { token } = req.body;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
        return;
      }

      if (!token) {
        res.status(400).json({
          success: false,
          message: 'Token is required',
        });
        return;
      }

      await pool.query(
        `UPDATE push_notification_tokens 
         SET is_active = false, updated_at = NOW()
         WHERE user_id = $1 AND token = $2`,
        [userId, token]
      );

      console.log(`[Notifications] Token unregistered for user ${userId}`);

      res.json({
        success: true,
        message: 'Push token unregistered successfully',
      });
      return;
    } catch (error) {
      console.error('[Notifications] Unregister token error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to unregister push token',
      });
      return;
    }
  }

  /**
   * Get user's registered tokens
   */
  static async getTokens(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
        return;
      }

      const result = await pool.query(
        `SELECT token, platform, created_at, updated_at, is_active
         FROM push_notification_tokens
         WHERE user_id = $1 AND is_active = true
         ORDER BY updated_at DESC`,
        [userId]
      );

      res.json({
        success: true,
        data: result.rows,
      });
      return;
    } catch (error) {
      console.error('[Notifications] Get tokens error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get push tokens',
      });
      return;
    }
  }
}

