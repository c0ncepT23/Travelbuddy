import { query } from '../config/database';
import { TripGroupModel } from '../models/tripGroup.model';
import { SavedItemModel } from '../models/savedItem.model';
import { ChatMessageModel } from '../models/chatMessage.model';
import { UserModel } from '../models/user.model';
import { MessageSenderType, MessageType, ItemCategory } from '../types';
import logger from '../config/logger';

// Category emoji mapping
const CATEGORY_EMOJI: Record<string, string> = {
  food: '🍽️',
  place: '🏛️',
  shopping: '🛍️',
  activity: '🎯',
  accommodation: '🏨',
  tip: '💡',
};

export class LocationService {
  /**
   * Update user location
   */
  static async updateLocation(
    userId: string,
    tripGroupId: string,
    latitude: number,
    longitude: number
  ): Promise<void> {
    try {
      // Verify user is member
      const isMember = await TripGroupModel.isMember(tripGroupId, userId);
      if (!isMember) {
        throw new Error('Access denied');
      }

      // Update or insert location
      await query(
        `INSERT INTO user_locations (user_id, trip_group_id, latitude, longitude)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, trip_group_id) 
         DO UPDATE SET latitude = $3, longitude = $4, updated_at = CURRENT_TIMESTAMP`,
        [userId, tripGroupId, latitude, longitude]
      );

      logger.info(`Location updated for user ${userId} in trip ${tripGroupId}`);

      // Check for nearby items
      await this.checkNearbyItems(userId, tripGroupId, latitude, longitude);
    } catch (error: any) {
      logger.error('Update location error:', error);
      throw error;
    }
  }

  /**
   * Check for nearby saved items and send suggestions
   * Enhanced: Detects area changes and sends comprehensive summaries
   */
  private static async checkNearbyItems(
    userId: string,
    tripGroupId: string,
    latitude: number,
    longitude: number
  ): Promise<void> {
    try {
      // Get items within larger radius (5km) to detect area-level presence
      const areaItems = await SavedItemModel.findNearby(
        tripGroupId,
        latitude,
        longitude,
        5000 // 5km radius for area detection
      );

      if (areaItems.length === 0) {
        return;
      }

      // Filter out already checked-in items
      const unvisitedItems = areaItems.filter((item: any) => item.status === 'saved');

      if (unvisitedItems.length === 0) {
        return;
      }

      // Determine the area name from the closest items
      const areaName = this.extractAreaName(unvisitedItems);
      
      // Check if we've recently sent alert for this area (avoid spam - 4 hours)
      const recentAlert = await this.hasRecentAreaAlert(tripGroupId, areaName);
      if (recentAlert) {
        // Still check for very close items (within 200m)
        const veryCloseItems = unvisitedItems.filter((item: any) => item.distance < 200);
        if (veryCloseItems.length > 0) {
          const hasRecentCloseAlert = await this.hasRecentLocationAlert(tripGroupId, latitude, longitude);
          if (!hasRecentCloseAlert) {
            await this.sendLocationAlert(tripGroupId, veryCloseItems.slice(0, 1));
          }
        }
        return;
      }

      // Send comprehensive area summary
      await this.sendAreaSummaryAlert(userId, tripGroupId, areaName, unvisitedItems);

      logger.info(`Area summary sent to trip ${tripGroupId}: ${unvisitedItems.length} places in ${areaName}`);
    } catch (error) {
      logger.error('Check nearby items error:', error);
    }
  }

  /**
   * Extract area name from nearby items
   */
  private static extractAreaName(items: any[]): string {
    // Try to get area_name from closest item
    const closestWithArea = items.find(item => item.area_name);
    if (closestWithArea?.area_name) {
      return closestWithArea.area_name;
    }
    
    // Fall back to location_name parsing
    const locationName = items[0]?.location_name || 'this area';
    const parts = locationName.split(',').map((p: string) => p.trim());
    
    // Return first meaningful part (usually area/neighborhood)
    return parts[0] || 'this area';
  }

  /**
   * Check if we've recently sent an area summary alert (within 4 hours)
   */
  private static async hasRecentAreaAlert(
    tripGroupId: string,
    areaName: string
  ): Promise<boolean> {
    try {
      const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
      
      const result = await query(
        `SELECT COUNT(*) as count FROM chat_messages
         WHERE trip_group_id = $1
         AND sender_type = 'agent'
         AND metadata->>'type' = 'area_summary'
         AND metadata->>'area' = $2
         AND created_at > $3`,
        [tripGroupId, areaName, fourHoursAgo]
      );

      return parseInt(result.rows[0].count) > 0;
    } catch (error) {
      logger.error('Error checking recent area alerts:', error);
      return false;
    }
  }

  /**
   * Send comprehensive area summary to chat
   */
  private static async sendAreaSummaryAlert(
    userId: string,
    tripGroupId: string,
    areaName: string,
    items: any[]
  ): Promise<void> {
    try {
      // Get user name
      const user = await UserModel.findById(userId);
      const userName = user?.name?.split(' ')[0] || 'Hey';

      // Group items by category
      const categoryGroups: Record<string, any[]> = {};
      items.forEach((item: any) => {
        const cat = item.category || 'place';
        if (!categoryGroups[cat]) {
          categoryGroups[cat] = [];
        }
        categoryGroups[cat].push(item);
      });

      // Sort each category by rating (highest first)
      Object.keys(categoryGroups).forEach(cat => {
        categoryGroups[cat].sort((a, b) => (b.rating || 0) - (a.rating || 0));
      });

      // Build category breakdown string
      const categoryBreakdown = Object.entries(categoryGroups)
        .map(([cat, catItems]) => {
          const emoji = CATEGORY_EMOJI[cat] || '📍';
          return `${emoji} ${catItems.length}`;
        })
        .join('  •  ');

      // Get top 3 places by rating across all categories
      const allSorted = [...items].sort((a, b) => (b.rating || 0) - (a.rating || 0));
      const topPicks = allSorted.slice(0, 3);

      // Build top picks string
      const topPicksStr = topPicks.map((item: any, idx: number) => {
        const emoji = CATEGORY_EMOJI[item.category] || '📍';
        const rating = item.rating ? `⭐ ${item.rating.toFixed(1)}` : '';
        return `${idx + 1}. ${emoji} ${item.name} ${rating}`;
      }).join('\n');

      // Compose the message
      const message = `📍 ${userName}, you're in **${areaName}**! 🎉\n\n` +
        `You have **${items.length} spots** saved here:\n` +
        `${categoryBreakdown}\n\n` +
        `⭐ **TOP PICKS** (by rating):\n${topPicksStr}\n\n` +
        `Tap any place below to see details, or say "@AI plan ${areaName}" for a full day itinerary!`;

      // Create metadata for frontend rendering
      const metadata = {
        type: 'area_summary',
        area: areaName,
        total_places: items.length,
        categories: Object.fromEntries(
          Object.entries(categoryGroups).map(([cat, catItems]) => [cat, catItems.length])
        ),
        top_picks: topPicks.map((item: any) => ({
          id: item.id,
          name: item.name,
          category: item.category,
          rating: item.rating,
          distance: Math.round(item.distance),
        })),
        all_places: items.slice(0, 10).map((item: any) => ({
          id: item.id,
          name: item.name,
          category: item.category,
          rating: item.rating,
          distance: Math.round(item.distance),
        })),
      };

      // Send as agent message
      await ChatMessageModel.create(
        tripGroupId,
        null,
        MessageSenderType.AGENT,
        MessageType.TEXT,
        message,
        metadata
      );

      logger.info(`Area summary sent for ${areaName}: ${items.length} places`);
    } catch (error) {
      logger.error('Error sending area summary:', error);
      throw error;
    }
  }

  /**
   * Check if we've recently sent an alert for this location (within last hour)
   */
  private static async hasRecentLocationAlert(
    tripGroupId: string,
    _latitude: number,
    _longitude: number
  ): Promise<boolean> {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      const result = await query(
        `SELECT COUNT(*) as count FROM chat_messages
         WHERE trip_group_id = $1
         AND sender_type = 'agent'
         AND message_type = 'system'
         AND metadata->>'type' = 'location_alert'
         AND created_at > $2`,
        [tripGroupId, oneHourAgo]
      );

      return result.rows[0].count > 0;
    } catch (error) {
      logger.error('Error checking recent alerts:', error);
      return false; // On error, allow the alert
    }
  }

  /**
   * Send proactive location alert to chat
   */
  private static async sendLocationAlert(
    tripGroupId: string,
    nearbyItems: any[]
  ): Promise<void> {
    try {
      // Determine location name from the first item
      const locationName = nearbyItems[0].location_name?.split(',')[0] || 'this area';

      let message = '';
      
      if (nearbyItems.length === 1) {
        // Single place
        const item = nearbyItems[0];
        const distanceText = item.distance < 100 
          ? 'right here' 
          : `${Math.round(item.distance)}m away`;
        
        message = `🚨 LOCATION ALERT! You're near **${item.name}**! 🚨\n\n` +
                  `One of your saved spots is ${distanceText}. Want to check it out?`;
      } else {
        // Multiple places
        message = `🚨 LOCATION ALERT! You're in **${locationName}**! 🚨\n\n` +
                  `You saved **${nearbyItems.length} spots** nearby. Which vibe are we catching?`;
      }

      // Create metadata with place information for frontend rendering
      const metadata = {
        type: 'location_alert',
        location: locationName,
        places: nearbyItems.slice(0, 3).map((item: any) => ({
          id: item.id,
          name: item.name,
          category: item.category,
          distance: Math.round(item.distance),
          location_name: item.location_name,
        })),
      };

      // Send as system message from agent
      await ChatMessageModel.create(
        tripGroupId,
        null, // No user sender (it's from the agent)
        MessageSenderType.AGENT,
        MessageType.SYSTEM,
        message,
        metadata
      );

      logger.info(`Proactive location alert sent to trip ${tripGroupId}`);
    } catch (error) {
      logger.error('Error sending location alert:', error);
      throw error;
    }
  }

  /**
   * Get nearby items for a location
   */
  static async getNearbyItems(
    userId: string,
    tripGroupId: string,
    latitude: number,
    longitude: number,
    radiusMeters: number = 500
  ): Promise<any[]> {
    try {
      // Verify user is member
      const isMember = await TripGroupModel.isMember(tripGroupId, userId);
      if (!isMember) {
        throw new Error('Access denied');
      }

      return await SavedItemModel.findNearby(tripGroupId, latitude, longitude, radiusMeters);
    } catch (error: any) {
      logger.error('Get nearby items error:', error);
      throw error;
    }
  }

  /**
   * Get user's current location for a trip
   */
  static async getUserLocation(
    userId: string,
    tripGroupId: string
  ): Promise<{ latitude: number; longitude: number; updated_at: Date } | null> {
    try {
      const result = await query(
        'SELECT latitude, longitude, updated_at FROM user_locations WHERE user_id = $1 AND trip_group_id = $2',
        [userId, tripGroupId]
      );

      return result.rows[0] || null;
    } catch (error) {
      logger.error('Get user location error:', error);
      return null;
    }
  }
}

