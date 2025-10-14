import { query } from '../config/database';
import { TripGroupModel } from '../models/tripGroup.model';
import { SavedItemModel } from '../models/savedItem.model';
import { ChatMessageModel } from '../models/chatMessage.model';
import { MessageSenderType, MessageType } from '../types';
import logger from '../config/logger';

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
   */
  private static async checkNearbyItems(
    _userId: string,
    tripGroupId: string,
    latitude: number,
    longitude: number
  ): Promise<void> {
    try {
      // Get items within 500m
      const nearbyItems = await SavedItemModel.findNearby(
        tripGroupId,
        latitude,
        longitude,
        500
      );

      if (nearbyItems.length === 0) {
        return;
      }

      // Filter out already visited items
      const unvisitedItems = nearbyItems.filter((item) => item.status === 'saved');

      if (unvisitedItems.length === 0) {
        return;
      }

      // Sort by distance
      unvisitedItems.sort((a, b) => a.distance - b.distance);

      // Check if we've recently sent alert for this location (avoid spam)
      const recentAlert = await this.hasRecentLocationAlert(tripGroupId, latitude, longitude);
      if (recentAlert) {
        return;
      }

      // Send proactive location alert message
      await this.sendLocationAlert(tripGroupId, unvisitedItems);

      logger.info(`Location alert sent to trip ${tripGroupId}: ${unvisitedItems.length} nearby places`);
    } catch (error) {
      logger.error('Check nearby items error:', error);
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

