import { Router } from 'express';
import { param } from 'express-validator';
import { PublicController } from '../controllers/public.controller';
import { validate } from '../middleware/validation';

const router = Router();

/**
 * GET /api/public/trips/:id/summary
 * 
 * Get public trip summary for sharing previews.
 * No authentication required.
 */
router.get(
  '/trips/:id/summary',
  validate([param('id').isUUID().withMessage('Invalid trip ID')]),
  PublicController.getTripSummary
);

/**
 * GET /api/public/trips/:id/items
 * 
 * Get all items for a public trip.
 * No authentication required.
 */
router.get(
  '/trips/:id/items',
  validate([param('id').isUUID().withMessage('Invalid trip ID')]),
  PublicController.getTripItems
);

export default router;

