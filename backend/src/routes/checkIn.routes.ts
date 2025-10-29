import { Router } from 'express';
import { CheckInController } from '../controllers/checkIn.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// Check-in routes (require auth)
router.post('/trips/:tripId/checkin', authenticate, CheckInController.createCheckIn);
router.get('/trips/:tripId/checkins', authenticate, CheckInController.getCheckIns);
router.get('/trips/:tripId/timeline', authenticate, CheckInController.getTimeline);
router.get('/trips/:tripId/stats', authenticate, CheckInController.getTripStats);
router.put('/checkins/:checkinId', authenticate, CheckInController.updateCheckIn);
router.delete('/checkins/:checkinId', authenticate, CheckInController.deleteCheckIn);

// Story routes
router.post('/trips/:tripId/story', authenticate, CheckInController.createStory);
router.put('/story/:storyId', authenticate, CheckInController.updateStory);

// Public story route (no auth required)
router.get('/story/:shareCode', CheckInController.getPublicStory);

export default router;

