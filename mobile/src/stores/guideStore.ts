import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Guide, GuideWithPlaces, GuideDayGroup, SavedItem } from '../types';
import { api } from '../services/api';

interface GuideState {
  guides: Guide[];
  guidesWithPlaces: GuideWithPlaces[];
  selectedGuide: GuideWithPlaces | null;
  selectedGuidePlacesByDay: GuideDayGroup[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  fetchGuides: (tripId: string) => Promise<void>;
  fetchGuidesWithPlaces: (tripId: string) => Promise<void>;
  fetchGuideById: (tripId: string, guideId: string) => Promise<void>;
  addPlaceToDay: (tripId: string, guideId: string, savedItemId: string, day: number) => Promise<SavedItem | null>;
  deleteGuide: (tripId: string, guideId: string) => Promise<boolean>;
  selectGuide: (guide: GuideWithPlaces | null) => void;
  clearError: () => void;
}

export const useGuideStore = create<GuideState>((set, get) => ({
  guides: [],
  guidesWithPlaces: [],
  selectedGuide: null,
  selectedGuidePlacesByDay: [],
  isLoading: false,
  error: null,

  /**
   * Fetch all guides for a trip (metadata only)
   */
  fetchGuides: async (tripId: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get(`/trips/${tripId}/guides`);
      
      if (response.data.success) {
        set({ guides: response.data.data, isLoading: false });
      } else {
        throw new Error(response.data.error || 'Failed to fetch guides');
      }
    } catch (error: any) {
      console.error('[GuideStore] Fetch guides error:', error);
      set({ error: error.message, isLoading: false });
    }
  },

  /**
   * Fetch all guides with their places (for day planner drawer)
   */
  fetchGuidesWithPlaces: async (tripId: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get(`/trips/${tripId}/guides/with-places`);
      
      if (response.data.success) {
        set({ guidesWithPlaces: response.data.data, isLoading: false });
      } else {
        throw new Error(response.data.error || 'Failed to fetch guides');
      }
    } catch (error: any) {
      console.error('[GuideStore] Fetch guides with places error:', error);
      set({ error: error.message, isLoading: false });
    }
  },

  /**
   * Fetch a single guide with places grouped by day
   */
  fetchGuideById: async (tripId: string, guideId: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get(`/trips/${tripId}/guides/${guideId}`);
      
      if (response.data.success) {
        const guideData = response.data.data;
        set({ 
          selectedGuide: guideData,
          selectedGuidePlacesByDay: guideData.placesByDay || [],
          isLoading: false 
        });
      } else {
        throw new Error(response.data.error || 'Failed to fetch guide');
      }
    } catch (error: any) {
      console.error('[GuideStore] Fetch guide by ID error:', error);
      set({ error: error.message, isLoading: false });
    }
  },

  /**
   * Add a place from guide to user's day plan
   */
  addPlaceToDay: async (tripId: string, guideId: string, savedItemId: string, day: number) => {
    try {
      const response = await api.post(`/trips/${tripId}/guides/${guideId}/add-to-day`, {
        savedItemId,
        day,
      });
      
      if (response.data.success) {
        const updatedItem = response.data.data;
        
        // Update the place in guidesWithPlaces
        set((state) => ({
          guidesWithPlaces: state.guidesWithPlaces.map((guide) => ({
            ...guide,
            places: guide.places.map((place) =>
              place.saved_item_id === savedItemId
                ? { ...place, planned_day: day }
                : place
            ),
          })),
          // Also update selectedGuide if it's the same guide
          selectedGuide: state.selectedGuide
            ? {
                ...state.selectedGuide,
                places: state.selectedGuide.places.map((place) =>
                  place.saved_item_id === savedItemId
                    ? { ...place, planned_day: day }
                    : place
                ),
              }
            : null,
          selectedGuidePlacesByDay: state.selectedGuidePlacesByDay.map((group) => ({
            ...group,
            places: group.places.map((place) =>
              place.saved_item_id === savedItemId
                ? { ...place, planned_day: day }
                : place
            ),
          })),
        }));
        
        return updatedItem;
      } else {
        throw new Error(response.data.error || 'Failed to add place to day');
      }
    } catch (error: any) {
      console.error('[GuideStore] Add place to day error:', error);
      set({ error: error.message });
      return null;
    }
  },

  /**
   * Delete a guide
   */
  deleteGuide: async (tripId: string, guideId: string) => {
    try {
      const response = await api.delete(`/trips/${tripId}/guides/${guideId}`);
      
      if (response.data.success) {
        // Remove from local state
        set((state) => ({
          guides: state.guides.filter((g) => g.id !== guideId),
          guidesWithPlaces: state.guidesWithPlaces.filter((g) => g.id !== guideId),
          selectedGuide: state.selectedGuide?.id === guideId ? null : state.selectedGuide,
        }));
        return true;
      } else {
        throw new Error(response.data.error || 'Failed to delete guide');
      }
    } catch (error: any) {
      console.error('[GuideStore] Delete guide error:', error);
      set({ error: error.message });
      return false;
    }
  },

  /**
   * Select a guide (for viewing details)
   */
  selectGuide: (guide: GuideWithPlaces | null) => {
    if (guide) {
      // Group places by day
      const placesByDay: GuideDayGroup[] = [];
      const dayMap = new Map<number | null, typeof guide.places>();
      
      for (const place of guide.places) {
        const day = place.guide_day_number;
        if (!dayMap.has(day)) {
          dayMap.set(day, []);
        }
        dayMap.get(day)!.push(place);
      }
      
      // Convert to array and sort
      const sortedDays = Array.from(dayMap.keys()).sort((a, b) => {
        if (a === null) return 1;
        if (b === null) return -1;
        return a - b;
      });
      
      for (const day of sortedDays) {
        placesByDay.push({
          day,
          places: dayMap.get(day)!,
        });
      }
      
      set({ selectedGuide: guide, selectedGuidePlacesByDay: placesByDay });
    } else {
      set({ selectedGuide: null, selectedGuidePlacesByDay: [] });
    }
  },

  /**
   * Clear error
   */
  clearError: () => set({ error: null }),
}));

// Helper function to get category emoji
export const getGuideCategoryEmoji = (category: string): string => {
  const emojis: Record<string, string> = {
    food: '🍽️',
    place: '📍',
    shopping: '🛍️',
    activity: '🎯',
    accommodation: '🏨',
    tip: '💡',
  };
  return emojis[category] || '📍';
};

// Helper function to get source type icon
export const getSourceTypeIcon = (sourceType: string): string => {
  const icons: Record<string, string> = {
    youtube: '📺',
    instagram: '📷',
    reddit: '🤖',
    tiktok: '🎵',
    url: '🔗',
  };
  return icons[sourceType] || '🔗';
};

