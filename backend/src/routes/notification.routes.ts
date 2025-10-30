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

export default router;

