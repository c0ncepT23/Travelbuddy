import { Router } from 'express';
import { param, query } from 'express-validator';
import { SavedItemController } from '../controllers/savedItem.controller';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validation';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get all items for a trip
router.get(
  '/:tripId/items',
  validate([
    param('tripId').isUUID().withMessage('Invalid trip ID'),
    query('category').optional().isString(),
    query('status').optional().isIn(['saved', 'visited']),
  ]),
  SavedItemController.getTripItems
);

// Search items in a trip
router.get(
  '/:tripId/search',
  validate([
    param('tripId').isUUID().withMessage('Invalid trip ID'),
    query('q').notEmpty().withMessage('Search query required'),
  ]),
  SavedItemController.search
);

export default router;

