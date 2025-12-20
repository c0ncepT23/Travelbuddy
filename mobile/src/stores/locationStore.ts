import { create } from 'zustand';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../config/api';
import { SavedItem } from '../types';
import {
  startBackgroundLocationTracking,
  stopBackgroundLocationTracking,
  isBackgroundTrackingActive,
  setActiveTrip,
} from '../tasks/locationTracking.task';
import notificationService from '../services/notification.service';

type LocationObject = Location.LocationObject;
type LocationSubscription = Location.LocationSubscription;

interface LocationState {
  location: LocationObject | null;
  hasPermission: boolean;
  hasBackgroundPermission: boolean;
  isTracking: boolean;
  isBackgroundTracking: boolean;
  isBackgroundTrackingEnabled: boolean; // User preference
  nearbyItems: SavedItem[];
  
  // Actions
  requestPermission: () => Promise<boolean>;
  requestBackgroundPermission: () => Promise<boolean>;
  startTracking: () => Promise<void>;
  stopTracking: () => void;
  startBackgroundTracking: (tripId?: string) => Promise<void>;
  stopBackgroundTracking: () => Promise<void>;
  setBackgroundTrackingEnabled: (enabled: boolean) => Promise<void>;
  loadBackgroundTrackingPreference: () => Promise<void>;
  updateLocation: (tripId: string, location: LocationObject) => Promise<void>;
  updateLocationGlobal: (location: LocationObject) => Promise<void>;
  fetchNearbyItems: (tripId: string, latitude: number, longitude: number) => Promise<void>;
  fetchAllNearbyItems: (latitude: number, longitude: number) => Promise<void>;
  initializeNotifications: () => Promise<void>;
}

let locationSubscription: LocationSubscription | null = null;

export const useLocationStore = create<LocationState>((set, get) => ({
  location: null,
  hasPermission: false,
  hasBackgroundPermission: false,
  isTracking: false,
  isBackgroundTracking: false,
  isBackgroundTrackingEnabled: true, // Default enabled
  nearbyItems: [],

  requestPermission: async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      const hasPermission = status === 'granted';
      set({ hasPermission });
      return hasPermission;
    } catch (error) {
      console.error('Permission request error:', error);
      return false;
    }
  },

  requestBackgroundPermission: async () => {
    try {
      // First need foreground permission
      const { hasPermission } = get();
      if (!hasPermission) {
        const granted = await get().requestPermission();
        if (!granted) return false;
      }

      // Then request background
      const { status } = await Location.requestBackgroundPermissionsAsync();
      const hasBackgroundPermission = status === 'granted';
      set({ hasBackgroundPermission });
      return hasBackgroundPermission;
    } catch (error) {
      console.error('Background permission request error:', error);
      return false;
    }
  },

  startTracking: async () => {
    const { hasPermission } = get();
    
    if (!hasPermission) {
      const granted = await get().requestPermission();
      if (!granted) {
        throw new Error('Location permission denied');
      }
    }

    try {
      locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 30000, // Update every 30 seconds
          distanceInterval: 50, // Or every 50 meters
        },
        (location) => {
          set({ location });
        }
      );

      set({ isTracking: true });
    } catch (error) {
      console.error('Start tracking error:', error);
      throw error;
    }
  },

  stopTracking: () => {
    if (locationSubscription) {
      locationSubscription.remove();
      locationSubscription = null;
    }
    set({ isTracking: false });
  },

  // Start global background tracking (checks ALL trips)
  startBackgroundTracking: async (tripId?: string) => {
    try {
      // Optionally set active trip for backwards compatibility
      if (tripId) {
        await setActiveTrip(tripId);
      }
      
      // Check if already tracking
      const isAlreadyActive = await isBackgroundTrackingActive();
      if (isAlreadyActive) {
        set({ isBackgroundTracking: true });
        return;
      }
      
      const { hasBackgroundPermission } = get();
      
      if (!hasBackgroundPermission) {
        const granted = await get().requestBackgroundPermission();
        if (!granted) {
          throw new Error('Background location permission denied');
        }
      }

      // Start background location tracking
      await startBackgroundLocationTracking();
      
      // Check if it's actually running
      const isActive = await isBackgroundTrackingActive();
      set({ isBackgroundTracking: isActive });
      
      console.log('[LocationStore] Background tracking started globally');
    } catch (error) {
      console.error('[LocationStore] Start background tracking error:', error);
      throw error;
    }
  },

  stopBackgroundTracking: async () => {
    try {
      await stopBackgroundLocationTracking();
      await setActiveTrip(null);
      set({ isBackgroundTracking: false });
    } catch (error) {
      console.error('[LocationStore] Stop background tracking error:', error);
    }
  },

  // Enable/disable background tracking (user preference)
  setBackgroundTrackingEnabled: async (enabled: boolean) => {
    try {
      await AsyncStorage.setItem('backgroundTrackingEnabled', enabled ? 'true' : 'false');
      set({ isBackgroundTrackingEnabled: enabled });
      
      if (enabled) {
        // Start tracking if not already
        const isActive = await isBackgroundTrackingActive();
        if (!isActive) {
          await get().startBackgroundTracking();
        }
      } else {
        // Stop tracking
        await get().stopBackgroundTracking();
      }
      
      console.log('[LocationStore] Background tracking', enabled ? 'enabled' : 'disabled');
    } catch (error) {
      console.error('[LocationStore] Set background tracking enabled error:', error);
    }
  },

  // Load user's background tracking preference
  loadBackgroundTrackingPreference: async () => {
    try {
      const enabled = await AsyncStorage.getItem('backgroundTrackingEnabled');
      // Default to true if not set
      const isEnabled = enabled !== 'false';
      set({ isBackgroundTrackingEnabled: isEnabled });
    } catch (error) {
      console.error('[LocationStore] Load preference error:', error);
    }
  },

  updateLocation: async (tripId, location) => {
    try {
      await api.post('/location/update', {
        tripGroupId: tripId,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
    } catch (error) {
      console.error('Update location error:', error);
      // Don't throw - this is a background operation
    }
  },

  // Update location globally (checks all trips)
  updateLocationGlobal: async (location) => {
    try {
      await api.post('/location/update-global', {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
    } catch (error) {
      console.error('Update location global error:', error);
      // Don't throw - this is a background operation
    }
  },

  fetchNearbyItems: async (tripId, latitude, longitude) => {
    try {
      const response = await api.get<{ data: SavedItem[] }>(
        `/location/${tripId}/nearby?latitude=${latitude}&longitude=${longitude}&radius=500`
      );
      set({ nearbyItems: response.data.data });
    } catch (error) {
      console.error('Fetch nearby items error:', error);
      throw error;
    }
  },

  // Fetch nearby items from ALL trips
  fetchAllNearbyItems: async (latitude, longitude) => {
    try {
      const response = await api.get<{ data: SavedItem[] }>(
        `/location/nearby-all?latitude=${latitude}&longitude=${longitude}&radius=500`
      );
      set({ nearbyItems: response.data.data });
    } catch (error) {
      console.error('Fetch all nearby items error:', error);
      throw error;
    }
  },

  initializeNotifications: async () => {
    try {
      await notificationService.initialize();
    } catch (error) {
      console.error('[LocationStore] Notification initialization error:', error);
    }
  },
}));

