import { Router } from 'express';
import { GuideController } from '../controllers/guide.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get all guides for a trip
// GET /api/trips/:tripGroupId/guides
router.get('/:tripGroupId/guides', GuideController.getGuides);

// Get all guides with their places (for day planner drawer)
// GET /api/trips/:tripGroupId/guides/with-places
router.get('/:tripGroupId/guides/with-places', GuideController.getGuidesWithPlaces);

// Get a single guide with places grouped by day
// GET /api/trips/:tripGroupId/guides/:guideId
router.get('/:tripGroupId/guides/:guideId', GuideController.getGuideById);

// Add a place from guide to user's day plan
// POST /api/trips/:tripGroupId/guides/:guideId/add-to-day
router.post('/:tripGroupId/guides/:guideId/add-to-day', GuideController.addPlaceToDay);

// Delete a guide
// DELETE /api/trips/:tripGroupId/guides/:guideId
router.delete('/:tripGroupId/guides/:guideId', GuideController.deleteGuide);

export default router;

