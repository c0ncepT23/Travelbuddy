import { Response } from 'express';
import { TripSegmentModel } from '../models/tripSegment.model';
import { TripGroupModel } from '../models/tripGroup.model';
import { GooglePlacesService } from '../services/googlePlaces.service';
import { AuthRequest } from '../types';
import logger from '../config/logger';

export class SegmentController {
  /**
   * Create a new segment for a trip
   * POST /api/trips/:tripId/segments
   */
  static async createSegment(req: AuthRequest, res: Response) {
    try {
      const { tripId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }

      // Check membership
      const isMember = await TripGroupModel.isMember(tripId, userId);
      if (!isMember) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }

      const {
        city,
        startDate,
        endDate,
        area,
        country,
        timezone,
        accommodationName,
        accommodationAddress,
        notes,
      } = req.body;

      if (!city || !startDate || !endDate) {
        return res.status(400).json({
          success: false,
          error: 'City, start date, and end date are required',
        });
      }

      // Parse dates
      const start = new Date(startDate);
      const end = new Date(endDate);

      if (end < start) {
        return res.status(400).json({
          success: false,
          error: 'End date must be after start date',
        });
      }

      // Geocode accommodation if provided
      let accommodationLat: number | undefined;
      let accommodationLng: number | undefined;
      let accommodationPlaceId: string | undefined;

      if (accommodationName) {
        try {
          const enriched = await GooglePlacesService.enrichPlace(
            accommodationName,
            city
          );
          if (enriched?.geometry?.location) {
            accommodationLat = enriched.geometry.location.lat;
            accommodationLng = enriched.geometry.location.lng;
            accommodationPlaceId = enriched.place_id;
            logger.info(`Geocoded accommodation: ${accommodationName} -> (${accommodationLat}, ${accommodationLng})`);
          }
        } catch (error) {
          logger.warn(`Failed to geocode accommodation: ${accommodationName}`);
        }
      }

      const segment = await TripSegmentModel.create(
        tripId,
        city,
        start,
        end,
        userId,
        {
          area,
          country,
          timezone,
          accommodationName,
          accommodationAddress,
          accommodationLat,
          accommodationLng,
          accommodationPlaceId,
          notes,
        }
      );

      // Auto-link existing places to this segment
      const linkedCount = await TripSegmentModel.autoLinkPlacesToSegments(tripId);

      // Get places count for this city
      const placesCount = await TripSegmentModel.getPlacesCountForCity(tripId, city);

      res.status(201).json({
        success: true,
        data: {
          ...segment,
          places_count: placesCount.total,
          visited_count: placesCount.visited,
          auto_linked: linkedCount,
        },
        message: `Added ${city} segment! You have ${placesCount.total} places saved there.`,
      });
    } catch (error: any) {
      logger.error('Create segment error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Get all segments for a trip
   * GET /api/trips/:tripId/segments
   */
  static async getSegments(req: AuthRequest, res: Response) {
    try {
      const { tripId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }

      const isMember = await TripGroupModel.isMember(tripId, userId);
      if (!isMember) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }

      const withStats = req.query.withStats === 'true';

      const segments = withStats
        ? await TripSegmentModel.findByTripWithStats(tripId)
        : await TripSegmentModel.findByTrip(tripId);

      res.json({ success: true, data: segments });
    } catch (error: any) {
      logger.error('Get segments error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Get current segment (based on today's date)
   * GET /api/trips/:tripId/segments/current
   */
  static async getCurrentSegment(req: AuthRequest, res: Response) {
    try {
      const { tripId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }

      const isMember = await TripGroupModel.isMember(tripId, userId);
      if (!isMember) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }

      // Allow testing with a custom date
      const forDate = req.query.date ? new Date(req.query.date as string) : undefined;

      const currentInfo = await TripSegmentModel.getCurrentSegment(tripId, forDate);

      // Get next segment if not currently in one
      let nextSegment = null;
      if (!currentInfo.segment) {
        nextSegment = await TripSegmentModel.getNextSegment(tripId, forDate);
      }

      // Get places count if in a segment
      let placesCount = { total: 0, visited: 0 };
      if (currentInfo.segment) {
        placesCount = await TripSegmentModel.getPlacesCountForCity(
          tripId,
          currentInfo.segment.city
        );
      }

      res.json({
        success: true,
        data: {
          ...currentInfo,
          placesInCity: placesCount.total,
          visitedInCity: placesCount.visited,
          unvisitedInCity: placesCount.total - placesCount.visited,
          nextSegment,
        },
      });
    } catch (error: any) {
      logger.error('Get current segment error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Get a specific segment
   * GET /api/trips/:tripId/segments/:segmentId
   */
  static async getSegment(req: AuthRequest, res: Response) {
    try {
      const { tripId, segmentId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }

      const isMember = await TripGroupModel.isMember(tripId, userId);
      if (!isMember) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }

      const segment = await TripSegmentModel.findById(segmentId);

      if (!segment || segment.trip_group_id !== tripId) {
        return res.status(404).json({ success: false, error: 'Segment not found' });
      }

      // Get places count
      const placesCount = await TripSegmentModel.getPlacesCountForCity(tripId, segment.city);

      res.json({
        success: true,
        data: {
          ...segment,
          places_count: placesCount.total,
          visited_count: placesCount.visited,
        },
      });
    } catch (error: any) {
      logger.error('Get segment error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Update a segment
   * PUT /api/trips/:tripId/segments/:segmentId
   */
  static async updateSegment(req: AuthRequest, res: Response) {
    try {
      const { tripId, segmentId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }

      const isMember = await TripGroupModel.isMember(tripId, userId);
      if (!isMember) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }

      const existing = await TripSegmentModel.findById(segmentId);
      if (!existing || existing.trip_group_id !== tripId) {
        return res.status(404).json({ success: false, error: 'Segment not found' });
      }

      const updates: any = {};
      const allowedFields = [
        'city', 'area', 'country', 'timezone', 'start_date', 'end_date',
        'accommodation_name', 'accommodation_address', 'notes', 'order_index'
      ];

      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updates[field] = req.body[field];
        }
      }

      // Re-geocode if accommodation changed
      if (req.body.accommodation_name && req.body.accommodation_name !== existing.accommodation_name) {
        try {
          const city = updates.city || existing.city;
          const enriched = await GooglePlacesService.enrichPlace(req.body.accommodation_name, city);
          if (enriched?.geometry?.location) {
            updates.accommodation_lat = enriched.geometry.location.lat;
            updates.accommodation_lng = enriched.geometry.location.lng;
            updates.accommodation_place_id = enriched.place_id;
          }
        } catch (error) {
          logger.warn(`Failed to geocode updated accommodation`);
        }
      }

      const segment = await TripSegmentModel.update(segmentId, updates);

      // Re-link places if city changed
      if (updates.city && updates.city !== existing.city) {
        await TripSegmentModel.autoLinkPlacesToSegments(tripId);
      }

      res.json({ success: true, data: segment });
    } catch (error: any) {
      logger.error('Update segment error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Delete a segment
   * DELETE /api/trips/:tripId/segments/:segmentId
   */
  static async deleteSegment(req: AuthRequest, res: Response) {
    try {
      const { tripId, segmentId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }

      const isMember = await TripGroupModel.isMember(tripId, userId);
      if (!isMember) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }

      const segment = await TripSegmentModel.findById(segmentId);
      if (!segment || segment.trip_group_id !== tripId) {
        return res.status(404).json({ success: false, error: 'Segment not found' });
      }

      await TripSegmentModel.delete(segmentId);

      res.json({ success: true, message: `Removed ${segment.city} from itinerary` });
    } catch (error: any) {
      logger.error('Delete segment error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Reorder segments
   * PUT /api/trips/:tripId/segments/reorder
   */
  static async reorderSegments(req: AuthRequest, res: Response) {
    try {
      const { tripId } = req.params;
      const userId = req.user?.id;
      const { segmentIds } = req.body;

      if (!userId) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }

      const isMember = await TripGroupModel.isMember(tripId, userId);
      if (!isMember) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }

      if (!Array.isArray(segmentIds)) {
        return res.status(400).json({ success: false, error: 'segmentIds must be an array' });
      }

      await TripSegmentModel.reorder(tripId, segmentIds);

      const segments = await TripSegmentModel.findByTrip(tripId);

      res.json({ success: true, data: segments });
    } catch (error: any) {
      logger.error('Reorder segments error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

