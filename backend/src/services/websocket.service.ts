import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { GroupMessageModel } from '../models/groupMessage.model';
import jwt from 'jsonwebtoken';

interface AuthenticatedSocket extends Socket {
  userId?: number;
  userEmail?: string;
}

export class WebSocketService {
  private io: SocketIOServer;
  
  constructor(httpServer: HTTPServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || '*',
        methods: ['GET', 'POST'],
        credentials: true
      },
      pingTimeout: 60000,
      pingInterval: 25000
    });

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  private setupMiddleware() {
    // Authentication middleware
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
        
        if (!token) {
          return next(new Error('Authentication error'));
        }

        const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'secret');
        socket.userId = decoded.id;
        socket.userEmail = decoded.email;
        
        next();
      } catch (error) {
        next(new Error('Authentication error'));
      }
    });
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      console.log(`User connected: ${socket.userId} (${socket.userEmail})`);

      // Join trip rooms
      socket.on('join_trip', async (tripId: string) => {
        if (!socket.userId) return;
        
        try {
          const room = `trip_${tripId}`;
          socket.join(room);
          
          // Update online status
          await GroupMessageModel.setOnlineStatus(
            socket.userId,
            parseInt(tripId),
            true,
            socket.id
          );
          
          // Broadcast to others in the trip
          socket.to(room).emit('user_online', {
            userId: socket.userId,
            email: socket.userEmail
          });
          
          // Send current online users
          const onlineUsers = await GroupMessageModel.getOnlineUsers(parseInt(tripId));
          socket.emit('online_users', onlineUsers);
          
          console.log(`User ${socket.userId} joined trip ${tripId}`);
        } catch (error) {
          console.error('Error joining trip:', error);
        }
      });

      // Leave trip room
      socket.on('leave_trip', async (tripId: string) => {
        if (!socket.userId) return;
        
        try {
          const room = `trip_${tripId}`;
          socket.leave(room);
          
          // Update online status
          await GroupMessageModel.setOnlineStatus(
            socket.userId,
            parseInt(tripId),
            false
          );
          
          // Broadcast to others
          socket.to(room).emit('user_offline', {
            userId: socket.userId,
            email: socket.userEmail
          });
          
          console.log(`User ${socket.userId} left trip ${tripId}`);
        } catch (error) {
          console.error('Error leaving trip:', error);
        }
      });

      // Send message
      socket.on('send_message', async (data: {
        tripId: string;
        content: string;
        messageType?: 'text' | 'ai_response' | 'system';
        metadata?: any;
        replyToMessageId?: number;
      }) => {
        if (!socket.userId) return;
        
        try {
          const { tripId, content, messageType, metadata, replyToMessageId } = data;
          
          // Save message to database
          const message = await GroupMessageModel.create(
            parseInt(tripId),
            socket.userId,
            content,
            messageType || 'text',
            metadata,
            replyToMessageId
          );
          
          // Broadcast to all users in the trip (including sender)
          const room = `trip_${tripId}`;
          this.io.to(room).emit('new_message', {
            ...message,
            sender_email: socket.userEmail
          });
          
          // Remove typing indicator
          await GroupMessageModel.removeTyping(parseInt(tripId), socket.userId);
          this.io.to(room).emit('typing_stopped', {
            userId: socket.userId,
            email: socket.userEmail
          });
          
          console.log(`Message sent by ${socket.userId} in trip ${tripId}`);
        } catch (error) {
          console.error('Error sending message:', error);
          socket.emit('message_error', { error: 'Failed to send message' });
        }
      });

      // Typing indicator
      socket.on('typing_start', async (data: { tripId: string }) => {
        if (!socket.userId) return;
        
        try {
          const { tripId } = data;
          await GroupMessageModel.setTyping(parseInt(tripId), socket.userId);
          
          const room = `trip_${tripId}`;
          socket.to(room).emit('typing_started', {
            userId: socket.userId,
            email: socket.userEmail
          });
        } catch (error) {
          console.error('Error setting typing:', error);
        }
      });

      socket.on('typing_stop', async (data: { tripId: string }) => {
        if (!socket.userId) return;
        
        try {
          const { tripId } = data;
          await GroupMessageModel.removeTyping(parseInt(tripId), socket.userId);
          
          const room = `trip_${tripId}`;
          socket.to(room).emit('typing_stopped', {
            userId: socket.userId,
            email: socket.userEmail
          });
        } catch (error) {
          console.error('Error removing typing:', error);
        }
      });

      // Mark messages as read
      socket.on('mark_read', async (data: { tripId: string; messageId?: number }) => {
        if (!socket.userId) return;
        
        try {
          const { tripId, messageId } = data;
          
          if (messageId) {
            await GroupMessageModel.markAsRead(messageId, socket.userId);
          } else {
            await GroupMessageModel.markAllAsRead(parseInt(tripId), socket.userId);
          }
          
          const room = `trip_${tripId}`;
          socket.to(room).emit('message_read', {
            userId: socket.userId,
            messageId,
            tripId
          });
        } catch (error) {
          console.error('Error marking as read:', error);
        }
      });

      // Handle disconnection
      socket.on('disconnect', async () => {
        if (!socket.userId) return;
        
        console.log(`User disconnected: ${socket.userId}`);
        
        try {
          // Get all trips the user was in and update status
          const rooms = Array.from(socket.rooms);
          for (const room of rooms) {
            if (room.startsWith('trip_')) {
              const tripId = room.replace('trip_', '');
              
              await GroupMessageModel.setOnlineStatus(
                socket.userId,
                parseInt(tripId),
                false
              );
              
              socket.to(room).emit('user_offline', {
                userId: socket.userId,
                email: socket.userEmail
              });
            }
          }
        } catch (error) {
          console.error('Error handling disconnect:', error);
        }
      });
    });
  }

  // Method to send push notification (to be called from outside)
  public async sendPushNotification(userId: number, notification: {
    title: string;
    body: string;
    data?: any;
  }) {
    try {
      const tokens = await GroupMessageModel.getUserTokens(userId);
      
      // TODO: Integrate with actual push notification service (FCM, APNs)
      console.log(`Would send push notification to user ${userId}:`, notification);
      console.log(`Tokens:`, tokens);
      
      // For now, just log. In production, integrate with:
      // - Firebase Cloud Messaging for Android/iOS
      // - Apple Push Notification service for iOS
      // - Web Push for browsers
    } catch (error) {
      console.error('Error sending push notification:', error);
    }
  }

  public getIO(): SocketIOServer {
    return this.io;
  }
}

