/**
 * Cron Job Scheduler
 * Handles scheduled tasks for proactive notifications
 */

import cron from 'node-cron';
import { ProactiveNotificationService } from './proactiveNotification.service';
import logger from '../config/logger';

export class CronJobService {
  private static morningBriefingJob: cron.ScheduledTask | null = null;
  private static eveningRecapJob: cron.ScheduledTask | null = null;
  private static mealSuggestionJobs: cron.ScheduledTask[] = [];

  /**
   * Initialize all cron jobs
   */
  static initialize(): void {
    logger.info('[CronJobs] Initializing scheduled tasks...');

    // Morning briefings - Run every hour from 6am to 10am
    // This catches users in different timezones
    // The actual notification service checks the user's local time
    this.morningBriefingJob = cron.schedule('0 6-10 * * *', async () => {
      logger.info('[CronJobs] Running morning briefing job...');
      try {
        const count = await ProactiveNotificationService.processAllMorningBriefings();
        logger.info(`[CronJobs] Sent ${count} morning briefings`);
      } catch (error) {
        logger.error('[CronJobs] Morning briefing job error:', error);
      }
    }, {
      timezone: 'UTC' // Run in UTC, service handles local time conversion
    });

    // Evening recaps - Run every hour from 6pm to 10pm
    this.eveningRecapJob = cron.schedule('0 18-22 * * *', async () => {
      logger.info('[CronJobs] Running evening recap job...');
      try {
        const count = await ProactiveNotificationService.processAllEveningRecaps();
        logger.info(`[CronJobs] Sent ${count} evening recaps`);
      } catch (error) {
        logger.error('[CronJobs] Evening recap job error:', error);
      }
    }, {
      timezone: 'UTC'
    });

    // Meal suggestions - Lunch at 12pm, Dinner at 7pm (approximate, local time handled by service)
    // Run hourly during meal times to catch different timezones
    const lunchJob = cron.schedule('0 11-13 * * *', async () => {
      logger.info('[CronJobs] Running lunch suggestion job...');
      // This would need to iterate through active users - simplified for now
    }, {
      timezone: 'UTC'
    });
    this.mealSuggestionJobs.push(lunchJob);

    const dinnerJob = cron.schedule('0 18-20 * * *', async () => {
      logger.info('[CronJobs] Running dinner suggestion job...');
      // This would need to iterate through active users - simplified for now
    }, {
      timezone: 'UTC'
    });
    this.mealSuggestionJobs.push(dinnerJob);

    logger.info('[CronJobs] ✅ Scheduled tasks initialized:');
    logger.info('[CronJobs]   - Morning briefings: 6-10 AM UTC (hourly)');
    logger.info('[CronJobs]   - Evening recaps: 6-10 PM UTC (hourly)');
    logger.info('[CronJobs]   - Meal suggestions: Lunch 11-1 PM, Dinner 6-8 PM UTC');
  }

  /**
   * Stop all cron jobs (for graceful shutdown)
   */
  static stop(): void {
    if (this.morningBriefingJob) {
      this.morningBriefingJob.stop();
      this.morningBriefingJob = null;
    }
    if (this.eveningRecapJob) {
      this.eveningRecapJob.stop();
      this.eveningRecapJob = null;
    }
    this.mealSuggestionJobs.forEach(job => job.stop());
    this.mealSuggestionJobs = [];
    
    logger.info('[CronJobs] All scheduled tasks stopped');
  }

  /**
   * Manually trigger morning briefings (for testing)
   */
  static async triggerMorningBriefings(): Promise<number> {
    logger.info('[CronJobs] Manually triggering morning briefings...');
    return await ProactiveNotificationService.processAllMorningBriefings();
  }

  /**
   * Manually trigger evening recaps (for testing)
   */
  static async triggerEveningRecaps(): Promise<number> {
    logger.info('[CronJobs] Manually triggering evening recaps...');
    return await ProactiveNotificationService.processAllEveningRecaps();
  }
}

