import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';

class WebSocketService {
  private socket: Socket | null = null;
  private isConnected: boolean = false;
  private currentTripId: string | null = null;
  private listeners: Map<string, Set<Function>> = new Map();

  async connect() {
    if (this.socket?.connected) {
      console.log('[WebSocket] Already connected');
      return;
    }

    try {
      // Get auth token
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        console.error('[WebSocket] No auth token found');
        return;
      }

      const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://travelbuddy-production-1d2c.up.railway.app';

      this.socket = io(API_URL, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5,
      });

      this.setupEventHandlers();
      console.log('[WebSocket] Connecting...');
    } catch (error) {
      console.error('[WebSocket] Connection error:', error);
    }
  }

  private setupEventHandlers() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('[WebSocket] Connected:', this.socket?.id);
      this.isConnected = true;
      this.emit('connection_status', { connected: true });
      
      // Rejoin trip if we were in one
      if (this.currentTripId) {
        this.joinTrip(this.currentTripId);
      }
    });

    this.socket.on('disconnect', () => {
      console.log('[WebSocket] Disconnected');
      this.isConnected = false;
      this.emit('connection_status', { connected: false });
    });

    this.socket.on('connect_error', (error) => {
      console.error('[WebSocket] Connection error:', error.message);
      this.emit('connection_error', { error: error.message });
    });

    // Message events
    this.socket.on('new_message', (message) => {
      console.log('[WebSocket] New message:', message);
      this.emit('new_message', message);
    });

    // Online status events
    this.socket.on('user_online', (data) => {
      console.log('[WebSocket] User online:', data);
      this.emit('user_online', data);
    });

    this.socket.on('user_offline', (data) => {
      console.log('[WebSocket] User offline:', data);
      this.emit('user_offline', data);
    });

    this.socket.on('online_users', (users) => {
      console.log('[WebSocket] Online users:', users);
      this.emit('online_users', users);
    });

    // Typing events
    this.socket.on('typing_started', (data) => {
      console.log('[WebSocket] Typing started:', data);
      this.emit('typing_started', data);
    });

    this.socket.on('typing_stopped', (data) => {
      console.log('[WebSocket] Typing stopped:', data);
      this.emit('typing_stopped', data);
    });

    // Read receipts
    this.socket.on('message_read', (data) => {
      console.log('[WebSocket] Message read:', data);
      this.emit('message_read', data);
    });
  }

  joinTrip(tripId: string) {
    if (!this.socket?.connected) {
      console.warn('[WebSocket] Not connected, cannot join trip');
      return;
    }

    console.log('[WebSocket] Joining trip:', tripId);
    this.currentTripId = tripId;
    this.socket.emit('join_trip', tripId);
  }

  leaveTrip(tripId: string) {
    if (!this.socket?.connected) return;

    console.log('[WebSocket] Leaving trip:', tripId);
    this.socket.emit('leave_trip', tripId);
    
    if (this.currentTripId === tripId) {
      this.currentTripId = null;
    }
  }

  sendMessage(data: {
    tripId: string;
    content: string;
    messageType?: 'text' | 'ai_response' | 'system';
    metadata?: any;
    replyToMessageId?: number;
  }) {
    if (!this.socket?.connected) {
      console.error('[WebSocket] Not connected, cannot send message');
      return;
    }

    console.log('[WebSocket] Sending message:', data);
    this.socket.emit('send_message', data);
  }

  startTyping(tripId: string) {
    if (!this.socket?.connected) return;
    this.socket.emit('typing_start', { tripId });
  }

  stopTyping(tripId: string) {
    if (!this.socket?.connected) return;
    this.socket.emit('typing_stop', { tripId });
  }

  markAsRead(tripId: string, messageId?: number) {
    if (!this.socket?.connected) return;
    this.socket.emit('mark_read', { tripId, messageId });
  }

  // Event listener management
  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: string, callback: Function) {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(callback);
    }
  }

  private emit(event: string, data: any) {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(callback => callback(data));
    }
  }

  disconnect() {
    if (this.socket) {
      console.log('[WebSocket] Disconnecting...');
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.currentTripId = null;
    }
  }

  isSocketConnected(): boolean {
    return this.isConnected && this.socket?.connected === true;
  }
}

// Export singleton instance
export const websocketService = new WebSocketService();

