import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { GroupMessageModel } from '../models/groupMessage.model';
import { PushNotificationService } from './pushNotification.service';
import { UserModel } from '../models/user.model';
import { TripGroupModel } from '../models/tripGroup.model';
import { AICompanionService } from './aiCompanion.service';
import { extractUrls } from '../utils/helpers';
import jwt from 'jsonwebtoken';
import logger from '../config/logger';

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

        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
          logger.error('[WebSocket] JWT_SECRET not configured');
          return next(new Error('Server configuration error'));
        }
        const decoded: any = jwt.verify(token, jwtSecret);
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
      logger.info(`[WebSocket] User connected: ${socket.userId} (${socket.userEmail})`);

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
          
          logger.info(`[WebSocket] User ${socket.userId} joined trip ${tripId}`);
        } catch (error) {
          logger.error('[WebSocket] Error joining trip:', error);
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
          
          logger.info(`[WebSocket] User ${socket.userId} left trip ${tripId}`);
        } catch (error) {
          logger.error('[WebSocket] Error leaving trip:', error);
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
          
          // Send push notification to offline members
          try {
            const [user, trip] = await Promise.all([
              UserModel.findById(socket.userId.toString()),
              TripGroupModel.findById(tripId),
            ]);
            
            if (user && trip) {
              await PushNotificationService.notifyNewMessage(
                parseInt(tripId),
                socket.userId,
                user.name || socket.userEmail || 'Someone',
                trip.name,
                content
              );
            }
          } catch (pushError) {
            logger.error('[WebSocket] Push notification error:', pushError);
          }
          
          logger.info(`Message sent by ${socket.userId} in trip ${tripId}`);
          
          // 🆕 AUTO-PROCESS URLs: If message contains YouTube/Instagram/Reddit links, process with AI
          const urls = extractUrls(content);
          if (urls.length > 0) {
            logger.info(`[WebSocket] URL detected in message, triggering AI processing: ${urls[0]}`);
            
            // Send "processing" message first
            const processingMessage = await GroupMessageModel.create(
              parseInt(tripId),
              0, // System user ID (or bot ID)
              `🤖 Processing ${urls[0].includes('youtube') ? 'YouTube video' : urls[0].includes('instagram') ? 'Instagram post' : 'link'}... Please wait! ⏳`,
              'ai_response',
              { isProcessing: true }
            );
            this.io.to(room).emit('new_message', {
              ...processingMessage,
              sender_email: 'AI Assistant'
            });
            
            // Process the URL asynchronously
            try {
              const aiResponse = await AICompanionService.processQuery(
                socket.userId.toString(),
                tripId,
                content
              );
              
              // Send AI response with extracted places
              const aiMessage = await GroupMessageModel.create(
                parseInt(tripId),
                0, // System/AI user
                aiResponse.message,
                'ai_response',
                { 
                  places: aiResponse.places,
                  suggestions: aiResponse.suggestions,
                  sourceUrl: urls[0]
                }
              );
              
              this.io.to(room).emit('new_message', {
                ...aiMessage,
                sender_email: 'AI Assistant'
              });
              
              logger.info(`[WebSocket] AI processed URL and found ${aiResponse.places?.length || 0} places`);
            } catch (aiError) {
              logger.error('[WebSocket] AI URL processing error:', aiError);
              
              // Send error message
              const errorMessage = await GroupMessageModel.create(
                parseInt(tripId),
                0,
                `😅 Sorry, I had trouble processing that link. The video might not contain travel locations, or there was a technical issue. Try another link?`,
                'ai_response',
                { error: true }
              );
              this.io.to(room).emit('new_message', {
                ...errorMessage,
                sender_email: 'AI Assistant'
              });
            }
          }
        } catch (error) {
          logger.error('Error sending message:', error);
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
          logger.error('[WebSocket] Error setting typing:', error);
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
          logger.error('[WebSocket] Error removing typing:', error);
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
          logger.error('[WebSocket] Error marking as read:', error);
        }
      });

      // Handle disconnection
      socket.on('disconnect', async () => {
        if (!socket.userId) return;
        
        logger.info(`[WebSocket] User disconnected: ${socket.userId}`);
        
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
          logger.error('[WebSocket] Error handling disconnect:', error);
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
      await PushNotificationService.sendToUser(userId, notification);
    } catch (error) {
      logger.error('Error sending push notification:', error);
    }
  }

  public getIO(): SocketIOServer {
    return this.io;
  }
}

