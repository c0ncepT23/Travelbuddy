import OpenAI from 'openai';
import { config } from '../config/env';
import { SavedItemModel } from '../models/savedItem.model';
import { TripGroupModel } from '../models/tripGroup.model';
import { TripSegmentModel } from '../models/tripSegment.model';
import { UserModel } from '../models/user.model';
import { GroupMessageModel } from '../models/groupMessage.model';
import { SavedItem, ItemCategory, CompanionContext } from '../types';
import { ContentProcessorService } from './contentProcessor.service';
import { GeocodingService } from './geocoding.service';
import { ItineraryService } from './itinerary.service';
import { DayPlanningService } from './dayPlanning.service';
import { extractUrls } from '../utils/helpers';
import logger from '../config/logger';

const openai = new OpenAI({
  apiKey: config.openai.apiKey,
});

interface UserContext {
  location?: {
    lat: number;
    lng: number;
    area?: string;
  };
  time: Date;
  userId: string;
  tripGroupId: string;
  userName: string;
  tripName: string;
  destination: string;
}

interface CompanionResponse {
  message: string;
  places?: Array<{
    id: string;
    name: string;
    category: string;
    description: string;
    location_name?: string;
    distance?: number;
  }>;
  suggestions?: string[];
  planId?: string; // Day planner ID for clickable link
  metadata?: {
    type: string;
    url?: string;
    destination?: string;
    duration_days?: number;
    itinerary?: Array<{
      day: number;
      title: string;
      places: string[];
    }>;
    places?: any[];
  };
}

interface MorningBriefing {
  greeting: string;
  segment: {
    city: string;
    dayNumber: number;
    totalDays: number;
    daysRemaining: number;
    hotel?: {
      name: string;
      address: string;
    };
  } | null;
  topPicks: Array<{
    id: string;
    name: string;
    category: string;
    rating?: number;
    location_name?: string;
    description: string;
  }>;
  nearbyHotel: Array<{
    id: string;
    name: string;
    category: string;
    distance: number;
    location_name?: string;
  }>;
  stats: {
    total: number;
    visited: number;
    remaining: number;
    byCategory: Record<string, number>;
  };
  suggestions: string[];
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
}

export class AICompanionService {
  /**
   * Process a user query and return intelligent response
   */
  static async processQuery(
    userId: string,
    tripGroupId: string,
    query: string,
    userLocation?: { lat: number; lng: number }
  ): Promise<CompanionResponse> {
    try {
      // Check if query contains a URL for content processing
      const urls = extractUrls(query);
      if (urls.length > 0) {
        return await this.processContentUrl(userId, tripGroupId, urls[0]);
      }

      // Check if this is a guide video import choice
      const guideImportChoice = this.detectGuideImportChoice(query);
      if (guideImportChoice) {
        return await this.handleGuideVideoImport(userId, tripGroupId, guideImportChoice);
      }

      // Check if user wants to finish itinerary collection
      if (ItineraryService.isFinishIntent(query)) {
        const summary = await ItineraryService.generateItinerarySummary(tripGroupId);
        return {
          message: summary,
          suggestions: ['Show my places', 'What should I do today?'],
        };
      }

      // Check if this is an itinerary-related query (adding segments)
      if (ItineraryService.isItineraryIntent(query)) {
        const result = await ItineraryService.generateItineraryResponse(
          tripGroupId,
          userId,
          query
        );
        
        return {
          message: result.message,
          suggestions: result.action === 'created_segment' 
            ? ['Add another city', "That's all", 'Show my itinerary']
            : undefined,
        };
      }

      // Check if user is specifying activities for a day (e.g., "Day 2 morning Siam, evening Chinatown")
      if (DayPlanningService.isDayActivityIntent(query)) {
        const parsed = await DayPlanningService.parseUserPlanRequest(query);
        
        if (parsed.anchors.length > 0) {
          // User has specific activities - build plan around them
          const result = await DayPlanningService.generatePlanWithAnchors(
            tripGroupId,
            userId,
            parsed.anchors
          );
          
          return {
            message: result.message,
            suggestions: ['View Day Planner', 'Change something', 'Add more activities'],
            planId: result.plan.id, // Include plan ID for clickable link
          };
        }
      }

      // Check if this is a generic "plan my day" request
      if (DayPlanningService.isPlanIntent(query)) {
        const result = await DayPlanningService.generateDayPlan(
          tripGroupId,
          userId
        );
        
        return {
          message: result.message,
          suggestions: ['View Day Planner', 'Change something', 'Show on map'],
          planId: result.plan.id,
        };
      }

      // Check if this is a plan modification request (swap, remove, add)
      if (DayPlanningService.isPlanModificationIntent(query)) {
        const result = await DayPlanningService.handlePlanModification(
          tripGroupId,
          userId,
          query
        );
        
        return {
          message: result.message,
          suggestions: result.success 
            ? ['Lock plan', 'Show updated plan', 'More changes']
            : undefined,
        };
      }

      // Get user context
      const context = await this.getUserContext(userId, tripGroupId, userLocation);
      
      // Get all saved places for this trip
      const savedPlaces = await SavedItemModel.findByTrip(tripGroupId);
      
      // Analyze query intent
      const intent = await this.analyzeQueryIntent(query, context);
      
      // Filter relevant places based on intent and context
      const relevantPlaces = await this.filterRelevantPlaces(
        savedPlaces,
        intent,
        context
      );
      
      // Generate natural language response
      const response = await this.generateResponse(
        query,
        context,
        relevantPlaces,
        intent
      );
      
      return response;
    } catch (error) {
      logger.error('AI Companion query processing error:', error);
      return {
        message: "Sorry, I had trouble understanding that. Could you ask in a different way? 😊",
      };
    }
  }

  /**
   * Process a content URL (YouTube, Reddit, Instagram, etc.)
   * Uses the appropriate extraction method based on content type
   */
  private static async processContentUrl(
    userId: string,
    tripGroupId: string,
    url: string
  ): Promise<CompanionResponse> {
    try {
      logger.info(`[Companion] Processing content URL: ${url}`);
      
      // Get trip destination for geocoding context
      const trip = await TripGroupModel.findById(tripGroupId);
      const tripDestination = trip?.destination || '';
      logger.info(`[Companion] Trip destination for context: ${tripDestination}`);
      
      // Determine content type
      const contentType = ContentProcessorService.detectContentType(url);
      const typeEmojis: Record<string, string> = {
        youtube: '▶️',
        instagram: '📷',
        reddit: '🤖',
        url: '🔗',
      };
      const emoji = typeEmojis[contentType] || '🔗';
      
      let placesToSave: Array<any> = [];
      let summary = '';
      
      // Use appropriate extraction method based on content type
      if (contentType === 'youtube') {
        // Extract MULTIPLE places from YouTube video
        const analysis = await ContentProcessorService.extractMultiplePlacesFromVideo(url);
        placesToSave = analysis.places;
        summary = analysis.summary;
        logger.info(`[Companion] Extracted ${placesToSave.length} places from YouTube video`);
        
        // Handle GUIDE/ITINERARY videos differently - show preview with options
        if (analysis.video_type === 'guide' && analysis.itinerary && analysis.itinerary.length > 0) {
          logger.info(`[Companion] Guide video detected: ${analysis.duration_days} days in ${analysis.destination}`);
          
          // Build itinerary preview
          let message = `📅 I found a **${analysis.duration_days}-day ${analysis.destination || ''} itinerary guide**!\n\n`;
          message += `📝 ${analysis.summary}\n\n`;
          message += `**Here's the day-by-day plan:**\n\n`;
          
          for (const day of analysis.itinerary) {
            message += `**Day ${day.day}**: ${day.title}\n`;
            message += day.places.map(p => `  • ${p}`).join('\n');
            message += '\n\n';
          }
          
          message += `I found **${placesToSave.length} places** mentioned in this guide.\n\n`;
          message += `**How would you like me to save this?**`;
          
          return {
            message,
            suggestions: [
              '📅 Import as Day Plans',
              '📍 Just save places',
              '✨ Both'
            ],
            // Include guide metadata for follow-up handling
            metadata: {
              type: 'guide_video_preview',
              url,
              destination: analysis.destination,
              duration_days: analysis.duration_days,
              itinerary: analysis.itinerary,
              places: placesToSave,
            },
          };
        }
      } else if (contentType === 'reddit') {
        // Extract MULTIPLE places from Reddit post
        const analysis = await ContentProcessorService.extractMultiplePlacesFromReddit(url);
        placesToSave = analysis.places;
        summary = analysis.summary;
        logger.info(`[Companion] Extracted ${placesToSave.length} places from Reddit post`);
      } else if (contentType === 'instagram') {
        // Extract MULTIPLE places from Instagram post/reel
        const analysis = await ContentProcessorService.extractMultiplePlacesFromInstagram(url);
        placesToSave = analysis.places;
        summary = analysis.summary;
        logger.info(`[Companion] Extracted ${placesToSave.length} places from Instagram post`);
      } else {
        // Single place extraction (generic URLs)
        const processed = await ContentProcessorService.processUrl(url);
        placesToSave = [{
          ...processed,
          source_title: processed.source_title || 'Link',
        }];
        logger.info(`[Companion] Extracted 1 place from ${contentType}`);
      }
      
      // Geocode all places to get lat/lng coordinates
      // Use trip destination as context to avoid geocoding to wrong city (e.g., "Financial District" -> NYC vs Hyderabad)
      logger.info(`[Companion] Geocoding ${placesToSave.length} places with context: ${tripDestination}`);
      const geocodedPlaces = await GeocodingService.geocodePlaces(
        placesToSave.map(p => ({
          name: p.name,
          location: p.location || p.location_name,
        })),
        tripDestination // Pass trip destination as geocoding context
      );

      // Merge geocoded coordinates with place data and confidence scores
      const placesWithCoords = placesToSave.map((place, index) => ({
        ...place,
        location_lat: geocodedPlaces[index].lat,
        location_lng: geocodedPlaces[index].lng,
        location_name: geocodedPlaces[index].formatted_address || place.location || place.location_name,
        location_confidence: geocodedPlaces[index].confidence || 'low',
        location_confidence_score: geocodedPlaces[index].confidence_score || 0,
      }));

      // Save all extracted places with coordinates
      const savedItems: SavedItem[] = [];
      for (const place of placesWithCoords) {
        try {
          const savedItem = await SavedItemModel.create(
            tripGroupId,
            userId,
            place.name,
            place.category,
            place.description,
            contentType as any, // ItemSourceType
            place.location_name,
            place.location_lat,
            place.location_lng,
            url,
            place.source_title || 'Unknown Source',
            place.originalContent,
            place.location_confidence,
            place.location_confidence_score
          );
          savedItems.push(savedItem);
          logger.info(`[Companion] Saved: ${savedItem.name} at (${place.location_lat}, ${place.location_lng})`);
        } catch (error) {
          logger.error(`[Companion] Error saving item: ${place.name}`, error);
        }
      }
      
      // Generate conversational response based on number of items
      const categoryEmojis: Record<string, string> = {
        food: '🍽️',
        shopping: '🛍️',
        place: '📍',
        activity: '🎯',
        accommodation: '🏨',
        tip: '💡',
      };
      
      if (savedItems.length === 0) {
        return {
          message: `${emoji} Hmm, I processed that ${contentType === 'youtube' ? 'video' : 'link'} but didn't find any specific places to save. The content might be too general or not travel-related. Want to try another link? 🔍`,
        };
      }
      
      if (savedItems.length === 1) {
        // Single item response
        const item = savedItems[0];
        const categoryEmoji = categoryEmojis[item.category] || '📌';
        const message = `${emoji} Got it! I processed that ${contentType === 'youtube' ? 'video' : 'link'}!\n\n${categoryEmoji} Added: **${item.name}**\n${item.location_name ? `📍 ${item.location_name}\n` : ''}Category: ${item.category}\n\n${item.description.substring(0, 150)}...\n\nAll set! Ask me about it anytime! 🎉`;
        
        return {
          message,
          places: [{
            id: item.id,
            name: item.name,
            category: item.category,
            description: item.description || '',
            location_name: item.location_name,
          }],
          suggestions: ['Show all saved places', 'What else can I help with?'],
        };
      }
      
      // Multiple items response
      const categoryGroups: Record<string, number> = {};
      savedItems.forEach((item) => {
        categoryGroups[item.category] = (categoryGroups[item.category] || 0) + 1;
      });
      
      const categoryParts = Object.entries(categoryGroups)
        .map(([cat, count]) => {
          return `${categoryEmojis[cat] || '📌'} ${count} ${cat} spot${count > 1 ? 's' : ''}`;
        })
        .join(', ');
      
      let message = `${emoji} Got it! I processed that ${contentType === 'youtube' ? 'video' : 'post'} and found ${savedItems.length} amazing place${savedItems.length > 1 ? 's' : ''}!\n\n`;
      
      if (summary) {
        message += `📝 ${summary}\n\n`;
      }
      
      message += `Added: ${categoryParts}\n\n`;
      message += savedItems.slice(0, 5).map((item, i) => 
        `${i + 1}. ${item.name}${item.location_name ? ` - ${item.location_name}` : ''}`
      ).join('\n');
      
      if (savedItems.length > 5) {
        message += `\n...and ${savedItems.length - 5} more!`;
      }
      
      message += '\n\nAll set! Ask me about them anytime! 🎉';
      
      return {
        message,
        places: savedItems.slice(0, 5).map((item) => ({
          id: item.id,
          name: item.name,
          category: item.category,
          description: item.description || '',
          location_name: item.location_name,
        })),
        suggestions: ['Show all saved places', 'What else can I help with?'],
      };
    } catch (error: any) {
      logger.error('Content URL processing error:', error);
      return {
        message: `Oops! I had trouble processing that link. ${error.message || 'Please check if the URL is valid and try again.'} 😅`,
      };
    }
  }

  /**
   * Detect if user's message is a guide video import choice
   */
  private static detectGuideImportChoice(query: string): 'day_plans' | 'places' | 'both' | null {
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('import as day') || lowerQuery.includes('day plan')) {
      return 'day_plans';
    }
    if (lowerQuery.includes('just save') || lowerQuery.includes('save places') || lowerQuery.includes('only places')) {
      return 'places';
    }
    if (lowerQuery.includes('both') || lowerQuery.includes('✨')) {
      return 'both';
    }
    
    return null;
  }

  /**
   * Handle guide video import based on user's choice
   */
  private static async handleGuideVideoImport(
    userId: string,
    tripGroupId: string,
    choice: 'day_plans' | 'places' | 'both'
  ): Promise<CompanionResponse> {
    try {
      // Find the most recent guide video preview message
      const guideMessage = await GroupMessageModel.getLastMessageWithMetadataType(
        tripGroupId,
        'guide_video_preview'
      );
      
      if (!guideMessage || !guideMessage.metadata) {
        return {
          message: "I couldn't find a recent guide video to import. Try sharing a video link again! 📺",
        };
      }
      
      const metadata = guideMessage.metadata;
      const places = metadata.places || [];
      const itinerary = metadata.itinerary || [];
      const destination = metadata.destination || '';
      
      // Get trip for geocoding context
      const trip = await TripGroupModel.findById(tripGroupId);
      const tripDestination = trip?.destination || destination;
      
      let savedCount = 0;
      let dayPlanCount = 0;
      
      // Save places if user chose 'places' or 'both'
      if (choice === 'places' || choice === 'both') {
        // Log places data for debugging
        logger.info(`[Companion] Guide import - ${places.length} places to save`);
        logger.info(`[Companion] Sample place: ${JSON.stringify(places[0])}`);
        
        // Geocode places
        const geocodedPlaces = await GeocodingService.geocodePlaces(
          places.map((p: any) => ({
            name: p.name,
            location: p.location_name || tripDestination,
          })),
          tripDestination
        );
        
        // Save each place and assign to day if day_plans is also selected
        const shouldAssignDays = choice === 'both' || choice === 'day_plans';
        logger.info(`[Companion] Should assign days: ${shouldAssignDays}`);
        
        for (let i = 0; i < places.length; i++) {
          const place = places[i];
          const geocoded = geocodedPlaces[i];
          
          try {
            const savedItem = await SavedItemModel.create(
              tripGroupId,
              userId,
              place.name,
              place.category,
              place.description || '',
              'youtube' as any,
              geocoded.formatted_address || place.location_name || tripDestination,
              geocoded.lat ?? undefined,
              geocoded.lng ?? undefined,
              metadata.url,
              `Day ${place.day || '?'} - Guide`,
              { video_type: 'guide', day: place.day },
              geocoded.confidence || 'medium',
              geocoded.confidence_score || 0.5
            );
            savedCount++;
            
            // Assign to day if importing day plans
            logger.info(`[Companion] Place "${place.name}" day=${place.day}, shouldAssign=${shouldAssignDays}`);
            if (shouldAssignDays && place.day && savedItem) {
              const assigned = await SavedItemModel.assignToDay(savedItem.id, place.day);
              logger.info(`[Companion] Assigned "${place.name}" to Day ${place.day}, result: ${assigned ? 'success' : 'failed'}`);
            } else if (shouldAssignDays && !place.day) {
              logger.warn(`[Companion] Place "${place.name}" has no day number!`);
            }
          } catch (error) {
            logger.error(`[Companion] Error saving guide place: ${place.name}`, error);
          }
        }
        
        dayPlanCount = itinerary.length; // Count days from itinerary
      }
      
      // Note: We no longer create separate DailyPlan records
      // The Day Planner UI reads from saved_items.planned_day
      
      // Generate response based on choice
      let message = '';
      
      if (choice === 'places') {
        message = `✅ Done! I saved **${savedCount} places** from the guide to your list.\n\n`;
        message += `You can browse them in your saved places. Each place is tagged with the day it was recommended for! 📍`;
      } else if (choice === 'day_plans') {
        message = `📅 Done! I created **${dayPlanCount} day plans** from the guide!\n\n`;
        message += `Check your Day Planner to see the suggested itinerary. You can customize it however you like! ✨`;
      } else {
        message = `✨ Done! I imported the complete guide:\n\n`;
        message += `• 📍 **${savedCount} places** saved to your list\n`;
        message += `• 📅 **${dayPlanCount} day plans** created\n\n`;
        message += `The places are saved for reference, and the Day Planner has your itinerary ready to customize!`;
      }
      
      return {
        message,
        suggestions: choice === 'places' 
          ? ['Show my places', 'What should I do today?']
          : ['View Day Planner', 'Show my places'],
      };
      
    } catch (error: any) {
      logger.error('Guide video import error:', error);
      return {
        message: `Oops! Something went wrong while importing the guide. ${error.message} 😅`,
      };
    }
  }

  /**
   * Get user context (location, time, trip info)
   */
  private static async getUserContext(
    userId: string,
    tripGroupId: string,
    userLocation?: { lat: number; lng: number }
  ): Promise<UserContext> {
    const user = await UserModel.findById(userId);
    const trip = await TripGroupModel.findById(tripGroupId);
    
    if (!user || !trip) {
      throw new Error('User or trip not found');
    }
    
    return {
      location: userLocation,
      time: new Date(),
      userId,
      tripGroupId,
      userName: user.name,
      tripName: trip.name,
      destination: trip.destination,
    };
  }

  /**
   * Analyze user query to understand intent
   */
  private static async analyzeQueryIntent(
    query: string,
    context: UserContext
  ): Promise<{
    type: 'location_based' | 'category' | 'specific' | 'surprise' | 'general';
    category?: ItemCategory;
    keywords: string[];
    distance?: 'nearby' | 'walking' | 'any';
    time?: 'now' | 'later' | 'any';
  }> {
    try {
      const prompt = `Analyze this user query about their saved travel places:

User query: "${query}"
Current time: ${context.time.toLocaleTimeString()}
User location: ${context.location ? 'Known' : 'Unknown'}

Determine:
1. Query type: location_based (near me), category (food/shopping/places), specific (named place), surprise (something random), general (other)
2. Category if mentioned: food, shopping, place, activity, accommodation, tip
3. Keywords to match
4. Distance preference: nearby (<500m), walking (<2km), any
5. Time preference: now (immediate), later (planning), any

Respond with JSON:
{
  "type": "location_based|category|specific|surprise|general",
  "category": "food|shopping|place|activity|accommodation|tip|null",
  "keywords": ["keyword1", "keyword2"],
  "distance": "nearby|walking|any",
  "time": "now|later|any"
}`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      });

      const result = JSON.parse(response.choices[0]?.message?.content || '{}');
      
      return {
        type: result.type || 'general',
        category: result.category === 'null' ? undefined : result.category,
        keywords: result.keywords || [],
        distance: result.distance || 'any',
        time: result.time || 'any',
      };
    } catch (error) {
      logger.error('Intent analysis error:', error);
      return {
        type: 'general',
        keywords: [],
        distance: 'any',
        time: 'any',
      };
    }
  }

  /**
   * Filter places based on intent and context
   */
  private static async filterRelevantPlaces(
    allPlaces: SavedItem[],
    intent: any,
    context: UserContext
  ): Promise<Array<SavedItem & { distance?: number }>> {
    let filtered: Array<SavedItem & { distance?: number }> = [...allPlaces];

    // Filter by category if specified
    if (intent.category) {
      filtered = filtered.filter((p) => p.category === intent.category);
    }

    // Filter by keywords
    if (intent.keywords.length > 0) {
      filtered = filtered.filter((place) => {
        const searchText = `${place.name} ${place.description} ${place.location_name}`.toLowerCase();
        return intent.keywords.some((keyword: string) =>
          searchText.includes(keyword.toLowerCase())
        );
      });
    }

    // Filter by location if user has location and wants nearby
    if (context.location && intent.distance !== 'any') {
      const maxDistance = intent.distance === 'nearby' ? 500 : 2000; // meters
      
      const withDistance = filtered
        .filter((place) => place.location_lat && place.location_lng)
        .map((place) => ({
          ...place,
          distance: this.calculateDistance(
            context.location!.lat,
            context.location!.lng,
            place.location_lat!,
            place.location_lng!
          ),
        }))
        .filter((place) => place.distance! <= maxDistance);
      
      // Sort by distance
      withDistance.sort((a, b) => (a.distance || 0) - (b.distance || 0));
      filtered = withDistance;
    }

    // Limit results to top 5
    return filtered.slice(0, 5);
  }

  /**
   * Generate natural language response
   */
  private static async generateResponse(
    query: string,
    context: UserContext,
    places: Array<SavedItem & { distance?: number }>,
    _intent: any
  ): Promise<CompanionResponse> {
    try {
      const placesContext = places.map((p, i) => `
${i + 1}. ${p.name} - ${p.category}
   Location: ${p.location_name || 'Unknown'}
   ${p.distance ? `Distance: ${p.distance < 1000 ? `${Math.round(p.distance)}m` : `${(p.distance / 1000).toFixed(1)}km`}` : ''}
   Description: ${p.description?.substring(0, 100)}
   Source: ${p.source_title || 'Your saved places'}
      `).join('\n');

      const prompt = `You are an excited travel companion helping ${context.userName} with their trip to ${context.destination}.

User query: "${query}"
Current time: ${context.time.toLocaleTimeString()}
User location: ${context.location ? 'Known' : 'Unknown'}

Relevant places from their saved items (${places.length} found):
${placesContext || 'None found matching the query'}

Generate an enthusiastic, helpful response:
- If places found: Suggest 2-3 best options with brief details
- If near them: Mention distance and directions
- If multiple good options: Present them conversationally
- If none found: Suggest they might want to save more or adjust their search
- Use emojis appropriately but not excessively
- Keep it conversational and friendly
- Reference which video/article the place came from when relevant

Respond with JSON:
{
  "message": "Your conversational response here",
  "suggestions": ["Optional action buttons like 'Show on map', 'Get directions'"]
}`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.8,
        response_format: { type: 'json_object' },
      });

      const result = JSON.parse(response.choices[0]?.message?.content || '{}');

      return {
        message: result.message || "I found some interesting places for you! 🎯",
        places: places.map((p) => ({
          id: p.id,
          name: p.name,
          category: p.category,
          description: p.description || '',
          location_name: p.location_name,
          distance: p.distance,
        })),
        suggestions: result.suggestions || [],
      };
    } catch (error) {
      logger.error('Response generation error:', error);
      
      // Fallback response
      if (places.length === 0) {
        return {
          message: "Hmm, I couldn't find anything matching that in your saved places. Want to save some more content? 🔍",
        };
      }

      return {
        message: `Found ${places.length} place(s) that might interest you! Check them out below 👇`,
        places: places.map((p) => ({
          id: p.id,
          name: p.name,
          category: p.category,
          description: p.description || '',
          location_name: p.location_name,
          distance: p.distance,
        })),
      };
    }
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
   */
  private static calculateDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number {
    const R = 6371e3; // Earth radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lng2 - lng1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }

  /**
   * Generate proactive suggestions based on context
   */
  static async generateProactiveSuggestion(
    _userId: string,
    tripGroupId: string,
    userLocation: { lat: number; lng: number }
  ): Promise<CompanionResponse | null> {
    try {
      const savedPlaces = await SavedItemModel.findByTrip(tripGroupId);
      
      // Find places within 500m
      const nearbyPlaces = savedPlaces
        .filter((place) => {
          if (!place.location_lat || !place.location_lng) return false;
          
          const distance = this.calculateDistance(
            userLocation.lat,
            userLocation.lng,
            place.location_lat,
            place.location_lng
          );
          
          return distance <= 500;
        })
        .map((place) => ({
          ...place,
          distance: this.calculateDistance(
            userLocation.lat,
            userLocation.lng,
            place.location_lat!,
            place.location_lng!
          ),
        }))
        .sort((a, b) => (a.distance || 0) - (b.distance || 0));
      
      if (nearbyPlaces.length === 0) {
        return null;
      }
      
      const nearest = nearbyPlaces[0];
      const distanceStr = nearest.distance! < 100 
        ? 'right here' 
        : `${Math.round(nearest.distance!)}m away`;
      
      const categoryEmojis: Record<string, string> = {
        food: '🍽️',
        shopping: '🛍️',
        place: '📍',
        activity: '🎯',
        accommodation: '🏨',
        tip: '💡',
      };
      
      const emoji = categoryEmojis[nearest.category] || '📍';
      
      return {
        message: `Hey! You're ${distanceStr} from ${nearest.name}! ${emoji}\n\nThat's the ${nearest.category} spot from ${nearest.source_title || 'your saved places'}. Want to check it out?`,
        places: [{
          id: nearest.id,
          name: nearest.name,
          category: nearest.category,
          description: nearest.description || '',
          location_name: nearest.location_name,
          distance: nearest.distance,
        }],
        suggestions: ['Get Directions', 'Tell me more', 'Mark as Visited'],
      };
    } catch (error) {
      logger.error('Proactive suggestion error:', error);
      return null;
    }
  }

  /**
   * Determine time of day from current hour
   */
  private static getTimeOfDay(hour: number): 'morning' | 'afternoon' | 'evening' | 'night' {
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 21) return 'evening';
    return 'night';
  }

  /**
   * Build full CompanionContext for intelligent suggestions
   */
  static async buildCompanionContext(
    userId: string,
    tripGroupId: string,
    userLocation?: { lat: number; lng: number }
  ): Promise<CompanionContext> {
    const now = new Date();
    const hour = now.getHours();
    const timeOfDay = this.getTimeOfDay(hour);
    const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' });
    const currentTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    // Get user and trip info
    const user = await UserModel.findById(userId);
    const trip = await TripGroupModel.findById(tripGroupId);
    const members = await TripGroupModel.getMembers(tripGroupId);

    if (!user || !trip) {
      throw new Error('User or trip not found');
    }

    // Get current segment info
    const currentSegmentInfo = await TripSegmentModel.getCurrentSegment(tripGroupId);
    const nextSegment = await TripSegmentModel.getNextSegment(tripGroupId);

    // Get saved places stats
    const stats = await SavedItemModel.getStatistics(tripGroupId);

    // Build segment context
    let currentSegment: CompanionContext['currentSegment'];
    let cityStats = { total: 0, visited: 0, unvisited: 0, byCategory: {} as Record<string, number> };
    let nearbyNow: SavedItem[] = [];
    let topRated: SavedItem[] = [];
    let mustVisit: SavedItem[] = [];

    if (currentSegmentInfo.segment) {
      const seg = currentSegmentInfo.segment;
      
      currentSegment = {
        id: seg.id,
        city: seg.city,
        startDate: seg.start_date,
        endDate: seg.end_date,
        dayNumber: currentSegmentInfo.dayNumber,
        totalDays: currentSegmentInfo.totalDays,
        daysRemaining: currentSegmentInfo.daysRemaining,
        hotel: seg.accommodation_name && seg.accommodation_lat && seg.accommodation_lng ? {
          name: seg.accommodation_name,
          lat: seg.accommodation_lat,
          lng: seg.accommodation_lng,
          address: seg.accommodation_address || '',
        } : undefined,
      };

      // Get city-specific stats
      cityStats = await SavedItemModel.getCityStatistics(tripGroupId, seg.city, seg.id);

      // Get top-rated places in current city
      topRated = await SavedItemModel.getTopRated(tripGroupId, {
        city: seg.city,
        segmentId: seg.id,
        excludeVisited: true,
        limit: 5,
      });

      // Get must-visit places in current city
      mustVisit = await SavedItemModel.getMustVisit(tripGroupId, {
        city: seg.city,
        excludeVisited: true,
        limit: 5,
      });

      // Get places near hotel
      if (seg.accommodation_lat && seg.accommodation_lng) {
        const nearbyItems = await SavedItemModel.findNearLocation(tripGroupId, seg.accommodation_lat, seg.accommodation_lng, {
          radiusMeters: 2000,
          excludeVisited: true,
          limit: 10,
        });
        nearbyNow = nearbyItems;
      }
    }

    // If user location provided, get nearby places
    if (userLocation) {
      nearbyNow = await SavedItemModel.findNearby(tripGroupId, userLocation.lat, userLocation.lng, 1000);
    }

    // Build next segment info
    let nextSegmentInfo: CompanionContext['nextSegment'];
    if (nextSegment) {
      const daysUntil = Math.ceil(
        (new Date(nextSegment.start_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      nextSegmentInfo = {
        city: nextSegment.city,
        startDate: nextSegment.start_date,
        daysUntil,
      };
    }

    return {
      currentDate: now,
      currentTime,
      timeOfDay,
      dayOfWeek,
      userLocation,
      hasItinerary: !!currentSegmentInfo.segment,
      currentSegment,
      nextSegment: nextSegmentInfo,
      savedPlaces: {
        total: parseInt(stats.total_items) || 0,
        inCurrentCity: cityStats.total,
        unvisitedInCity: cityStats.unvisited,
        visitedInCity: cityStats.visited,
        nearbyNow,
        topRated,
        mustVisit,
        byCategory: {
          food: parseInt(stats.food_count) || 0,
          place: parseInt(stats.place_count) || 0,
          shopping: parseInt(stats.shopping_count) || 0,
          activity: parseInt(stats.activity_count) || 0,
          accommodation: parseInt(stats.accommodation_count) || 0,
          tip: parseInt(stats.tip_count) || 0,
        },
      },
      tripId: tripGroupId,
      tripName: trip.name,
      destination: trip.destination,
      tripStartDate: trip.start_date,
      tripEndDate: trip.end_date,
      groupMembers: members.map((m: any) => ({ id: m.id, name: m.name })),
      userId,
      userName: user.name,
    };
  }

  /**
   * Generate morning briefing for the user
   */
  static async getMorningBriefing(
    userId: string,
    tripGroupId: string,
    userLocation?: { lat: number; lng: number }
  ): Promise<MorningBriefing> {
    try {
      // Build full context
      const context = await this.buildCompanionContext(userId, tripGroupId, userLocation);

      // Determine appropriate greeting based on time of day
      const greetingByTime: Record<string, string> = {
        morning: '🌅 Good morning',
        afternoon: '☀️ Good afternoon',
        evening: '🌆 Good evening',
        night: '🌙 Hello',
      };

      let greeting = `${greetingByTime[context.timeOfDay]}!`;
      
      if (context.currentSegment) {
        const { city, dayNumber, totalDays, daysRemaining } = context.currentSegment;
        greeting += ` Day ${dayNumber} of ${totalDays} in ${city}!`;
        
        if (daysRemaining === 0) {
          greeting += ` 🎯 Last day in ${city}!`;
        } else if (daysRemaining === 1) {
          greeting += ' Just one more day here.';
        }
      } else if (context.nextSegment) {
        const { city, daysUntil } = context.nextSegment;
        if (daysUntil === 0) {
          greeting += ` You're heading to ${city} today! 🚀`;
        } else if (daysUntil === 1) {
          greeting += ` ${city} tomorrow! 🎉`;
        } else {
          greeting += ` ${daysUntil} days until ${city}!`;
        }
      } else {
        greeting += ' Ready to explore?';
      }

      // Build segment info for response
      let segmentInfo: MorningBriefing['segment'] = null;
      if (context.currentSegment) {
        segmentInfo = {
          city: context.currentSegment.city,
          dayNumber: context.currentSegment.dayNumber,
          totalDays: context.currentSegment.totalDays,
          daysRemaining: context.currentSegment.daysRemaining,
          hotel: context.currentSegment.hotel ? {
            name: context.currentSegment.hotel.name,
            address: context.currentSegment.hotel.address,
          } : undefined,
        };
      }

      // Get top picks (highest rated unvisited)
      const topPicks = context.savedPlaces.topRated.slice(0, 5).map((place) => ({
        id: place.id,
        name: place.name,
        category: place.category,
        rating: place.rating,
        location_name: place.location_name,
        description: place.description || '',
      }));

      // Get places near hotel
      let nearbyHotel: MorningBriefing['nearbyHotel'] = [];
      if (context.currentSegment?.hotel) {
        const { lat, lng } = context.currentSegment.hotel;
        const nearbyItems = await SavedItemModel.findNearLocation(tripGroupId, lat, lng, {
          radiusMeters: 1500,
          excludeVisited: true,
          limit: 5,
        });
        nearbyHotel = nearbyItems.map((item) => ({
          id: item.id,
          name: item.name,
          category: item.category,
          distance: Math.round(item.distance),
          location_name: item.location_name,
        }));
      }

      // Build stats
      const stats = {
        total: context.savedPlaces.inCurrentCity || context.savedPlaces.total,
        visited: context.savedPlaces.visitedInCity,
        remaining: context.savedPlaces.unvisitedInCity,
        byCategory: context.savedPlaces.byCategory,
      };

      // Build time-appropriate suggestions
      const suggestions = this.getTimeSuggestions(context.timeOfDay, context.savedPlaces.byCategory);

      // Generate AI-enhanced greeting if we have enough context
      let enhancedGreeting = greeting;
      if (topPicks.length > 0 || nearbyHotel.length > 0) {
        try {
          enhancedGreeting = await this.generateAIBriefingMessage(context, topPicks, nearbyHotel);
        } catch (err) {
          logger.warn('Failed to generate AI briefing message, using default:', err);
        }
      }

      return {
        greeting: enhancedGreeting,
        segment: segmentInfo,
        topPicks,
        nearbyHotel,
        stats,
        suggestions,
        timeOfDay: context.timeOfDay,
      };
    } catch (error) {
      logger.error('Error generating morning briefing:', error);
      throw error;
    }
  }

  /**
   * Generate time-appropriate suggestions
   */
  private static getTimeSuggestions(
    timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night',
    byCategory: Record<string, number>
  ): string[] {
    const suggestions: string[] = [];

    switch (timeOfDay) {
      case 'morning':
        if (byCategory.food > 0) suggestions.push('Find breakfast spots 🥐');
        suggestions.push('Plan your day 📋');
        if (byCategory.place > 0) suggestions.push('Visit morning attractions 🏛️');
        break;
      case 'afternoon':
        if (byCategory.shopping > 0) suggestions.push('Go shopping 🛍️');
        if (byCategory.activity > 0) suggestions.push('Do an activity 🎯');
        if (byCategory.food > 0) suggestions.push('Find lunch spots 🍱');
        break;
      case 'evening':
        if (byCategory.food > 0) suggestions.push('Find dinner spots 🍽️');
        suggestions.push('Evening stroll 🌆');
        if (byCategory.place > 0) suggestions.push('Night views 🌃');
        break;
      case 'night':
        suggestions.push('Plan tomorrow 📅');
        if (byCategory.food > 0) suggestions.push('Late night eats 🍜');
        suggestions.push('Review saved places 📍');
        break;
    }

    return suggestions.slice(0, 4);
  }

  /**
   * Generate AI-enhanced briefing message
   */
  private static async generateAIBriefingMessage(
    context: CompanionContext,
    topPicks: Array<{ name: string; category: string; rating?: number }>,
    nearbyHotel: Array<{ name: string; category: string; distance: number }>
  ): Promise<string> {
    const prompt = `You are an enthusiastic travel companion AI. Generate a brief, friendly morning briefing message (2-3 sentences max).

Context:
- User: ${context.userName}
- Time: ${context.timeOfDay}
${context.currentSegment ? `- Location: Day ${context.currentSegment.dayNumber} of ${context.currentSegment.totalDays} in ${context.currentSegment.city}` : ''}
${context.currentSegment?.daysRemaining === 0 ? '- This is their LAST DAY in this city!' : ''}
- Unvisited places in city: ${context.savedPlaces.unvisitedInCity}
- Top picks: ${topPicks.slice(0, 3).map(p => p.name).join(', ')}
${nearbyHotel.length > 0 ? `- Near hotel: ${nearbyHotel.slice(0, 2).map(p => `${p.name} (${p.distance}m)`).join(', ')}` : ''}

Guidelines:
- Be enthusiastic but concise
- Use 1-2 relevant emojis
- Mention a specific place if highly rated
- If last day, create urgency
- If morning, suggest breakfast; if afternoon, activities; if evening, dinner
- Keep it under 150 characters`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
      max_tokens: 100,
    });

    return response.choices[0]?.message?.content || 'Ready to explore? Check out your top picks! 🗺️';
  }
}

