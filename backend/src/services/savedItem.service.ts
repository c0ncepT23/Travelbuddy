import { SavedItemModel } from '../models/savedItem.model';
import { TripGroupModel } from '../models/tripGroup.model';
import { SavedItem, ItemCategory, ItemSourceType, ItemStatus } from '../types';
import logger from '../config/logger';

export class SavedItemService {
  /**
   * Create a new saved item
   */
  static async createItem(
    userId: string,
    tripGroupId: string,
    itemData: {
      name: string;
      category: ItemCategory;
      description: string;
      sourceType: ItemSourceType;
      locationName?: string;
      locationLat?: number;
      locationLng?: number;
      sourceUrl?: string;
      sourceTitle?: string;
      originalContent?: any;
      clonedFromJourneyId?: string;
      clonedFromOwnerName?: string;
      destination?: string;
      parent_location?: string;
    }
  ): Promise<SavedItem> {
    try {
      // Verify user is member of trip
      const isMember = await TripGroupModel.isMember(tripGroupId, userId);
      if (!isMember) {
        throw new Error('Access denied');
      }

      const item = await SavedItemModel.create(
        tripGroupId,
        userId,
        itemData.name,
        itemData.category,
        itemData.description,
        itemData.sourceType,
        itemData.locationName,
        itemData.locationLat,
        itemData.locationLng,
        itemData.sourceUrl,
        itemData.sourceTitle,
        itemData.originalContent,
        undefined, // locationConfidence
        undefined, // locationConfidenceScore
        undefined, // googlePlaceId
        undefined, // rating
        undefined, // userRatingsTotal
        undefined, // priceLevel
        undefined, // formattedAddress
        undefined, // areaName
        undefined, // photosJson
        undefined, // openingHoursJson
        undefined, // tags
        undefined, // cuisineType
        undefined, // placeType
        itemData.parent_location,
        itemData.destination,
        itemData.clonedFromJourneyId,
        itemData.clonedFromOwnerName
      );

      logger.info(`Item created: ${item.id} by user ${userId}`);
      return item;
    } catch (error: any) {
      logger.error('Error creating item:', error);
      throw error;
    }
  }

  /**
   * Get item details
   */
  static async getItem(itemId: string, userId: string): Promise<SavedItem> {
    try {
      const item = await SavedItemModel.findById(itemId);
      if (!item) {
        throw new Error('Item not found');
      }

      // Verify user is member of trip
      const isMember = await TripGroupModel.isMember(item.trip_group_id, userId);
      if (!isMember) {
        throw new Error('Access denied');
      }

      return item;
    } catch (error: any) {
      logger.error('Error fetching item:', error);
      throw error;
    }
  }

  /**
   * Get all items for a trip
   */
  static async getTripItems(
    userId: string,
    tripGroupId: string,
    filters?: {
      category?: ItemCategory;
      status?: ItemStatus;
    }
  ): Promise<SavedItem[]> {
    try {
      // Verify user is member of trip
      const isMember = await TripGroupModel.isMember(tripGroupId, userId);
      if (!isMember) {
        throw new Error('Access denied');
      }

      return await SavedItemModel.findByTrip(tripGroupId, filters);
    } catch (error: any) {
      logger.error('Error fetching trip items:', error);
      throw error;
    }
  }

  /**
   * Update item
   */
  static async updateItem(
    userId: string,
    itemId: string,
    updates: Partial<SavedItem>
  ): Promise<SavedItem> {
    try {
      const item = await SavedItemModel.findById(itemId);
      if (!item) {
        throw new Error('Item not found');
      }

      // Verify user is member of trip
      const isMember = await TripGroupModel.isMember(item.trip_group_id, userId);
      if (!isMember) {
        throw new Error('Access denied');
      }

      const updatedItem = await SavedItemModel.update(itemId, updates);
      if (!updatedItem) {
        throw new Error('Failed to update item');
      }

      logger.info(`Item updated: ${itemId} by user ${userId}`);
      return updatedItem;
    } catch (error: any) {
      logger.error('Error updating item:', error);
      throw error;
    }
  }

  /**
   * Delete item
   */
  static async deleteItem(userId: string, itemId: string): Promise<void> {
    try {
      const item = await SavedItemModel.findById(itemId);
      if (!item) {
        throw new Error('Item not found');
      }

      // Only the person who added it or trip owner can delete
      const isOwner = await TripGroupModel.isOwner(item.trip_group_id, userId);
      if (item.added_by !== userId && !isOwner) {
        throw new Error('Only the person who added this item or trip owner can delete it');
      }

      await SavedItemModel.delete(itemId);
      logger.info(`Item deleted: ${itemId} by user ${userId}`);
    } catch (error: any) {
      logger.error('Error deleting item:', error);
      throw error;
    }
  }

  /**
   * Mark item as visited
   */
  static async markItemAsVisited(
    userId: string,
    itemId: string,
    notes?: string
  ): Promise<void> {
    try {
      const item = await SavedItemModel.findById(itemId);
      if (!item) {
        throw new Error('Item not found');
      }

      // Verify user is member of trip
      const isMember = await TripGroupModel.isMember(item.trip_group_id, userId);
      if (!isMember) {
        throw new Error('Access denied');
      }

      await SavedItemModel.markAsVisited(itemId, userId, notes);
      logger.info(`Item marked as visited: ${itemId} by user ${userId}`);
    } catch (error: any) {
      logger.error('Error marking item as visited:', error);
      throw error;
    }
  }

  /**
   * Get nearby items
   */
  static async getNearbyItems(
    userId: string,
    tripGroupId: string,
    lat: number,
    lng: number,
    radiusMeters: number = 500
  ): Promise<any[]> {
    try {
      // Verify user is member of trip
      const isMember = await TripGroupModel.isMember(tripGroupId, userId);
      if (!isMember) {
        throw new Error('Access denied');
      }

      return await SavedItemModel.findNearby(tripGroupId, lat, lng, radiusMeters);
    } catch (error: any) {
      logger.error('Error fetching nearby items:', error);
      throw error;
    }
  }

  /**
   * Search items
   */
  static async searchItems(
    userId: string,
    tripGroupId: string,
    searchQuery: string
  ): Promise<SavedItem[]> {
    try {
      // Verify user is member of trip
      const isMember = await TripGroupModel.isMember(tripGroupId, userId);
      if (!isMember) {
        throw new Error('Access denied');
      }

      return await SavedItemModel.search(tripGroupId, searchQuery);
    } catch (error: any) {
      logger.error('Error searching items:', error);
      throw error;
    }
  }

  /**
   * Get trip statistics
   */
  static async getTripStatistics(userId: string, tripGroupId: string): Promise<any> {
    try {
      // Verify user is member of trip
      const isMember = await TripGroupModel.isMember(tripGroupId, userId);
      if (!isMember) {
        throw new Error('Access denied');
      }

      return await SavedItemModel.getStatistics(tripGroupId);
    } catch (error: any) {
      logger.error('Error fetching trip statistics:', error);
      throw error;
    }
  }

  /**
   * Check for duplicates
   */
  static async checkDuplicates(
    tripGroupId: string,
    name: string,
    locationName?: string
  ): Promise<SavedItem[]> {
    try {
      return await SavedItemModel.findDuplicates(tripGroupId, name, locationName);
    } catch (error: any) {
      logger.error('Error checking duplicates:', error);
      return [];
    }
  }

  /**
   * Toggle favorite status for an item
   */
  static async toggleFavorite(userId: string, itemId: string): Promise<SavedItem> {
    try {
      const item = await SavedItemModel.findById(itemId);
      if (!item) {
        throw new Error('Item not found');
      }

      // Verify user is member of trip
      const isMember = await TripGroupModel.isMember(item.trip_group_id, userId);
      if (!isMember) {
        throw new Error('Access denied');
      }

      const updatedItem = await SavedItemModel.update(itemId, {
        is_favorite: !item.is_favorite,
      });

      if (!updatedItem) {
        throw new Error('Failed to toggle favorite');
      }

      logger.info(`Item ${itemId} favorite toggled to ${updatedItem.is_favorite} by user ${userId}`);
      return updatedItem;
    } catch (error: any) {
      logger.error('Error toggling favorite:', error);
      throw error;
    }
  }

  /**
   * Toggle must-visit status for an item
   */
  static async toggleMustVisit(userId: string, itemId: string): Promise<SavedItem> {
    try {
      const item = await SavedItemModel.findById(itemId);
      if (!item) {
        throw new Error('Item not found');
      }

      // Verify user is member of trip
      const isMember = await TripGroupModel.isMember(item.trip_group_id, userId);
      if (!isMember) {
        throw new Error('Access denied');
      }

      const updatedItem = await SavedItemModel.update(itemId, {
        is_must_visit: !item.is_must_visit,
      });

      if (!updatedItem) {
        throw new Error('Failed to toggle must-visit');
      }

      logger.info(`Item ${itemId} must-visit toggled to ${updatedItem.is_must_visit} by user ${userId}`);
      return updatedItem;
    } catch (error: any) {
      logger.error('Error toggling must-visit:', error);
      throw error;
    }
  }

  /**
   * Update user notes for an item
   */
  static async updateNotes(userId: string, itemId: string, notes: string): Promise<SavedItem> {
    try {
      const item = await SavedItemModel.findById(itemId);
      if (!item) {
        throw new Error('Item not found');
      }

      // Verify user is member of trip
      const isMember = await TripGroupModel.isMember(item.trip_group_id, userId);
      if (!isMember) {
        throw new Error('Access denied');
      }

      const updatedItem = await SavedItemModel.update(itemId, {
        user_notes: notes,
      });

      if (!updatedItem) {
        throw new Error('Failed to update notes');
      }

      logger.info(`Item ${itemId} notes updated by user ${userId}`);
      return updatedItem;
    } catch (error: any) {
      logger.error('Error updating notes:', error);
      throw error;
    }
  }

  /**
   * Get items grouped by day for day planner view
   */
  static async getItemsByDay(
    userId: string,
    tripGroupId: string
  ): Promise<{ day: number | null; items: SavedItem[] }[]> {
    try {
      // Verify user is member of trip
      const isMember = await TripGroupModel.isMember(tripGroupId, userId);
      if (!isMember) {
        throw new Error('Access denied');
      }

      return await SavedItemModel.findByDay(tripGroupId);
    } catch (error: any) {
      logger.error('Error fetching items by day:', error);
      throw error;
    }
  }

  /**
   * Assign item to a specific day
   */
  static async assignItemToDay(
    userId: string,
    itemId: string,
    day: number | null
  ): Promise<SavedItem> {
    try {
      const item = await SavedItemModel.findById(itemId);
      if (!item) {
        throw new Error('Item not found');
      }

      // Verify user is member of trip
      const isMember = await TripGroupModel.isMember(item.trip_group_id, userId);
      if (!isMember) {
        throw new Error('Access denied');
      }

      const updatedItem = await SavedItemModel.assignToDay(itemId, day);
      if (!updatedItem) {
        throw new Error('Failed to assign item to day');
      }

      logger.info(`Item ${itemId} assigned to day ${day} by user ${userId}`);
      return updatedItem;
    } catch (error: any) {
      logger.error('Error assigning item to day:', error);
      throw error;
    }
  }

  /**
   * Reorder items within a day (for drag-drop)
   */
  static async reorderItemsInDay(
    userId: string,
    tripGroupId: string,
    day: number | null,
    itemIds: string[]
  ): Promise<void> {
    try {
      // Verify user is member of trip
      const isMember = await TripGroupModel.isMember(tripGroupId, userId);
      if (!isMember) {
        throw new Error('Access denied');
      }

      await SavedItemModel.reorderInDay(tripGroupId, day, itemIds);
      logger.info(`Items reordered in day ${day} for trip ${tripGroupId} by user ${userId}`);
    } catch (error: any) {
      logger.error('Error reordering items:', error);
      throw error;
    }
  }

  /**
   * Clone items from a shared journey into user's own collection
   */
  static async cloneJourneyItems(
    userId: string,
    targetTripGroupId: string,
    sourceTripGroupId: string
  ): Promise<SavedItem[]> {
    try {
      // 1. Verify target trip exists and user is member
      const isMember = await TripGroupModel.isMember(targetTripGroupId, userId);
      if (!isMember) {
        throw new Error('Access denied to target trip');
      }

      // 2. Get source trip info (for owner name)
      const sourceTrip = await TripGroupModel.findById(sourceTripGroupId);
      if (!sourceTrip) {
        throw new Error('Source trip not found');
      }

      // Get source trip owner name
      const members = await TripGroupModel.getMembers(sourceTripGroupId);
      const owner = members.find(m => m.role === 'owner');
      const ownerName = owner ? owner.name : 'A Friend';

      // 3. Get all items from source trip
      const sourceItems = await SavedItemModel.findByTrip(sourceTripGroupId);
      
      // 4. Clone each item
      const clonedItems: SavedItem[] = [];
      for (const item of sourceItems) {
        // Skip items without names (shouldn't happen but good to be safe)
        if (!item.name) continue;

        const clonedItem = await SavedItemModel.create(
          targetTripGroupId,
          userId,
          item.name,
          item.category,
          item.description,
          item.original_source_type,
          item.location_name,
          item.location_lat,
          item.location_lng,
          item.original_source_url,
          item.source_title,
          item.original_content,
          'high',
          100,
          item.google_place_id,
          item.rating,
          item.user_ratings_total,
          item.price_level,
          item.formatted_address,
          item.area_name,
          item.photos_json,
          item.opening_hours_json,
          item.tags,
          item.cuisine_type,
          item.place_type,
          item.parent_location,
          item.destination,
          sourceTripGroupId,
          ownerName
        );
        clonedItems.push(clonedItem);
      }

      logger.info(`Cloned ${clonedItems.length} items from trip ${sourceTripGroupId} to ${targetTripGroupId} for user ${userId}`);
      return clonedItems;
    } catch (error: any) {
      logger.error('Error cloning journey items:', error);
      throw error;
    }
  }
}

