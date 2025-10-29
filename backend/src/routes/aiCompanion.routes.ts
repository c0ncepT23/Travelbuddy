import { Router } from 'express';
import { AICompanionController } from '../controllers/aiCompanion.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   POST /api/companion/:id/query
 * @desc    Ask the AI companion a question about saved places
 * @access  Private
 * @body    { query: string, location?: { lat: number, lng: number } }
 */
router.post('/:id/query', AICompanionController.query);

/**
 * @route   POST /api/companion/:id/suggest
 * @desc    Get proactive suggestion based on current location
 * @access  Private
 * @body    { location: { lat: number, lng: number } }
 */
router.post('/:id/suggest', AICompanionController.getProactiveSuggestion);

export default router;

