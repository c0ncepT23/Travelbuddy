import { create } from 'zustand';
import api from '../config/api';
import { CheckIn, TimelineItem, DayTimeline, TripStory, TripStats } from '../types';

interface CheckInState {
  checkIns: CheckIn[];
  timeline: DayTimeline[];
  currentStory: TripStory | null;
  stats: TripStats | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  createCheckIn: (tripId: string, data: {
    savedItemId: string;
    rating?: number;
    note?: string;
    cost?: number;
    currency?: string;
    photos?: string[];
    weather?: string;
    withUsers?: string[];
  }) => Promise<CheckIn | null>;
  
  fetchTimeline: (tripId: string) => Promise<void>;
  fetchStats: (tripId: string) => Promise<void>;
  
  updateCheckIn: (checkinId: string, updates: {
    checkedOutAt?: Date;
    rating?: number;
    note?: string;
    cost?: number;
    photos?: string[];
  }) => Promise<void>;
  
  deleteCheckIn: (checkinId: string) => Promise<void>;
  
  createOrGetStory: (tripId: string, data?: {
    isPublic?: boolean;
    title?: string;
    description?: string;
    themeColor?: string;
    showRatings?: boolean;
    showPhotos?: boolean;
    showCosts?: boolean;
    showNotes?: boolean;
  }) => Promise<TripStory | null>;
  
  updateStory: (storyId: string, updates: Partial<TripStory>) => Promise<void>;
  
  clearError: () => void;
  reset: () => void;
}

export const useCheckInStore = create<CheckInState>((set, get) => ({
  checkIns: [],
  timeline: [],
  currentStory: null,
  stats: null,
  isLoading: false,
  error: null,

  createCheckIn: async (tripId: string, data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post(
        `/trips/${tripId}/checkin`,
        data
      );
      
      if (response.data.success) {
        const newCheckIn = response.data.data;
        set(state => ({
          checkIns: [newCheckIn, ...state.checkIns],
          isLoading: false,
        }));
        
        // Refresh timeline
        await get().fetchTimeline(tripId);
        await get().fetchStats(tripId);
        
        return newCheckIn;
      }
      
      return null;
    } catch (error: any) {
      set({ error: error.response?.data?.error || 'Failed to check in', isLoading: false });
      return null;
    }
  },

  fetchTimeline: async (tripId: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get(
        `/trips/${tripId}/timeline?groupByDay=true`
      );
      
      if (response.data.success) {
        set({ timeline: response.data.data, isLoading: false });
      }
    } catch (error: any) {
      set({ error: error.response?.data?.error || 'Failed to fetch timeline', isLoading: false });
    }
  },

  fetchStats: async (tripId: string) => {
    try {
      const response = await api.get(`/trips/${tripId}/stats`);
      
      if (response.data.success) {
        set({ stats: response.data.data });
      }
    } catch (error: any) {
      console.error('Failed to fetch stats:', error);
    }
  },

  updateCheckIn: async (checkinId: string, updates) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.put(
        `/checkins/${checkinId}`,
        updates
      );
      
      if (response.data.success) {
        set(state => ({
          checkIns: state.checkIns.map(ci =>
            ci.id === checkinId ? response.data.data : ci
          ),
          isLoading: false,
        }));
      }
    } catch (error: any) {
      set({ error: error.response?.data?.error || 'Failed to update check-in', isLoading: false });
    }
  },

  deleteCheckIn: async (checkinId: string) => {
    set({ isLoading: true, error: null });
    try {
      await api.delete(`/checkins/${checkinId}`);
      
      set(state => ({
        checkIns: state.checkIns.filter(ci => ci.id !== checkinId),
        isLoading: false,
      }));
    } catch (error: any) {
      set({ error: error.response?.data?.error || 'Failed to delete check-in', isLoading: false });
    }
  },

  createOrGetStory: async (tripId: string, data = {}) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post(
        `/trips/${tripId}/story`,
        data
      );
      
      if (response.data.success) {
        const story = response.data.data;
        set({ currentStory: story, isLoading: false });
        return story;
      }
      
      return null;
    } catch (error: any) {
      set({ error: error.response?.data?.error || 'Failed to create story', isLoading: false });
      return null;
    }
  },

  updateStory: async (storyId: string, updates) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.put(
        `/story/${storyId}`,
        updates
      );
      
      if (response.data.success) {
        set({ currentStory: response.data.data, isLoading: false });
      }
    } catch (error: any) {
      set({ error: error.response?.data?.error || 'Failed to update story', isLoading: false });
    }
  },

  clearError: () => set({ error: null }),
  reset: () => set({
    checkIns: [],
    timeline: [],
    currentStory: null,
    stats: null,
    isLoading: false,
    error: null,
  }),
}));

