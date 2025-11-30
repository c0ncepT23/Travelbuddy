import { Router } from 'express';
import { body } from 'express-validator';
import { NotificationController } from '../controllers/notification.controller';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validation';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Register push notification token
router.post(
  '/register',
  validate([
    body('token').notEmpty().withMessage('Token is required'),
    body('platform').optional().isString(),
  ]),
  NotificationController.registerToken
);

// Unregister push notification token
router.post(
  '/unregister',
  validate([
    body('token').notEmpty().withMessage('Token is required'),
  ]),
  NotificationController.unregisterToken
);

// Get user's registered tokens
router.get(
  '/tokens',
  NotificationController.getTokens
);

/**
 * @route   GET /api/notifications/preferences
 * @desc    Get notification preferences for current user
 * @query   tripId?: string - Optional trip-specific preferences
 */
router.get('/preferences', NotificationController.getPreferences);

/**
 * @route   PUT /api/notifications/preferences
 * @desc    Update notification preferences
 * @query   tripId?: string - Optional trip-specific preferences
 * @body    { morning_briefing?, meal_suggestions?, nearby_alerts?, evening_recap?, 
 *           segment_alerts?, quiet_start?, quiet_end?, max_daily_notifications? }
 */
router.put('/preferences', NotificationController.updatePreferences);

/**
 * @route   POST /api/notifications/test-briefing/:tripId
 * @desc    Test morning briefing notification (sends immediately)
 */
router.post('/test-briefing/:tripId', NotificationController.testMorningBriefing);

/**
 * @route   POST /api/notifications/location/:tripId
 * @desc    Report user location for nearby place alerts
 * @body    { lat: number, lng: number }
 */
router.post(
  '/location/:tripId',
  validate([
    body('lat').isFloat().withMessage('Latitude is required'),
    body('lng').isFloat().withMessage('Longitude is required'),
  ]),
  NotificationController.reportLocation
);

export default router;

