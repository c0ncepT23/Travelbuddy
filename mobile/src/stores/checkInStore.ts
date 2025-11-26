import { create } from 'zustand';
import api from '../config/api';
import { CheckIn, DayTimeline, TripStats, TripStory } from '../types';

interface CheckInState {
  checkInsByTrip: Record<string, CheckIn[]>;
  checkIns: CheckIn[]; // Current trip's check-ins for easy access
  timeline: DayTimeline[];
  stats: TripStats | null;
  currentStory: TripStory | null;
  isLoading: boolean;
  
  // Actions
  fetchCheckIns: (tripId: string) => Promise<void>;
  isPlaceCheckedIn: (tripId: string, placeId: string) => boolean;
  refreshCheckIns: (tripId: string) => Promise<void>;
  createCheckIn: (tripId: string, data: CreateCheckInData) => Promise<CheckIn | null>;
  fetchTimeline: (tripId: string) => Promise<void>;
  fetchStats: (tripId: string) => Promise<void>;
  createOrGetStory: (tripId: string, options: StoryOptions) => Promise<TripStory | null>;
  updateStory: (shareCode: string, options: StoryOptions) => Promise<TripStory | null>;
}

interface CreateCheckInData {
  savedItemId: string;
  rating?: number;
  note?: string;
  cost?: number;
  currency?: string;
  photos?: string[];
}

interface StoryOptions {
  isPublic?: boolean;
  title?: string;
  description?: string;
  showRatings?: boolean;
  showPhotos?: boolean;
  showCosts?: boolean;
  showNotes?: boolean;
}

export const useCheckInStore = create<CheckInState>((set, get) => ({
  checkInsByTrip: {},
  checkIns: [],
  timeline: [],
  stats: null,
  currentStory: null,
  isLoading: false,

  fetchCheckIns: async (tripId: string) => {
    try {
      set({ isLoading: true });
      const response = await api.get(`/trips/${tripId}/checkins`);
      
      if (response.data.success) {
        const checkIns = response.data.data || [];
        set(state => ({
          checkInsByTrip: {
            ...state.checkInsByTrip,
            [tripId]: checkIns,
          },
          checkIns: checkIns,
          isLoading: false,
        }));
      }
    } catch (error) {
      console.error('Fetch check-ins error:', error);
      set({ isLoading: false });
    }
  },

  refreshCheckIns: async (tripId: string) => {
    await get().fetchCheckIns(tripId);
  },

  isPlaceCheckedIn: (tripId: string, placeId: string) => {
    const checkIns = get().checkInsByTrip[tripId] || [];
    return checkIns.some(ci => ci.saved_item_id === placeId);
  },

  createCheckIn: async (tripId: string, data: CreateCheckInData) => {
    try {
      set({ isLoading: true });
      const response = await api.post(`/trips/${tripId}/checkin`, {
        savedItemId: data.savedItemId,
        rating: data.rating,
        note: data.note,
        cost: data.cost,
        currency: data.currency,
        photos: data.photos,
      });

      if (response.data.success) {
        const newCheckIn = response.data.data;
        
        // Update local state
        set(state => {
          const currentCheckIns = state.checkInsByTrip[tripId] || [];
          return {
            checkInsByTrip: {
              ...state.checkInsByTrip,
              [tripId]: [...currentCheckIns, newCheckIn],
            },
            checkIns: [...currentCheckIns, newCheckIn],
            isLoading: false,
          };
        });

        return newCheckIn;
      }
      
      set({ isLoading: false });
      return null;
    } catch (error) {
      console.error('Create check-in error:', error);
      set({ isLoading: false });
      return null;
    }
  },

  fetchTimeline: async (tripId: string) => {
    try {
      set({ isLoading: true });
      const response = await api.get(`/trips/${tripId}/timeline`, {
        params: { groupByDay: true },
      });

      if (response.data.success) {
        set({
          timeline: response.data.data || [],
          isLoading: false,
        });
      } else {
        set({ isLoading: false });
      }
    } catch (error) {
      console.error('Fetch timeline error:', error);
      set({ timeline: [], isLoading: false });
    }
  },

  fetchStats: async (tripId: string) => {
    try {
      const response = await api.get(`/trips/${tripId}/stats`);

      if (response.data.success) {
        set({ stats: response.data.data });
      }
    } catch (error) {
      console.error('Fetch stats error:', error);
      set({ stats: null });
    }
  },

  createOrGetStory: async (tripId: string, options: StoryOptions) => {
    try {
      set({ isLoading: true });
      const response = await api.post(`/trips/${tripId}/story`, {
        is_public: options.isPublic ?? true,
        title: options.title,
        description: options.description,
        show_ratings: options.showRatings ?? true,
        show_photos: options.showPhotos ?? true,
        show_costs: options.showCosts ?? false,
        show_notes: options.showNotes ?? true,
      });

      if (response.data.success) {
        const story = response.data.data;
        set({ currentStory: story, isLoading: false });
        return story;
      }
      
      set({ isLoading: false });
      return null;
    } catch (error) {
      console.error('Create/get story error:', error);
      set({ isLoading: false });
      return null;
    }
  },

  updateStory: async (shareCode: string, options: StoryOptions) => {
    try {
      set({ isLoading: true });
      const response = await api.put(`/story/${shareCode}`, {
        is_public: options.isPublic,
        title: options.title,
        description: options.description,
        show_ratings: options.showRatings,
        show_photos: options.showPhotos,
        show_costs: options.showCosts,
        show_notes: options.showNotes,
      });

      if (response.data.success) {
        const story = response.data.data;
        set({ currentStory: story, isLoading: false });
        return story;
      }
      
      set({ isLoading: false });
      return null;
    } catch (error) {
      console.error('Update story error:', error);
      set({ isLoading: false });
      return null;
    }
  },
}));
