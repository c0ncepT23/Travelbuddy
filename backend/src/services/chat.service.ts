import { ChatMessageModel } from '../models/chatMessage.model';
import { TripGroupModel } from '../models/tripGroup.model';
import { SavedItemModel } from '../models/savedItem.model';
import { UserModel } from '../models/user.model';
import { TravelAgent } from '../agents/travelAgent';
import { ContentProcessorService } from '../services/contentProcessor.service';
import {
  ChatMessage,
  MessageSenderType,
  MessageType,
  AgentContext,
  ItemSourceType,
} from '../types';
import { extractUrls } from '../utils/helpers';
import logger from '../config/logger';

export class ChatService {
  /**
   * Send a message in a trip chat
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

      // Save user message
      const userMessage = await ChatMessageModel.create(
        tripGroupId,
        userId,
        MessageSenderType.USER,
        messageType,
        content,
        metadata
      );

      // Check if message contains a URL for processing
      const urls = extractUrls(content);
      if (urls.length > 0) {
        // Process first URL asynchronously
        this.processUrlMessage(userId, tripGroupId, urls[0]);
        
        // Send immediate response
        const processingMessage = await this.sendAgentMessage(
          tripGroupId,
          'Processing your link... 🔄',
          MessageType.SYSTEM
        );

        return { userMessage, agentResponse: processingMessage };
      }

      // Generate agent response
      const agentResponse = await this.generateAgentResponse(userId, tripGroupId, content);

      return { userMessage, agentResponse };
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
    url: string
  ): Promise<void> {
    try {
      logger.info(`🔍 Processing URL: ${url}`);
      const sourceType = ContentProcessorService.detectContentType(url);
      logger.info(`📝 Detected source type: ${sourceType}`);

      // Special handling for YouTube videos using Gemini
      if (sourceType === ItemSourceType.YOUTUBE) {
        logger.info(`🎬 Starting YouTube video extraction for: ${url}`);
        const analysis = await ContentProcessorService.extractMultiplePlacesFromVideo(url);
        logger.info(`✅ YouTube extraction complete. Video type: ${analysis.video_type}, Places: ${analysis.places.length}`);
        
        // Check if this is a how-to video
        if (analysis.video_type === 'howto') {
          // How-to video - save as guide/reference
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
            howtoItem.originalContent
          );

          logger.info(`How-to video saved: ${howtoItem.name}`);
          return;
        }

        // Regular places video - original flow
        // Send summary first
        await this.sendAgentMessage(
          tripGroupId,
          `📺 ${analysis.summary}\n\nFound ${analysis.places.length} place(s)! Adding them now...`
        );

        // Save each place
        let savedCount = 0;
        for (const place of analysis.places) {
          // Check for duplicates
          const duplicates = await SavedItemModel.findDuplicates(
            tripGroupId,
            place.name,
            place.location_name
          );

          if (duplicates.length > 0) {
            const duplicateCheck = await TravelAgent.checkDuplicates(
              place.name,
              duplicates.map((d) => ({ name: d.name, id: d.id }))
            );

            if (duplicateCheck.isDuplicate) {
              continue; // Skip duplicates
            }
          }

          // Save the item
          await SavedItemModel.create(
            tripGroupId,
            userId,
            place.name,
            place.category,
            place.description,
            ItemSourceType.YOUTUBE,
            place.location_name,
            undefined,
            undefined,
            url,
            place.source_title,
            place.originalContent
          );

          savedCount++;
        }

        // Send final confirmation
        const confirmation =
          savedCount > 0
            ? `✨ Added ${savedCount} place(s) to your trip! Check them out in your saved items!`
            : `I watched the video but couldn't find specific places to add. Saved it as a reference! 📝`;

        await this.sendAgentMessage(tripGroupId, confirmation);
        logger.info(`YouTube video processed: ${savedCount} places saved`);
        return;
      }

      // Special handling for Reddit posts using Gemini
      if (sourceType === ItemSourceType.REDDIT) {
        const analysis = await ContentProcessorService.extractMultiplePlacesFromReddit(url);
        
        // Send summary first
        await this.sendAgentMessage(
          tripGroupId,
          `💬 ${analysis.summary}\n\nFound ${analysis.places.length} place(s)! Adding them now...`
        );

        // Save each place
        let savedCount = 0;
        for (const place of analysis.places) {
          // Check for duplicates
          const duplicates = await SavedItemModel.findDuplicates(
            tripGroupId,
            place.name,
            place.location_name
          );

          if (duplicates.length > 0) {
            const duplicateCheck = await TravelAgent.checkDuplicates(
              place.name,
              duplicates.map((d) => ({ name: d.name, id: d.id }))
            );

            if (duplicateCheck.isDuplicate) {
              continue; // Skip duplicates
            }
          }

          // Save the item
          await SavedItemModel.create(
            tripGroupId,
            userId,
            place.name,
            place.category,
            place.description,
            ItemSourceType.REDDIT,
            place.location_name,
            undefined,
            undefined,
            url,
            place.source_title,
            place.originalContent
          );

          savedCount++;
        }

        // Send final confirmation
        const confirmation =
          savedCount > 0
            ? `✨ Added ${savedCount} place(s) to your trip! Check them out in your saved items!`
            : `I read the discussion but couldn't find specific places to add. Saved it as a reference! 📝`;

        await this.sendAgentMessage(tripGroupId, confirmation);
        logger.info(`Reddit post processed: ${savedCount} places saved`);
        return;
      }

      // Non-YouTube/Reddit processing (Instagram, web, etc.)
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
        processed.originalContent
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
      await this.sendAgentMessage(
        tripGroupId,
        `Hmm, I had trouble processing that link. Could you share more details about it? 🤔`
      );
    }
  }

  /**
   * Send agent message
   */
  private static async sendAgentMessage(
    tripGroupId: string,
    content: string,
    messageType: MessageType = MessageType.TEXT
  ): Promise<ChatMessage> {
    return await ChatMessageModel.create(
      tripGroupId,
      null,
      MessageSenderType.AGENT,
      messageType,
      content
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
        processed.originalContent
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

