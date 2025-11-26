import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import notificationService from '../services/notification.service';
import api from '../config/api';

const LOCATION_TASK_NAME = 'background-location-task';
const NEARBY_RADIUS = 500; // 500 meters
const NOTIFICATION_COOLDOWN = 3600000; // 1 hour in milliseconds

// Define the location task data type
interface LocationTaskData {
  locations: Location.LocationObject[];
}

// Track when we last notified for each place to avoid spam
const notificationHistory: Map<string, number> = new Map();

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

/**
 * Check if we should send notification (cooldown check)
 */
function shouldNotify(itemId: string): boolean {
  const lastNotified = notificationHistory.get(itemId);
  if (!lastNotified) return true;
  
  const timeSince = Date.now() - lastNotified;
  return timeSince > NOTIFICATION_COOLDOWN;
}

/**
 * Background location tracking task
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
        lat: location.coords.latitude,
        lng: location.coords.longitude,
        timestamp: new Date(location.timestamp).toISOString(),
      });

      try {
        // Get current trip ID from AsyncStorage
        const currentTripId = await AsyncStorage.getItem('currentTripId');
        
        if (!currentTripId) {
          console.log('[BackgroundLocation] No active trip');
          return;
        }

        // Fetch nearby items from backend
        const response = await api.get(
          `/location/${currentTripId}/nearby`,
          {
            params: {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              radius: NEARBY_RADIUS,
            },
          }
        );

        const nearbyItems = response.data?.data || [];
        console.log('[BackgroundLocation] Nearby items:', nearbyItems.length);

        // Check each nearby item
        for (const item of nearbyItems) {
          if (!item.location_lat || !item.location_lng) continue;

          // Calculate precise distance
          const distance = calculateDistance(
            location.coords.latitude,
            location.coords.longitude,
            item.location_lat,
            item.location_lng
          );

          // Only notify if within radius and cooldown passed
          if (distance <= NEARBY_RADIUS && shouldNotify(item.id)) {
            console.log('[BackgroundLocation] Sending notification for:', item.name);
            
            await notificationService.notifyNearbyPlace(
              item.name,
              distance,
              currentTripId,
              item.id
            );

            // Update notification history
            notificationHistory.set(item.id, Date.now());
          }
        }

        // Update user's location on backend
        await api.post('/location/update', {
          tripGroupId: currentTripId,
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });

      } catch (error) {
        console.error('[BackgroundLocation] Processing error:', error);
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
        notificationTitle: 'Travel Agent',
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

