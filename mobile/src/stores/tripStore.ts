import { create } from 'zustand';
import api from '../config/api';
import { Trip, TripMember } from '../types';

interface TripState {
  trips: Trip[];
  currentTrip: Trip | null;
  currentTripMembers: TripMember[];
  isLoading: boolean;
  
  // Actions
  fetchTrips: () => Promise<void>;
  fetchTripDetails: (tripId: string) => Promise<void>;
  fetchTripMembers: (tripId: string) => Promise<void>;
  createTrip: (data: {
    name: string;
    destination: string;
    startDate?: string;
    endDate?: string;
  }) => Promise<Trip>;
  updateTrip: (tripId: string, data: Partial<Trip>) => Promise<void>;
  updateTripBanner: (tripId: string, bannerUrl: string) => Promise<void>;
  deleteTrip: (tripId: string) => Promise<void>;
  joinTrip: (inviteCode: string) => Promise<Trip>;
  leaveTrip: (tripId: string) => Promise<void>;
  setCurrentTrip: (trip: Trip | null) => void;
}

export const useTripStore = create<TripState>((set, get) => ({
  trips: [],
  currentTrip: null,
  currentTripMembers: [],
  isLoading: false,

  fetchTrips: async () => {
    set({ isLoading: true });
    try {
      const response = await api.get<{ data: Trip[] }>('/trips');
      set({ trips: response.data.data, isLoading: false });
    } catch (error) {
      console.error('Fetch trips error:', error);
      set({ isLoading: false });
      throw error;
    }
  },

  fetchTripDetails: async (tripId: string) => {
    set({ isLoading: true });
    try {
      const response = await api.get<{ data: Trip }>(`/trips/${tripId}`);
      set({ currentTrip: response.data.data, isLoading: false });
    } catch (error) {
      console.error('Fetch trip details error:', error);
      set({ isLoading: false });
      throw error;
    }
  },

  fetchTripMembers: async (tripId: string) => {
    try {
      const response = await api.get<{ data: TripMember[] }>(`/trips/${tripId}/members`);
      set({ currentTripMembers: response.data.data });
    } catch (error) {
      console.error('Fetch trip members error:', error);
      throw error;
    }
  },

  createTrip: async (data) => {
    set({ isLoading: true });
    try {
      const response = await api.post<{ data: Trip }>('/trips', data);
      const newTrip = response.data.data;
      set((state) => ({
        trips: [newTrip, ...state.trips],
        isLoading: false,
      }));
      return newTrip;
    } catch (error: any) {
      set({ isLoading: false });
      throw new Error(error.response?.data?.error || 'Failed to create trip');
    }
  },

  updateTrip: async (tripId, data) => {
    set({ isLoading: true });
    try {
      const response = await api.put<{ data: Trip }>(`/trips/${tripId}`, data);
      const updatedTrip = response.data.data;
      set((state) => ({
        trips: state.trips.map((t) => (t.id === tripId ? updatedTrip : t)),
        currentTrip: state.currentTrip?.id === tripId ? updatedTrip : state.currentTrip,
        isLoading: false,
      }));
    } catch (error: any) {
      set({ isLoading: false });
      throw new Error(error.response?.data?.error || 'Failed to update trip');
    }
  },

  updateTripBanner: async (tripId, bannerUrl) => {
    try {
      const response = await api.put<{ data: Trip }>(`/trips/${tripId}/banner`, { bannerUrl });
      const updatedTrip = response.data.data;
      set((state) => ({
        trips: state.trips.map((t) => (t.id === tripId ? updatedTrip : t)),
        currentTrip: state.currentTrip?.id === tripId ? updatedTrip : state.currentTrip,
      }));
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to update banner');
    }
  },

  deleteTrip: async (tripId) => {
    set({ isLoading: true });
    try {
      await api.delete(`/trips/${tripId}`);
      set((state) => ({
        trips: state.trips.filter((t) => t.id !== tripId),
        currentTrip: state.currentTrip?.id === tripId ? null : state.currentTrip,
        isLoading: false,
      }));
    } catch (error: any) {
      set({ isLoading: false });
      throw new Error(error.response?.data?.error || 'Failed to delete trip');
    }
  },

  joinTrip: async (inviteCode) => {
    set({ isLoading: true });
    try {
      const response = await api.post<{ data: Trip }>('/trips/join', { inviteCode });
      const newTrip = response.data.data;
      set((state) => ({
        trips: [newTrip, ...state.trips],
        isLoading: false,
      }));
      return newTrip;
    } catch (error: any) {
      set({ isLoading: false });
      throw new Error(error.response?.data?.error || 'Failed to join trip');
    }
  },

  leaveTrip: async (tripId) => {
    set({ isLoading: true });
    try {
      await api.post(`/trips/${tripId}/leave`);
      set((state) => ({
        trips: state.trips.filter((t) => t.id !== tripId),
        currentTrip: state.currentTrip?.id === tripId ? null : state.currentTrip,
        isLoading: false,
      }));
    } catch (error: any) {
      set({ isLoading: false });
      throw new Error(error.response?.data?.error || 'Failed to leave trip');
    }
  },

  setCurrentTrip: (trip) => {
    set({ currentTrip: trip });
  },
}));

