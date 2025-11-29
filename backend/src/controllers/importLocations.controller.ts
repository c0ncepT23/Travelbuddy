import { Response } from 'express';
import { SavedItemModel } from '../models/savedItem.model';
import { TripGroupModel } from '../models/tripGroup.model';
import { ChatMessageModel } from '../models/chatMessage.model';
import { TravelAgent } from '../agents/travelAgent';
import { ItemSourceType, MessageSenderType, MessageType, AuthRequest } from '../types';
import logger from '../config/logger';

export class ImportLocationsController {
  /**
   * Import selected locations from YouTube/Reddit/Instagram
   * POST /api/trips/:tripId/import-locations
   */
  static async importLocations(req: AuthRequest, res: Response) {
    try {
      const { tripId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const { sourceUrl, sourceType, sourceTitle, selectedPlaces } = req.body;

      logger.info(`[ImportLocations] User ${userId} importing ${selectedPlaces.length} places to trip ${tripId}`);

      // Validate trip membership
      const isMember = await TripGroupModel.isMember(tripId, userId);
      if (!isMember) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Validate input
      if (!sourceUrl || !sourceType || !selectedPlaces || !Array.isArray(selectedPlaces)) {
        return res.status(400).json({ error: 'Invalid request data' });
      }

      if (selectedPlaces.length === 0) {
        return res.status(400).json({ error: 'No places selected' });
      }

      // Map source type to ItemSourceType enum
      const sourceTypeMap: Record<string, ItemSourceType> = {
        youtube: ItemSourceType.YOUTUBE,
        reddit: ItemSourceType.REDDIT,
        instagram: ItemSourceType.INSTAGRAM,
      };

      const itemSourceType = sourceTypeMap[sourceType.toLowerCase()];
      if (!itemSourceType) {
        return res.status(400).json({ error: 'Invalid source type' });
      }

      // Save each selected place
      let savedCount = 0;
      const savedItems = [];

      for (const place of selectedPlaces) {
        try {
          // Check for duplicates
          const duplicates = await SavedItemModel.findDuplicates(
            tripId,
            place.name,
            place.location_name
          );

          if (duplicates.length > 0) {
            // Use AI to check if it's truly a duplicate
            const duplicateCheck = await TravelAgent.checkDuplicates(
              place.name,
              duplicates.map((d) => ({ name: d.name, id: d.id }))
            );

            if (duplicateCheck.isDuplicate) {
              logger.info(`[ImportLocations] Skipping duplicate: ${place.name}`);
              continue; // Skip duplicates
            }
          }

          // Create saved item
          const savedItem = await SavedItemModel.create(
            tripId,
            userId,
            place.name,
            place.category,
            place.description,
            itemSourceType,
            place.location_name,
            place.location_lat,
            place.location_lng,
            sourceUrl,
            sourceTitle || place.source_title,
            place.originalContent,
            place.location_confidence,
            place.location_confidence_score,
            // Google Places enrichment fields
            place.google_place_id,
            place.rating,
            place.user_ratings_total,
            place.price_level,
            place.formatted_address,
            place.area_name,
            place.photos_json,
            place.opening_hours_json
          );

          savedItems.push(savedItem);
          savedCount++;
          logger.info(`[ImportLocations] Saved: ${place.name}`);
        } catch (error: any) {
          logger.error(`[ImportLocations] Error saving place ${place.name}:`, error);
          // Continue with other places even if one fails
        }
      }

      // Send agent confirmation message
      const confirmationMessage = savedCount > 0
        ? `✨ Saved ${savedCount} spot${savedCount > 1 ? 's' : ''} to your trip! Check them out in your saved items!`
        : `Hmm, looks like all those places were already in your trip! 🤔`;

      await ChatMessageModel.create(
        tripId,
        null,
        MessageSenderType.AGENT,
        MessageType.TEXT,
        confirmationMessage
      );

      logger.info(`[ImportLocations] Import complete: ${savedCount}/${selectedPlaces.length} places saved`);

      return res.status(200).json({
        success: true,
        data: {
          savedCount,
          totalSelected: selectedPlaces.length,
          savedItems,
        },
      });
    } catch (error: any) {
      logger.error('[ImportLocations] Error:', error);
      return res.status(500).json({ error: 'Failed to import locations' });
    }
  }
}

