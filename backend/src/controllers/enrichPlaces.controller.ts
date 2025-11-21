import { Request, Response } from 'express';
import { SavedItemModel } from '../models/savedItem.model';
import { TripGroupModel } from '../models/tripGroup.model';
import { GooglePlacesService } from '../services/googlePlaces.service';
import logger from '../config/logger';

export class EnrichPlacesController {
  /**
   * Enrich existing places in a trip with Google Places data
   * POST /api/trips/:tripId/enrich-places
   */
  static async enrichTripPlaces(req: Request, res: Response) {
    try {
      const { tripId } = req.params;
      const userId = (req as any).userId;

      logger.info(`[EnrichPlaces] User ${userId} enriching places for trip ${tripId}`);

      // Validate trip membership
      const isMember = await TripGroupModel.isMember(tripId, userId);
      if (!isMember) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Get all items in trip
      const items = await SavedItemModel.findByTrip(tripId);
      
      logger.info(`[EnrichPlaces] Found ${items.length} items to enrich`);

      let enrichedCount = 0;
      let skippedCount = 0;

      // Enrich each item that doesn't have Google Places data
      for (const item of items) {
        try {
          // Skip if already enriched
          if (item.google_place_id) {
            skippedCount++;
            logger.info(`[EnrichPlaces] Skipping "${item.name}" - already enriched`);
            continue;
          }

          // Skip tips/guides (no physical location)
          if (item.category === 'tip') {
            skippedCount++;
            continue;
          }

          // Enrich with Google Places
          const enriched = await GooglePlacesService.enrichPlace(
            item.name,
            item.location_name
          );

          if (enriched) {
            // Update the item with enriched data
            await SavedItemModel.update(item.id, {
              google_place_id: enriched.place_id,
              rating: enriched.rating,
              user_ratings_total: enriched.user_ratings_total,
              price_level: enriched.price_level,
              formatted_address: enriched.formatted_address,
              area_name: enriched.area_name,
              location_lat: enriched.geometry?.location.lat || item.location_lat,
              location_lng: enriched.geometry?.location.lng || item.location_lng,
              photos_json: enriched.photos,
              opening_hours_json: enriched.opening_hours,
            });

            enrichedCount++;
            logger.info(`[EnrichPlaces] ✅ Enriched "${item.name}" with rating ${enriched.rating}`);
          } else {
            skippedCount++;
            logger.info(`[EnrichPlaces] ⚠️ Could not find Google Places data for "${item.name}"`);
          }

          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error: any) {
          logger.error(`[EnrichPlaces] Error enriching "${item.name}":`, error);
          skippedCount++;
        }
      }

      logger.info(`[EnrichPlaces] Complete: ${enrichedCount} enriched, ${skippedCount} skipped`);

      return res.status(200).json({
        success: true,
        data: {
          total: items.length,
          enriched: enrichedCount,
          skipped: skippedCount,
          message: `Successfully enriched ${enrichedCount} out of ${items.length} places!`,
        },
      });
    } catch (error: any) {
      logger.error('[EnrichPlaces] Error:', error);
      return res.status(500).json({ error: 'Failed to enrich places' });
    }
  }
}

