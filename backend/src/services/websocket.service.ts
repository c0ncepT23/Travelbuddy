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
  userId?: string;
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
            tripId,
            true,
            socket.id
          );
          
          // Broadcast to others in the trip
          socket.to(room).emit('user_online', {
            userId: socket.userId,
            email: socket.userEmail
          });
          
          // Send current online users
          const onlineUsers = await GroupMessageModel.getOnlineUsers(tripId);
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
            tripId,
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
        logger.info(`[WebSocket] ===== SEND_MESSAGE EVENT RECEIVED =====`);
        logger.info(`[WebSocket] Data: ${JSON.stringify(data)}`);
        logger.info(`[WebSocket] Socket userId: ${socket.userId}`);
        
        if (!socket.userId) {
          logger.error('[WebSocket] No userId on socket, rejecting message');
          return;
        }
        
        try {
          const { tripId, content, messageType, metadata, replyToMessageId } = data;
          
          // Save message to database
          const message = await GroupMessageModel.create(
            tripId,
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
          await GroupMessageModel.removeTyping(tripId, socket.userId);
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
                tripId,
                socket.userId,
                user.name || socket.userEmail || 'Someone',
                trip.name,
                content
              );
            }
          } catch (pushError) {
            logger.error('[WebSocket] Push notification error:', pushError);
          }
          
          logger.info(`[WebSocket] Message sent by ${socket.userId} in trip ${tripId}: "${content.substring(0, 50)}..."`);
          
          // Check if message is directed at group members (contains @mention)
          const hasMention = /@\w+/.test(content) || content.toLowerCase().includes('@all');
          const urls = extractUrls(content);
          logger.info(`[WebSocket] Extracted URLs: ${JSON.stringify(urls)}, Has @mention: ${hasMention}`);
          
          // Process through AI ONLY if:
          // 1. Not an @mention (those are for group members)
          // 2. Not already an AI response or system message
          if (socket.userId && !hasMention && messageType !== 'ai_response' && messageType !== 'system') {
            const hasUrl = urls.length > 0;
            logger.info(`[WebSocket] ${hasUrl ? 'URL DETECTED' : 'TEXT QUERY'}: Processing message`);
            logger.info(`[WebSocket] User ID: ${socket.userId}, Trip ID: ${tripId}`);
            
            // Send "processing" message for URLs (they take longer)
            if (hasUrl) {
              logger.info(`[WebSocket] Creating processing message for room: ${room}`);
              try {
                const processingMessage = await GroupMessageModel.create(
                  tripId,
                  socket.userId, // Use sender's ID - message_type distinguishes it
                  `🤖 Processing ${urls[0].includes('youtube') ? 'YouTube video' : urls[0].includes('instagram') ? 'Instagram post' : 'link'}... Please wait! ⏳`,
                  'ai_response',
                  { isProcessing: true, isAI: true }
                );
                logger.info(`[WebSocket] Processing message created: ${JSON.stringify(processingMessage)}`);
                
                this.io.to(room).emit('new_message', {
                  ...processingMessage,
                  sender_name: 'AI Assistant',
                  sender_email: 'ai@travelagent.app'
                });
                logger.info(`[WebSocket] Processing message emitted to room ${room}`);
              } catch (procError: any) {
                logger.error(`[WebSocket] Failed to create/emit processing message: ${procError.message}`);
              }
            }
            
            // Process message through AI companion
            logger.info(`[WebSocket] Starting AI processing...`);
            try {
              const aiResponse = await AICompanionService.processQuery(
                socket.userId.toString(),
                tripId,
                content
              );
              logger.info(`[WebSocket] AI processing complete. Response: ${aiResponse.message.substring(0, 100)}...`);
              
              // Send AI response
              const aiMessage = await GroupMessageModel.create(
                tripId,
                socket.userId, // Use sender's ID
                aiResponse.message,
                'ai_response',
                { 
                  places: aiResponse.places,
                  suggestions: aiResponse.suggestions,
                  sourceUrl: hasUrl ? urls[0] : undefined,
                  planId: aiResponse.planId, // Day planner ID if plan was created
                  isAI: true,
                  // Include full metadata for guide video imports, etc.
                  ...aiResponse.metadata
                }
              );
              
              this.io.to(room).emit('new_message', {
                ...aiMessage,
                sender_name: 'TravelPal',
                sender_email: 'ai@travelagent.app'
              });
              
              logger.info(`[WebSocket] AI response sent. Places: ${aiResponse.places?.length || 0}`);
            } catch (aiError: any) {
              logger.error('[WebSocket] AI processing error:', aiError);
              logger.error('[WebSocket] AI Error details:', aiError.message);
              
              // Send error message
              const errorMsg = hasUrl 
                ? `😅 Sorry, I had trouble processing that link. ${aiError.message || 'Try another link?'}`
                : `😅 Sorry, I had trouble with that. ${aiError.message || 'Could you try rephrasing?'}`;
              
              const errorMessage = await GroupMessageModel.create(
                tripId,
                socket.userId,
                errorMsg,
                'ai_response',
                { error: true, isAI: true, errorMessage: aiError.message }
              );
              this.io.to(room).emit('new_message', {
                ...errorMessage,
                sender_name: 'TravelPal',
                sender_email: 'ai@travelagent.app'
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
          await GroupMessageModel.setTyping(tripId, socket.userId);
          
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
          await GroupMessageModel.removeTyping(tripId, socket.userId);
          
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
            await GroupMessageModel.markAllAsRead(tripId, socket.userId);
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
                tripId,
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

