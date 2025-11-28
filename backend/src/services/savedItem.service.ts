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
        itemData.originalContent
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
}

