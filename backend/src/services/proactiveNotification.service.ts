/**
 * Proactive Notification Service
 * Handles intelligent, context-aware notifications:
 * - Morning briefings
 * - Nearby place alerts
 * - Evening recaps
 * - Last day warnings
 * - Segment transition alerts
 */

import { PushNotificationService } from './pushNotification.service';
import { AICompanionService } from './aiCompanion.service';
import { NotificationPreferencesModel } from '../models/notificationPreferences.model';
import { TripSegmentModel } from '../models/tripSegment.model';
import { SavedItemModel } from '../models/savedItem.model';
import { TripGroupModel } from '../models/tripGroup.model';
import { UserModel } from '../models/user.model';
import logger from '../config/logger';

interface NearbyAlertData {
  userId: string;
  tripGroupId: string;
  placeId: string;
  placeName: string;
  category: string;
  distance: number;
  sourceTitle?: string;
}

export class ProactiveNotificationService {
  /**
   * Send morning briefing notification to a user
   */
  static async sendMorningBriefing(
    userId: string,
    tripGroupId: string
  ): Promise<boolean> {
    try {
      // Check if notifications are enabled
      const prefs = await NotificationPreferencesModel.findByUser(userId, tripGroupId);
      if (!prefs?.morning_briefing) {
        logger.info(`[ProactiveNotif] Morning briefing disabled for user ${userId}`);
        return false;
      }

      // Get current segment
      const segmentInfo = await TripSegmentModel.getCurrentSegment(tripGroupId);
      if (!segmentInfo.segment) {
        logger.info(`[ProactiveNotif] No active segment for trip ${tripGroupId}`);
        return false;
      }

      const { segment, dayNumber, totalDays, daysRemaining } = segmentInfo;
      const isLastDay = daysRemaining === 0;

      // Get trip info
      const trip = await TripGroupModel.findById(tripGroupId);
      if (!trip) return false;

      // Get city stats
      const stats = await SavedItemModel.getCityStatistics(tripGroupId, segment.city, segment.id);
      
      // Get top pick for the notification
      const topPicks = await SavedItemModel.getTopRated(tripGroupId, {
        city: segment.city,
        segmentId: segment.id,
        excludeVisited: true,
        limit: 1,
      });

      // Build notification content
      let title: string;
      let body: string;

      if (isLastDay) {
        title = `🎯 Last day in ${segment.city}!`;
        body = `${stats.unvisited} places left to visit. `;
        if (topPicks.length > 0) {
          body += `Don't miss ${topPicks[0].name}!`;
        } else {
          body += `Make it count!`;
        }
      } else {
        title = `🌅 Day ${dayNumber} in ${segment.city}`;
        body = `${stats.unvisited} places to explore. `;
        if (topPicks.length > 0) {
          body += `Try ${topPicks[0].name} today!`;
        }
      }

      // Send notification
      await PushNotificationService.sendToUser(userId, {
        title,
        body,
        data: {
          type: 'morning_briefing',
          tripId: tripGroupId,
          screen: 'TripHome',
          segmentId: segment.id,
          city: segment.city,
          dayNumber,
        },
        channelId: 'briefings',
      });

      logger.info(`[ProactiveNotif] Sent morning briefing to user ${userId} for ${segment.city} Day ${dayNumber}`);
      return true;
    } catch (error) {
      logger.error(`[ProactiveNotif] Morning briefing error for user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Send nearby place alert
   */
  static async sendNearbyAlert(data: NearbyAlertData): Promise<boolean> {
    try {
      const { userId, tripGroupId, placeId, placeName, category, distance, sourceTitle } = data;

      // Check if nearby alerts are enabled
      const prefs = await NotificationPreferencesModel.findByUser(userId, tripGroupId);
      if (!prefs?.nearby_alerts) {
        return false;
      }

      // Check quiet hours
      const segmentInfo = await TripSegmentModel.getCurrentSegment(tripGroupId);
      const timezone = segmentInfo.segment?.timezone;
      if (await NotificationPreferencesModel.isQuietTime(userId, timezone)) {
        logger.info(`[ProactiveNotif] Skipping nearby alert - quiet hours for user ${userId}`);
        return false;
      }

      // Category emoji mapping
      const categoryEmojis: Record<string, string> = {
        food: '🍽️',
        shopping: '🛍️',
        place: '📍',
        activity: '🎯',
        accommodation: '🏨',
        tip: '💡',
      };
      const emoji = categoryEmojis[category] || '📍';

      const distanceStr = distance < 100 ? 'right here' : `${Math.round(distance)}m away`;
      
      const title = `${emoji} ${placeName} is ${distanceStr}!`;
      let body = `That's the ${category} spot`;
      if (sourceTitle) {
        body += ` from "${sourceTitle}"`;
      }
      body += `. Want to check it out?`;

      await PushNotificationService.sendToUser(userId, {
        title,
        body,
        data: {
          type: 'nearby_alert',
          tripId: tripGroupId,
          placeId,
          screen: 'TripDetail',
          highlightItemId: placeId,
        },
        channelId: 'nearby',
      });

      logger.info(`[ProactiveNotif] Sent nearby alert to user ${userId} for ${placeName}`);
      return true;
    } catch (error) {
      logger.error(`[ProactiveNotif] Nearby alert error:`, error);
      return false;
    }
  }

  /**
   * Send evening recap notification
   */
  static async sendEveningRecap(
    userId: string,
    tripGroupId: string
  ): Promise<boolean> {
    try {
      // Check if enabled
      const prefs = await NotificationPreferencesModel.findByUser(userId, tripGroupId);
      if (!prefs?.evening_recap) {
        return false;
      }

      // Get current segment
      const segmentInfo = await TripSegmentModel.getCurrentSegment(tripGroupId);
      if (!segmentInfo.segment) {
        return false;
      }

      const { segment, dayNumber, daysRemaining } = segmentInfo;
      const trip = await TripGroupModel.findById(tripGroupId);
      if (!trip) return false;

      // Get today's stats (places visited today would require check-in data)
      const stats = await SavedItemModel.getCityStatistics(tripGroupId, segment.city, segment.id);

      // Build notification
      let title: string;
      let body: string;

      if (daysRemaining === 0) {
        title = `🌙 Last night in ${segment.city}`;
        body = `${stats.visited} places visited, ${stats.unvisited} still on your list. Make the most of tonight!`;
      } else if (daysRemaining === 1) {
        title = `🌆 Evening in ${segment.city}`;
        body = `One more day here! ${stats.unvisited} places left to explore.`;
      } else {
        title = `🌆 Day ${dayNumber} complete!`;
        body = `${stats.visited} places visited in ${segment.city}. ${daysRemaining} days to go!`;
      }

      await PushNotificationService.sendToUser(userId, {
        title,
        body,
        data: {
          type: 'evening_recap',
          tripId: tripGroupId,
          screen: 'TripHome',
          city: segment.city,
          dayNumber,
        },
        channelId: 'briefings',
      });

      logger.info(`[ProactiveNotif] Sent evening recap to user ${userId}`);
      return true;
    } catch (error) {
      logger.error(`[ProactiveNotif] Evening recap error:`, error);
      return false;
    }
  }

  /**
   * Send last day warning (morning of last day)
   */
  static async sendLastDayWarning(
    userId: string,
    tripGroupId: string
  ): Promise<boolean> {
    try {
      const segmentInfo = await TripSegmentModel.getCurrentSegment(tripGroupId);
      if (!segmentInfo.segment || segmentInfo.daysRemaining !== 0) {
        return false; // Not last day
      }

      const { segment } = segmentInfo;
      const stats = await SavedItemModel.getCityStatistics(tripGroupId, segment.city, segment.id);

      // Get must-visit items that haven't been visited
      const mustVisit = await SavedItemModel.getMustVisit(tripGroupId, {
        city: segment.city,
        excludeVisited: true,
        limit: 3,
      });

      let body = `${stats.unvisited} places still on your list!`;
      if (mustVisit.length > 0) {
        body = `Don't miss: ${mustVisit.map(p => p.name).join(', ')}`;
      }

      await PushNotificationService.sendToUser(userId, {
        title: `🚨 Last day in ${segment.city}!`,
        body,
        data: {
          type: 'last_day_warning',
          tripId: tripGroupId,
          screen: 'TripHome',
          city: segment.city,
        },
        channelId: 'briefings',
      });

      logger.info(`[ProactiveNotif] Sent last day warning to user ${userId} for ${segment.city}`);
      return true;
    } catch (error) {
      logger.error(`[ProactiveNotif] Last day warning error:`, error);
      return false;
    }
  }

  /**
   * Send segment transition alert (arriving in new city tomorrow)
   */
  static async sendSegmentTransitionAlert(
    userId: string,
    tripGroupId: string
  ): Promise<boolean> {
    try {
      const prefs = await NotificationPreferencesModel.findByUser(userId, tripGroupId);
      if (!prefs?.segment_alerts) {
        return false;
      }

      // Get current and next segment
      const currentInfo = await TripSegmentModel.getCurrentSegment(tripGroupId);
      const nextSegment = await TripSegmentModel.getNextSegment(tripGroupId);

      if (!nextSegment) {
        return false;
      }

      // Check if next segment starts tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const nextStart = new Date(nextSegment.start_date);
      
      if (nextStart.toDateString() !== tomorrow.toDateString()) {
        return false;
      }

      // Get place count for next city
      const stats = await SavedItemModel.getCityStatistics(tripGroupId, nextSegment.city, nextSegment.id);

      await PushNotificationService.sendToUser(userId, {
        title: `✈️ ${nextSegment.city} tomorrow!`,
        body: `You have ${stats.total} places saved there. ${nextSegment.accommodation_name ? `Staying at ${nextSegment.accommodation_name}` : 'Get ready for adventure!'}`,
        data: {
          type: 'segment_transition',
          tripId: tripGroupId,
          screen: 'TripHome',
          nextCity: nextSegment.city,
          nextSegmentId: nextSegment.id,
        },
        channelId: 'trips',
      });

      logger.info(`[ProactiveNotif] Sent segment transition alert to user ${userId} for ${nextSegment.city}`);
      return true;
    } catch (error) {
      logger.error(`[ProactiveNotif] Segment transition error:`, error);
      return false;
    }
  }

  /**
   * Send meal suggestion based on time of day
   */
  static async sendMealSuggestion(
    userId: string,
    tripGroupId: string,
    mealType: 'breakfast' | 'lunch' | 'dinner'
  ): Promise<boolean> {
    try {
      const prefs = await NotificationPreferencesModel.findByUser(userId, tripGroupId);
      if (!prefs?.meal_suggestions) {
        return false;
      }

      // Get current segment
      const segmentInfo = await TripSegmentModel.getCurrentSegment(tripGroupId);
      if (!segmentInfo.segment) {
        return false;
      }

      const { segment } = segmentInfo;

      // Get food places near hotel
      let foodPlaces: any[] = [];
      if (segment.accommodation_lat && segment.accommodation_lng) {
        foodPlaces = await SavedItemModel.findNearLocation(tripGroupId, segment.accommodation_lat, segment.accommodation_lng, {
          radiusMeters: 1500,
          excludeVisited: true,
          category: 'food' as any,
          limit: 1,
        });
      }

      if (foodPlaces.length === 0) {
        // Fallback to top-rated food
        foodPlaces = await SavedItemModel.getTopRated(tripGroupId, {
          city: segment.city,
          excludeVisited: true,
          category: 'food' as any,
          limit: 1,
        });
      }

      if (foodPlaces.length === 0) {
        return false;
      }

      const place = foodPlaces[0];
      const mealEmoji = mealType === 'breakfast' ? '🥐' : mealType === 'lunch' ? '🍱' : '🍽️';
      const mealName = mealType.charAt(0).toUpperCase() + mealType.slice(1);

      await PushNotificationService.sendToUser(userId, {
        title: `${mealEmoji} ${mealName} time!`,
        body: `How about ${place.name}? ${place.rating ? `⭐ ${place.rating.toFixed(1)}` : ''} ${place.distance ? `(${Math.round(place.distance)}m away)` : ''}`,
        data: {
          type: 'meal_suggestion',
          tripId: tripGroupId,
          placeId: place.id,
          mealType,
          screen: 'TripDetail',
          highlightItemId: place.id,
        },
        channelId: 'suggestions',
      });

      logger.info(`[ProactiveNotif] Sent ${mealType} suggestion to user ${userId}`);
      return true;
    } catch (error) {
      logger.error(`[ProactiveNotif] Meal suggestion error:`, error);
      return false;
    }
  }

  /**
   * Process all morning briefings (called by cron job)
   */
  static async processAllMorningBriefings(): Promise<number> {
    try {
      const users = await NotificationPreferencesModel.getUsersForMorningBriefing(8);
      let sentCount = 0;

      for (const { userId, tripGroupId } of users) {
        const sent = await this.sendMorningBriefing(userId, tripGroupId);
        if (sent) sentCount++;
      }

      logger.info(`[ProactiveNotif] Processed ${sentCount} morning briefings`);
      return sentCount;
    } catch (error) {
      logger.error(`[ProactiveNotif] Error processing morning briefings:`, error);
      return 0;
    }
  }

  /**
   * Process all evening recaps (called by cron job)
   */
  static async processAllEveningRecaps(): Promise<number> {
    try {
      const users = await NotificationPreferencesModel.getUsersForEveningRecap(20);
      let sentCount = 0;

      for (const { userId, tripGroupId } of users) {
        const sent = await this.sendEveningRecap(userId, tripGroupId);
        if (sent) sentCount++;
      }

      logger.info(`[ProactiveNotif] Processed ${sentCount} evening recaps`);
      return sentCount;
    } catch (error) {
      logger.error(`[ProactiveNotif] Error processing evening recaps:`, error);
      return 0;
    }
  }

  /**
   * Check nearby places for a user and send alerts
   */
  static async checkNearbyPlaces(
    userId: string,
    tripGroupId: string,
    lat: number,
    lng: number
  ): Promise<number> {
    try {
      // Get nearby unvisited places
      const nearbyPlaces = await SavedItemModel.findNearby(tripGroupId, lat, lng, 300);
      
      // Filter to unvisited only
      const unvisited = nearbyPlaces.filter((p: any) => p.status !== 'visited');
      
      let alertsSent = 0;
      
      // Send alert for closest unvisited place
      if (unvisited.length > 0) {
        const closest = unvisited[0];
        const sent = await this.sendNearbyAlert({
          userId,
          tripGroupId,
          placeId: closest.id,
          placeName: closest.name,
          category: closest.category,
          distance: closest.distance,
          sourceTitle: closest.source_title,
        });
        if (sent) alertsSent++;
      }

      return alertsSent;
    } catch (error) {
      logger.error(`[ProactiveNotif] Check nearby error:`, error);
      return 0;
    }
  }
}

