import axios from 'axios';
import { config } from '../config/env';
import logger from '../config/logger';

// Simple in-memory cache for nearby search results (TTL: 1 hour)
const nearbySearchCache = new Map<string, { data: NearbyPlace[]; timestamp: number }>();
// Cache for place enrichment (TTL: 24 hours - place data doesn't change often)
const enrichmentCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour
const ENRICHMENT_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

interface NearbyPlace {
  place_id: string;
  name: string;
  vicinity: string;
  rating?: number;
  user_ratings_total?: number;
  price_level?: number;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  opening_hours?: {
    open_now: boolean;
  };
  types: string[];
}

interface GooglePlaceDetails {
  place_id: string;
  name: string;
  formatted_address: string;
  rating?: number;
  user_ratings_total?: number;
  price_level?: number;
  types?: string[];  // Google's place types for validation
  photos?: Array<{
    photo_reference: string;
    height: number;
    width: number;
    html_attributions: string[];
  }>;
  opening_hours?: {
    open_now: boolean;
    periods?: any[];
    weekday_text?: string[];
  };
  geometry?: {
    location: {
      lat: number;
      lng: number;
    };
  };
  address_components?: Array<{
    long_name: string;
    short_name: string;
    types: string[];
  }>;
}

export class GooglePlacesService {
  private static readonly API_KEY = config.googleMaps.apiKey;
  private static readonly BASE_URL = 'https://maps.googleapis.com/maps/api/place';
  private static readonly GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode';

  /**
   * Geocode a place name + street hint into coordinates
   * MUCH cheaper than Places Search: ~$5 per 1000 requests vs $32+
   * 
   * Used for "Grounding Lite" - turning Gemini's AI-suggested famous restaurants
   * into map coordinates without expensive Places API calls.
   * 
   * Cost: $5 per 1,000 requests (Geocoding)
   */
  static async geocodePlace(
    placeName: string, 
    streetHint: string,
    city: string
  ): Promise<{
    lat: number;
    lng: number;
    formatted_address: string;
    place_id?: string;
  } | null> {
    try {
      if (!this.API_KEY) {
        logger.warn('[GooglePlaces] API Key missing, skipping geocode');
        return null;
      }

      // Construct a search query: "Restaurant Name, Street, City"
      const query = `${placeName}, ${streetHint}, ${city}`;
      
      logger.info(`[Geocode] Looking up: "${query}"`);

      const response = await axios.get(`${this.GEOCODE_URL}/json`, {
        params: {
          address: query,
          key: this.API_KEY,
        },
      });

      if (response.data.status !== 'OK' || !response.data.results?.length) {
        logger.warn(`[Geocode] No results for: "${query}" (status: ${response.data.status})`);
        return null;
      }

      const result = response.data.results[0];
      const location = result.geometry?.location;

      if (!location) {
        logger.warn(`[Geocode] No location in result for: "${query}"`);
        return null;
      }

      logger.info(`[Geocode] Found: ${result.formatted_address} at (${location.lat}, ${location.lng})`);

      return {
        lat: location.lat,
        lng: location.lng,
        formatted_address: result.formatted_address,
        place_id: result.place_id, // May be useful for future enrichment
      };
    } catch (error: any) {
      logger.error(`[Geocode] Error for "${placeName}":`, error.message);
      return null;
    }
  }

  /**
   * Geocode multiple grounded suggestions in parallel
   * Used for "Grounding Lite" to process Gemini's 3 famous restaurant suggestions
   */
  static async geocodeGroundedSuggestions(
    suggestions: Array<{
      name: string;
      street_hint: string;
      why_famous: string;
    }>,
    city: string
  ): Promise<Array<{
    name: string;
    description: string;
    location_lat: number;
    location_lng: number;
    formatted_address: string;
    is_grounded_suggestion: boolean;
  }>> {
    const results = await Promise.all(
      suggestions.map(async (suggestion) => {
        const geocoded = await this.geocodePlace(suggestion.name, suggestion.street_hint, city);
        
        if (!geocoded) {
          logger.warn(`[Grounding] Failed to geocode: "${suggestion.name}"`);
          return null;
        }

        return {
          name: suggestion.name,
          description: suggestion.why_famous,
          location_lat: geocoded.lat,
          location_lng: geocoded.lng,
          formatted_address: geocoded.formatted_address,
          is_grounded_suggestion: true, // Flag to identify as AI-suggested "Ghost Pin"
        };
      })
    );

    // Filter out null results
    const validResults = results.filter((r): r is NonNullable<typeof r> => r !== null);
    logger.info(`[Grounding] Geocoded ${validResults.length}/${suggestions.length} suggestions`);
    
    return validResults;
  }

  /**
   * Search for nearby places by type/keyword
   * Used for finding alternatives when saved items aren't enough
   * 
   * Cost: $32 per 1,000 requests (Nearby Search)
   * Free tier: ~6,250 calls/month with $200 credit
   */
  static async searchNearby(options: {
    lat: number;
    lng: number;
    type?: string;        // e.g., "restaurant", "cafe", "tourist_attraction"
    keyword?: string;     // e.g., "ramen", "sushi"
    radius?: number;      // meters, default 1000
    openNow?: boolean;    // filter to only open places
    maxResults?: number;  // limit results, default 3
  }): Promise<NearbyPlace[]> {
    try {
      if (!this.API_KEY) {
        logger.warn('[GooglePlaces] API Key missing, skipping nearby search');
        return [];
      }

      const { lat, lng, type, keyword, radius = 1000, openNow = false, maxResults = 3 } = options;

      // Check cache first
      const cacheKey = `nearby:${lat.toFixed(3)},${lng.toFixed(3)}:${type || ''}:${keyword || ''}:${radius}:${openNow}`;
      const cached = nearbySearchCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        logger.info(`[GooglePlaces] Cache hit for nearby search: ${cacheKey}`);
        return cached.data.slice(0, maxResults);
      }

      logger.info(`[GooglePlaces] Nearby search: type=${type}, keyword=${keyword}, radius=${radius}m`);

      const params: any = {
        location: `${lat},${lng}`,
        radius: radius,
        key: this.API_KEY,
      };

      if (type) params.type = type;
      if (keyword) params.keyword = keyword;
      if (openNow) params.opennow = true;

      const response = await axios.get(`${this.BASE_URL}/nearbysearch/json`, { params });

      if (response.data.status !== 'OK' && response.data.status !== 'ZERO_RESULTS') {
        logger.warn(`[GooglePlaces] Nearby search status: ${response.data.status}`);
        return [];
      }

      const results: NearbyPlace[] = response.data.results || [];
      logger.info(`[GooglePlaces] Found ${results.length} nearby places`);

      // Cache the results
      nearbySearchCache.set(cacheKey, { data: results, timestamp: Date.now() });

      // Return limited results (skip photos to save costs)
      return results.slice(0, maxResults);
    } catch (error: any) {
      logger.error('[GooglePlaces] Nearby search error:', error.message);
      return [];
    }
  }

  /**
   * Map our category to Google Places type
   */
  static categoryToGoogleType(category: string): string {
    const mapping: Record<string, string> = {
      'food': 'restaurant',
      'restaurant': 'restaurant',
      'cafe': 'cafe',
      'shopping': 'shopping_mall',
      'place': 'tourist_attraction',
      'activity': 'tourist_attraction',
      'accommodation': 'lodging',
      'bar': 'bar',
      'nightlife': 'night_club',
    };
    return mapping[category.toLowerCase()] || 'point_of_interest';
  }

  /**
   * Extract cuisine_type and place_type from Google Places types array
   * This validates/enriches the AI's extraction with Google's structured data
   */
  static extractSubTypesFromGoogleTypes(types: string[]): {
    cuisine_type?: string;
    place_type?: string;
    validated_category?: string;
  } {
    if (!types || types.length === 0) return {};

    const result: { cuisine_type?: string; place_type?: string; validated_category?: string } = {};

    // Google Places cuisine/food type mappings
    const cuisineTypeMap: Record<string, string> = {
      'ramen_restaurant': 'ramen',
      'sushi_restaurant': 'sushi',
      'japanese_restaurant': 'japanese',
      'korean_restaurant': 'korean',
      'chinese_restaurant': 'chinese',
      'thai_restaurant': 'thai',
      'vietnamese_restaurant': 'vietnamese',
      'indian_restaurant': 'indian',
      'italian_restaurant': 'italian',
      'french_restaurant': 'french',
      'mexican_restaurant': 'mexican',
      'american_restaurant': 'american',
      'seafood_restaurant': 'seafood',
      'steak_house': 'steak',
      'barbecue_restaurant': 'bbq',
      'pizza_restaurant': 'pizza',
      'hamburger_restaurant': 'burgers',
      'sandwich_shop': 'sandwiches',
      'bakery': 'bakery',
      'cafe': 'cafe',
      'coffee_shop': 'coffee',
      'tea_house': 'tea',
      'ice_cream_shop': 'ice cream',
      'dessert_shop': 'dessert',
      'bar': 'bar',
      'izakaya': 'izakaya',
      'food_court': 'food court',
      'fast_food_restaurant': 'fast food',
      'vegetarian_restaurant': 'vegetarian',
      'vegan_restaurant': 'vegan',
    };

    // Google Places place type mappings
    const placeTypeMap: Record<string, string> = {
      'hindu_temple': 'temple',
      'buddhist_temple': 'temple',
      'temple': 'temple',
      'shrine': 'shrine',
      'church': 'church',
      'mosque': 'mosque',
      'synagogue': 'synagogue',
      'place_of_worship': 'religious site',
      'castle': 'castle',
      'palace': 'palace',
      'museum': 'museum',
      'art_gallery': 'gallery',
      'park': 'park',
      'national_park': 'national park',
      'garden': 'garden',
      'zoo': 'zoo',
      'aquarium': 'aquarium',
      'amusement_park': 'theme park',
      'tourist_attraction': 'attraction',
      'natural_feature': 'nature',
      'point_of_interest': 'landmark',
      'viewpoint': 'viewpoint',
      'beach': 'beach',
      'spa': 'spa',
      'hot_spring': 'onsen',
      'market': 'market',
      'shopping_mall': 'mall',
      'department_store': 'department store',
      'electronics_store': 'electronics',
      'clothing_store': 'fashion',
      'book_store': 'bookstore',
      'convenience_store': 'convenience store',
      'supermarket': 'supermarket',
      'stadium': 'stadium',
      'movie_theater': 'cinema',
      'night_club': 'nightclub',
      'casino': 'casino',
      'bowling_alley': 'bowling',
      'gym': 'gym',
    };

    // Category validation map
    const categoryMap: Record<string, string> = {
      'restaurant': 'food',
      'food': 'food',
      'cafe': 'food',
      'bakery': 'food',
      'bar': 'food',
      'meal_delivery': 'food',
      'meal_takeaway': 'food',
      'store': 'shopping',
      'shopping_mall': 'shopping',
      'lodging': 'accommodation',
      'hotel': 'accommodation',
      'tourist_attraction': 'place',
      'museum': 'place',
      'park': 'activity',
      'amusement_park': 'activity',
      'spa': 'activity',
    };

    // Check for cuisine type (food places)
    for (const type of types) {
      if (cuisineTypeMap[type]) {
        result.cuisine_type = cuisineTypeMap[type];
        break;
      }
    }

    // Check for place type (non-food places)
    for (const type of types) {
      if (placeTypeMap[type]) {
        result.place_type = placeTypeMap[type];
        break;
      }
    }

    // Validate/suggest category
    for (const type of types) {
      if (categoryMap[type]) {
        result.validated_category = categoryMap[type];
        break;
      }
    }

    logger.info(`[GooglePlaces] Extracted sub-types from ${types.slice(0, 5).join(', ')}: cuisine=${result.cuisine_type}, place=${result.place_type}`);
    return result;
  }

  /**
   * Search for a place by text query to get its Place ID
   */
  static async searchPlace(query: string): Promise<string | null> {
    try {
      if (!this.API_KEY) {
        logger.warn('Google Maps API Key is missing');
        return null;
      }

      const response = await axios.get(`${this.BASE_URL}/findplacefromtext/json`, {
        params: {
          input: query,
          inputtype: 'textquery',
          fields: 'place_id',
          key: this.API_KEY,
        },
      });

      if (response.data.status === 'OK' && response.data.candidates.length > 0) {
        return response.data.candidates[0].place_id;
      }

      // Fallback to Text Search if Find Place fails (sometimes better for vague queries)
      const textSearchResponse = await axios.get(`${this.BASE_URL}/textsearch/json`, {
        params: {
          query: query,
          key: this.API_KEY,
        },
      });

      if (textSearchResponse.data.status === 'OK' && textSearchResponse.data.results.length > 0) {
        return textSearchResponse.data.results[0].place_id;
      }

      return null;
    } catch (error) {
      logger.error('Error searching Google Place:', error);
      return null;
    }
  }

  /**
   * Get rich details for a place
   */
  static async getPlaceDetails(placeId: string): Promise<GooglePlaceDetails | null> {
    try {
      if (!this.API_KEY) return null;

      const response = await axios.get(`${this.BASE_URL}/details/json`, {
        params: {
          place_id: placeId,
          // Removed price_level and opening_hours to save API costs (~$5/1000 requests)
          fields: 'place_id,name,formatted_address,rating,user_ratings_total,photos,geometry,address_components,types',
          key: this.API_KEY,
        },
      });

      if (response.data.status === 'OK') {
        return response.data.result as GooglePlaceDetails;
      }

      return null;
    } catch (error) {
      logger.error('Error fetching Google Place Details:', error);
      return null;
    }
  }

  /**
   * Extract the best area/neighborhood name from address components
   * Priority varies by city structure (Tokyo vs Osaka vs other cities)
   */
  static identifyArea(addressComponents?: any[]): string | null {
    if (!addressComponents) return null;

    const getType = (type: string) => 
      addressComponents.find((c) => c.types.includes(type))?.long_name;

    // In Japan: 
    // ward = locality (e.g., "Shibuya City", "Minato City") OR sublocality_level_1 for some cities
    // district = sublocality_level_1 (e.g., "Jinnan") or political
    // sub-district = sublocality_level_2 (e.g., "1-chome")

    const locality = getType('locality'); // e.g., "Shibuya City" or "Osaka"
    const sublocality1 = getType('sublocality_level_1'); // e.g., "Chuo Ward" in Osaka
    const ward = getType('ward'); // Explicit ward type
    const neighborhood = getType('neighborhood');
    const adminArea2 = getType('administrative_area_level_2'); // County/City in some regions
    const political = addressComponents.find((c) => 
      c.types.includes('political') && c.types.includes('sublocality')
    )?.long_name;

    // For cities like Osaka where locality is just "Osaka", prefer sublocality (ward)
    // Check if locality is a major city name - if so, use sublocality for grouping
    const majorCities = ['Osaka', '大阪市', 'Kyoto', '京都市', 'Nagoya', '名古屋市', 'Sapporo', '札幌市', 'Fukuoka', '福岡市', 'Kobe', '神戸市'];
    const isMajorCity = locality && majorCities.some(city => locality.includes(city));

    if (isMajorCity) {
      // For major cities, prefer ward/sublocality over city name
      if (ward) return ward;
      if (sublocality1) return sublocality1;
      if (political) return political;
    }

    // For Tokyo (locality includes "City" like "Shibuya City"), use locality
    if (locality && locality.includes('City')) return locality;
    
    // General fallback order
    if (locality) return locality;
    if (ward) return ward;
    if (sublocality1) return sublocality1;
    if (neighborhood) return neighborhood;
    if (adminArea2) return adminArea2;

    return null;
  }

  /**
   * Enrich a place query with Google Maps data
   * Now includes sub-type extraction from Google's types for validation
   * Uses caching to avoid redundant API calls (24h TTL)
   */
  static async enrichPlace(name: string, locationHint?: string): Promise<Partial<GooglePlaceDetails> & { 
    area_name?: string;
    google_cuisine_type?: string;
    google_place_type?: string;
    google_validated_category?: string;
    google_tags?: string[];
  } | null> {
    try {
      const query = locationHint ? `${name} ${locationHint}` : name;
      
      // Check cache first
      const cacheKey = `enrich:${query.toLowerCase().trim()}`;
      const cached = enrichmentCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < ENRICHMENT_CACHE_TTL) {
        logger.info(`[GooglePlaces] Cache hit for: "${query}"`);
        return cached.data;
      }
      
      logger.info(`[GooglePlaces] Searching for: "${query}"`);
      
      const placeId = await this.searchPlace(query);
      
      if (!placeId) {
        logger.warn(`[GooglePlaces] No place ID found for "${query}"`);
        return null;
      }

      logger.info(`[GooglePlaces] Found place ID: ${placeId}`);

      const details = await this.getPlaceDetails(placeId);
      if (!details) {
        logger.warn(`[GooglePlaces] No details found for place ID: ${placeId}`);
        return null;
      }

      const areaName = this.identifyArea(details.address_components);
      
      // Extract sub-types from Google's types for validation
      const subTypes = this.extractSubTypesFromGoogleTypes(details.types || []);
      
      // Create tags from Google's types (filter out generic ones)
      const genericTypes = ['point_of_interest', 'establishment', 'premise', 'political'];
      const googleTags = (details.types || [])
        .filter((t: string) => !genericTypes.includes(t))
        .map((t: string) => t.replace(/_/g, ' ')); // "japanese_restaurant" -> "japanese restaurant"
      
      logger.info(`[GooglePlaces] Enrichment success! Rating: ${details.rating}, Area: ${areaName}, Types: ${details.types?.slice(0, 3).join(', ')}, Tags: ${googleTags.slice(0, 3).join(', ')}`);

      const result = {
        ...details,
        area_name: areaName || undefined,
        google_cuisine_type: subTypes.cuisine_type,
        google_place_type: subTypes.place_type,
        google_validated_category: subTypes.validated_category,
        google_tags: googleTags,
      };
      
      // Cache the result
      enrichmentCache.set(cacheKey, { data: result, timestamp: Date.now() });
      
      return result;
    } catch (error: any) {
      logger.error('[GooglePlaces] Enrichment error:', error.message);
      return null;
    }
  }
}

