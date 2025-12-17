/**
 * Smart Share Routes
 * 
 * Zero-friction content sharing endpoints
 */

import { Router } from 'express';
import { body } from 'express-validator';
import { SmartShareController } from '../controllers/smartShare.controller';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validation';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * POST /api/share/process
 * 
 * Process a shared URL with zero friction:
 * - Extracts destination from content
 * - Auto-creates/finds trip for that country
 * - Saves all extracted places
 * - Returns instant results
 */
router.post(
  '/process',
  validate([
    body('url').isURL().withMessage('Valid URL is required'),
  ]),
  SmartShareController.processSharedUrl
);

/**
 * GET /api/share/trips
 * 
 * Get user's trips grouped by country
 * Fallback for manual selection if needed
 */
router.get('/trips', SmartShareController.getCountryTrips);

export default router;

