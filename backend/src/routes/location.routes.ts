import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { LocationController } from '../controllers/location.controller';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validation';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Update location
router.post(
  '/update',
  validate([
    body('tripGroupId').isUUID().withMessage('Invalid trip ID'),
    body('latitude').isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
    body('longitude').isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude'),
  ]),
  LocationController.updateLocation
);

// Get nearby items
router.get(
  '/:tripId/nearby',
  validate([
    param('tripId').isUUID().withMessage('Invalid trip ID'),
    query('latitude').isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
    query('longitude').isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude'),
    query('radius').optional().isInt({ min: 100, max: 5000 }),
  ]),
  LocationController.getNearbyItems
);

export default router;

