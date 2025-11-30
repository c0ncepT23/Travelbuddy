import { Response } from 'express';
import { AuthRequest } from '../types';
import { DailyPlanModel } from '../models/dailyPlan.model';
import { DayPlanningService } from '../services/dayPlanning.service';
import { TripGroupModel } from '../models/tripGroup.model';
import logger from '../config/logger';

export class DailyPlanController {
  /**
   * Generate a day plan (or get existing)
   * POST /api/trips/:tripGroupId/plans/generate
   */
  static async generatePlan(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { tripGroupId } = req.params;
      const { date } = req.body;
      const userId = req.user!.id;

      // Verify user is member of trip
      const trip = await TripGroupModel.findById(tripGroupId);
      if (!trip) {
        res.status(404).json({ success: false, error: 'Trip not found' });
        return;
      }

      const isMember = await TripGroupModel.isMember(tripGroupId, userId);
      if (!isMember) {
        res.status(403).json({ success: false, error: 'Not a member of this trip' });
        return;
      }

      // Generate plan
      const targetDate = date ? new Date(date) : new Date();
      const result = await DayPlanningService.generateDayPlan(tripGroupId, userId, targetDate);

      res.json({
        success: true,
        data: {
          plan: result.plan,
          message: result.message,
        },
      });
    } catch (error) {
      logger.error('Generate plan error:', error);
      res.status(500).json({ success: false, error: 'Failed to generate plan' });
    }
  }

  /**
   * Get today's plan
   * GET /api/trips/:tripGroupId/plans/today
   */
  static async getTodaysPlan(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { tripGroupId } = req.params;
      const userId = req.user!.id;

      // Verify membership
      const isMember = await TripGroupModel.isMember(tripGroupId, userId);
      if (!isMember) {
        res.status(403).json({ success: false, error: 'Not a member of this trip' });
        return;
      }

      const plan = await DailyPlanModel.getTodaysPopulatedPlan(tripGroupId);

      res.json({
        success: true,
        data: plan,
      });
    } catch (error) {
      logger.error('Get today plan error:', error);
      res.status(500).json({ success: false, error: 'Failed to get plan' });
    }
  }

  /**
   * Get plan by date
   * GET /api/trips/:tripGroupId/plans/:date
   */
  static async getPlanByDate(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { tripGroupId, date } = req.params;
      const userId = req.user!.id;

      // Verify membership
      const isMember = await TripGroupModel.isMember(tripGroupId, userId);
      if (!isMember) {
        res.status(403).json({ success: false, error: 'Not a member of this trip' });
        return;
      }

      const plan = await DailyPlanModel.findByDate(tripGroupId, new Date(date));
      
      if (plan) {
        const populated = await DailyPlanModel.getPopulatedPlan(plan.id);
        res.json({ success: true, data: populated });
      } else {
        res.json({ success: true, data: null });
      }
    } catch (error) {
      logger.error('Get plan by date error:', error);
      res.status(500).json({ success: false, error: 'Failed to get plan' });
    }
  }

  /**
   * Get all plans for trip
   * GET /api/trips/:tripGroupId/plans
   */
  static async getAllPlans(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { tripGroupId } = req.params;
      const userId = req.user!.id;

      // Verify membership
      const isMember = await TripGroupModel.isMember(tripGroupId, userId);
      if (!isMember) {
        res.status(403).json({ success: false, error: 'Not a member of this trip' });
        return;
      }

      const plans = await DailyPlanModel.findByTrip(tripGroupId);

      res.json({ success: true, data: plans });
    } catch (error) {
      logger.error('Get all plans error:', error);
      res.status(500).json({ success: false, error: 'Failed to get plans' });
    }
  }

  /**
   * Update plan stops (reorder, add, remove)
   * PUT /api/trips/:tripGroupId/plans/:planId/stops
   */
  static async updateStops(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { planId } = req.params;
      const { stops, routeData, totalDurationMinutes, totalDistanceMeters } = req.body;
      const userId = req.user!.id;

      const plan = await DailyPlanModel.findById(planId);
      if (!plan) {
        res.status(404).json({ success: false, error: 'Plan not found' });
        return;
      }

      // Verify membership
      const isMember = await TripGroupModel.isMember(plan.trip_group_id, userId);
      if (!isMember) {
        res.status(403).json({ success: false, error: 'Not a member of this trip' });
        return;
      }

      const updated = await DailyPlanModel.updateStops(
        planId,
        stops,
        routeData,
        totalDurationMinutes,
        totalDistanceMeters
      );

      res.json({ success: true, data: updated });
    } catch (error) {
      logger.error('Update stops error:', error);
      res.status(500).json({ success: false, error: 'Failed to update plan' });
    }
  }

  /**
   * Swap a stop with another place
   * POST /api/trips/:tripGroupId/plans/:planId/swap
   */
  static async swapStop(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { planId } = req.params;
      const { oldItemId, newItemId } = req.body;
      const userId = req.user!.id;

      const plan = await DailyPlanModel.findById(planId);
      if (!plan) {
        res.status(404).json({ success: false, error: 'Plan not found' });
        return;
      }

      // Verify membership
      const isMember = await TripGroupModel.isMember(plan.trip_group_id, userId);
      if (!isMember) {
        res.status(403).json({ success: false, error: 'Not a member of this trip' });
        return;
      }

      const updated = await DailyPlanModel.swapStop(planId, oldItemId, newItemId);

      res.json({ success: true, data: updated });
    } catch (error) {
      logger.error('Swap stop error:', error);
      res.status(500).json({ success: false, error: 'Failed to swap stop' });
    }
  }

  /**
   * Add a stop to plan
   * POST /api/trips/:tripGroupId/plans/:planId/stops
   */
  static async addStop(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { planId } = req.params;
      const { savedItemId, plannedTime, durationMinutes } = req.body;
      const userId = req.user!.id;

      const plan = await DailyPlanModel.findById(planId);
      if (!plan) {
        res.status(404).json({ success: false, error: 'Plan not found' });
        return;
      }

      // Verify membership
      const isMember = await TripGroupModel.isMember(plan.trip_group_id, userId);
      if (!isMember) {
        res.status(403).json({ success: false, error: 'Not a member of this trip' });
        return;
      }

      const updated = await DailyPlanModel.addStop(planId, savedItemId, plannedTime, durationMinutes);

      res.json({ success: true, data: updated });
    } catch (error) {
      logger.error('Add stop error:', error);
      res.status(500).json({ success: false, error: 'Failed to add stop' });
    }
  }

  /**
   * Remove a stop from plan
   * DELETE /api/trips/:tripGroupId/plans/:planId/stops/:savedItemId
   */
  static async removeStop(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { planId, savedItemId } = req.params;
      const userId = req.user!.id;

      const plan = await DailyPlanModel.findById(planId);
      if (!plan) {
        res.status(404).json({ success: false, error: 'Plan not found' });
        return;
      }

      // Verify membership
      const isMember = await TripGroupModel.isMember(plan.trip_group_id, userId);
      if (!isMember) {
        res.status(403).json({ success: false, error: 'Not a member of this trip' });
        return;
      }

      const updated = await DailyPlanModel.removeStop(planId, savedItemId);

      res.json({ success: true, data: updated });
    } catch (error) {
      logger.error('Remove stop error:', error);
      res.status(500).json({ success: false, error: 'Failed to remove stop' });
    }
  }

  /**
   * Update plan status (active/completed/cancelled)
   * PUT /api/trips/:tripGroupId/plans/:planId/status
   */
  static async updateStatus(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { planId } = req.params;
      const { status } = req.body;
      const userId = req.user!.id;

      if (!['active', 'completed', 'cancelled'].includes(status)) {
        res.status(400).json({ success: false, error: 'Invalid status' });
        return;
      }

      const plan = await DailyPlanModel.findById(planId);
      if (!plan) {
        res.status(404).json({ success: false, error: 'Plan not found' });
        return;
      }

      // Verify membership
      const isMember = await TripGroupModel.isMember(plan.trip_group_id, userId);
      if (!isMember) {
        res.status(403).json({ success: false, error: 'Not a member of this trip' });
        return;
      }

      const updated = await DailyPlanModel.updateStatus(planId, status);

      res.json({ success: true, data: updated });
    } catch (error) {
      logger.error('Update status error:', error);
      res.status(500).json({ success: false, error: 'Failed to update status' });
    }
  }

  /**
   * Delete a plan
   * DELETE /api/trips/:tripGroupId/plans/:planId
   */
  static async deletePlan(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { planId } = req.params;
      const userId = req.user!.id;

      const plan = await DailyPlanModel.findById(planId);
      if (!plan) {
        res.status(404).json({ success: false, error: 'Plan not found' });
        return;
      }

      // Verify membership
      const isMember = await TripGroupModel.isMember(plan.trip_group_id, userId);
      if (!isMember) {
        res.status(403).json({ success: false, error: 'Not a member of this trip' });
        return;
      }

      await DailyPlanModel.delete(planId);

      res.json({ success: true, message: 'Plan deleted' });
    } catch (error) {
      logger.error('Delete plan error:', error);
      res.status(500).json({ success: false, error: 'Failed to delete plan' });
    }
  }
}

