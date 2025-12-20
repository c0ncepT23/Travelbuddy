import { query } from '../config/database';
import { TripGroupModel } from '../models/tripGroup.model';
import { SavedItemModel } from '../models/savedItem.model';
import { ChatMessageModel } from '../models/chatMessage.model';
import { PushNotificationService } from './pushNotification.service';
import { MessageSenderType, MessageType, TripGroup } from '../types';
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
   * Check for nearby saved items and send PUSH NOTIFICATIONS
   * Sends real push notifications (like WhatsApp) when user is near a saved place
   */
  private static async checkNearbyItems(
    userId: string,
    tripGroupId: string,
    latitude: number,
    longitude: number
  ): Promise<void> {
    try {
      // Get items within 500m - close enough to be actionable
      const nearbyItems = await SavedItemModel.findNearby(
        tripGroupId,
        latitude,
        longitude,
        500 // 500m radius
      );

      if (nearbyItems.length === 0) {
        return;
      }

      // Filter out already checked-in items
      const unvisitedItems = nearbyItems.filter((item: any) => item.status === 'saved');

      if (unvisitedItems.length === 0) {
        return;
      }

      // Check if we've recently sent alert for this location (avoid spam - 30 mins)
      const hasRecentAlert = await this.hasRecentProximityAlert(userId, tripGroupId);
      if (hasRecentAlert) {
        logger.info(`[Location] Skipping proximity alert - recent alert exists for user ${userId}`);
        return;
      }

      // Get the closest unvisited place
      const closestPlace = unvisitedItems[0];
      const distanceText = closestPlace.distance < 100 
        ? 'right here!' 
        : `${Math.round(closestPlace.distance)}m away`;

      // Get category emoji
      const emoji = CATEGORY_EMOJI[closestPlace.category] || '📍';

      // SEND REAL PUSH NOTIFICATION 🔔
      await PushNotificationService.sendToUser(userId, {
        title: `${emoji} ${closestPlace.name} is ${distanceText}`,
        body: unvisitedItems.length > 1 
          ? `You have ${unvisitedItems.length} saved spots nearby. Tap to explore!`
          : `One of your saved spots! Tap to check in.`,
        data: {
          type: 'nearby_alert',
          tripId: tripGroupId,
          placeId: closestPlace.id,
          placeName: closestPlace.name,
          screen: 'TripHome',
        },
        channelId: 'nearby',
      });

      // Record that we sent an alert
      await this.recordProximityAlert(userId, tripGroupId, closestPlace.id);

      logger.info(`[Location] 🔔 Push notification sent to user ${userId}: Near ${closestPlace.name}`);

      // Also send to chat for visibility when they open the app
      if (unvisitedItems.length > 1) {
        await this.sendLocationAlert(tripGroupId, unvisitedItems.slice(0, 3));
      }
    } catch (error) {
      logger.error('Check nearby items error:', error);
    }
  }

  /**
   * Check if we've recently sent a proximity alert to this user (within 30 mins)
   */
  private static async hasRecentProximityAlert(
    userId: string,
    tripGroupId: string
  ): Promise<boolean> {
    try {
      const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);
      
      const result = await query(
        `SELECT COUNT(*) as count FROM proximity_alerts
         WHERE user_id = $1
         AND trip_group_id = $2
         AND created_at > $3`,
        [userId, tripGroupId, thirtyMinsAgo]
      );

      return parseInt(result.rows[0].count) > 0;
    } catch (error) {
      // Table might not exist yet - that's ok
      logger.debug('Proximity alert check (table may not exist):', error);
      return false;
    }
  }

  /**
   * Record that we sent a proximity alert
   */
  private static async recordProximityAlert(
    userId: string,
    tripGroupId: string,
    placeId: string
  ): Promise<void> {
    try {
      await query(
        `INSERT INTO proximity_alerts (user_id, trip_group_id, place_id)
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [userId, tripGroupId, placeId]
      );
    } catch (error) {
      // Table might not exist - create it
      try {
        await query(`
          CREATE TABLE IF NOT EXISTS proximity_alerts (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL,
            trip_group_id INTEGER NOT NULL,
            place_id INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        await query(
          `INSERT INTO proximity_alerts (user_id, trip_group_id, place_id) VALUES ($1, $2, $3)`,
          [userId, tripGroupId, placeId]
        );
      } catch (createError) {
        logger.error('Record proximity alert error:', createError);
      }
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

  /**
   * Update user location globally - checks ALL trips the user is a member of
   * This is the main endpoint for background location tracking
   */
  static async updateLocationGlobal(
    userId: string,
    latitude: number,
    longitude: number
  ): Promise<{ nearbyPlaces: any[]; notificationSent: boolean }> {
    try {
      logger.info(`[Location] Global update for user ${userId}: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);

      // Get all trips the user is a member of
      const userTrips = await TripGroupModel.findByUser(userId);
      
      if (!userTrips || userTrips.length === 0) {
        logger.info(`[Location] User ${userId} has no trips`);
        return { nearbyPlaces: [], notificationSent: false };
      }

      logger.info(`[Location] Checking ${userTrips.length} trips for user ${userId}`);

      // Check for nearby places across ALL trips
      const allNearbyPlaces: any[] = [];
      
      for (const trip of userTrips) {
        try {
          const nearbyItems = await SavedItemModel.findNearby(
            trip.id,
            latitude,
            longitude,
            500 // 500m radius
          );

          // Add trip context to each item
          const itemsWithTrip = nearbyItems.map((item: any) => ({
            ...item,
            tripId: trip.id,
            tripName: trip.name,
            destination: trip.destination,
          }));

          allNearbyPlaces.push(...itemsWithTrip);
        } catch (err) {
          // Skip trips with errors (e.g., deleted)
          logger.debug(`[Location] Skipping trip ${trip.id}:`, err);
        }
      }

      if (allNearbyPlaces.length === 0) {
        return { nearbyPlaces: [], notificationSent: false };
      }

      // Filter to only unvisited places
      const unvisitedPlaces = allNearbyPlaces.filter((item: any) => item.status === 'saved');

      if (unvisitedPlaces.length === 0) {
        logger.info(`[Location] All ${allNearbyPlaces.length} nearby places already visited`);
        return { nearbyPlaces: allNearbyPlaces, notificationSent: false };
      }

      // Check if we've recently sent an alert (globally, not per trip)
      const hasRecentAlert = await this.hasRecentGlobalProximityAlert(userId);
      if (hasRecentAlert) {
        logger.info(`[Location] Skipping notification - recent alert exists for user ${userId}`);
        return { nearbyPlaces: unvisitedPlaces, notificationSent: false };
      }

      // Sort by distance and get closest
      unvisitedPlaces.sort((a: any, b: any) => a.distance - b.distance);
      const closestPlace = unvisitedPlaces[0];

      const distanceText = closestPlace.distance < 100 
        ? 'right here!' 
        : `${Math.round(closestPlace.distance)}m away`;

      const emoji = CATEGORY_EMOJI[closestPlace.category] || '📍';

      // Send push notification
      await PushNotificationService.sendToUser(userId, {
        title: `${emoji} ${closestPlace.name} is ${distanceText}`,
        body: unvisitedPlaces.length > 1 
          ? `You have ${unvisitedPlaces.length} saved spots nearby from your trips. Tap to explore!`
          : `From your ${closestPlace.destination || closestPlace.tripName} trip. Tap to check in!`,
        data: {
          type: 'nearby_alert',
          tripId: closestPlace.tripId,
          placeId: closestPlace.id,
          placeName: closestPlace.name,
          screen: 'TripHome',
        },
        channelId: 'nearby',
      });

      // Record that we sent an alert
      await this.recordGlobalProximityAlert(userId, closestPlace.id);

      logger.info(`[Location] 🔔 Global notification sent to user ${userId}: Near ${closestPlace.name}`);

      return { nearbyPlaces: unvisitedPlaces, notificationSent: true };
    } catch (error: any) {
      logger.error('[Location] Global update error:', error);
      throw error;
    }
  }

  /**
   * Check if we've recently sent a global proximity alert (within 30 mins)
   */
  private static async hasRecentGlobalProximityAlert(userId: string): Promise<boolean> {
    try {
      const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);
      
      const result = await query(
        `SELECT COUNT(*) as count FROM proximity_alerts
         WHERE user_id = $1
         AND created_at > $2`,
        [userId, thirtyMinsAgo]
      );

      return parseInt(result.rows[0].count) > 0;
    } catch (error) {
      // Table might not exist yet
      logger.debug('Global proximity alert check error:', error);
      return false;
    }
  }

  /**
   * Record that we sent a global proximity alert
   */
  private static async recordGlobalProximityAlert(
    userId: string,
    placeId: string
  ): Promise<void> {
    try {
      // Ensure table exists
      await query(`
        CREATE TABLE IF NOT EXISTS proximity_alerts (
          id SERIAL PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL,
          trip_group_id VARCHAR(255),
          place_id VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await query(
        `INSERT INTO proximity_alerts (user_id, place_id)
         VALUES ($1, $2)`,
        [userId, placeId]
      );
    } catch (error) {
      logger.error('Record global proximity alert error:', error);
    }
  }

  /**
   * Get all nearby places across all user's trips
   */
  static async getAllNearbyItems(
    userId: string,
    latitude: number,
    longitude: number,
    radiusMeters: number = 500
  ): Promise<any[]> {
    try {
      const userTrips = await TripGroupModel.findByUser(userId);
      
      if (!userTrips || userTrips.length === 0) {
        return [];
      }

      const allNearbyPlaces: any[] = [];
      
      for (const trip of userTrips) {
        try {
          const nearbyItems = await SavedItemModel.findNearby(
            trip.id,
            latitude,
            longitude,
            radiusMeters
          );

          const itemsWithTrip = nearbyItems.map((item: any) => ({
            ...item,
            tripId: trip.id,
            tripName: trip.name,
            destination: trip.destination,
          }));

          allNearbyPlaces.push(...itemsWithTrip);
        } catch (err) {
          // Skip trips with errors
        }
      }

      // Sort by distance
      allNearbyPlaces.sort((a: any, b: any) => a.distance - b.distance);

      return allNearbyPlaces;
    } catch (error: any) {
      logger.error('Get all nearby items error:', error);
      throw error;
    }
  }
}

