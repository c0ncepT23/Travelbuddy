import { create } from 'zustand';
import api from '../config/api';

export interface CheckIn {
  id: string;
  saved_item_id: string;
  user_id: string;
  checked_in_at: Date;
  rating?: number;
  note?: string;
  cost?: number;
  currency?: string;
  photos?: string[];
}

interface CheckInState {
  checkInsByTrip: Record<string, CheckIn[]>;
  isLoading: boolean;
  
  // Actions
  fetchCheckIns: (tripId: string) => Promise<void>;
  isPlaceCheckedIn: (tripId: string, placeId: string) => boolean;
  refreshCheckIns: (tripId: string) => Promise<void>;
}

export const useCheckInStore = create<CheckInState>((set, get) => ({
  checkInsByTrip: {},
  isLoading: false,

  fetchCheckIns: async (tripId: string) => {
    try {
      set({ isLoading: true });
      const response = await api.get(`/trips/${tripId}/checkins`);
      
      if (response.data.success) {
        set(state => ({
          checkInsByTrip: {
            ...state.checkInsByTrip,
            [tripId]: response.data.data,
          },
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
}));
