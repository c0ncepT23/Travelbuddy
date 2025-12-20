import { Response } from 'express';
import { AuthRequest } from '../types';
import { LocationService } from '../services/location.service';
import logger from '../config/logger';

export class LocationController {
  /**
   * Update user location (per trip - legacy)
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
   * Update user location globally - checks ALL trips for nearby places
   * Used by background location tracking
   */
  static async updateLocationGlobal(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { latitude, longitude } = req.body;

      const result = await LocationService.updateLocationGlobal(
        req.user.id,
        latitude,
        longitude
      );

      res.status(200).json({
        success: true,
        message: 'Location updated successfully',
        data: {
          nearbyCount: result.nearbyPlaces.length,
          notificationSent: result.notificationSent,
          nearbyPlaces: result.nearbyPlaces.slice(0, 5), // Return top 5 for debugging
        },
      });
    } catch (error: any) {
      logger.error('Update location global error:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to update location',
      });
    }
  }

  /**
   * Get all nearby items across all user's trips
   */
  static async getAllNearbyItems(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { latitude, longitude, radius } = req.query;

      if (!latitude || !longitude) {
        res.status(400).json({
          success: false,
          error: 'Latitude and longitude required',
        });
        return;
      }

      const items = await LocationService.getAllNearbyItems(
        req.user.id,
        parseFloat(latitude as string),
        parseFloat(longitude as string),
        radius ? parseInt(radius as string) : 500
      );

      res.status(200).json({
        success: true,
        data: items,
      });
    } catch (error: any) {
      logger.error('Get all nearby items error:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to fetch nearby items',
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

