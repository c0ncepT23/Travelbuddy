import { Response } from 'express';
import { AuthRequest } from '../types';
import pool from '../config/database';
import { NotificationPreferencesModel } from '../models/notificationPreferences.model';
import { ProactiveNotificationService } from '../services/proactiveNotification.service';

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

  /**
   * Get notification preferences for current user
   */
  static async getPreferences(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { tripId } = req.query;

      if (!userId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      const prefs = await NotificationPreferencesModel.getOrCreate(
        userId,
        tripId as string | undefined
      );

      res.json({
        success: true,
        data: prefs,
      });
    } catch (error) {
      console.error('[Notifications] Get preferences error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get notification preferences',
      });
    }
  }

  /**
   * Update notification preferences
   */
  static async updatePreferences(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { tripId } = req.query;
      const updates = req.body;

      if (!userId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      const prefs = await NotificationPreferencesModel.update(
        userId,
        updates,
        tripId as string | undefined
      );

      res.json({
        success: true,
        data: prefs,
        message: 'Notification preferences updated',
      });
    } catch (error) {
      console.error('[Notifications] Update preferences error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update notification preferences',
      });
    }
  }

  /**
   * Trigger a test morning briefing notification
   */
  static async testMorningBriefing(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { tripId } = req.params;

      if (!userId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      const sent = await ProactiveNotificationService.sendMorningBriefing(userId, tripId);

      res.json({
        success: true,
        data: { sent },
        message: sent ? 'Morning briefing sent!' : 'No briefing sent (check preferences or segment)',
      });
    } catch (error) {
      console.error('[Notifications] Test briefing error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send test briefing',
      });
    }
  }

  /**
   * Report user location for nearby alerts
   */
  static async reportLocation(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { tripId } = req.params;
      const { lat, lng } = req.body;

      if (!userId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      if (!lat || !lng) {
        res.status(400).json({
          success: false,
          message: 'Location (lat, lng) is required',
        });
        return;
      }

      const alertsSent = await ProactiveNotificationService.checkNearbyPlaces(
        userId,
        tripId,
        lat,
        lng
      );

      res.json({
        success: true,
        data: { alertsSent },
      });
    } catch (error) {
      console.error('[Notifications] Report location error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process location',
      });
    }
  }
}

