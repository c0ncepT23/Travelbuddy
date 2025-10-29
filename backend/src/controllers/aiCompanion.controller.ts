import { Response } from 'express';
import { AuthRequest } from '../types';
import { AICompanionService } from '../services/aiCompanion.service';
import logger from '../config/logger';

export class AICompanionController {
  /**
   * Process a user query to the AI companion
   */
  static async query(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { id: tripGroupId } = req.params;
      const { query, location } = req.body;

      if (!query || typeof query !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Query is required',
        });
        return;
      }

      const response = await AICompanionService.processQuery(
        req.user.id,
        tripGroupId,
        query,
        location
      );

      res.status(200).json({
        success: true,
        data: response,
      });
    } catch (error: any) {
      logger.error('AI Companion query error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to process query',
      });
    }
  }

  /**
   * Get proactive suggestion based on location
   */
  static async getProactiveSuggestion(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { id: tripGroupId } = req.params;
      const { location } = req.body;

      if (!location || !location.lat || !location.lng) {
        res.status(400).json({
          success: false,
          error: 'Location is required',
        });
        return;
      }

      const suggestion = await AICompanionService.generateProactiveSuggestion(
        req.user.id,
        tripGroupId,
        location
      );

      if (!suggestion) {
        res.status(200).json({
          success: true,
          data: null,
          message: 'No nearby places found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: suggestion,
      });
    } catch (error: any) {
      logger.error('Proactive suggestion error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to generate suggestion',
      });
    }
  }
}

