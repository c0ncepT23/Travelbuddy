import OpenAI from 'openai';
import { config } from '../config/env';
import { SavedItemModel } from '../models/savedItem.model';
import { TripGroupModel } from '../models/tripGroup.model';
import { UserModel } from '../models/user.model';
import { SavedItem, ItemCategory } from '../types';
import { ContentProcessorService } from './contentProcessor.service';
import { GeocodingService } from './geocoding.service';
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
      logger.info(`[Companion] Geocoding ${placesToSave.length} places...`);
      const geocodedPlaces = await GeocodingService.geocodePlaces(
        placesToSave.map(p => ({
          name: p.name,
          location: p.location || p.location_name,
        }))
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
}

