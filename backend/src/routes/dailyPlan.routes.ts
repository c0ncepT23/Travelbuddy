import { Router } from 'express';
import { DailyPlanController } from '../controllers/dailyPlan.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Generate a new day plan
// POST /api/trips/:tripGroupId/plans/generate
router.post('/:tripGroupId/plans/generate', DailyPlanController.generatePlan);

// Get today's plan
// GET /api/trips/:tripGroupId/plans/today
router.get('/:tripGroupId/plans/today', DailyPlanController.getTodaysPlan);

// Get all plans for trip
// GET /api/trips/:tripGroupId/plans
router.get('/:tripGroupId/plans', DailyPlanController.getAllPlans);

// Get plan by date
// GET /api/trips/:tripGroupId/plans/:date (date format: YYYY-MM-DD)
router.get('/:tripGroupId/plans/:date', DailyPlanController.getPlanByDate);

// Update plan stops
// PUT /api/trips/:tripGroupId/plans/:planId/stops
router.put('/:tripGroupId/plans/:planId/stops', DailyPlanController.updateStops);

// Add a stop to plan
// POST /api/trips/:tripGroupId/plans/:planId/stops
router.post('/:tripGroupId/plans/:planId/stops', DailyPlanController.addStop);

// Remove a stop from plan
// DELETE /api/trips/:tripGroupId/plans/:planId/stops/:savedItemId
router.delete('/:tripGroupId/plans/:planId/stops/:savedItemId', DailyPlanController.removeStop);

// Swap a stop
// POST /api/trips/:tripGroupId/plans/:planId/swap
router.post('/:tripGroupId/plans/:planId/swap', DailyPlanController.swapStop);

// Update plan status
// PUT /api/trips/:tripGroupId/plans/:planId/status
router.put('/:tripGroupId/plans/:planId/status', DailyPlanController.updateStatus);

// Delete plan
// DELETE /api/trips/:tripGroupId/plans/:planId
router.delete('/:tripGroupId/plans/:planId', DailyPlanController.deletePlan);

export default router;

