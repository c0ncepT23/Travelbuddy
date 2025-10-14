import { Response } from 'express';
import { AuthRequest } from '../types';
import { LocationService } from '../services/location.service';
import logger from '../config/logger';

export class LocationController {
  /**
   * Update user location
   */
  static async updateLocation(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { tripGroupId, latitude, longitude } = req.body;

      await LocationService.updateLocation(
        req.user.id,
        tripGroupId,
        latitude,
        longitude
      );

      res.status(200).json({
        success: true,
        message: 'Location updated successfully',
      });
    } catch (error: any) {
      logger.error('Update location error:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to update location',
      });
    }
  }

  /**
   * Get nearby items
   */
  static async getNearbyItems(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { tripId } = req.params;
      const { latitude, longitude, radius } = req.query;

      if (!latitude || !longitude) {
        res.status(400).json({
          success: false,
          error: 'Latitude and longitude required',
        });
        return;
      }

      const items = await LocationService.getNearbyItems(
        req.user.id,
        tripId,
        parseFloat(latitude as string),
        parseFloat(longitude as string),
        radius ? parseInt(radius as string) : 500
      );

      res.status(200).json({
        success: true,
        data: items,
      });
    } catch (error: any) {
      logger.error('Get nearby items error:', error);
      res.status(403).json({
        success: false,
        error: error.message || 'Failed to fetch nearby items',
      });
    }
  }
}

