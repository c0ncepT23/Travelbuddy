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
 * - If no places found but food/activity intent detected, queues for AI Chat
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

/**
 * GET /api/share/discovery-queue
 * 
 * Get all pending discovery queue items for the user
 * Optional query param: ?country=Thailand
 */
router.get('/discovery-queue', SmartShareController.getDiscoveryQueue);

/**
 * GET /api/share/discovery-queue/:tripId
 * 
 * Get discovery queue items for a specific trip
 */
router.get('/discovery-queue/:tripId', SmartShareController.getDiscoveryQueue);

/**
 * POST /api/share/discovery-queue/:itemId/explore
 * 
 * Mark a discovery queue item as explored (user tapped on it)
 */
router.post('/discovery-queue/:itemId/explore', SmartShareController.exploreQueueItem);

/**
 * POST /api/share/discovery-queue/:itemId/dismiss
 * 
 * Dismiss a discovery queue item (user not interested)
 */
router.post('/discovery-queue/:itemId/dismiss', SmartShareController.dismissQueueItem);

/**
 * POST /api/share/discovery-queue/:itemId/saved
 * 
 * Mark a discovery queue item as saved (user saved a place from suggestions)
 */
router.post('/discovery-queue/:itemId/saved', SmartShareController.markQueueItemSaved);

export default router;
