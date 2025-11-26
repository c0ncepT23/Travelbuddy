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
}

