import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../config/api';
import { User, AuthResponse, LoginRequest, RegisterRequest } from '../types';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  
  // Actions
  login: (credentials: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  googleLogin: (idToken: string) => Promise<void>;
  logout: () => Promise<void>;
  loadStoredAuth: () => Promise<void>;
  setUser: (user: User) => void;
  updateUser: (updates: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isLoading: false,
  isAuthenticated: false,

  login: async (credentials: LoginRequest) => {
    set({ isLoading: true });
    try {
      // Use phone-based login if phone number provided, else email
      const endpoint = (credentials as any).phoneNumber ? '/auth/login-phone' : '/auth/login';
      const response = await api.post<{ data: AuthResponse }>(endpoint, credentials);
      const { user, accessToken, refreshToken } = response.data.data;

      // Store tokens
      await AsyncStorage.setItem('accessToken', accessToken);
      await AsyncStorage.setItem('refreshToken', refreshToken);
      await AsyncStorage.setItem('user', JSON.stringify(user));

      set({
        user,
        accessToken,
        refreshToken,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error: any) {
      set({ isLoading: false });
      throw new Error(error.response?.data?.error || 'Login failed');
    }
  },

  register: async (data: RegisterRequest) => {
    set({ isLoading: true });
    try {
      // Use phone-based registration if phone number provided, else email
      const endpoint = (data as any).phoneNumber ? '/auth/register-phone' : '/auth/signup';
      const response = await api.post<{ data: AuthResponse }>(endpoint, data);
      const { user, accessToken, refreshToken } = response.data.data;

      // Store tokens
      await AsyncStorage.setItem('accessToken', accessToken);
      await AsyncStorage.setItem('refreshToken', refreshToken);
      await AsyncStorage.setItem('user', JSON.stringify(user));

      set({
        user,
        accessToken,
        refreshToken,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error: any) {
      set({ isLoading: false });
      throw new Error(error.response?.data?.error || 'Registration failed');
    }
  },

  googleLogin: async (idToken: string) => {
    set({ isLoading: true });
    try {
      const response = await api.post<{ data: AuthResponse }>('/auth/google', { idToken });
      const { user, accessToken, refreshToken } = response.data.data;

      await AsyncStorage.setItem('accessToken', accessToken);
      await AsyncStorage.setItem('refreshToken', refreshToken);
      await AsyncStorage.setItem('user', JSON.stringify(user));

      set({
        user,
        accessToken,
        refreshToken,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error: any) {
      set({ isLoading: false });
      throw new Error(error.response?.data?.error || 'Google login failed');
    }
  },

  logout: async () => {
    try {
      const { refreshToken } = get();
      if (refreshToken) {
        await api.post('/auth/logout', { refreshToken });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear local storage
      await AsyncStorage.removeItem('accessToken');
      await AsyncStorage.removeItem('refreshToken');
      await AsyncStorage.removeItem('user');

      set({
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
      });
    }
  },

  loadStoredAuth: async () => {
    console.log('🔵 loadStoredAuth: Starting...');
    set({ isLoading: true });
    try {
      console.log('🔵 loadStoredAuth: Accessing AsyncStorage...');
      const [accessToken, refreshToken, userStr] = await Promise.all([
        AsyncStorage.getItem('accessToken'),
        AsyncStorage.getItem('refreshToken'),
        AsyncStorage.getItem('user'),
      ]);
      
      console.log('🔵 loadStoredAuth: AsyncStorage read complete', {
        hasToken: !!accessToken,
        hasRefresh: !!refreshToken,
        hasUser: !!userStr
      });

      if (accessToken && refreshToken && userStr) {
        console.log('🔵 loadStoredAuth: Parsing user data...');
        const user = JSON.parse(userStr);
        console.log('🔵 loadStoredAuth: Setting authenticated state...');
        set({
          user,
          accessToken,
          refreshToken,
          isAuthenticated: true,
        });
        console.log('✅ loadStoredAuth: Complete - User authenticated');
      } else {
        console.log('✅ loadStoredAuth: Complete - No stored auth found');
      }
    } catch (error) {
      console.error('❌ loadStoredAuth ERROR:', error);
      console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack');
    } finally {
      console.log('🔵 loadStoredAuth: Setting isLoading = false');
      set({ isLoading: false });
      console.log('✅ loadStoredAuth: Finished');
    }
  },

  setUser: (user: User) => {
    set({ user });
    AsyncStorage.setItem('user', JSON.stringify(user));
  },

  updateUser: (updates: Partial<User>) => {
    const currentUser = get().user;
    if (currentUser) {
      const updatedUser = { ...currentUser, ...updates };
      set({ user: updatedUser });
      AsyncStorage.setItem('user', JSON.stringify(updatedUser));
    }
  },
}));

