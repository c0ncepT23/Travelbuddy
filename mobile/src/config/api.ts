﻿import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// API Base URL - Using Railway (permanent cloud deployment!)
export const API_BASE_URL = Platform.OS === 'web' 
  ? 'http://localhost:3000/api'
  : 'https://travelbuddy-production-1d2c.up.railway.app/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  async (config) => {
    try {
      console.log('ðŸ”· API Interceptor: Getting token...');
      const token = await AsyncStorage.getItem('accessToken');
      console.log('ðŸ”· API Interceptor: Token retrieved', { hasToken: !!token });
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    } catch (error) {
      console.error('âŒ API Interceptor ERROR:', error);
      return config; // Return config even if error
    }
  },
  (error) => {
    console.error('âŒ API Request Interceptor Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = await AsyncStorage.getItem('refreshToken');
        
        if (!refreshToken) {
          throw new Error('No refresh token');
        }

        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refreshToken,
        });

        const { accessToken, refreshToken: newRefreshToken } = response.data.data;

        await AsyncStorage.setItem('accessToken', accessToken);
        await AsyncStorage.setItem('refreshToken', newRefreshToken);

        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed, clear tokens and redirect to login
        await AsyncStorage.removeItem('accessToken');
        await AsyncStorage.removeItem('refreshToken');
        // Navigation will be handled by the auth store
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;

