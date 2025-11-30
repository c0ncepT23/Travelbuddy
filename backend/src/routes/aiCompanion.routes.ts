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

/**
 * @route   GET /api/companion/:id/briefing
 * @desc    Get morning briefing with segment-aware suggestions
 * @access  Private
 * @query   location?: { lat: number, lng: number } (optional, passed in body)
 * @returns {
 *   greeting: string,
 *   segment: { city, dayNumber, totalDays, daysRemaining, hotel? },
 *   topPicks: SavedItem[],      // Highest rated unvisited in current city
 *   nearbyHotel: SavedItem[],   // Places near hotel
 *   stats: { total, visited, remaining, byCategory },
 *   suggestions: string[],      // Time-appropriate action suggestions
 *   timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night'
 * }
 */
router.get('/:id/briefing', AICompanionController.getMorningBriefing);
router.post('/:id/briefing', AICompanionController.getMorningBriefing);

/**
 * @route   GET /api/companion/:id/context
 * @desc    Get full companion context for segment-aware AI
 * @access  Private
 * @returns CompanionContext with full trip, segment, and places info
 */
router.get('/:id/context', AICompanionController.getCompanionContext);
router.post('/:id/context', AICompanionController.getCompanionContext);

export default router;

