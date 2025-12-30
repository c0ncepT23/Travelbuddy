import { SavedItemModel } from '../models/savedItem.model';
import { TripGroupModel } from '../models/tripGroup.model';
import { TripSegmentModel } from '../models/tripSegment.model';
import { UserModel } from '../models/user.model';
import { SavedItem, ItemCategory, CompanionContext } from '../types';
import { ContentProcessorService } from './contentProcessor.service';
import { GeocodingService } from './geocoding.service';
import { GeminiService } from './gemini.service';
import { extractUrls } from '../utils/helpers';
import logger from '../config/logger';

// NOTE: Migrated from OpenAI to Gemini 2.5 Flash (100x cheaper, faster)
// SIMPLIFIED: Removed guide/day planning features - just extract and save places

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
    summary?: string;
    guideMetadata?: {
      title?: string;
      creatorName?: string;
      creatorChannelId?: string;
      thumbnailUrl?: string;
      hasDayStructure?: boolean;
      totalDays?: number;
    };
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

      // Get user context
      const context = await this.getUserContext(userId, tripGroupId, userLocation);
      
      // Get all saved places for this trip
      const savedPlaces = await SavedItemModel.findByTrip(tripGroupId);
      
      // Analyze query intent
      const intent = await this.analyzeQueryIntent(query, context);
      
      // Handle "alternatives" intent specially
      if (intent.type === 'alternatives' && intent.referencedPlace) {
        logger.info(`[Companion] Alternatives request for: ${intent.referencedPlace}, reason: ${intent.reason}`);
        return await this.findAlternatives(
          savedPlaces,
          intent.referencedPlace,
          intent.reason,
          context
        );
      }
      
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
      let creatorName: string | undefined;
      
      // Use appropriate extraction method based on content type
      // SIMPLIFIED: All videos (including guides) just extract places - no day structure
      if (contentType === 'youtube') {
        const analysis = await ContentProcessorService.extractMultiplePlacesFromVideo(url);
        placesToSave = analysis.places;
        summary = analysis.summary;
        creatorName = analysis.guideMetadata?.creatorName;
        logger.info(`[Companion] Extracted ${placesToSave.length} places from YouTube video${creatorName ? ` by ${creatorName}` : ''}`);
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

      // Save all extracted places with coordinates + sub-categorization
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
            place.location_confidence_score,
            // Google Places enrichment (passed from content processor)
            place.google_place_id,
            place.rating,
            place.user_ratings_total,
            place.price_level,
            place.formatted_address,
            place.area_name,
            place.photos_json,
            place.opening_hours_json,
            // NEW: Sub-categorization fields for smart clustering
            place.tags,
            place.cuisine_type,
            place.place_type,
            place.destination || place.destination_country || tripDestination
          );
          savedItems.push(savedItem);
          logger.info(`[Companion] Saved: ${savedItem.name} (${place.cuisine_type || place.place_type || place.category}) at (${place.location_lat}, ${place.location_lng})`);
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
      
      // Include creator info if available
      const creatorInfo = creatorName ? ` by **${creatorName}**` : '';
      let message = `${emoji} Got it! I processed that ${contentType === 'youtube' ? 'video' : 'post'}${creatorInfo} and found ${savedItems.length} amazing place${savedItems.length > 1 ? 's' : ''}!\n\n`;
      
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
   * NOW USES: Gemini 2.5 Flash (100x cheaper than GPT-4)
   */
  private static async analyzeQueryIntent(
    query: string,
    context: UserContext
  ): Promise<{
    type: 'location_based' | 'category' | 'specific' | 'surprise' | 'general' | 'alternatives';
    category?: ItemCategory;
    keywords: string[];
    distance?: 'nearby' | 'walking' | 'any';
    time?: 'now' | 'later' | 'any';
    referencedPlace?: string; // For alternatives - the place user can't visit
    reason?: string; // Why they can't visit (closed, crowded, etc.)
    // Smart query fields (Schema-enforced from Gemini)
    limit?: number;
    sortBy?: 'rating' | 'distance' | 'recent' | 'review_count' | null;
    sortOrder?: 'desc' | 'asc';
    cuisineType?: string;
    specificDish?: string;
  }> {
    try {
      // Use Gemini 2.5 Flash for intent analysis (fast & cheap)
      const result = await GeminiService.analyzeIntent(query, {
        hasLocation: !!context.location,
        currentTime: context.time.toLocaleTimeString(),
        destination: context.destination,
      });
      
      // Filter out 'planning' type which is handled separately
      const type = result.type === 'planning' ? 'general' : result.type;
      
      return {
        type: type as any,
        category: result.category,
        keywords: result.keywords,
        distance: result.distance,
        time: result.time,
        referencedPlace: result.referencedPlace,
        reason: result.reason,
        // NEW fields
        limit: result.limit,
        sortBy: result.sortBy,
        sortOrder: result.sortOrder,
        cuisineType: result.cuisineType,
        specificDish: result.specificDish,
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
   * SMART FILTERING: Supports count limits, sorting by rating/distance, and cuisine filtering
   */
  private static async filterRelevantPlaces(
    allPlaces: SavedItem[],
    intent: any,
    context: UserContext
  ): Promise<Array<SavedItem & { distance?: number }>> {
    let filtered: Array<SavedItem & { distance?: number }> = [...allPlaces];

    logger.info(`[FilterPlaces] Intent: ${JSON.stringify(intent)}`);
    logger.info(`[FilterPlaces] All places count: ${allPlaces.length}`);
    logger.info(`[FilterPlaces] Place categories: ${allPlaces.map(p => `${p.name}:${p.category}`).join(', ')}`);

    // 1. Filter by category if specified (case-insensitive)
    if (intent.category && intent.category !== 'null' && intent.category !== null) {
      const targetCategory = intent.category.toLowerCase();
      filtered = filtered.filter((p) => p.category?.toLowerCase() === targetCategory);
      logger.info(`[FilterPlaces] After category filter (${targetCategory}): ${filtered.length} places`);
    }

    // 2. Filter by cuisine type if specified (for food places)
    if (intent.cuisineType && filtered.length > 0) {
      const cuisineType = intent.cuisineType.toLowerCase();
      const cuisineFiltered = filtered.filter((place) => {
        const searchText = `${place.name} ${place.description} ${place.cuisine_type || ''} ${place.tags?.join(' ') || ''}`.toLowerCase();
        return searchText.includes(cuisineType);
      });
      // Only apply if it doesn't eliminate all results
      if (cuisineFiltered.length > 0) {
        filtered = cuisineFiltered;
        logger.info(`[FilterPlaces] After cuisine filter (${cuisineType}): ${filtered.length} places`);
      } else {
        logger.info(`[FilterPlaces] Cuisine filter (${cuisineType}) would eliminate all results, skipping`);
      }
    }

    // 3. Filter by keywords (only if we still have results)
    if (intent.keywords && intent.keywords.length > 0 && filtered.length > 0) {
      // Don't re-filter by cuisine keywords we already handled
      const keywordsToUse = intent.keywords.filter((k: string) => 
        k.toLowerCase() !== intent.cuisineType?.toLowerCase()
      );
      
      if (keywordsToUse.length > 0) {
        const keywordFiltered = filtered.filter((place) => {
          const searchText = `${place.name} ${place.description} ${place.location_name}`.toLowerCase();
          return keywordsToUse.some((keyword: string) =>
            searchText.includes(keyword.toLowerCase())
          );
        });
        // Only apply keyword filter if it doesn't eliminate all results
        if (keywordFiltered.length > 0) {
          filtered = keywordFiltered;
        }
        logger.info(`[FilterPlaces] After keyword filter: ${filtered.length} places`);
      }
    }

    // 4. Calculate distances if user has location
    if (context.location) {
      filtered = filtered.map((place) => ({
        ...place,
        distance: place.location_lat && place.location_lng
          ? this.calculateDistance(
              context.location!.lat,
              context.location!.lng,
              place.location_lat,
              place.location_lng
            )
          : undefined,
      }));
    }

    // 5. SMART SORTING based on intent
    const sortBy = intent.sortBy;
    const sortOrder = intent.sortOrder || 'desc';
    
    if (sortBy === 'rating') {
      // Sort by rating (handle null/undefined ratings)
      filtered.sort((a, b) => {
        const ratingA = a.rating ?? 0;
        const ratingB = b.rating ?? 0;
        return sortOrder === 'desc' ? ratingB - ratingA : ratingA - ratingB;
      });
      logger.info(`[FilterPlaces] Sorted by rating (${sortOrder})`);
    } else if (sortBy === 'distance' && context.location) {
      // Sort by distance (closest first for 'asc', farthest first for 'desc')
      filtered.sort((a, b) => {
        const distA = a.distance ?? Infinity;
        const distB = b.distance ?? Infinity;
        return sortOrder === 'asc' ? distA - distB : distB - distA;
      });
      logger.info(`[FilterPlaces] Sorted by distance (${sortOrder})`);
    } else if (sortBy === 'recent') {
      // Sort by created_at
      filtered.sort((a, b) => {
        const dateA = new Date(a.created_at || 0).getTime();
        const dateB = new Date(b.created_at || 0).getTime();
        return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
      });
      logger.info(`[FilterPlaces] Sorted by recent (${sortOrder})`);
    } else if (sortBy === 'review_count') {
      // Sort by popularity (number of reviews) - "most popular", "viral"
      filtered.sort((a, b) => {
        const reviewsA = a.user_ratings_total ?? 0;
        const reviewsB = b.user_ratings_total ?? 0;
        return sortOrder === 'desc' ? reviewsB - reviewsA : reviewsA - reviewsB;
      });
      logger.info(`[FilterPlaces] Sorted by review_count (${sortOrder})`);
    } else if (intent.distance === 'nearby' && context.location) {
      // Legacy: If user wants "nearby", sort by distance ascending
      filtered.sort((a, b) => (a.distance || Infinity) - (b.distance || Infinity));
      logger.info(`[FilterPlaces] Sorted by distance (nearby intent)`);
    }

    // 6. SMART LIMIT: Respect user's requested count
    const limit = intent.limit || 5; // Default to 5 if not specified
    const finalCount = Math.min(limit, filtered.length);
    
    logger.info(`[FilterPlaces] Final result: ${filtered.length} places, limiting to ${finalCount} (requested: ${intent.limit || 'default 5'})`);
    
    return filtered.slice(0, finalCount);
  }

  /**
   * Find alternatives to a place the user can't visit
   * Prioritizes saved items, then supplements with Google Places if needed
   * 
   * Cost optimization:
   * - Only calls Google Places if saved items < 3
   * - Limits Google results to top 3
   * - Skips photos (fetched on-demand)
   * - Results are cached for 1 hour
   */
  private static async findAlternatives(
    savedPlaces: SavedItem[],
    referencedPlaceName: string,
    reason: string | undefined,
    context: UserContext
  ): Promise<CompanionResponse> {
    logger.info(`[Alternatives] Finding alternatives for: ${referencedPlaceName}`);
    
    // 1. Find the referenced place from saved items
    const referencedPlace = savedPlaces.find(p => 
      p.name.toLowerCase().includes(referencedPlaceName.toLowerCase()) ||
      referencedPlaceName.toLowerCase().includes(p.name.toLowerCase())
    );
    
    if (!referencedPlace) {
      logger.info(`[Alternatives] Referenced place not found in saved items`);
      return {
        message: `I couldn't find "${referencedPlaceName}" in your saved places. Could you tell me more about what kind of place you're looking for? 🤔`,
      };
    }
    
    logger.info(`[Alternatives] Found referenced place: ${referencedPlace.name}, category: ${referencedPlace.category}`);
    
    // 2. Find similar places from saved items (same category, excluding the referenced place)
    let alternatives: Array<SavedItem & { distance?: number }> = savedPlaces.filter(p => 
      p.id !== referencedPlace.id &&
      p.category?.toLowerCase() === referencedPlace.category?.toLowerCase()
    );
    
    logger.info(`[Alternatives] Found ${alternatives.length} saved alternatives in same category`);
    
    // 3. If user has location, calculate distances and prioritize nearby
    const searchLat = context.location?.lat || referencedPlace.location_lat;
    const searchLng = context.location?.lng || referencedPlace.location_lng;
    
    if (searchLat && searchLng) {
      alternatives = alternatives
        .filter(p => p.location_lat && p.location_lng)
        .map(p => ({
          ...p,
          distance: this.calculateDistance(
            searchLat,
            searchLng,
            p.location_lat!,
            p.location_lng!
          ),
        }))
        .sort((a, b) => (a.distance || 0) - (b.distance || 0));
    }
    
    // 4. Take top 3 from saved items
    const savedAlternatives = alternatives.slice(0, 3);
    
    // 5. If < 3 saved alternatives, supplement with Google Places
    let googleAlternatives: Array<{
      name: string;
      address: string;
      rating?: number;
      distance?: number;
      isGoogleResult: boolean;
    }> = [];
    
    const needGoogleSupport = savedAlternatives.length < 3 && searchLat && searchLng;
    
    if (needGoogleSupport) {
      logger.info(`[Alternatives] Saved items insufficient (${savedAlternatives.length}), querying Google Places`);
      
      try {
        const { GooglePlacesService } = await import('./googlePlaces.service');
        
        // Map category to Google type
        const googleType = GooglePlacesService.categoryToGoogleType(referencedPlace.category || 'place');
        
        // Extract keyword from place name (e.g., "Ichiran Ramen" → "ramen")
        const keywords = referencedPlace.name.toLowerCase().split(' ').filter(w => 
          !['the', 'a', 'an', 'restaurant', 'cafe', 'shop', 'store'].includes(w) && w.length > 2
        );
        const keyword = keywords.length > 0 ? keywords[keywords.length - 1] : undefined;
        
        const googleResults = await GooglePlacesService.searchNearby({
          lat: searchLat,
          lng: searchLng,
          type: googleType,
          keyword: keyword,
          radius: 1500, // 1.5km
          openNow: true, // Prioritize open places since user needs alternative NOW
          maxResults: 3 - savedAlternatives.length, // Only get what we need
        });
        
        logger.info(`[Alternatives] Google returned ${googleResults.length} places`);
        
        // Filter out places already in saved items
        const savedNames = savedPlaces.map(p => p.name.toLowerCase());
        
        googleAlternatives = googleResults
          .filter(g => !savedNames.some(name => 
            name.includes(g.name.toLowerCase()) || g.name.toLowerCase().includes(name)
          ))
          .map(g => ({
            name: g.name,
            address: g.vicinity,
            rating: g.rating,
            distance: searchLat && searchLng && g.geometry?.location 
              ? this.calculateDistance(searchLat, searchLng, g.geometry.location.lat, g.geometry.location.lng)
              : undefined,
            isGoogleResult: true,
          }));
          
        logger.info(`[Alternatives] After filtering, ${googleAlternatives.length} Google suggestions`);
      } catch (error) {
        logger.error('[Alternatives] Google Places error:', error);
        // Continue without Google results
      }
    }
    
    // 6. Build response
    const reasonText = reason ? ` (${reason})` : '';
    let message = `No worries! Since you can't visit **${referencedPlace.name}**${reasonText}, here are some similar alternatives:\n\n`;
    
    let placeIndex = 1;
    
    // Show saved alternatives first
    if (savedAlternatives.length > 0) {
      message += `**From your saved places:**\n`;
      savedAlternatives.forEach((place) => {
        const distanceText = place.distance 
          ? ` (${place.distance < 1000 ? `${Math.round(place.distance)}m` : `${(place.distance / 1000).toFixed(1)}km`})`
          : '';
        const ratingText = place.rating ? ` ⭐ ${Number(place.rating).toFixed(1)}` : '';
        message += `${placeIndex}. **${place.name}**${distanceText}${ratingText}\n`;
        if (place.description) {
          message += `   ${place.description.substring(0, 80)}${place.description.length > 80 ? '...' : ''}\n`;
        }
        message += '\n';
        placeIndex++;
      });
    }
    
    // Show Google alternatives
    if (googleAlternatives.length > 0) {
      message += `**New discoveries nearby:**\n`;
      googleAlternatives.forEach((place) => {
        const distanceText = place.distance 
          ? ` (${place.distance < 1000 ? `${Math.round(place.distance)}m` : `${(place.distance / 1000).toFixed(1)}km`})`
          : '';
        const ratingText = place.rating ? ` ⭐ ${place.rating.toFixed(1)}` : '';
        const openText = ' 🟢 Open now';
        message += `${placeIndex}. **${place.name}**${distanceText}${ratingText}${openText}\n`;
        message += `   📍 ${place.address}\n`;
        message += `   _Say "add ${place.name}" to save it!_\n\n`;
        placeIndex++;
      });
    }
    
    // No results at all
    if (savedAlternatives.length === 0 && googleAlternatives.length === 0) {
      message = `I couldn't find similar ${referencedPlace.category || 'places'} nearby right now. `;
      message += `Try asking "find ${referencedPlace.category || 'places'} near me" and I'll search for you! 🔍`;
    }
    
    return {
      message,
      places: savedAlternatives.map(p => ({
        id: p.id,
        name: p.name,
        category: p.category || 'place',
        description: p.description || '',
        location_name: p.location_name,
        distance: p.distance,
      })),
    };
  }

  /**
   * Extract creator insights from originalContent (transcript/caption)
   * This is the "secret sauce" - the creator's personal tips!
   */
  private static extractCreatorInsights(originalContent: any): string | undefined {
    if (!originalContent) return undefined;
    
    // Try to get the most relevant creator content
    let insight = '';
    
    // YouTube: transcript has the creator talking about places
    if (originalContent.transcript) {
      // Get first 300 chars of transcript (usually has the most relevant context)
      insight = originalContent.transcript.substring(0, 300);
    }
    // Instagram: caption has the creator's description
    else if (originalContent.caption) {
      insight = originalContent.caption.substring(0, 300);
    }
    // Reddit: body text
    else if (originalContent.body) {
      insight = originalContent.body.substring(0, 300);
    }
    
    // Clean up and return if meaningful
    if (insight && insight.length > 20) {
      return insight.trim() + (insight.length >= 300 ? '...' : '');
    }
    
    return undefined;
  }

  /**
   * Generate natural language response
   * NOW USES: Gemini 2.5 Flash (100x cheaper than GPT-4)
   * ENHANCED: Includes creator insights from originalContent!
   */
  private static async generateResponse(
    query: string,
    context: UserContext,
    places: Array<SavedItem & { distance?: number }>,
    intent: any
  ): Promise<CompanionResponse> {
    try {
      // Use Gemini 2.5 Flash for response generation (fast & cheap)
      // NOW includes creator insights from transcript/caption!
      const message = await GeminiService.generatePlacesResponse(
        query,
        {
          userName: context.userName,
          destination: context.destination,
          currentTime: context.time.toLocaleTimeString(),
          // NEW: Smart query context for better responses
          limit: intent.limit,
          sortBy: intent.sortBy,
          cuisineType: intent.cuisineType,
        },
        places.map(p => ({
          name: p.name,
          category: p.category,
          description: p.description,
          location_name: p.location_name,
          distance: p.distance,
          source_title: p.source_title,
          // NEW: Creator insights from video/post
          tags: p.tags || [],
          cuisine_type: p.cuisine_type,
          place_type: p.place_type,
          rating: p.rating,
          creator_insights: this.extractCreatorInsights(p.original_content),
        }))
      );

      return {
        message,
        places: places.map((p) => ({
          id: p.id,
          name: p.name,
          category: p.category,
          description: p.description || '',
          location_name: p.location_name,
          distance: p.distance,
          // Include data for rich UI cards
          photos_json: p.photos_json,
          rating: p.rating,
          user_ratings_total: p.user_ratings_total,
        })),
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
          // Include data for rich UI cards
          photos_json: p.photos_json,
          rating: p.rating,
          user_ratings_total: p.user_ratings_total,
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
   * NOW USES: Gemini 2.5 Flash (100x cheaper than GPT-4)
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
- Keep it under 150 characters

Generate ONLY the message text, no JSON:`;

    try {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const { config } = await import('../config/env');
      const genAI = new GoogleGenerativeAI(config.gemini.apiKey);
      
      const model = genAI.getGenerativeModel({ 
        model: 'gemini-2.5-flash',
        generationConfig: { temperature: 0.8, maxOutputTokens: 100 }
      });
      
      const result = await model.generateContent(prompt);
      return result.response.text() || 'Ready to explore? Check out your top picks! 🗺️';
    } catch (error) {
      logger.warn('Failed to generate AI briefing, using fallback:', error);
      return 'Ready to explore? Check out your top picks! 🗺️';
    }
  }
}

