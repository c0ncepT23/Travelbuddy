import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../config/api';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

class NotificationService {
  private expoPushToken: string | null = null;
  private notificationListener: Notifications.Subscription | null = null;
  private responseListener: Notifications.Subscription | null = null;

  /**
   * Initialize notification service
   */
  async initialize() {
    console.log('[Notifications] Initializing...');
    
    // Register for push notifications
    await this.registerForPushNotifications();
    
    // Set up notification listeners
    this.setupNotificationListeners();
  }

  /**
   * Register for push notifications and get Expo push token
   */
  async registerForPushNotifications() {
    if (!Device.isDevice) {
      console.log('[Notifications] Must use physical device for Push Notifications');
      return null;
    }

    try {
      // Check existing permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      // Request permissions if not granted
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('[Notifications] Permission not granted');
        return null;
      }

      // Get Expo push token
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: '03f5aa21-93d3-46d6-b572-f41aa2eee57a', // From app.json
      });
      this.expoPushToken = tokenData.data;
      console.log('[Notifications] Expo Push Token:', this.expoPushToken);

      // Save token to AsyncStorage
      await AsyncStorage.setItem('expoPushToken', this.expoPushToken);

      // Send token to backend
      await this.sendTokenToBackend(this.expoPushToken);

      // Configure Android notification channel
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('nearby-places', {
          name: 'Nearby Places',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#6366F1',
          sound: 'default',
        });
      }

      return this.expoPushToken;
    } catch (error) {
      console.error('[Notifications] Registration error:', error);
      return null;
    }
  }

  /**
   * Send push token to backend
   */
  async sendTokenToBackend(token: string) {
    try {
      await api.post('/notifications/register', {
        token,
        platform: Platform.OS,
      });
      console.log('[Notifications] Token sent to backend');
    } catch (error) {
      console.error('[Notifications] Failed to send token to backend:', error);
    }
  }

  /**
   * Set up notification listeners
   */
  setupNotificationListeners() {
    // Listener for notifications received while app is foregrounded
    this.notificationListener = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log('[Notifications] Notification received:', notification);
      }
    );

    // Listener for when user taps on notification
    this.responseListener = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        console.log('[Notifications] Notification tapped:', response);
        const data = response.notification.request.content.data;
        
        // Handle navigation based on notification data
        if (data?.tripId && data?.itemId) {
          // TODO: Navigate to trip detail with highlighted item
          console.log('[Notifications] Navigate to trip:', data.tripId, 'item:', data.itemId);
        }
      }
    );
  }

  /**
   * Send a local notification
   */
  async sendLocalNotification(
    title: string,
    body: string,
    data?: Record<string, any>
  ) {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: 'default',
          badge: 1,
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: null, // Send immediately
      });
      console.log('[Notifications] Local notification sent');
    } catch (error) {
      console.error('[Notifications] Failed to send local notification:', error);
    }
  }

  /**
   * Send notification for nearby place
   */
  async notifyNearbyPlace(
    placeName: string,
    distance: number,
    tripId: string,
    itemId: string
  ) {
    const distanceText = distance < 1000
      ? `${Math.round(distance)}m`
      : `${(distance / 1000).toFixed(1)}km`;

    await this.sendLocalNotification(
      `📍 ${placeName} is nearby!`,
      `You're ${distanceText} away from this saved place.`,
      {
        type: 'nearby_place',
        tripId,
        itemId,
        distance,
      }
    );
  }

  /**
   * Cancel all notifications
   */
  async cancelAllNotifications() {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }

  /**
   * Get push token
   */
  getExpoPushToken(): string | null {
    return this.expoPushToken;
  }

  /**
   * Clean up
   */
  cleanup() {
    if (this.notificationListener) {
      Notifications.removeNotificationSubscription(this.notificationListener);
    }
    if (this.responseListener) {
      Notifications.removeNotificationSubscription(this.responseListener);
    }
  }
}

export default new NotificationService();

