import { ChatMessageModel } from '../models/chatMessage.model';
import { TripGroupModel } from '../models/tripGroup.model';
import { SavedItemModel } from '../models/savedItem.model';
import { UserModel } from '../models/user.model';
import { TravelAgent } from '../agents/travelAgent';
import { ContentProcessorService } from '../services/contentProcessor.service';
import { MessageIntentService } from './messageIntent.service';
import {
  ChatMessage,
  MessageSenderType,
  MessageType,
  AgentContext,
  ItemSourceType,
} from '../types';
// extractUrls imported but used by ContentProcessorService
// import { extractUrls } from '../utils/helpers';
import logger from '../config/logger';

export class ChatService {
  /**
   * Send a message in a trip chat
   * Uses smart intent detection to decide if AI should respond
   */
  static async sendMessage(
    userId: string,
    tripGroupId: string,
    content: string,
    messageType: MessageType = MessageType.TEXT,
    metadata?: any
  ): Promise<{ userMessage: ChatMessage; agentResponse?: ChatMessage }> {
    try {
      // Verify user is member
      const isMember = await TripGroupModel.isMember(tripGroupId, userId);
      if (!isMember) {
        throw new Error('Access denied');
      }

      // Get user info for context
      const user = await UserModel.findById(userId);
      const senderName = user?.name || 'User';

      // Save user message with sender name in metadata
      const userMessage = await ChatMessageModel.create(
        tripGroupId,
        userId,
        MessageSenderType.USER,
        messageType,
        content,
        { ...metadata, sender_name: senderName }
      );

      // === SMART INTENT CLASSIFICATION ===
      logger.info(`📥 Received message from ${senderName}: "${content}"`);
      
      const intentResult = await MessageIntentService.classifyIntent(content, senderName);
      logger.info(`🧠 Intent: ${intentResult.intent} (${intentResult.confidence}) - ${intentResult.reason}`);

      // Handle based on intent
      switch (intentResult.intent) {
        case 'PROCESS_LINK': {
          // Extract and process URL
          const urls = MessageIntentService.extractUrls(content);
          if (urls.length > 0) {
            const url = urls[0];
            logger.info(`✅ Processing URL: ${url}`);
            
            // Detect source type for better UI
            const sourceType = ContentProcessorService.detectContentType(url);
            const sourceLabel = sourceType === 'youtube' ? '🎬 YouTube video' :
                               sourceType === 'instagram' ? '📷 Instagram post' :
                               sourceType === 'reddit' ? '💬 Reddit post' : '🔗 Link';
            
            // Send processing message with metadata for UI
            const processingMessage = await this.sendAgentMessage(
              tripGroupId,
              `Analyzing ${sourceLabel}...`,
              MessageType.SYSTEM,
              {
                type: 'processing',
                source_url: url,
                source_type: sourceType,
                status: 'processing',
                started_at: new Date().toISOString(),
              }
            );
            
            // Start async processing
            this.processUrlMessage(userId, tripGroupId, url, processingMessage.id);
            
            return { userMessage, agentResponse: processingMessage };
          }
          break;
        }

        case 'AI_QUERY': {
          // User is asking AI something - generate response
          logger.info(`🤖 AI responding to query from ${senderName}`);
          const agentResponse = await this.generateAgentResponse(userId, tripGroupId, content);
          return { userMessage, agentResponse };
        }

        case 'MEMBER_CHAT':
        default: {
          // Members chatting with each other - AI stays silent
          logger.info(`💬 Member chat detected - AI staying silent`);
          return { userMessage, agentResponse: undefined };
        }
      }

      return { userMessage };
    } catch (error: any) {
      logger.error('Send message error:', error);
      throw error;
    }
  }

  /**
   * Generate agent response
   */
  private static async generateAgentResponse(
    userId: string,
    tripGroupId: string,
    userMessage: string
  ): Promise<ChatMessage> {
    try {
      // Get agent context
      const context = await this.getAgentContext(userId, tripGroupId);

      // Get conversation history
      const history = await ChatMessageModel.getRecentHistory(tripGroupId, 10);

      // Generate response using AI
      const response = await TravelAgent.chat(context, userMessage, history);

      // Save agent message
      return await this.sendAgentMessage(tripGroupId, response);
    } catch (error) {
      logger.error('Agent response generation error:', error);
      return await this.sendAgentMessage(
        tripGroupId,
        "Oops! I had trouble responding. Can you try again? 😅"
      );
    }
  }

  /**
   * Process URL message (async) - Now with Gemini for YouTube!
   */
  private static async processUrlMessage(
    userId: string,
    tripGroupId: string,
    url: string,
    _processingMessageId?: string
  ): Promise<void> {
    try {
      logger.info(`🔍 Processing URL: ${url}`);
      const sourceType = ContentProcessorService.detectContentType(url);
      logger.info(`📝 Detected source type: ${sourceType}`);

      // Special handling for YouTube videos using Gemini
      if (sourceType === ItemSourceType.YOUTUBE) {
        logger.info(`🎬 Starting YouTube video extraction for: ${url}`);
        const analysis = await ContentProcessorService.extractMultiplePlacesFromVideo(url);
        const seenPlaceKeys = new Set<string>();
        const uniquePlaces = analysis.places.filter((place) => {
          const key = ChatService.getPlaceDedupKey(place.name, place.location_name);
          if (seenPlaceKeys.has(key)) {
            return false;
          }
          seenPlaceKeys.add(key);
          return true;
        });
        logger.info(`YouTube extraction complete. Video type: ${analysis.video_type}, Places: ${uniquePlaces.length}`);
        
        // Check if this is a how-to video
        if (analysis.video_type === 'howto') {
          // How-to video - save as guide/reference (keep auto-save for how-to)
          await this.sendAgentMessage(
            tripGroupId,
            `📚 This looks like a how-to guide!\n\n${analysis.summary}\n\nI've saved it under "How-To Videos" for reference. These won't show up in your places list, but you can watch them anytime! 🎓`
          );

          // Save the single how-to item
          const howtoItem = analysis.places[0];
          await SavedItemModel.create(
            tripGroupId,
            userId,
            howtoItem.name,
            howtoItem.category,
            howtoItem.description,
            ItemSourceType.YOUTUBE,
            howtoItem.location_name,
            undefined,
            undefined,
            url,
            howtoItem.source_title,
            howtoItem.originalContent,
            undefined,
            undefined,
            howtoItem.google_place_id,
            howtoItem.rating,
            howtoItem.user_ratings_total,
            howtoItem.price_level,
            howtoItem.formatted_address,
            howtoItem.area_name,
            howtoItem.photos_json,
            howtoItem.opening_hours_json
          );

          logger.info(`How-to video saved: ${howtoItem.name}`);
          return;
        }

        // Check if any places were found
        if (uniquePlaces.length === 0) {
          await this.sendAgentMessage(
            tripGroupId,
            `🎬 I watched the video but couldn't identify specific places to add.\n\n📝 **Summary:** ${analysis.summary}\n\n💡 *Tip: If you know places from the video, just tell me like "Add Senso-ji Temple in Tokyo"*`,
            MessageType.TEXT,
            {
              type: 'extraction_result',
              status: 'empty',
              source_url: url,
              source_type: 'youtube',
              summary: analysis.summary,
              reason: 'no_places_found',
            }
          );
          return;
        }

        // Regular places video - NEW: Send pending_import message
        const videoTitle = uniquePlaces[0]?.source_title || 'YouTube Video';
        
        await this.sendAgentMessage(
          tripGroupId,
          `📺 ${analysis.summary}\n\nFound ${uniquePlaces.length} place(s)! Tap below to review and import them →`,
          MessageType.TEXT,
          {
            type: 'pending_import',
            source_url: url,
            source_type: 'youtube',
            video_title: videoTitle,
            summary: analysis.summary,
            places: uniquePlaces,
            user_id: userId
          }
        );

        logger.info(`YouTube video processed: ${uniquePlaces.length} places ready for import`);
        return;
      }

      // Special handling for Reddit posts using Gemini
      if (sourceType === ItemSourceType.REDDIT) {
        const analysis = await ContentProcessorService.extractMultiplePlacesFromReddit(url);
        
        if (analysis.places.length === 0) {
          // No places found - send helpful message with metadata
          await this.sendAgentMessage(
            tripGroupId,
            `💬 I read through the discussion but couldn't find specific place names to add.\n\n📝 **Summary:** ${analysis.summary}\n\n💡 *Tip: If you know specific places mentioned, you can tell me directly like "Add Ichiran Ramen in Tokyo"*`,
            MessageType.TEXT,
            {
              type: 'extraction_result',
              status: 'empty',
              source_url: url,
              source_type: 'reddit',
              summary: analysis.summary,
              reason: 'no_places_found',
            }
          );
          return;
        }

        // NEW: Send pending_import message
        const postTitle = analysis.places[0]?.source_title || 'Reddit Post';
        
        await this.sendAgentMessage(
          tripGroupId,
          `💬 ${analysis.summary}\n\nFound ${analysis.places.length} place(s)! Tap below to review and import them →`,
          MessageType.TEXT,
          {
            type: 'pending_import',
            source_url: url,
            source_type: 'reddit',
            video_title: postTitle,
            summary: analysis.summary,
            places: analysis.places,
            user_id: userId
          }
        );

        logger.info(`Reddit post processed: ${analysis.places.length} places ready for import`);
        return;
      }

      // Special handling for Instagram posts
      if (sourceType === ItemSourceType.INSTAGRAM) {
        const analysis = await ContentProcessorService.extractMultiplePlacesFromInstagram(url);
        
        if (analysis.places.length === 0) {
          // No places found - send helpful message with metadata
          await this.sendAgentMessage(
            tripGroupId,
            `📷 I watched the reel but couldn't identify specific place names.\n\n📝 **What I saw:** ${analysis.summary}\n\n💡 *Tip: If you know the place name, just tell me like "Add Cafe Lalo in NYC" and I'll find it!*`,
            MessageType.TEXT,
            {
              type: 'extraction_result',
              status: 'empty',
              source_url: url,
              source_type: 'instagram',
              summary: analysis.summary,
              reason: 'no_places_found',
            }
          );
          return;
        }

        // NEW: Send pending_import message
        const postTitle = analysis.places[0]?.source_title || 'Instagram Post';
        
        await this.sendAgentMessage(
          tripGroupId,
          `📷 ${analysis.summary}\n\nFound ${analysis.places.length} place(s)! Tap below to review and import them →`,
          MessageType.TEXT,
          {
            type: 'pending_import',
            source_url: url,
            source_type: 'instagram',
            video_title: postTitle,
            summary: analysis.summary,
            places: analysis.places,
            user_id: userId
          }
        );

        logger.info(`Instagram post processed: ${analysis.places.length} places ready for import`);
        return;
      }

      // Non-YouTube/Reddit/Instagram processing (web, etc.)
      const processed = await ContentProcessorService.processUrl(url);

      // Check for duplicates
      const duplicates = await SavedItemModel.findDuplicates(
        tripGroupId,
        processed.name,
        processed.location_name
      );

      if (duplicates.length > 0) {
        const duplicateCheck = await TravelAgent.checkDuplicates(
          processed.name,
          duplicates.map((d) => ({ name: d.name, id: d.id }))
        );

        if (duplicateCheck.isDuplicate) {
          const agentMessage = duplicateCheck.message || 'This looks like a duplicate!';
          await this.sendAgentMessage(tripGroupId, agentMessage);
          return;
        }
      }

      // Create saved item
      const savedItem = await SavedItemModel.create(
        tripGroupId,
        userId,
        processed.name,
        processed.category,
        processed.description,
        sourceType,
        processed.location_name,
        processed.location_lat,
        processed.location_lng,
        url,
        processed.source_title,
        processed.originalContent,
        undefined,
        undefined,
        processed.google_place_id,
        processed.rating,
        processed.user_ratings_total,
        processed.price_level,
        processed.formatted_address,
        processed.area_name,
        processed.photos_json,
        processed.opening_hours_json
      );

      // Generate confirmation message
      const agentMessage = await TravelAgent.generateConfirmation(
        savedItem.name,
        savedItem.category,
        savedItem.description
      );

      await this.sendAgentMessage(tripGroupId, agentMessage);

      logger.info(`Content processed and saved: ${savedItem.id}`);
    } catch (error: any) {
      logger.error('❌ URL processing error:', error);
      logger.error('Error details:', { message: error.message, stack: error.stack });
      
      // Determine error type for better messaging
      const isNetworkError = error.message?.includes('fetch') || error.message?.includes('network');
      const isPrivateContent = error.message?.includes('private') || error.message?.includes('unavailable');
      const isRateLimited = error.message?.includes('rate') || error.message?.includes('limit');
      
      let errorMessage = '';
      let errorReason = 'unknown';
      
      if (isPrivateContent) {
        errorMessage = `🔒 This content seems to be private or unavailable.\n\n💡 *Try sharing a public link, or tell me the place name directly!*`;
        errorReason = 'private_content';
      } else if (isRateLimited) {
        errorMessage = `⏳ I'm processing too many links right now. Please try again in a minute!\n\n💡 *In the meantime, you can tell me about places directly.*`;
        errorReason = 'rate_limited';
      } else if (isNetworkError) {
        errorMessage = `📡 Had trouble reaching that link. Could be a temporary issue.\n\n💡 *Try again, or share the place name directly like "Add Shake Shack in NYC"*`;
        errorReason = 'network_error';
      } else {
        errorMessage = `🤔 I couldn't extract places from that link.\n\n💡 *No worries! Just tell me the place name like "Add Blue Bottle Coffee in Tokyo" and I'll find it for you!*`;
        errorReason = 'extraction_failed';
      }
      
      await this.sendAgentMessage(
        tripGroupId,
        errorMessage,
        MessageType.TEXT,
        {
          type: 'extraction_result',
          status: 'error',
          source_url: url,
          reason: errorReason,
          error_message: error.message,
        }
      );
    }
  }

  private static getPlaceDedupKey(name?: string, locationName?: string): string {
    const normalize = (value?: string) =>
      value ? value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() : '';
    const normalizedName = normalize(name);
    const normalizedLocation = normalize(locationName);
    return `${normalizedName}__${normalizedLocation}`;
  }

  /**
   * Send agent message
   */
  private static async sendAgentMessage(
    tripGroupId: string,
    content: string,
    messageType: MessageType = MessageType.TEXT,
    metadata?: any
  ): Promise<ChatMessage> {
    return await ChatMessageModel.create(
      tripGroupId,
      null,
      MessageSenderType.AGENT,
      messageType,
      content,
      metadata
    );
  }

  /**
   * Get chat messages
   */
  static async getMessages(
    userId: string,
    tripGroupId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<ChatMessage[]> {
    try {
      // Verify user is member
      const isMember = await TripGroupModel.isMember(tripGroupId, userId);
      if (!isMember) {
        throw new Error('Access denied');
      }

      return await ChatMessageModel.findByTrip(tripGroupId, limit, offset);
    } catch (error: any) {
      logger.error('Get messages error:', error);
      throw error;
    }
  }

  /**
   * Process image upload
   */
  static async processImageUpload(
    userId: string,
    tripGroupId: string,
    imageBuffer: Buffer,
    imageUrl: string
  ): Promise<ChatMessage> {
    try {
      // Verify user is member
      const isMember = await TripGroupModel.isMember(tripGroupId, userId);
      if (!isMember) {
        throw new Error('Access denied');
      }

      // Save user message with image
      const userMessage = await ChatMessageModel.create(
        tripGroupId,
        userId,
        MessageSenderType.USER,
        MessageType.PHOTO,
        'Shared an image',
        { imageUrl }
      );

      // Send processing message
      await this.sendAgentMessage(tripGroupId, 'Analyzing your image... 📸');

      // Process image
      const processed = await ContentProcessorService.processImage(imageBuffer);

      // Create saved item
      const savedItem = await SavedItemModel.create(
        tripGroupId,
        userId,
        processed.name,
        processed.category,
        processed.description,
        ItemSourceType.PHOTO,
        processed.location_name,
        processed.location_lat,
        processed.location_lng,
        imageUrl,
        processed.source_title,
        processed.originalContent,
        undefined,
        undefined,
        processed.google_place_id,
        processed.rating,
        processed.user_ratings_total,
        processed.price_level,
        processed.formatted_address,
        processed.area_name,
        processed.photos_json,
        processed.opening_hours_json
      );

      // Generate confirmation
      const confirmation = await TravelAgent.generateConfirmation(
        savedItem.name,
        savedItem.category,
        savedItem.description
      );

      await this.sendAgentMessage(tripGroupId, confirmation);

      return userMessage;
    } catch (error: any) {
      logger.error('Image processing error:', error);
      await this.sendAgentMessage(
        tripGroupId,
        "I couldn't read that image clearly. Can you describe what it shows? 😊"
      );
      throw error;
    }
  }

  /**
   * Get agent context for trip
   */
  private static async getAgentContext(
    userId: string,
    tripGroupId: string
  ): Promise<AgentContext> {
    const trip = await TripGroupModel.findById(tripGroupId);
    const user = await UserModel.findById(userId);

    if (!trip || !user) {
      throw new Error('Trip or user not found');
    }

    return {
      tripGroupId,
      userId,
      userName: user.name,
      tripName: trip.name,
      destination: trip.destination,
      startDate: trip.start_date,
      endDate: trip.end_date,
    };
  }
}












