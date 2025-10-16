import { create } from 'zustand';
import * as Location from 'expo-location';
import api from '../config/api';
import { SavedItem } from '../types';

type LocationObject = Location.LocationObject;
type LocationSubscription = Location.LocationSubscription;

interface LocationState {
  location: LocationObject | null;
  hasPermission: boolean;
  isTracking: boolean;
  nearbyItems: SavedItem[];
  
  // Actions
  requestPermission: () => Promise<boolean>;
  startTracking: () => Promise<void>;
  stopTracking: () => void;
  updateLocation: (tripId: string, location: LocationObject) => Promise<void>;
  fetchNearbyItems: (tripId: string, latitude: number, longitude: number) => Promise<void>;
}

let locationSubscription: LocationSubscription | null = null;

export const useLocationStore = create<LocationState>((set, get) => ({
  location: null,
  hasPermission: false,
  isTracking: false,
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
}));

