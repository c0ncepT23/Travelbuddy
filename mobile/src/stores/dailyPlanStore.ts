import { create } from 'zustand';
import { DailyPlan, DailyPlanStop, ApiResponse } from '../types';
import api from '../services/api';

interface DailyPlanState {
  todaysPlan: DailyPlan | null;
  allPlans: DailyPlan[];
  isLoading: boolean;
  isGenerating: boolean;
  error: string | null;
  lastGeneratedMessage: string | null;

  // Actions
  fetchTodaysPlan: (tripId: string) => Promise<void>;
  fetchAllPlans: (tripId: string) => Promise<void>;
  generatePlan: (tripId: string, date?: string) => Promise<{ plan: DailyPlan; message: string } | null>;
  updateStops: (tripId: string, planId: string, stops: DailyPlanStop[]) => Promise<void>;
  addStop: (tripId: string, planId: string, savedItemId: string, plannedTime?: string, durationMinutes?: number) => Promise<void>;
  removeStop: (tripId: string, planId: string, savedItemId: string) => Promise<void>;
  swapStop: (tripId: string, planId: string, oldItemId: string, newItemId: string) => Promise<void>;
  updateStatus: (tripId: string, planId: string, status: 'active' | 'completed' | 'cancelled') => Promise<void>;
  deletePlan: (tripId: string, planId: string) => Promise<void>;
  clearError: () => void;
  reset: () => void;
}

export const useDailyPlanStore = create<DailyPlanState>((set, get) => ({
  todaysPlan: null,
  allPlans: [],
  isLoading: false,
  isGenerating: false,
  error: null,
  lastGeneratedMessage: null,

  fetchTodaysPlan: async (tripId: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get<ApiResponse<DailyPlan | null>>(
        `/trips/${tripId}/plans/today`
      );
      if (response.data.success) {
        set({ todaysPlan: response.data.data, isLoading: false });
      } else {
        set({ error: response.data.error || 'Failed to fetch plan', isLoading: false });
      }
    } catch (error: any) {
      set({
        error: error.response?.data?.error || 'Failed to fetch plan',
        isLoading: false,
      });
    }
  },

  fetchAllPlans: async (tripId: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get<ApiResponse<DailyPlan[]>>(
        `/trips/${tripId}/plans`
      );
      if (response.data.success) {
        set({ allPlans: response.data.data || [], isLoading: false });
      } else {
        set({ error: response.data.error || 'Failed to fetch plans', isLoading: false });
      }
    } catch (error: any) {
      set({
        error: error.response?.data?.error || 'Failed to fetch plans',
        isLoading: false,
      });
    }
  },

  generatePlan: async (tripId: string, date?: string) => {
    set({ isGenerating: true, error: null, lastGeneratedMessage: null });
    try {
      const response = await api.post<ApiResponse<{ plan: DailyPlan; message: string }>>(
        `/trips/${tripId}/plans/generate`,
        { date }
      );
      if (response.data.success && response.data.data) {
        const { plan, message } = response.data.data;
        
        // Update today's plan if it's for today
        const today = new Date().toISOString().split('T')[0];
        const planDate = new Date(plan.plan_date).toISOString().split('T')[0];
        
        if (planDate === today) {
          set({ todaysPlan: plan });
        }
        
        // Update allPlans
        const currentPlans = get().allPlans;
        const existingIndex = currentPlans.findIndex(p => p.id === plan.id);
        if (existingIndex >= 0) {
          currentPlans[existingIndex] = plan;
          set({ allPlans: [...currentPlans] });
        } else {
          set({ allPlans: [...currentPlans, plan] });
        }
        
        set({ isGenerating: false, lastGeneratedMessage: message });
        return { plan, message };
      } else {
        set({ error: response.data.error || 'Failed to generate plan', isGenerating: false });
        return null;
      }
    } catch (error: any) {
      set({
        error: error.response?.data?.error || 'Failed to generate plan',
        isGenerating: false,
      });
      return null;
    }
  },

  updateStops: async (tripId: string, planId: string, stops: DailyPlanStop[]) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.put<ApiResponse<DailyPlan>>(
        `/trips/${tripId}/plans/${planId}/stops`,
        { stops }
      );
      if (response.data.success && response.data.data) {
        const updatedPlan = response.data.data;
        
        // Update todaysPlan if applicable
        if (get().todaysPlan?.id === planId) {
          set({ todaysPlan: updatedPlan });
        }
        
        // Update allPlans
        const currentPlans = get().allPlans.map(p => 
          p.id === planId ? updatedPlan : p
        );
        set({ allPlans: currentPlans, isLoading: false });
      } else {
        set({ error: response.data.error || 'Failed to update stops', isLoading: false });
      }
    } catch (error: any) {
      set({
        error: error.response?.data?.error || 'Failed to update stops',
        isLoading: false,
      });
    }
  },

  addStop: async (tripId: string, planId: string, savedItemId: string, plannedTime?: string, durationMinutes?: number) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post<ApiResponse<DailyPlan>>(
        `/trips/${tripId}/plans/${planId}/stops`,
        { savedItemId, plannedTime, durationMinutes }
      );
      if (response.data.success && response.data.data) {
        const updatedPlan = response.data.data;
        
        if (get().todaysPlan?.id === planId) {
          set({ todaysPlan: updatedPlan });
        }
        
        const currentPlans = get().allPlans.map(p => 
          p.id === planId ? updatedPlan : p
        );
        set({ allPlans: currentPlans, isLoading: false });
      } else {
        set({ error: response.data.error || 'Failed to add stop', isLoading: false });
      }
    } catch (error: any) {
      set({
        error: error.response?.data?.error || 'Failed to add stop',
        isLoading: false,
      });
    }
  },

  removeStop: async (tripId: string, planId: string, savedItemId: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.delete<ApiResponse<DailyPlan>>(
        `/trips/${tripId}/plans/${planId}/stops/${savedItemId}`
      );
      if (response.data.success && response.data.data) {
        const updatedPlan = response.data.data;
        
        if (get().todaysPlan?.id === planId) {
          set({ todaysPlan: updatedPlan });
        }
        
        const currentPlans = get().allPlans.map(p => 
          p.id === planId ? updatedPlan : p
        );
        set({ allPlans: currentPlans, isLoading: false });
      } else {
        set({ error: response.data.error || 'Failed to remove stop', isLoading: false });
      }
    } catch (error: any) {
      set({
        error: error.response?.data?.error || 'Failed to remove stop',
        isLoading: false,
      });
    }
  },

  swapStop: async (tripId: string, planId: string, oldItemId: string, newItemId: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post<ApiResponse<DailyPlan>>(
        `/trips/${tripId}/plans/${planId}/swap`,
        { oldItemId, newItemId }
      );
      if (response.data.success && response.data.data) {
        const updatedPlan = response.data.data;
        
        if (get().todaysPlan?.id === planId) {
          set({ todaysPlan: updatedPlan });
        }
        
        const currentPlans = get().allPlans.map(p => 
          p.id === planId ? updatedPlan : p
        );
        set({ allPlans: currentPlans, isLoading: false });
      } else {
        set({ error: response.data.error || 'Failed to swap stop', isLoading: false });
      }
    } catch (error: any) {
      set({
        error: error.response?.data?.error || 'Failed to swap stop',
        isLoading: false,
      });
    }
  },

  updateStatus: async (tripId: string, planId: string, status: 'active' | 'completed' | 'cancelled') => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.put<ApiResponse<DailyPlan>>(
        `/trips/${tripId}/plans/${planId}/status`,
        { status }
      );
      if (response.data.success && response.data.data) {
        const updatedPlan = response.data.data;
        
        if (get().todaysPlan?.id === planId) {
          set({ todaysPlan: updatedPlan });
        }
        
        const currentPlans = get().allPlans.map(p => 
          p.id === planId ? updatedPlan : p
        );
        set({ allPlans: currentPlans, isLoading: false });
      } else {
        set({ error: response.data.error || 'Failed to update status', isLoading: false });
      }
    } catch (error: any) {
      set({
        error: error.response?.data?.error || 'Failed to update status',
        isLoading: false,
      });
    }
  },

  deletePlan: async (tripId: string, planId: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.delete<ApiResponse<void>>(
        `/trips/${tripId}/plans/${planId}`
      );
      if (response.data.success) {
        if (get().todaysPlan?.id === planId) {
          set({ todaysPlan: null });
        }
        
        const currentPlans = get().allPlans.filter(p => p.id !== planId);
        set({ allPlans: currentPlans, isLoading: false });
      } else {
        set({ error: response.data.error || 'Failed to delete plan', isLoading: false });
      }
    } catch (error: any) {
      set({
        error: error.response?.data?.error || 'Failed to delete plan',
        isLoading: false,
      });
    }
  },

  clearError: () => set({ error: null }),

  reset: () => set({
    todaysPlan: null,
    allPlans: [],
    isLoading: false,
    isGenerating: false,
    error: null,
    lastGeneratedMessage: null,
  }),
}));

