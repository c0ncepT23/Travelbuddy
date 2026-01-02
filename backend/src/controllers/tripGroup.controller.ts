import { Response } from 'express';
import { AuthRequest } from '../types';
import { TripGroupService } from '../services/tripGroup.service';
import logger from '../config/logger';

export class TripGroupController {
  /**
   * Create a new trip
   */
  static async create(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { name, destination, startDate, endDate } = req.body;

      const trip = await TripGroupService.createTrip(
        req.user.id,
        name,
        destination,
        startDate ? new Date(startDate) : undefined,
        endDate ? new Date(endDate) : undefined
      );

      res.status(201).json({
        success: true,
        data: trip,
        message: 'Trip created successfully',
      });
    } catch (error: any) {
      logger.error('Create trip error:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to create trip',
      });
    }
  }

  /**
   * Get user's trips
   */
  static async getUserTrips(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const trips = await TripGroupService.getUserTrips(req.user.id);
      
      // DEBUG: Log first trip to check places_count
      if (trips.length > 0) {
        logger.info(`[TripGroupController] User ${req.user.id} has ${trips.length} trips. First trip places_count: ${trips[0].places_count}`);
      }

      res.status(200).json({
        success: true,
        data: trips,
      });
    } catch (error: any) {
      logger.error('Get user trips error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch trips',
      });
    }
  }

  /**
   * Get trip details
   */
  static async getTripById(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { id } = req.params;
      const trip = await TripGroupService.getTripDetails(id, req.user.id);

      res.status(200).json({
        success: true,
        data: trip,
      });
    } catch (error: any) {
      logger.error('Get trip details error:', error);
      const statusCode = error.message === 'Access denied' ? 403 : 404;
      res.status(statusCode).json({
        success: false,
        error: error.message || 'Failed to fetch trip',
      });
    }
  }

  /**
   * Update trip
   */
  static async update(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { id } = req.params;
      const updates = req.body;

      const trip = await TripGroupService.updateTrip(id, req.user.id, updates);

      res.status(200).json({
        success: true,
        data: trip,
        message: 'Trip updated successfully',
      });
    } catch (error: any) {
      logger.error('Update trip error:', error);
      const statusCode = error.message.includes('owner') ? 403 : 400;
      res.status(statusCode).json({
        success: false,
        error: error.message || 'Failed to update trip',
      });
    }
  }

  /**
   * Delete trip
   */
  static async delete(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { id } = req.params;
      await TripGroupService.deleteTrip(id, req.user.id);

      res.status(200).json({
        success: true,
        message: 'Trip deleted successfully',
      });
    } catch (error: any) {
      logger.error('Delete trip error:', error);
      const statusCode = error.message.includes('owner') ? 403 : 404;
      res.status(statusCode).json({
        success: false,
        error: error.message || 'Failed to delete trip',
      });
    }
  }

  /**
   * Join trip via invite code
   */
  static async joinTrip(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { inviteCode } = req.body;

      const trip = await TripGroupService.joinTrip(req.user.id, inviteCode);

      res.status(200).json({
        success: true,
        data: trip,
        message: 'Successfully joined trip',
      });
    } catch (error: any) {
      logger.error('Join trip error:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to join trip',
      });
    }
  }

  /**
   * Leave trip
   */
  static async leaveTrip(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { id } = req.params;
      await TripGroupService.leaveTrip(id, req.user.id);

      res.status(200).json({
        success: true,
        message: 'Successfully left trip',
      });
    } catch (error: any) {
      logger.error('Leave trip error:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to leave trip',
      });
    }
  }

  /**
   * Get trip members
   */
  static async getMembers(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { id } = req.params;
      const members = await TripGroupService.getTripMembers(id, req.user.id);

      res.status(200).json({
        success: true,
        data: members,
      });
    } catch (error: any) {
      logger.error('Get members error:', error);
      res.status(403).json({
        success: false,
        error: error.message || 'Failed to fetch members',
      });
    }
  }

  /**
   * Get invite information
   */
  static async getInviteInfo(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { id } = req.params;
      const inviteInfo = await TripGroupService.getInviteInfo(id, req.user.id);

      res.status(200).json({
        success: true,
        data: inviteInfo,
      });
    } catch (error: any) {
      logger.error('Get invite info error:', error);
      res.status(403).json({
        success: false,
        error: error.message || 'Failed to get invite information',
      });
    }
  }

  /**
   * Update trip banner
   */
  static async updateBanner(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { id } = req.params;
      const { bannerUrl } = req.body;

      if (!bannerUrl) {
        res.status(400).json({
          success: false,
          error: 'Banner URL is required',
        });
        return;
      }

      const trip = await TripGroupService.updateBanner(id, req.user.id, bannerUrl);

      res.status(200).json({
        success: true,
        data: trip,
        message: 'Banner updated successfully',
      });
    } catch (error: any) {
      logger.error('Update banner error:', error);
      const statusCode = error.message.includes('owner') ? 403 : 400;
      res.status(statusCode).json({
        success: false,
        error: error.message || 'Failed to update banner',
      });
    }
  }
}

