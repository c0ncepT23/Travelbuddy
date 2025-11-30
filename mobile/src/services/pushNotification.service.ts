import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../config/api';

// Configure how notifications behave when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

class PushNotificationService {
  private expoPushToken: string | null = null;
  private notificationListener: Notifications.Subscription | null = null;
  private responseListener: Notifications.Subscription | null = null;

  /**
   * Initialize push notifications
   * Call this on app startup
   */
  async initialize(): Promise<string | null> {
    try {
      // Only works on physical devices
      if (!Device.isDevice) {
        console.log('[PushNotification] Must use physical device for push notifications');
        return null;
      }

      // Check/request permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('[PushNotification] Permission not granted');
        return null;
      }

      // Get Expo push token (works with FCM on Android)
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: process.env.EXPO_PUBLIC_PROJECT_ID, // Your Expo project ID
      });
      this.expoPushToken = tokenData.data;
      console.log('[PushNotification] Token:', this.expoPushToken);

      // Configure Android channels
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#2563EB',
        });

        // Chat messages channel
        await Notifications.setNotificationChannelAsync('chat', {
          name: 'Chat Messages',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 100, 100, 100],
          lightColor: '#2563EB',
          sound: 'default',
        });

        // Trip updates channel
        await Notifications.setNotificationChannelAsync('trips', {
          name: 'Trip Updates',
          importance: Notifications.AndroidImportance.DEFAULT,
          lightColor: '#10B981',
        });

        // Daily briefings channel (morning/evening)
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
      }

      // Register token with backend
      await this.registerTokenWithBackend();

      return this.expoPushToken;
    } catch (error) {
      console.error('[PushNotification] Error initializing:', error);
      return null;
    }
  }

  /**
   * Register push token with backend
   */
  private async registerTokenWithBackend(): Promise<void> {
    if (!this.expoPushToken) return;

    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        console.log('[PushNotification] No auth token, skipping registration');
        return;
      }

      await api.post('/notifications/register', {
        token: this.expoPushToken,
        platform: Platform.OS,
        deviceId: Device.modelId || 'unknown',
      });

      console.log('[PushNotification] Token registered with backend');
    } catch (error) {
      console.error('[PushNotification] Error registering token:', error);
    }
  }

  /**
   * Set up notification listeners
   * @param onNotificationReceived - Called when notification is received while app is open
   * @param onNotificationResponse - Called when user taps a notification
   */
  setupListeners(
    onNotificationReceived?: (notification: Notifications.Notification) => void,
    onNotificationResponse?: (response: Notifications.NotificationResponse) => void
  ): void {
    // Listen for notifications while app is foregrounded
    this.notificationListener = Notifications.addNotificationReceivedListener((notification) => {
      console.log('[PushNotification] Received:', notification);
      onNotificationReceived?.(notification);
    });

    // Listen for user interaction with notification
    this.responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('[PushNotification] Response:', response);
      onNotificationResponse?.(response);
    });
  }

  /**
   * Remove notification listeners
   */
  removeListeners(): void {
    if (this.notificationListener) {
      Notifications.removeNotificationSubscription(this.notificationListener);
      this.notificationListener = null;
    }
    if (this.responseListener) {
      Notifications.removeNotificationSubscription(this.responseListener);
      this.responseListener = null;
    }
  }

  /**
   * Unregister push token (on logout)
   */
  async unregister(): Promise<void> {
    if (!this.expoPushToken) return;

    try {
      await api.post('/notifications/unregister', {
        token: this.expoPushToken,
      });
      this.expoPushToken = null;
      console.log('[PushNotification] Token unregistered');
    } catch (error) {
      console.error('[PushNotification] Error unregistering:', error);
    }
  }

  /**
   * Schedule a local notification (for testing)
   */
  async scheduleLocalNotification(
    title: string,
    body: string,
    data?: Record<string, any>,
    seconds: number = 1
  ): Promise<string> {
    return await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: 'default',
      },
      trigger: { seconds },
    });
  }

  /**
   * Get the current push token
   */
  getToken(): string | null {
    return this.expoPushToken;
  }

  /**
   * Clear all notifications
   */
  async clearAll(): Promise<void> {
    await Notifications.dismissAllNotificationsAsync();
  }

  /**
   * Get badge count
   */
  async getBadgeCount(): Promise<number> {
    return await Notifications.getBadgeCountAsync();
  }

  /**
   * Set badge count
   */
  async setBadgeCount(count: number): Promise<void> {
    await Notifications.setBadgeCountAsync(count);
  }
}

// Export singleton instance
export const pushNotificationService = new PushNotificationService();

