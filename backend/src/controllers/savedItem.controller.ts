import { Response } from 'express';
import { AuthRequest } from '../types';
import { SavedItemService } from '../services/savedItem.service';
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
}

