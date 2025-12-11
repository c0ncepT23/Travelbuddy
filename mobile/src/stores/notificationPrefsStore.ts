import { create } from 'zustand';
import api from '../config/api';
import { NotificationPreferences } from '../types';
import { proactiveNotificationService } from '../services/proactiveNotification.service';

interface NotificationPrefsState {
  preferences: NotificationPreferences | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchPreferences: (tripId?: string) => Promise<NotificationPreferences>;
  updatePreferences: (updates: Partial<NotificationPreferences>, tripId?: string) => Promise<void>;
  clearPreferences: () => void;
}

export const useNotificationPrefsStore = create<NotificationPrefsState>((set, get) => ({
  preferences: null,
  isLoading: false,
  error: null,

  fetchPreferences: async (tripId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get<{ data: NotificationPreferences }>(
        '/notifications/preferences',
        { params: { tripId } }
      );
      const prefs = response.data.data;
      set({ preferences: prefs, isLoading: false });
      
      return prefs;
    } catch (error: any) {
      console.error('[NotifPrefsStore] Fetch error:', error);
      set({ isLoading: false, error: error.message });
      throw error;
    }
  },

  updatePreferences: async (updates, tripId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.put<{ data: NotificationPreferences }>(
        '/notifications/preferences',
        updates,
        { params: { tripId } }
      );
      const prefs = response.data.data;
      set({ preferences: prefs, isLoading: false });

      // Update proactive notification service
      await proactiveNotificationService.updatePreferences({
        morningBriefing: prefs.morning_briefing,
        mealSuggestions: prefs.meal_suggestions,
        nearbyAlerts: prefs.nearby_alerts,
        eveningRecap: prefs.evening_recap,
        segmentAlerts: prefs.segment_alerts,
        quietStart: prefs.quiet_start,
        quietEnd: prefs.quiet_end,
      });

    } catch (error: any) {
      console.error('[NotifPrefsStore] Update error:', error);
      set({ isLoading: false, error: error.message });
      throw error;
    }
  },

  clearPreferences: () => {
    set({ preferences: null, error: null });
  },
}));

