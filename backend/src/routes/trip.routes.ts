import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { SavedItemController } from '../controllers/savedItem.controller';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validation';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get items grouped by day (for day planner view) - MUST be before /:tripId/items
router.get(
  '/:tripId/items/by-day',
  validate([
    param('tripId').isUUID().withMessage('Invalid trip ID'),
  ]),
  SavedItemController.getItemsByDay
);

// Get smart sub-clusters (cuisine types, place types, etc.)
// Returns: { cuisine_types: [{type: "ramen", count: 3, items: [...]}], place_types: [...] }
router.get(
  '/:tripId/items/clusters',
  validate([
    param('tripId').isUUID().withMessage('Invalid trip ID'),
    query('category').optional().isString(),
  ]),
  SavedItemController.getSubClusters
);

// Get items by sub-type (e.g., all ramen places, all temples)
router.get(
  '/:tripId/items/subtype/:subType',
  validate([
    param('tripId').isUUID().withMessage('Invalid trip ID'),
    param('subType').isString().withMessage('Sub-type is required'),
    query('field').optional().isIn(['cuisine_type', 'place_type']),
  ]),
  SavedItemController.getBySubType
);

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

// Create a new item for a trip (used by AI Scout, Share extension, etc.)
router.post(
  '/:tripId/items',
  validate([
    param('tripId').isUUID().withMessage('Invalid trip ID'),
    body('name').trim().notEmpty().withMessage('Item name is required'),
    body('category').optional().isString(),
    body('description').optional().trim(),
    body('locationName').optional().trim(),
    body('locationLat').optional().isFloat(),
    body('locationLng').optional().isFloat(),
    body('googlePlaceId').optional().isString(),
    body('rating').optional().isFloat(),
    body('userRatingsTotal').optional().isInt(),
  ]),
  SavedItemController.createForTrip
);

// Reorder items within a day (for drag-drop)
router.patch(
  '/:tripId/items/reorder',
  validate([
    param('tripId').isUUID().withMessage('Invalid trip ID'),
    body('day').custom((value) => {
      if (value === null) return true;
      const num = parseInt(value, 10);
      if (isNaN(num) || num < 1) {
        throw new Error('Day must be null or a positive integer');
      }
      return true;
    }),
    body('itemIds').isArray({ min: 1 }).withMessage('itemIds must be a non-empty array'),
    body('itemIds.*').isUUID().withMessage('Each itemId must be a valid UUID'),
  ]),
  SavedItemController.reorderInDay
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

