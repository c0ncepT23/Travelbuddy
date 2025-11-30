import { create } from 'zustand';
import api from '../config/api';
import { TripSegment, CurrentSegmentInfo } from '../types';

interface SegmentState {
  segments: TripSegment[];
  currentSegmentInfo: CurrentSegmentInfo | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  fetchSegments: (tripId: string, withStats?: boolean) => Promise<TripSegment[]>;
  fetchCurrentSegment: (tripId: string) => Promise<CurrentSegmentInfo>;
  addSegment: (tripId: string, segment: CreateSegmentInput) => Promise<TripSegment>;
  updateSegment: (tripId: string, segmentId: string, updates: Partial<TripSegment>) => Promise<TripSegment>;
  deleteSegment: (tripId: string, segmentId: string) => Promise<void>;
  reorderSegments: (tripId: string, segmentIds: string[]) => Promise<void>;
  clearSegments: () => void;
}

export interface CreateSegmentInput {
  city: string;
  startDate: string;
  endDate: string;
  area?: string;
  country?: string;
  timezone?: string;
  accommodationName?: string;
  accommodationAddress?: string;
  notes?: string;
}

export const useSegmentStore = create<SegmentState>((set, get) => ({
  segments: [],
  currentSegmentInfo: null,
  isLoading: false,
  error: null,

  fetchSegments: async (tripId, withStats = true) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get<{ data: TripSegment[] }>(
        `/trips/${tripId}/segments`,
        { params: { withStats: withStats.toString() } }
      );
      const segments = response.data.data;
      set({ segments, isLoading: false });
      console.log(`[SegmentStore] Fetched ${segments.length} segments for trip ${tripId}`);
      return segments;
    } catch (error: any) {
      console.error('[SegmentStore] Fetch segments error:', error);
      set({ isLoading: false, error: error.message });
      throw error;
    }
  },

  fetchCurrentSegment: async (tripId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get<{ data: CurrentSegmentInfo }>(
        `/trips/${tripId}/segments/current`
      );
      const info = response.data.data;
      set({ currentSegmentInfo: info, isLoading: false });
      
      if (info.segment) {
        console.log(`[SegmentStore] Current segment: ${info.segment.city} (Day ${info.dayNumber}/${info.totalDays})`);
      } else if (info.isTransitDay) {
        console.log(`[SegmentStore] Transit day - no active segment`);
      } else {
        console.log(`[SegmentStore] No current segment`);
      }
      
      return info;
    } catch (error: any) {
      console.error('[SegmentStore] Fetch current segment error:', error);
      set({ isLoading: false, error: error.message });
      throw error;
    }
  },

  addSegment: async (tripId, input) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post<{ data: TripSegment; message: string }>(
        `/trips/${tripId}/segments`,
        input
      );
      const newSegment = response.data.data;
      
      set((state) => ({
        segments: [...state.segments, newSegment].sort((a, b) => a.order_index - b.order_index),
        isLoading: false,
      }));
      
      console.log(`[SegmentStore] Added segment: ${newSegment.city}`);
      return newSegment;
    } catch (error: any) {
      console.error('[SegmentStore] Add segment error:', error);
      set({ isLoading: false, error: error.message });
      throw new Error(error.response?.data?.error || 'Failed to add segment');
    }
  },

  updateSegment: async (tripId, segmentId, updates) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.put<{ data: TripSegment }>(
        `/trips/${tripId}/segments/${segmentId}`,
        updates
      );
      const updatedSegment = response.data.data;
      
      set((state) => ({
        segments: state.segments.map((s) => 
          s.id === segmentId ? updatedSegment : s
        ),
        isLoading: false,
      }));
      
      console.log(`[SegmentStore] Updated segment: ${updatedSegment.city}`);
      return updatedSegment;
    } catch (error: any) {
      console.error('[SegmentStore] Update segment error:', error);
      set({ isLoading: false, error: error.message });
      throw new Error(error.response?.data?.error || 'Failed to update segment');
    }
  },

  deleteSegment: async (tripId, segmentId) => {
    set({ isLoading: true, error: null });
    try {
      await api.delete(`/trips/${tripId}/segments/${segmentId}`);
      
      set((state) => ({
        segments: state.segments.filter((s) => s.id !== segmentId),
        isLoading: false,
      }));
      
      console.log(`[SegmentStore] Deleted segment: ${segmentId}`);
    } catch (error: any) {
      console.error('[SegmentStore] Delete segment error:', error);
      set({ isLoading: false, error: error.message });
      throw new Error(error.response?.data?.error || 'Failed to delete segment');
    }
  },

  reorderSegments: async (tripId, segmentIds) => {
    try {
      const response = await api.put<{ data: TripSegment[] }>(
        `/trips/${tripId}/segments/reorder`,
        { segmentIds }
      );
      const reorderedSegments = response.data.data;
      
      set({ segments: reorderedSegments });
      console.log(`[SegmentStore] Reordered ${segmentIds.length} segments`);
    } catch (error: any) {
      console.error('[SegmentStore] Reorder segments error:', error);
      throw new Error(error.response?.data?.error || 'Failed to reorder segments');
    }
  },

  clearSegments: () => {
    set({ segments: [], currentSegmentInfo: null, error: null });
  },
}));

// Helper function to check if a date is within a segment
export const isDateInSegment = (date: Date, segment: TripSegment): boolean => {
  const checkDate = new Date(date).setHours(0, 0, 0, 0);
  const startDate = new Date(segment.start_date).setHours(0, 0, 0, 0);
  const endDate = new Date(segment.end_date).setHours(0, 0, 0, 0);
  return checkDate >= startDate && checkDate <= endDate;
};

// Helper function to get segment for a specific date
export const getSegmentForDate = (date: Date, segments: TripSegment[]): TripSegment | null => {
  return segments.find((s) => isDateInSegment(date, s)) || null;
};

// Helper function to format segment date range
export const formatSegmentDates = (segment: TripSegment): string => {
  const start = new Date(segment.start_date);
  const end = new Date(segment.end_date);
  
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  const startStr = start.toLocaleDateString('en-US', options);
  const endStr = end.toLocaleDateString('en-US', options);
  
  return `${startStr} - ${endStr}`;
};

// Helper function to calculate days until segment
export const daysUntilSegment = (segment: TripSegment): number => {
  const today = new Date().setHours(0, 0, 0, 0);
  const startDate = new Date(segment.start_date).setHours(0, 0, 0, 0);
  return Math.ceil((startDate - today) / (1000 * 60 * 60 * 24));
};

