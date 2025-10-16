import { create } from 'zustand';
import api from '../config/api';
import { Message } from '../types';

interface ChatState {
  messages: Message[];
  isLoading: boolean;
  isSending: boolean;
  
  // Actions
  fetchMessages: (tripId: string) => Promise<void>;
  sendMessage: (tripId: string, content: string) => Promise<void>;
  uploadImage: (tripId: string, imageUri: string) => Promise<void>;
  clearMessages: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isLoading: false,
  isSending: false,

  fetchMessages: async (tripId) => {
    set({ isLoading: true });
    try {
      const response = await api.get<{ data: Message[] }>(`/trips/${tripId}/messages`);
      set({ messages: response.data.data, isLoading: false });
    } catch (error) {
      console.error('Fetch messages error:', error);
      set({ isLoading: false });
      throw error;
    }
  },

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

  clearMessages: () => {
    set({ messages: [] });
  },
}));

