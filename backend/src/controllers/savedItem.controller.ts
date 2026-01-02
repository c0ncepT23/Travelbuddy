import { Response } from 'express';
import { AuthRequest } from '../types';
import { SavedItemService } from '../services/savedItem.service';
import { GooglePlacesService } from '../services/googlePlaces.service';
import { SavedItemModel } from '../models/savedItem.model';
import { DiscoveryQueueModel } from '../models/discoveryQueue.model';
import logger from '../config/logger';

export class SavedItemController {
  /**
   * Create a new item
   */
  static async create(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { tripGroupId, ...itemData } = req.body;

      const item = await SavedItemService.createItem(req.user.id, tripGroupId, itemData);

      res.status(201).json({
        success: true,
        data: item,
        message: 'Item saved successfully',
      });
    } catch (error: any) {
      logger.error('Create item error:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to create item',
      });
    }
  }

  /**
   * Create a new item for a specific trip (tripId from URL params)
   */
  static async createForTrip(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { tripId } = req.params;
      const itemData = req.body;

      const item = await SavedItemService.createItem(req.user.id, tripId, itemData);

      res.status(201).json({
        success: true,
        data: item,
        message: 'Item saved successfully',
      });
    } catch (error: any) {
      logger.error('Create item for trip error:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to create item',
      });
    }
  }

  /**
   * Get item details
   */
  static async getById(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { id } = req.params;
      const item = await SavedItemService.getItem(id, req.user.id);

      res.status(200).json({
        success: true,
        data: item,
      });
    } catch (error: any) {
      logger.error('Get item error:', error);
      const statusCode = error.message === 'Access denied' ? 403 : 404;
      res.status(statusCode).json({
        success: false,
        error: error.message || 'Failed to fetch item',
      });
    }
  }

  /**
   * Get all items for a trip
   */
  static async getTripItems(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { tripId } = req.params;
      const { category, status } = req.query;

      const filters: any = {};
      if (category) filters.category = category;
      if (status) filters.status = status;

      const items = await SavedItemService.getTripItems(req.user.id, tripId, filters);

      res.status(200).json({
        success: true,
        data: items,
      });
    } catch (error: any) {
      logger.error('Get trip items error:', error);
      res.status(403).json({
        success: false,
        error: error.message || 'Failed to fetch items',
      });
    }
  }

  /**
   * Update item
   */
  static async update(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { id } = req.params;
      const updates = req.body;

      const item = await SavedItemService.updateItem(req.user.id, id, updates);

      res.status(200).json({
        success: true,
        data: item,
        message: 'Item updated successfully',
      });
    } catch (error: any) {
      logger.error('Update item error:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to update item',
      });
    }
  }

  /**
   * Delete item
   */
  static async delete(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { id } = req.params;
      await SavedItemService.deleteItem(req.user.id, id);

      res.status(200).json({
        success: true,
        message: 'Item deleted successfully',
      });
    } catch (error: any) {
      logger.error('Delete item error:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to delete item',
      });
    }
  }

  /**
   * Mark item as visited
   */
  static async markAsVisited(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { id } = req.params;
      const { notes } = req.body;

      await SavedItemService.markItemAsVisited(req.user.id, id, notes);

      res.status(200).json({
        success: true,
        message: 'Item marked as visited',
      });
    } catch (error: any) {
      logger.error('Mark as visited error:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to mark item as visited',
      });
    }
  }

  /**
   * Search items
   */
  static async search(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { tripId } = req.params;
      const { q } = req.query;

      if (!q || typeof q !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Search query required',
        });
        return;
      }

      const items = await SavedItemService.searchItems(req.user.id, tripId, q);

      res.status(200).json({
        success: true,
        data: items,
      });
    } catch (error: any) {
      logger.error('Search items error:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Search failed',
      });
    }
  }

  /**
   * Toggle favorite status
   */
  static async toggleFavorite(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { id } = req.params;
      const item = await SavedItemService.toggleFavorite(req.user.id, id);

      res.status(200).json({
        success: true,
        data: item,
        message: item.is_favorite ? 'Added to favorites' : 'Removed from favorites',
      });
    } catch (error: any) {
      logger.error('Toggle favorite error:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to toggle favorite',
      });
    }
  }

  /**
   * Toggle must-visit status
   */
  static async toggleMustVisit(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { id } = req.params;
      const item = await SavedItemService.toggleMustVisit(req.user.id, id);

      res.status(200).json({
        success: true,
        data: item,
        message: item.is_must_visit ? 'Marked as must-visit' : 'Removed must-visit status',
      });
    } catch (error: any) {
      logger.error('Toggle must-visit error:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to toggle must-visit',
      });
    }
  }

  /**
   * Update user notes for an item
   */
  static async updateNotes(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { id } = req.params;
      const { notes } = req.body;

      const item = await SavedItemService.updateNotes(req.user.id, id, notes);

      res.status(200).json({
        success: true,
        data: item,
        message: 'Notes updated successfully',
      });
    } catch (error: any) {
      logger.error('Update notes error:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to update notes',
      });
    }
  }

  /**
   * Get items grouped by day for day planner view
   */
  static async getItemsByDay(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { tripId } = req.params;
      const groupedItems = await SavedItemService.getItemsByDay(req.user.id, tripId);

      res.status(200).json({
        success: true,
        data: groupedItems,
      });
    } catch (error: any) {
      logger.error('Get items by day error:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to fetch items by day',
      });
    }
  }

  /**
   * Assign item to a specific day
   */
  static async assignToDay(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { id } = req.params;
      const { day } = req.body;

      // day can be null (unassign) or a positive integer
      const dayNumber = day === null ? null : parseInt(day, 10);
      
      if (day !== null && (isNaN(dayNumber!) || dayNumber! < 1)) {
        res.status(400).json({
          success: false,
          error: 'Day must be null or a positive integer',
        });
        return;
      }

      const item = await SavedItemService.assignItemToDay(req.user.id, id, dayNumber);

      res.status(200).json({
        success: true,
        data: item,
        message: dayNumber === null ? 'Item unassigned from day' : `Item assigned to Day ${dayNumber}`,
      });
    } catch (error: any) {
      logger.error('Assign to day error:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to assign item to day',
      });
    }
  }

  /**
   * Reorder items within a day (for drag-drop)
   */
  static async reorderInDay(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { tripId } = req.params;
      const { day, itemIds } = req.body;

      if (!Array.isArray(itemIds) || itemIds.length === 0) {
        res.status(400).json({
          success: false,
          error: 'itemIds must be a non-empty array',
        });
        return;
      }

      // day can be null (unassigned section) or a positive integer
      const dayNumber = day === null ? null : parseInt(day, 10);
      
      if (day !== null && (isNaN(dayNumber!) || dayNumber! < 1)) {
        res.status(400).json({
          success: false,
          error: 'Day must be null or a positive integer',
        });
        return;
      }

      await SavedItemService.reorderItemsInDay(req.user.id, tripId, dayNumber, itemIds);

      res.status(200).json({
        success: true,
        message: 'Items reordered successfully',
      });
    } catch (error: any) {
      logger.error('Reorder items error:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to reorder items',
      });
    }
  }

  /**
   * Enrich item with Google Places data (photos, rating, etc.)
   */
  static async enrichWithGoogle(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { id } = req.params;
      
      // Get the item first
      const item = await SavedItemService.getItem(id, req.user.id);
      
      if (!item) {
        res.status(404).json({ success: false, error: 'Item not found' });
        return;
      }

      // Skip if already enriched with photos
      if (item.photos_json && item.photos_json.length > 0) {
        res.status(200).json({
          success: true,
          data: item,
          message: 'Item already enriched',
        });
        return;
      }

      // Build search query with location hint
      const locationHint = item.location_name || item.formatted_address || '';
      logger.info(`[Enrich] Enriching "${item.name}" with hint: ${locationHint}`);

      const googleData = await GooglePlacesService.enrichPlace(item.name, locationHint);

      if (!googleData) {
        res.status(200).json({
          success: true,
          data: item,
          message: 'No Google data found for this place',
        });
        return;
      }

      // Update the item with Google data
      const updates: any = {};
      
      if (googleData.place_id) updates.google_place_id = googleData.place_id;
      if (googleData.rating) updates.rating = googleData.rating;
      if (googleData.user_ratings_total) updates.user_ratings_total = googleData.user_ratings_total;
      if (googleData.price_level !== undefined) updates.price_level = googleData.price_level;
      if (googleData.formatted_address) updates.formatted_address = googleData.formatted_address;
      if (googleData.area_name) updates.area_name = googleData.area_name;
      if (googleData.photos && googleData.photos.length > 0) {
        updates.photos_json = JSON.stringify(googleData.photos);
      }
      if (googleData.opening_hours) {
        updates.opening_hours_json = JSON.stringify(googleData.opening_hours);
      }
      if (googleData.geometry?.location) {
        // Only update location if not already set
        if (!item.location_lat || !item.location_lng) {
          updates.location_lat = googleData.geometry.location.lat;
          updates.location_lng = googleData.geometry.location.lng;
        }
      }

      // Update in database
      const updatedItem = await SavedItemModel.update(id, updates);

      logger.info(`[Enrich] Successfully enriched "${item.name}" - Rating: ${googleData.rating}, Photos: ${googleData.photos?.length || 0}`);

      res.status(200).json({
        success: true,
        data: updatedItem,
        message: 'Item enriched with Google data',
      });
    } catch (error: any) {
      logger.error('Enrich item error:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to enrich item',
      });
    }
  }

  /**
   * Get smart sub-clusters for browsing
   * Returns cuisine_types (ramen, wagyu, cheesecake), place_types (temple, shrine), etc.
   * This enables users to browse by "what" they want (e.g., "I want ramen") instead of just categories
   */
  static async getSubClusters(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { tripId } = req.params;
      const { category } = req.query;

      const clusters = await SavedItemModel.getSubClusters(
        tripId,
        category as any
      );

      res.status(200).json({
        success: true,
        data: clusters,
      });
    } catch (error: any) {
      logger.error('Get sub-clusters error:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to get sub-clusters',
      });
    }
  }

  /**
   * Get items by sub-type (cuisine_type or place_type)
   * e.g., GET /trips/:tripId/items/subtype/ramen?field=cuisine_type
   */
  static async getBySubType(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { tripId, subType } = req.params;
      const field = (req.query.field as string) || 'cuisine_type';

      if (field !== 'cuisine_type' && field !== 'place_type') {
        res.status(400).json({
          success: false,
          error: 'Field must be cuisine_type or place_type',
        });
        return;
      }

      const items = await SavedItemModel.findBySubType(tripId, subType, field);

      res.status(200).json({
        success: true,
        data: items,
      });
    } catch (error: any) {
      logger.error('Get by sub-type error:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to get items by sub-type',
      });
    }
  }

  /**
   * Create item from discovery queue with Places API enrichment
   * This is the "Save" action from the Explore tab
   */
  static async createFromDiscovery(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { tripId } = req.params;
      const { discoveryItemId, name, city, country } = req.body;

      logger.info(`[CreateFromDiscovery] Processing: "${name}" in ${city}, ${country}`);

      // Get the discovery item to verify it exists and get source info
      const discoveryItem = await DiscoveryQueueModel.getById(discoveryItemId);
      if (!discoveryItem) {
        res.status(404).json({ success: false, error: 'Discovery item not found' });
        return;
      }

      // Search for the place using Google Places API
      const searchQuery = `${name} ${city}`;
      logger.info(`[CreateFromDiscovery] Searching Google Places: "${searchQuery}"`);

      const googleData = await GooglePlacesService.enrichPlace(name, city);

      // Build the item data
      const itemData: any = {
        name: googleData?.name || name,
        category: 'food', // Discovery items are typically food suggestions
        description: `Found via AI: "${discoveryItem.vibe || discoveryItem.item}"`,
        destination: country || discoveryItem.country,
        cuisineType: discoveryItem.item, // The food item they were looking for
        sourceUrl: discoveryItem.source_url,
        sourceTitle: discoveryItem.source_title,
      };

      // Add Google Places enrichment if found
      if (googleData) {
        if (googleData.place_id) itemData.googlePlaceId = googleData.place_id;
        if (googleData.rating) itemData.rating = googleData.rating;
        if (googleData.user_ratings_total) itemData.userRatingsTotal = googleData.user_ratings_total;
        if (googleData.price_level !== undefined) itemData.priceLevel = googleData.price_level;
        if (googleData.formatted_address) itemData.formattedAddress = googleData.formatted_address;
        if (googleData.area_name) itemData.locationName = googleData.area_name;
        if (googleData.geometry?.location) {
          itemData.locationLat = googleData.geometry.location.lat;
          itemData.locationLng = googleData.geometry.location.lng;
        }
        if (googleData.photos && googleData.photos.length > 0) {
          itemData.photosJson = JSON.stringify(googleData.photos);
        }
        if (googleData.opening_hours) {
          itemData.openingHoursJson = JSON.stringify(googleData.opening_hours);
        }
        logger.info(`[CreateFromDiscovery] Found: "${googleData.name}" - Rating: ${googleData.rating}, Photos: ${googleData.photos?.length || 0}`);
      } else {
        logger.warn(`[CreateFromDiscovery] No Google data found for "${name}" in ${city}`);
      }

      // Create the saved item
      const item = await SavedItemService.createItem(req.user.id, tripId, itemData);

      // Mark the discovery item as saved
      await DiscoveryQueueModel.markSaved(discoveryItemId);

      res.status(201).json({
        success: true,
        data: item,
        message: 'Place saved successfully',
      });
    } catch (error: any) {
      logger.error('Create from discovery error:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to save place',
      });
    }
  }

  /**
   * Clone all items from one trip to another
   */
  static async cloneTrip(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { sourceTripId, targetTripId } = req.body;

      if (!sourceTripId || !targetTripId) {
        res.status(400).json({
          success: false,
          error: 'sourceTripId and targetTripId are required',
        });
        return;
      }

      const clonedItems = await SavedItemService.cloneJourneyItems(
        req.user.id,
        targetTripId,
        sourceTripId
      );

      res.status(201).json({
        success: true,
        data: clonedItems,
        message: `Successfully cloned ${clonedItems.length} items`,
      });
    } catch (error: any) {
      logger.error('Clone trip error:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to clone trip',
      });
    }
  }
}

