/**
 * Trip Data Store - Zustand-powered shared state for trip places
 * 
 * Purpose:
 * - Centralized storage for saved places (survives screen navigation)
 * - Cross-screen action system (pendingAction pattern)
 * - Global transition state for smooth UX
 * 
 * Architecture:
 * - savedPlacesByTrip: Record<tripId, places[]> - No refetch on navigation
 * - pendingAction: For cross-screen communication (highlight, focus, etc.)
 * - transitionState: Global UI feedback during navigation
 */

import { create } from 'zustand';
import api from '../config/api';
import { SavedItem } from '../types';

// Pending action types - extensible for future needs
export type PendingActionType = 
  | { type: 'highlight_place'; placeId: string; placeName: string }
  | { type: 'focus_cluster'; clusterId: string }
  | { type: 'open_chat'; query?: string }
  | null;

// Transition state for global UI feedback
export interface TransitionState {
  isActive: boolean;
  message: string;
  emoji: string;
  targetScreen?: string;
}

interface TripDataState {
  // Saved places by trip (cached)
  savedPlacesByTrip: Record<string, SavedItem[]>;
  loadingTrips: Set<string>; // Track which trips are currently loading
  
  // Cross-screen action system
  pendingAction: PendingActionType;
  
  // Global transition state
  transitionState: TransitionState;
  
  // Actions
  fetchSavedPlaces: (tripId: string, forceRefresh?: boolean) => Promise<SavedItem[]>;
  getSavedPlaces: (tripId: string) => SavedItem[];
  isTripLoading: (tripId: string) => boolean;
  
  // Pending action management
  setPendingAction: (action: PendingActionType) => void;
  clearPendingAction: () => void;
  
  // Transition state management
  setTransition: (message: string, emoji?: string, targetScreen?: string) => void;
  clearTransition: () => void;
  
  // Cache management
  invalidateTrip: (tripId: string) => void;
  addPlaceToTrip: (tripId: string, place: SavedItem) => void;
  removePlaceFromTrip: (tripId: string, placeId: string) => void;
  markPlaceAsVisited: (tripId: string, placeId: string, notes?: string) => Promise<boolean>;
}

export const useTripDataStore = create<TripDataState>((set, get) => ({
  savedPlacesByTrip: {},
  loadingTrips: new Set(),
  pendingAction: null,
  transitionState: {
    isActive: false,
    message: '',
    emoji: '✨',
  },

  // Fetch saved places for a trip (with caching)
  fetchSavedPlaces: async (tripId: string, forceRefresh = false) => {
    const state = get();
    
    // Return cached data if available and not forcing refresh
    if (!forceRefresh && state.savedPlacesByTrip[tripId]?.length > 0) {
      console.log(`📦 [TripDataStore] Using cached data for trip ${tripId} (${state.savedPlacesByTrip[tripId].length} places)`);
      return state.savedPlacesByTrip[tripId];
    }
    
    // Check if already loading
    if (state.loadingTrips.has(tripId)) {
      console.log(`⏳ [TripDataStore] Already loading trip ${tripId}, waiting...`);
      // Wait for existing load to complete
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          const currentState = get();
          if (!currentState.loadingTrips.has(tripId)) {
            clearInterval(checkInterval);
            resolve(currentState.savedPlacesByTrip[tripId] || []);
          }
        }, 100);
      });
    }
    
    // Mark as loading
    set((s) => ({
      loadingTrips: new Set([...s.loadingTrips, tripId]),
    }));
    
    try {
      console.log(`🔄 [TripDataStore] Fetching places for trip ${tripId}...`);
      const response = await api.get(`/trips/${tripId}/items`);
      const items: SavedItem[] = response.data.data || response.data || [];
      
      // Deduplicate by google_place_id or name+lat+lng
      const seen = new Set<string>();
      const uniqueItems = items.filter((item) => {
        const key = item.google_place_id || `${item.name}-${item.location_lat}-${item.location_lng}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      
      console.log(`✅ [TripDataStore] Loaded ${uniqueItems.length} places for trip ${tripId}`);
      
      set((s) => {
        const newLoadingTrips = new Set(s.loadingTrips);
        newLoadingTrips.delete(tripId);
        return {
          savedPlacesByTrip: {
            ...s.savedPlacesByTrip,
            [tripId]: uniqueItems,
          },
          loadingTrips: newLoadingTrips,
        };
      });
      
      return uniqueItems;
    } catch (error) {
      console.error(`❌ [TripDataStore] Error fetching places for trip ${tripId}:`, error);
      
      set((s) => {
        const newLoadingTrips = new Set(s.loadingTrips);
        newLoadingTrips.delete(tripId);
        return { loadingTrips: newLoadingTrips };
      });
      
      return [];
    }
  },

  // Get cached saved places (synchronous)
  getSavedPlaces: (tripId: string) => {
    return get().savedPlacesByTrip[tripId] || [];
  },

  // Check if a trip is currently loading
  isTripLoading: (tripId: string) => {
    return get().loadingTrips.has(tripId);
  },

  // Set a pending action for cross-screen communication
  setPendingAction: (action: PendingActionType) => {
    console.log(`🎯 [TripDataStore] Setting pending action:`, action);
    set({ pendingAction: action });
  },

  // Clear the pending action (after it's been handled)
  clearPendingAction: () => {
    console.log(`🧹 [TripDataStore] Clearing pending action`);
    set({ pendingAction: null });
  },

  // Set transition state for global UI feedback
  setTransition: (message: string, emoji = '✨', targetScreen?: string) => {
    console.log(`🚀 [TripDataStore] Transition: ${emoji} ${message}`);
    set({
      transitionState: {
        isActive: true,
        message,
        emoji,
        targetScreen,
      },
    });
  },

  // Clear transition state
  clearTransition: () => {
    set({
      transitionState: {
        isActive: false,
        message: '',
        emoji: '✨',
      },
    });
  },

  // Invalidate cache for a trip (force refetch next time)
  invalidateTrip: (tripId: string) => {
    console.log(`🗑️ [TripDataStore] Invalidating cache for trip ${tripId}`);
    set((s) => {
      const newSavedPlaces = { ...s.savedPlacesByTrip };
      delete newSavedPlaces[tripId];
      return { savedPlacesByTrip: newSavedPlaces };
    });
  },

  // Add a place to a trip (optimistic update)
  addPlaceToTrip: (tripId: string, place: SavedItem) => {
    set((s) => ({
      savedPlacesByTrip: {
        ...s.savedPlacesByTrip,
        [tripId]: [...(s.savedPlacesByTrip[tripId] || []), place],
      },
    }));
  },

  // Remove a place from a trip (optimistic update)
  removePlaceFromTrip: (tripId: string, placeId: string) => {
    set((s) => ({
      savedPlacesByTrip: {
        ...s.savedPlacesByTrip,
        [tripId]: (s.savedPlacesByTrip[tripId] || []).filter((p) => p.id !== placeId),
      },
    }));
  },

  // Mark a place as visited
  markPlaceAsVisited: async (tripId: string, placeId: string, notes?: string) => {
    try {
      console.log(`✅ [TripDataStore] Marking place ${placeId} as visited in trip ${tripId}...`);
      
      // OPTIMISTIC UPDATE: Update local state immediately for instant UI response
      const originalPlaces = get().savedPlacesByTrip[tripId] || [];
      const updatedPlaces = originalPlaces.map(p => 
        p.id === placeId 
          ? { ...p, status: 'visited' as any, updated_at: new Date().toISOString() } 
          : p
      );
      
      set((s) => ({
        savedPlacesByTrip: {
          ...s.savedPlacesByTrip,
          [tripId]: updatedPlaces,
        }
      }));

      // Call API in background
      await api.post(`/items/${placeId}/visit`, { notes });
      
      return true;
    } catch (error) {
      console.error(`❌ [TripDataStore] Error marking place as visited:`, error);
      // Fallback: we keep it as visited locally for now to avoid flickering, 
      // but in a real app you might want to rollback on error.
      return false;
    }
  },
}));

