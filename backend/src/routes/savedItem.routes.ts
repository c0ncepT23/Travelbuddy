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
  ]),
  SavedItemController.update
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

