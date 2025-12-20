import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../config/api';

const LOCATION_TASK_NAME = 'background-location-task';

// Define the location task data type
interface LocationTaskData {
  locations: Location.LocationObject[];
}

/**
 * Background location tracking task
 * Reports location to backend GLOBALLY - checks ALL user's trips for nearby places
 * Backend handles push notifications when user is near any saved place
 */
TaskManager.defineTask(
  LOCATION_TASK_NAME,
  async ({ data, error }: TaskManager.TaskManagerTaskBody<LocationTaskData>) => {
    if (error) {
      console.error('[BackgroundLocation] Task error:', error);
      return;
    }

    if (data) {
      const { locations } = data;
      const location = locations[0];

      if (!location) {
        console.log('[BackgroundLocation] No location data');
        return;
      }

      console.log('[BackgroundLocation] Location update:', {
        lat: location.coords.latitude.toFixed(5),
        lng: location.coords.longitude.toFixed(5),
      });

      try {
        // Check if tracking is enabled
        const trackingEnabled = await AsyncStorage.getItem('backgroundTrackingEnabled');
        if (trackingEnabled === 'false') {
          console.log('[BackgroundLocation] Tracking disabled by user');
          return;
        }

        // Send location to backend GLOBALLY - checks ALL trips
        const response = await api.post('/location/update-global', {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });

        const result = response.data?.data;
        if (result?.notificationSent) {
          console.log('[BackgroundLocation] 🔔 Notification sent! Nearby:', result.nearbyCount);
        } else if (result?.nearbyCount > 0) {
          console.log('[BackgroundLocation] Found', result.nearbyCount, 'nearby places (no notification)');
        } else {
          console.log('[BackgroundLocation] No nearby places');
        }

      } catch (error: any) {
        // Don't log auth errors loudly - user might be logged out
        if (error.response?.status === 401) {
          console.log('[BackgroundLocation] User not authenticated');
        } else {
          console.error('[BackgroundLocation] Error:', error.message);
        }
      }
    }
  }
);

/**
 * Start background location tracking
 */
export async function startBackgroundLocationTracking() {
  try {
    // Check if task is already registered
    const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
    
    if (isRegistered) {
      console.log('[BackgroundLocation] Task already registered');
      return;
    }

    // Request background permissions
    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
    
    if (foregroundStatus !== 'granted') {
      console.log('[BackgroundLocation] Foreground permission not granted');
      return;
    }

    const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
    
    if (backgroundStatus !== 'granted') {
      console.log('[BackgroundLocation] Background permission not granted');
      return;
    }

    // Start location tracking
    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 60000, // Update every 1 minute
      distanceInterval: 100, // Or every 100 meters
      foregroundService: {
        notificationTitle: 'Yori',
        notificationBody: 'Tracking your location to notify you of nearby places',
        notificationColor: '#6366F1',
      },
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
    });

    console.log('[BackgroundLocation] Started successfully');
  } catch (error) {
    console.error('[BackgroundLocation] Start error:', error);
  }
}

/**
 * Stop background location tracking
 */
export async function stopBackgroundLocationTracking() {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
    
    if (isRegistered) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      console.log('[BackgroundLocation] Stopped successfully');
    }
  } catch (error) {
    console.error('[BackgroundLocation] Stop error:', error);
  }
}

/**
 * Check if background tracking is active
 */
export async function isBackgroundTrackingActive(): Promise<boolean> {
  try {
    return await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
  } catch (error) {
    console.error('[BackgroundLocation] Status check error:', error);
    return false;
  }
}

/**
 * Set current trip for background tracking
 */
export async function setActiveTrip(tripId: string | null) {
  try {
    if (tripId) {
      await AsyncStorage.setItem('currentTripId', tripId);
      console.log('[BackgroundLocation] Active trip set:', tripId);
    } else {
      await AsyncStorage.removeItem('currentTripId');
      console.log('[BackgroundLocation] Active trip cleared');
    }
  } catch (error) {
    console.error('[BackgroundLocation] Set active trip error:', error);
  }
}

