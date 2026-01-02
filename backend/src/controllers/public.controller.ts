import { Request, Response } from 'express';
import { TripGroupService } from '../services/tripGroup.service';
import logger from '../config/logger';

export class PublicController {
  /**
   * Get trip summary for public sharing (OG images, web teasers)
   */
  static async getTripSummary(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const summary = await TripGroupService.getPublicSummary(id);

      res.status(200).json({
        success: true,
        data: summary,
      });
    } catch (error: any) {
      logger.error('Public get trip summary error:', error);
      res.status(404).json({
        success: false,
        error: error.message || 'Trip not found',
      });
    }
  }
}

