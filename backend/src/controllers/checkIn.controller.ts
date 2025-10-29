import { Response } from 'express';
import { AuthRequest } from '../types';
import { CheckInModel } from '../models/checkIn.model';
import { TripStoryModel } from '../models/tripStory.model';
import logger from '../config/logger';

export class CheckInController {
  /**
   * Create a new check-in
   * POST /api/trips/:tripId/checkin
   */
  static async createCheckIn(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { tripId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const {
        savedItemId,
        checkedInAt,
        rating,
        note,
        cost,
        currency,
        photos,
        actualLocationLat,
        actualLocationLng,
        weather,
        withUsers,
        isAutoCheckIn,
        isVisible,
        sharedPublicly,
      } = req.body;

      if (!savedItemId) {
        res.status(400).json({ error: 'savedItemId is required' });
        return;
      }

      const checkIn = await CheckInModel.create({
        userId,
        tripGroupId: tripId,
        savedItemId,
        checkedInAt: checkedInAt ? new Date(checkedInAt) : undefined,
        rating,
        note,
        cost,
        currency,
        photos,
        actualLocationLat,
        actualLocationLng,
        weather,
        withUsers,
        isAutoCheckIn,
        isVisible,
        sharedPublicly,
      });

      logger.info(`[CheckIn] User ${userId} checked in to item ${savedItemId}`);

      res.status(201).json({
        success: true,
        data: checkIn,
      });
    } catch (error: any) {
      logger.error('[CheckIn] Error creating check-in:', error);
      res.status(500).json({ error: 'Failed to create check-in' });
    }
  }

  /**
   * Get all check-ins for a trip
   * GET /api/trips/:tripId/checkins
   */
  static async getCheckIns(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { tripId } = req.params;

      const checkIns = await CheckInModel.findByTrip(tripId);

      res.json({
        success: true,
        data: checkIns,
      });
    } catch (error: any) {
      logger.error('[CheckIn] Error fetching check-ins:', error);
      res.status(500).json({ error: 'Failed to fetch check-ins' });
    }
  }

  /**
   * Get timeline for a trip
   * GET /api/trips/:tripId/timeline
   */
  static async getTimeline(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { tripId } = req.params;
      const { groupByDay } = req.query;

      if (groupByDay === 'true') {
        const timeline = await CheckInModel.getTimelineByDay(tripId);
        res.json({
          success: true,
          data: timeline,
        });
        return;
      }

      const timeline = await CheckInModel.getTimeline(tripId);

      res.json({
        success: true,
        data: timeline,
      });
    } catch (error: any) {
      logger.error('[CheckIn] Error fetching timeline:', error);
      res.status(500).json({ error: 'Failed to fetch timeline' });
    }
  }

  /**
   * Update a check-in
   * PUT /api/checkins/:checkinId
   */
  static async updateCheckIn(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { checkinId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Verify ownership
      const existingCheckIn = await CheckInModel.findById(checkinId);
      if (!existingCheckIn) {
        res.status(404).json({ error: 'Check-in not found' });
        return;
      }

      if (existingCheckIn.user_id !== userId) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }

      const updates = req.body;
      
      // Convert date strings to Date objects
      if (updates.checkedOutAt) {
        updates.checkedOutAt = new Date(updates.checkedOutAt);
      }

      const updatedCheckIn = await CheckInModel.update(checkinId, updates);

      res.json({
        success: true,
        data: updatedCheckIn,
      });
    } catch (error: any) {
      logger.error('[CheckIn] Error updating check-in:', error);
      res.status(500).json({ error: 'Failed to update check-in' });
    }
  }

  /**
   * Delete a check-in
   * DELETE /api/checkins/:checkinId
   */
  static async deleteCheckIn(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { checkinId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Verify ownership
      const existingCheckIn = await CheckInModel.findById(checkinId);
      if (!existingCheckIn) {
        res.status(404).json({ error: 'Check-in not found' });
        return;
      }

      if (existingCheckIn.user_id !== userId) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }

      await CheckInModel.delete(checkinId);

      res.json({
        success: true,
        message: 'Check-in deleted',
      });
    } catch (error: any) {
      logger.error('[CheckIn] Error deleting check-in:', error);
      res.status(500).json({ error: 'Failed to delete check-in' });
    }
  }

  /**
   * Get trip statistics
   * GET /api/trips/:tripId/stats
   */
  static async getTripStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { tripId } = req.params;

      const stats = await CheckInModel.getTripStats(tripId);

      if (!stats) {
        res.status(404).json({ error: 'Trip not found' });
        return;
      }

      res.json({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      logger.error('[CheckIn] Error fetching trip stats:', error);
      res.status(500).json({ error: 'Failed to fetch stats' });
    }
  }

  /**
   * Create or get trip story
   * POST /api/trips/:tripId/story
   */
  static async createStory(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { tripId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Check if story already exists
      const existing = await TripStoryModel.findByTrip(tripId);
      if (existing) {
        res.json({
          success: true,
          data: existing,
          message: 'Story already exists',
        });
        return;
      }

      const {
        isPublic,
        title,
        description,
        heroImageUrl,
        coverPhotos,
        themeColor,
        showRatings,
        showPhotos,
        showCosts,
        showNotes,
        showCompanions,
        expiresAt,
      } = req.body;

      const story = await TripStoryModel.create({
        tripGroupId: tripId,
        userId,
        isPublic,
        title,
        description,
        heroImageUrl,
        coverPhotos,
        themeColor,
        showRatings,
        showPhotos,
        showCosts,
        showNotes,
        showCompanions,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      });

      logger.info(`[Story] Created story ${story.share_code} for trip ${tripId}`);

      res.status(201).json({
        success: true,
        data: story,
      });
    } catch (error: any) {
      logger.error('[Story] Error creating story:', error);
      res.status(500).json({ error: 'Failed to create story' });
    }
  }

  /**
   * Get public story (no auth required)
   * GET /api/story/:shareCode
   */
  static async getPublicStory(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { shareCode } = req.params;

      const story = await TripStoryModel.findByShareCode(shareCode);

      if (!story) {
        res.status(404).json({ error: 'Story not found' });
        return;
      }

      // Check if expired
      if (await TripStoryModel.isExpired(story)) {
        res.status(410).json({ error: 'Story has expired' });
        return;
      }

      // Check if public
      if (!story.is_public) {
        res.status(403).json({ error: 'Story is private' });
        return;
      }

      // Increment view count
      await TripStoryModel.incrementViews(story.id);

      // Get timeline
      const timeline = await CheckInModel.getTimelineByDay(story.trip_group_id);

      // Filter based on story settings
      const filteredTimeline = timeline.map(day => ({
        ...day,
        check_ins: day.check_ins.map(ci => ({
          ...ci,
          rating: story.show_ratings ? ci.rating : undefined,
          note: story.show_notes ? ci.note : undefined,
          cost: story.show_costs ? ci.cost : undefined,
          photos: story.show_photos ? ci.photos : undefined,
          with_users: story.show_companions ? ci.with_users : undefined,
        })),
      }));

      // Get stats
      const stats = await CheckInModel.getTripStats(story.trip_group_id);

      res.json({
        success: true,
        data: {
          story,
          timeline: filteredTimeline,
          stats,
        },
      });
    } catch (error: any) {
      logger.error('[Story] Error fetching public story:', error);
      res.status(500).json({ error: 'Failed to fetch story' });
    }
  }

  /**
   * Update story
   * PUT /api/story/:storyId
   */
  static async updateStory(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { storyId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Verify ownership
      const existingStory = await TripStoryModel.findByShareCode(storyId);
      if (!existingStory) {
        res.status(404).json({ error: 'Story not found' });
        return;
      }

      if (existingStory.user_id !== userId) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }

      const updates = req.body;
      if (updates.expiresAt) {
        updates.expiresAt = new Date(updates.expiresAt);
      }

      const updatedStory = await TripStoryModel.update(existingStory.id, updates);

      res.json({
        success: true,
        data: updatedStory,
      });
    } catch (error: any) {
      logger.error('[Story] Error updating story:', error);
      res.status(500).json({ error: 'Failed to update story' });
    }
  }
}

