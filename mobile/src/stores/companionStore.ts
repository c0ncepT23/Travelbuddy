import { create } from 'zustand';
import api from '../config/api';

export interface PlaceResult {
  id: string;
  name: string;
  category: string;
  description: string;
  location_name?: string;
  distance?: number;
  // Rich UI card data
  photos_json?: string;
  rating?: number;
  user_ratings_total?: number;
}

export interface CompanionMessage {
  id: string;
  type: 'user' | 'companion';
  content: string;
  places?: PlaceResult[];
  suggestions?: string[];
  timestamp: Date;
}

interface CompanionState {
  messagesByTrip: Record<string, CompanionMessage[]>; // Trip-specific messages
  isLoading: boolean;
  error: string | null;
  
  // Actions
  sendQuery: (tripId: string, query: string, location?: { lat: number; lng: number }) => Promise<void>;
  getProactiveSuggestion: (tripId: string, location: { lat: number; lng: number }) => Promise<void>;
  clearMessages: (tripId: string) => void;
  addMessage: (tripId: string, message: CompanionMessage) => void;
  getMessages: (tripId: string) => CompanionMessage[];
}

export const useCompanionStore = create<CompanionState>((set, get) => ({
  messagesByTrip: {}, // Initialize as empty object
  isLoading: false,
  error: null,

  // Get messages for a specific trip
  getMessages: (tripId: string) => {
    return get().messagesByTrip[tripId] || [];
  },

  sendQuery: async (tripId: string, query: string, location?: { lat: number; lng: number }) => {
    try {
      set({ isLoading: true, error: null });

      // Add user message immediately
      const userMessage: CompanionMessage = {
        id: `user-${Date.now()}`,
        type: 'user',
        content: query,
        timestamp: new Date(),
      };
      
      set((state) => ({
        messagesByTrip: {
          ...state.messagesByTrip,
          [tripId]: [...(state.messagesByTrip[tripId] || []), userMessage],
        },
      }));

      // Send to backend
      const response = await api.post(`/companion/${tripId}/query`, {
        query,
        location,
      });

      if (response.data.success) {
        const companionMessage: CompanionMessage = {
          id: `companion-${Date.now()}`,
          type: 'companion',
          content: response.data.data.message,
          places: response.data.data.places,
          suggestions: response.data.data.suggestions,
          timestamp: new Date(),
        };

        set((state) => ({
          messagesByTrip: {
            ...state.messagesByTrip,
            [tripId]: [...(state.messagesByTrip[tripId] || []), companionMessage],
          },
          isLoading: false,
        }));
      }
    } catch (error: any) {
      console.error('Send query error:', error);
      set({
        error: error.response?.data?.error || 'Failed to send query',
        isLoading: false,
      });
      
      // Add error message
      const errorMessage: CompanionMessage = {
        id: `error-${Date.now()}`,
        type: 'companion',
        content: "Sorry, I had trouble with that. Can you try again? 😊",
        timestamp: new Date(),
      };
      
      set((state) => ({
        messagesByTrip: {
          ...state.messagesByTrip,
          [tripId]: [...(state.messagesByTrip[tripId] || []), errorMessage],
        },
      }));
    }
  },

  getProactiveSuggestion: async (tripId: string, location: { lat: number; lng: number }) => {
    try {
      const response = await api.post(`/companion/${tripId}/suggest`, {
        location,
      });

      if (response.data.success && response.data.data) {
        const companionMessage: CompanionMessage = {
          id: `suggestion-${Date.now()}`,
          type: 'companion',
          content: response.data.data.message,
          places: response.data.data.places,
          suggestions: response.data.data.suggestions,
          timestamp: new Date(),
        };

        set((state) => ({
          messagesByTrip: {
            ...state.messagesByTrip,
            [tripId]: [...(state.messagesByTrip[tripId] || []), companionMessage],
          },
        }));
      }
    } catch (error: any) {
      console.error('Get proactive suggestion error:', error);
      // Silently fail for proactive suggestions
    }
  },

  clearMessages: (tripId: string) => {
    set((state) => ({
      messagesByTrip: {
        ...state.messagesByTrip,
        [tripId]: [],
      },
      error: null,
    }));
  },

  addMessage: (tripId: string, message: CompanionMessage) => {
    set((state) => ({
      messagesByTrip: {
        ...state.messagesByTrip,
        [tripId]: [...(state.messagesByTrip[tripId] || []), message],
      },
    }));
  },
}));

