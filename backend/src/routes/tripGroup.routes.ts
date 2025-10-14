import { Router } from 'express';
import { body, param } from 'express-validator';
import { TripGroupController } from '../controllers/tripGroup.controller';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validation';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Create trip
router.post(
  '/',
  validate([
    body('name').trim().notEmpty().withMessage('Trip name is required'),
    body('destination').trim().notEmpty().withMessage('Destination is required'),
    body('startDate').optional().isISO8601().withMessage('Invalid start date'),
    body('endDate').optional().isISO8601().withMessage('Invalid end date'),
  ]),
  TripGroupController.create
);

// Get user's trips
router.get('/', TripGroupController.getUserTrips);

// Get trip details
router.get(
  '/:id',
  validate([param('id').isUUID().withMessage('Invalid trip ID')]),
  TripGroupController.getTripById
);

// Update trip
router.put(
  '/:id',
  validate([
    param('id').isUUID().withMessage('Invalid trip ID'),
    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
    body('destination').optional().trim().notEmpty().withMessage('Destination cannot be empty'),
    body('startDate').optional().isISO8601().withMessage('Invalid start date'),
    body('endDate').optional().isISO8601().withMessage('Invalid end date'),
  ]),
  TripGroupController.update
);

// Delete trip
router.delete(
  '/:id',
  validate([param('id').isUUID().withMessage('Invalid trip ID')]),
  TripGroupController.delete
);

// Join trip via invite code
router.post(
  '/join',
  validate([
    body('inviteCode')
      .trim()
      .isLength({ min: 6, max: 6 })
      .withMessage('Invalid invite code'),
  ]),
  TripGroupController.joinTrip
);

// Leave trip
router.post(
  '/:id/leave',
  validate([param('id').isUUID().withMessage('Invalid trip ID')]),
  TripGroupController.leaveTrip
);

// Get trip members
router.get(
  '/:id/members',
  validate([param('id').isUUID().withMessage('Invalid trip ID')]),
  TripGroupController.getMembers
);

// Get invite information
router.post(
  '/:id/invite',
  validate([param('id').isUUID().withMessage('Invalid trip ID')]),
  TripGroupController.getInviteInfo
);

// Update trip banner
router.put(
  '/:id/banner',
  validate([
    param('id').isUUID().withMessage('Invalid trip ID'),
    body('bannerUrl').trim().notEmpty().withMessage('Banner URL is required'),
  ]),
  TripGroupController.updateBanner
);

export default router;

