/**
 * Proactive Notification Service (Mobile)
 * Handles local notification scheduling and background location for:
 * - Morning briefings
 * - Nearby place alerts
 * - Meal time suggestions
 */

import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../config/api';

const BACKGROUND_LOCATION_TASK = 'background-location-task';
const MORNING_BRIEFING_KEY = 'morning_briefing_scheduled';
const NEARBY_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

interface NotificationPreferences {
  morningBriefing: boolean;
  mealSuggestions: boolean;
  nearbyAlerts: boolean;
  eveningRecap: boolean;
  segmentAlerts: boolean;
  quietStart: string; // HH:MM
  quietEnd: string;   // HH:MM
}

class ProactiveNotificationServiceClass {
  private currentTripId: string | null = null;
  private lastNearbyCheck: number = 0;
  private preferences: NotificationPreferences = {
    morningBriefing: true,
    mealSuggestions: true,
    nearbyAlerts: true,
    eveningRecap: true,
    segmentAlerts: true,
    quietStart: '22:00',
    quietEnd: '07:00',
  };

  /**
   * Initialize proactive notifications for a trip
   */
  async initialize(tripId: string): Promise<void> {
    this.currentTripId = tripId;
    
    // Load preferences
    await this.loadPreferences();
    
    // Setup notification channels
    await this.setupNotificationChannels();
    
    // Schedule morning briefing
    if (this.preferences.morningBriefing) {
      await this.scheduleMorningBriefing();
    }

    console.log('[ProactiveNotif] Initialized for trip', tripId);
  }

  /**
   * Setup Android notification channels
   */
  private async setupNotificationChannels(): Promise<void> {
    // Briefings channel (morning/evening)
    await Notifications.setNotificationChannelAsync('briefings', {
      name: 'Daily Briefings',
      description: 'Morning briefings and evening recaps',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#2563EB',
      sound: 'default',
    });

    // Nearby alerts channel
    await Notifications.setNotificationChannelAsync('nearby', {
      name: 'Nearby Places',
      description: 'Alerts when you\'re near saved places',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 100, 100, 100],
      lightColor: '#10B981',
      sound: 'default',
    });

    // Suggestions channel
    await Notifications.setNotificationChannelAsync('suggestions', {
      name: 'Suggestions',
      description: 'Meal and activity suggestions',
      importance: Notifications.AndroidImportance.DEFAULT,
      lightColor: '#F59E0B',
    });

    console.log('[ProactiveNotif] Notification channels configured');
  }

  /**
   * Load notification preferences from backend
   */
  async loadPreferences(): Promise<void> {
    try {
      const response = await api.get('/notifications/preferences', {
        params: { tripId: this.currentTripId },
      });
      
      if (response.data.success && response.data.data) {
        const data = response.data.data;
        this.preferences = {
          morningBriefing: data.morning_briefing,
          mealSuggestions: data.meal_suggestions,
          nearbyAlerts: data.nearby_alerts,
          eveningRecap: data.evening_recap,
          segmentAlerts: data.segment_alerts,
          quietStart: data.quiet_start,
          quietEnd: data.quiet_end,
        };
      }
    } catch (error) {
      console.error('[ProactiveNotif] Failed to load preferences:', error);
    }
  }

  /**
   * Update notification preferences
   */
  async updatePreferences(updates: Partial<NotificationPreferences>): Promise<void> {
    try {
      await api.put('/notifications/preferences', {
        morning_briefing: updates.morningBriefing,
        meal_suggestions: updates.mealSuggestions,
        nearby_alerts: updates.nearbyAlerts,
        evening_recap: updates.eveningRecap,
        segment_alerts: updates.segmentAlerts,
        quiet_start: updates.quietStart,
        quiet_end: updates.quietEnd,
      }, {
        params: { tripId: this.currentTripId },
      });
      
      this.preferences = { ...this.preferences, ...updates };
      
      // Reschedule morning briefing if preference changed
      if (updates.morningBriefing !== undefined) {
        if (updates.morningBriefing) {
          await this.scheduleMorningBriefing();
        } else {
          await this.cancelMorningBriefing();
        }
      }
    } catch (error) {
      console.error('[ProactiveNotif] Failed to update preferences:', error);
      throw error;
    }
  }

  /**
   * Schedule morning briefing local notification
   */
  async scheduleMorningBriefing(): Promise<string | null> {
    try {
      // Cancel existing scheduled briefing
      await this.cancelMorningBriefing();

      // Calculate next 8am
      const now = new Date();
      const scheduledTime = new Date();
      scheduledTime.setHours(8, 0, 0, 0);
      
      // If it's already past 8am today, schedule for tomorrow
      if (now >= scheduledTime) {
        scheduledTime.setDate(scheduledTime.getDate() + 1);
      }

      const secondsUntil = Math.floor((scheduledTime.getTime() - now.getTime()) / 1000);

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: '🌅 Good morning!',
          body: 'Tap to see your daily briefing',
          data: {
            type: 'morning_briefing',
            tripId: this.currentTripId,
            screen: 'TripHome',
          },
          sound: 'default',
        },
        trigger: {
          seconds: secondsUntil,
          channelId: 'briefings',
        },
      });

      await AsyncStorage.setItem(MORNING_BRIEFING_KEY, notificationId);
      console.log(`[ProactiveNotif] Morning briefing scheduled for ${scheduledTime.toLocaleString()}`);
      
      return notificationId;
    } catch (error) {
      console.error('[ProactiveNotif] Failed to schedule morning briefing:', error);
      return null;
    }
  }

  /**
   * Cancel scheduled morning briefing
   */
  async cancelMorningBriefing(): Promise<void> {
    try {
      const notificationId = await AsyncStorage.getItem(MORNING_BRIEFING_KEY);
      if (notificationId) {
        await Notifications.cancelScheduledNotificationAsync(notificationId);
        await AsyncStorage.removeItem(MORNING_BRIEFING_KEY);
        console.log('[ProactiveNotif] Morning briefing cancelled');
      }
    } catch (error) {
      console.error('[ProactiveNotif] Failed to cancel morning briefing:', error);
    }
  }

  /**
   * Check if currently in quiet hours
   */
  isQuietTime(): boolean {
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    const { quietStart, quietEnd } = this.preferences;
    
    // Handle overnight quiet hours
    if (quietStart > quietEnd) {
      return currentTime >= quietStart || currentTime < quietEnd;
    }
    
    return currentTime >= quietStart && currentTime < quietEnd;
  }

  /**
   * Report current location to backend for nearby alerts
   */
  async reportLocation(lat: number, lng: number): Promise<void> {
    if (!this.currentTripId || !this.preferences.nearbyAlerts) {
      return;
    }

    // Throttle location reports
    const now = Date.now();
    if (now - this.lastNearbyCheck < NEARBY_CHECK_INTERVAL) {
      return;
    }
    this.lastNearbyCheck = now;

    // Don't send during quiet hours
    if (this.isQuietTime()) {
      return;
    }

    try {
      await api.post(`/notifications/location/${this.currentTripId}`, {
        lat,
        lng,
      });
      console.log(`[ProactiveNotif] Location reported: ${lat}, ${lng}`);
    } catch (error) {
      console.error('[ProactiveNotif] Failed to report location:', error);
    }
  }

  /**
   * Request background location permissions
   */
  async requestBackgroundLocationPermission(): Promise<boolean> {
    try {
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      if (foregroundStatus !== 'granted') {
        console.log('[ProactiveNotif] Foreground location permission denied');
        return false;
      }

      const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
      if (backgroundStatus !== 'granted') {
        console.log('[ProactiveNotif] Background location permission denied');
        return false;
      }

      return true;
    } catch (error) {
      console.error('[ProactiveNotif] Location permission error:', error);
      return false;
    }
  }

  /**
   * Start background location tracking
   */
  async startBackgroundLocationTracking(): Promise<boolean> {
    try {
      const hasPermission = await this.requestBackgroundLocationPermission();
      if (!hasPermission) {
        return false;
      }

      const isTaskDefined = TaskManager.isTaskDefined(BACKGROUND_LOCATION_TASK);
      if (!isTaskDefined) {
        console.log('[ProactiveNotif] Background location task not defined');
        return false;
      }

      const hasStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      if (hasStarted) {
        console.log('[ProactiveNotif] Background location already running');
        return true;
      }

      await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
        accuracy: Location.Accuracy.Balanced,
        distanceInterval: 100, // Update every 100 meters
        timeInterval: 5 * 60 * 1000, // Or every 5 minutes
        foregroundService: {
          notificationTitle: 'Travel Companion',
          notificationBody: 'Tracking location for nearby alerts',
          notificationColor: '#2563EB',
        },
        pausesUpdatesAutomatically: true,
        activityType: Location.ActivityType.OtherNavigation,
      });

      console.log('[ProactiveNotif] Background location tracking started');
      return true;
    } catch (error) {
      console.error('[ProactiveNotif] Failed to start background location:', error);
      return false;
    }
  }

  /**
   * Stop background location tracking
   */
  async stopBackgroundLocationTracking(): Promise<void> {
    try {
      const hasStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      if (hasStarted) {
        await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
        console.log('[ProactiveNotif] Background location tracking stopped');
      }
    } catch (error) {
      console.error('[ProactiveNotif] Failed to stop background location:', error);
    }
  }

  /**
   * Trigger a test notification
   */
  async sendTestNotification(type: 'briefing' | 'nearby' | 'suggestion'): Promise<void> {
    const configs = {
      briefing: {
        title: '🌅 Good morning!',
        body: 'Day 2 in Osaka! 5 places to explore today.',
        channelId: 'briefings',
      },
      nearby: {
        title: '🍽️ Ichiran Ramen is 200m away!',
        body: 'That ramen spot from your saved places. Want to check it out?',
        channelId: 'nearby',
      },
      suggestion: {
        title: '🍱 Lunch time!',
        body: 'How about Tsukiji Market? ⭐ 4.5',
        channelId: 'suggestions',
      },
    };

    const config = configs[type];

    await Notifications.scheduleNotificationAsync({
      content: {
        title: config.title,
        body: config.body,
        data: { type, tripId: this.currentTripId, screen: 'TripHome' },
        sound: 'default',
      },
      trigger: { seconds: 1, channelId: config.channelId },
    });
  }

  /**
   * Cleanup when leaving a trip
   */
  async cleanup(): Promise<void> {
    await this.cancelMorningBriefing();
    await this.stopBackgroundLocationTracking();
    this.currentTripId = null;
    console.log('[ProactiveNotif] Cleaned up');
  }

  /**
   * Get current preferences
   */
  getPreferences(): NotificationPreferences {
    return { ...this.preferences };
  }
}

// Export singleton
export const proactiveNotificationService = new ProactiveNotificationServiceClass();

// Define background location task
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }: any) => {
  if (error) {
    console.error('[BackgroundLocation] Error:', error);
    return;
  }
  
  if (data) {
    const { locations } = data;
    if (locations && locations.length > 0) {
      const { latitude, longitude } = locations[0].coords;
      await proactiveNotificationService.reportLocation(latitude, longitude);
    }
  }
});

export default proactiveNotificationService;

