import { Router } from 'express';
import { body, param } from 'express-validator';
import { SavedItemController } from '../controllers/savedItem.controller';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { ItemCategory, ItemSourceType } from '../types';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Create item
router.post(
  '/',
  validate([
    body('tripGroupId').isUUID().withMessage('Invalid trip ID'),
    body('name').trim().notEmpty().withMessage('Item name is required'),
    body('category')
      .isIn(Object.values(ItemCategory))
      .withMessage('Invalid category'),
    body('description').trim().notEmpty().withMessage('Description is required'),
    body('sourceType')
      .isIn(Object.values(ItemSourceType))
      .withMessage('Invalid source type'),
    body('locationName').optional().trim(),
    body('locationLat').optional().isFloat(),
    body('locationLng').optional().isFloat(),
    body('sourceUrl').optional().isURL().withMessage('Invalid source URL'),
  ]),
  SavedItemController.create
);

// Get item details
router.get(
  '/:id',
  validate([param('id').isUUID().withMessage('Invalid item ID')]),
  SavedItemController.getById
);

// Update item
router.put(
  '/:id',
  validate([
    param('id').isUUID().withMessage('Invalid item ID'),
    body('name').optional().trim().notEmpty(),
    body('category').optional().isIn(Object.values(ItemCategory)),
    body('description').optional().trim().notEmpty(),
    body('status').optional().isIn(['saved', 'visited']),
    body('is_favorite').optional().isBoolean(),
    body('is_must_visit').optional().isBoolean(),
  ]),
  SavedItemController.update
);

// Toggle favorite status
router.patch(
  '/:id/favorite',
  validate([param('id').isUUID().withMessage('Invalid item ID')]),
  SavedItemController.toggleFavorite
);

// Toggle must-visit status
router.patch(
  '/:id/must-visit',
  validate([param('id').isUUID().withMessage('Invalid item ID')]),
  SavedItemController.toggleMustVisit
);

// Assign item to a specific day (day planner)
router.patch(
  '/:id/assign-day',
  validate([
    param('id').isUUID().withMessage('Invalid item ID'),
    body('day').custom((value) => {
      if (value === null) return true;
      const num = parseInt(value, 10);
      if (isNaN(num) || num < 1) {
        throw new Error('Day must be null or a positive integer');
      }
      return true;
    }),
  ]),
  SavedItemController.assignToDay
);

// Update user notes
router.patch(
  '/:id/notes',
  validate([
    param('id').isUUID().withMessage('Invalid item ID'),
    body('notes').isString().withMessage('Notes must be a string'),
  ]),
  SavedItemController.updateNotes
);

// Delete item
router.delete(
  '/:id',
  validate([param('id').isUUID().withMessage('Invalid item ID')]),
  SavedItemController.delete
);

// Mark item as visited
router.post(
  '/:id/visit',
  validate([
    param('id').isUUID().withMessage('Invalid item ID'),
    body('notes').optional().trim(),
  ]),
  SavedItemController.markAsVisited
);

export default router;

