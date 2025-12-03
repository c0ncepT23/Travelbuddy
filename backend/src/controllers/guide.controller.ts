import { Response } from 'express';
import { AuthRequest } from '../types';
import { GuideModel } from '../models/guide.model';
import { TripGroupModel } from '../models/tripGroup.model';
import { SavedItemModel } from '../models/savedItem.model';
import logger from '../config/logger';

export class GuideController {
  /**
   * Get all guides for a trip
   * GET /api/trips/:tripGroupId/guides
   */
  static async getGuides(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { tripGroupId } = req.params;
      const userId = req.user!.id;

      // Verify membership
      const isMember = await TripGroupModel.isMember(tripGroupId, userId);
      if (!isMember) {
        res.status(403).json({ success: false, error: 'Not a member of this trip' });
        return;
      }

      const guides = await GuideModel.findByTrip(tripGroupId);

      res.json({ success: true, data: guides });
    } catch (error) {
      logger.error('Get guides error:', error);
      res.status(500).json({ success: false, error: 'Failed to get guides' });
    }
  }

  /**
   * Get all guides with their places
   * GET /api/trips/:tripGroupId/guides/with-places
   */
  static async getGuidesWithPlaces(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { tripGroupId } = req.params;
      const userId = req.user!.id;

      // Verify membership
      const isMember = await TripGroupModel.isMember(tripGroupId, userId);
      if (!isMember) {
        res.status(403).json({ success: false, error: 'Not a member of this trip' });
        return;
      }

      const guidesWithPlaces = await GuideModel.getGuidesWithPlaces(tripGroupId);

      res.json({ success: true, data: guidesWithPlaces });
    } catch (error) {
      logger.error('Get guides with places error:', error);
      res.status(500).json({ success: false, error: 'Failed to get guides' });
    }
  }

  /**
   * Get a single guide with places grouped by day
   * GET /api/trips/:tripGroupId/guides/:guideId
   */
  static async getGuideById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { tripGroupId, guideId } = req.params;
      const userId = req.user!.id;

      // Verify membership
      const isMember = await TripGroupModel.isMember(tripGroupId, userId);
      if (!isMember) {
        res.status(403).json({ success: false, error: 'Not a member of this trip' });
        return;
      }

      const guide = await GuideModel.getGuideWithPlaces(guideId);
      if (!guide) {
        res.status(404).json({ success: false, error: 'Guide not found' });
        return;
      }

      // Get places grouped by day
      const placesByDay = await GuideModel.getGuidePlacesByDay(guideId);

      res.json({ 
        success: true, 
        data: {
          ...guide,
          placesByDay,
        }
      });
    } catch (error) {
      logger.error('Get guide by ID error:', error);
      res.status(500).json({ success: false, error: 'Failed to get guide' });
    }
  }

  /**
   * Add a place from guide to user's day plan
   * POST /api/trips/:tripGroupId/guides/:guideId/add-to-day
   */
  static async addPlaceToDay(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { tripGroupId } = req.params;
      const { savedItemId, day } = req.body;
      const userId = req.user!.id;

      // Verify membership
      const isMember = await TripGroupModel.isMember(tripGroupId, userId);
      if (!isMember) {
        res.status(403).json({ success: false, error: 'Not a member of this trip' });
        return;
      }

      if (!savedItemId || day === undefined) {
        res.status(400).json({ success: false, error: 'savedItemId and day are required' });
        return;
      }

      // Assign the place to the user's day
      const updatedItem = await SavedItemModel.assignToDay(savedItemId, day);

      if (!updatedItem) {
        res.status(404).json({ success: false, error: 'Place not found' });
        return;
      }

      res.json({ 
        success: true, 
        data: updatedItem,
        message: day === null 
          ? 'Place unassigned from day' 
          : `Place added to Day ${day}`
      });
    } catch (error) {
      logger.error('Add place to day error:', error);
      res.status(500).json({ success: false, error: 'Failed to add place to day' });
    }
  }

  /**
   * Delete a guide
   * DELETE /api/trips/:tripGroupId/guides/:guideId
   */
  static async deleteGuide(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { tripGroupId, guideId } = req.params;
      const userId = req.user!.id;

      // Verify membership
      const isMember = await TripGroupModel.isMember(tripGroupId, userId);
      if (!isMember) {
        res.status(403).json({ success: false, error: 'Not a member of this trip' });
        return;
      }

      const deleted = await GuideModel.delete(guideId);

      if (!deleted) {
        res.status(404).json({ success: false, error: 'Guide not found' });
        return;
      }

      res.json({ success: true, message: 'Guide deleted' });
    } catch (error) {
      logger.error('Delete guide error:', error);
      res.status(500).json({ success: false, error: 'Failed to delete guide' });
    }
  }

  /**
   * Get guides that contain a specific place
   * GET /api/items/:savedItemId/guides
   */
  static async getGuidesForPlace(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { savedItemId } = req.params;

      const guides = await GuideModel.getGuidesContainingPlace(savedItemId);

      res.json({ success: true, data: guides });
    } catch (error) {
      logger.error('Get guides for place error:', error);
      res.status(500).json({ success: false, error: 'Failed to get guides' });
    }
  }
}

