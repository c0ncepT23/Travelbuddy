import { create } from 'zustand';
import api from '../config/api';
import { Message, PendingImportPlace } from '../types';
import { websocketService } from '../services/websocket.service';

interface ImportLocationsPayload {
  sourceUrl: string;
  sourceType: 'youtube' | 'reddit' | 'instagram';
  sourceTitle: string;
  selectedPlaces: PendingImportPlace[];
}

interface TypingUser {
  userId: number;
  email: string;
  name?: string;
}

interface OnlineUser {
  user_id: number;
  email?: string;
  name?: string;
  is_online: boolean;
  last_seen?: Date;
}

interface ChatState {
  messages: Message[];
  isLoading: boolean;
  isSending: boolean;
  isConnected: boolean;
  typingUsers: TypingUser[];
  onlineUsers: OnlineUser[];
  currentTripId: string | null;
  
  // Actions
  fetchMessages: (tripId: string) => Promise<void>;
  sendMessage: (tripId: string, content: string) => Promise<void>;
  sendMessageViaSocket: (tripId: string, content: string) => void;
  uploadImage: (tripId: string, imageUri: string) => Promise<void>;
  importLocations: (tripId: string, payload: ImportLocationsPayload) => Promise<number>;
  clearMessages: () => void;
  
  // WebSocket actions
  connectWebSocket: () => Promise<void>;
  disconnectWebSocket: () => void;
  joinTripChat: (tripId: string) => void;
  leaveTripChat: (tripId: string) => void;
  startTyping: (tripId: string) => void;
  stopTyping: (tripId: string) => void;
  markAsRead: (tripId: string, messageId?: number) => void;
  
  // Internal state updates
  addMessage: (message: Message) => void;
  setTypingUsers: (users: TypingUser[]) => void;
  addTypingUser: (user: TypingUser) => void;
  removeTypingUser: (userId: number) => void;
  setOnlineUsers: (users: OnlineUser[]) => void;
  addOnlineUser: (user: OnlineUser) => void;
  removeOnlineUser: (userId: number) => void;
  setConnectionStatus: (connected: boolean) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isLoading: false,
  isSending: false,
  isConnected: false,
  typingUsers: [],
  onlineUsers: [],
  currentTripId: null,

  fetchMessages: async (tripId) => {
    set({ isLoading: true });
    try {
      const response = await api.get<{ data: Message[] }>(`/trips/${tripId}/messages`);
      console.log(`[ChatStore] Fetched ${response.data.data?.length || 0} messages for trip ${tripId}`);
      set({ messages: response.data.data || [], isLoading: false });
    } catch (error) {
      console.error('[ChatStore] Fetch messages error:', error);
      set({ isLoading: false, messages: [] });
      throw error;
    }
  },

  // REST API send (fallback)
  sendMessage: async (tripId, content) => {
    set({ isSending: true });
    try {
      const response = await api.post<{
        data: { userMessage: Message; agentResponse?: Message };
      }>(`/trips/${tripId}/messages`, {
        content,
        messageType: 'text',
      });

      const { userMessage, agentResponse } = response.data.data;

      set((state) => ({
        messages: [
          ...state.messages,
          userMessage,
          ...(agentResponse ? [agentResponse] : []),
        ],
        isSending: false,
      }));
    } catch (error: any) {
      set({ isSending: false });
      throw new Error(error.response?.data?.error || 'Failed to send message');
    }
  },

  // WebSocket send (preferred)
  sendMessageViaSocket: (tripId, content) => {
    const { isConnected, stopTyping } = get();
    
    if (isConnected) {
      set({ isSending: true });
      websocketService.sendMessage({
        tripId,
        content,
        messageType: 'text',
      });
      stopTyping(tripId);
      // isSending will be reset when we receive the message back
      setTimeout(() => set({ isSending: false }), 500);
    } else {
      // Fallback to REST
      get().sendMessage(tripId, content);
    }
  },

  uploadImage: async (tripId, imageUri) => {
    set({ isSending: true });
    try {
      const formData = new FormData();
      formData.append('image', {
        uri: imageUri,
        type: 'image/jpeg',
        name: 'photo.jpg',
      } as any);

      const response = await api.post<{ data: Message }>(
        `/trips/${tripId}/upload-image`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      set((state) => ({
        messages: [...state.messages, response.data.data],
        isSending: false,
      }));
    } catch (error: any) {
      set({ isSending: false });
      throw new Error(error.response?.data?.error || 'Failed to upload image');
    }
  },

  importLocations: async (tripId, payload) => {
    try {
      const response = await api.post<{
        data: { savedCount: number; totalSelected: number; savedItems: any[] };
      }>(`/trips/${tripId}/import-locations`, payload);

      // Refresh messages to show agent confirmation
      await get().fetchMessages(tripId);

      return response.data.data.savedCount;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to import locations');
    }
  },

  clearMessages: () => {
    set({ messages: [], typingUsers: [], onlineUsers: [] });
  },

  // WebSocket Methods
  connectWebSocket: async () => {
    await websocketService.connect();
    
    // Set up event listeners
    websocketService.on('connection_status', (data: { connected: boolean }) => {
      get().setConnectionStatus(data.connected);
    });
    
    websocketService.on('new_message', (message: Message) => {
      get().addMessage(message);
    });
    
    websocketService.on('typing_started', (data: TypingUser) => {
      get().addTypingUser(data);
    });
    
    websocketService.on('typing_stopped', (data: { userId: number }) => {
      get().removeTypingUser(data.userId);
    });
    
    websocketService.on('online_users', (users: OnlineUser[]) => {
      get().setOnlineUsers(users);
    });
    
    websocketService.on('user_online', (user: OnlineUser) => {
      get().addOnlineUser(user);
    });
    
    websocketService.on('user_offline', (user: { userId: number }) => {
      get().removeOnlineUser(user.userId);
    });
  },

  disconnectWebSocket: () => {
    websocketService.disconnect();
    set({ isConnected: false, typingUsers: [], onlineUsers: [] });
  },

  joinTripChat: (tripId) => {
    set({ currentTripId: tripId });
    websocketService.joinTrip(tripId);
  },

  leaveTripChat: (tripId) => {
    websocketService.leaveTrip(tripId);
    set({ currentTripId: null, typingUsers: [], onlineUsers: [] });
  },

  startTyping: (tripId) => {
    if (get().isConnected) {
      websocketService.startTyping(tripId);
    }
  },

  stopTyping: (tripId) => {
    if (get().isConnected) {
      websocketService.stopTyping(tripId);
    }
  },

  markAsRead: (tripId, messageId) => {
    if (get().isConnected) {
      websocketService.markAsRead(tripId, messageId);
    }
  },

  // Internal state updates
  addMessage: (message) => {
    set((state) => {
      // Avoid duplicates
      const exists = state.messages.some((m) => m.id === message.id);
      if (exists) return state;
      return { messages: [...state.messages, message] };
    });
  },

  setTypingUsers: (users) => {
    set({ typingUsers: users });
  },

  addTypingUser: (user) => {
    set((state) => {
      const exists = state.typingUsers.some((u) => u.userId === user.userId);
      if (exists) return state;
      return { typingUsers: [...state.typingUsers, user] };
    });
  },

  removeTypingUser: (userId) => {
    set((state) => ({
      typingUsers: state.typingUsers.filter((u) => u.userId !== userId),
    }));
  },

  setOnlineUsers: (users) => {
    set({ onlineUsers: users });
  },

  addOnlineUser: (user) => {
    set((state) => {
      // Update if exists, add if new
      const existingIndex = state.onlineUsers.findIndex((u) => u.user_id === user.user_id);
      if (existingIndex >= 0) {
        const updated = [...state.onlineUsers];
        updated[existingIndex] = { ...updated[existingIndex], is_online: true };
        return { onlineUsers: updated };
      }
      return { onlineUsers: [...state.onlineUsers, { ...user, is_online: true }] };
    });
  },

  removeOnlineUser: (userId) => {
    set((state) => ({
      onlineUsers: state.onlineUsers.map((u) =>
        u.user_id === userId ? { ...u, is_online: false } : u
      ),
    }));
  },

  setConnectionStatus: (connected) => {
    set({ isConnected: connected });
  },
}));
