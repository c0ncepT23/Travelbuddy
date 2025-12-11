import { create } from 'zustand';
import api from '../config/api';
import { MorningBriefing } from '../types';

interface BriefingState {
  briefing: MorningBriefing | null;
  isLoading: boolean;
  error: string | null;
  lastFetched: Date | null;

  // Actions
  fetchBriefing: (tripId: string, location?: { lat: number; lng: number }) => Promise<MorningBriefing>;
  clearBriefing: () => void;
}

export const useBriefingStore = create<BriefingState>((set, get) => ({
  briefing: null,
  isLoading: false,
  error: null,
  lastFetched: null,

  fetchBriefing: async (tripId, location) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post<{ data: MorningBriefing }>(
        `/companion/${tripId}/briefing`,
        { location }
      );
      const briefing = response.data.data;
      
      set({ 
        briefing, 
        isLoading: false, 
        lastFetched: new Date() 
      });
      return briefing;
    } catch (error: any) {
      console.error('[BriefingStore] Fetch briefing error:', error);
      set({ isLoading: false, error: error.message });
      throw error;
    }
  },

  clearBriefing: () => {
    set({ briefing: null, error: null, lastFetched: null });
  },
}));

// Helper to get time-appropriate greeting icon
export const getTimeIcon = (timeOfDay: MorningBriefing['timeOfDay']): string => {
  switch (timeOfDay) {
    case 'morning': return '🌅';
    case 'afternoon': return '☀️';
    case 'evening': return '🌆';
    case 'night': return '🌙';
    default: return '✨';
  }
};

// Helper to get category emoji
export const getCategoryEmoji = (category: string): string => {
  switch (category) {
    case 'food': return '🍽️';
    case 'shopping': return '🛍️';
    case 'place': return '📍';
    case 'activity': return '🎯';
    case 'accommodation': return '🏨';
    case 'tip': return '💡';
    default: return '✨';
  }
};

