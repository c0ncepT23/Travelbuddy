import axios from 'axios';
import { config } from '../config/env';
import logger from '../config/logger';

// Simple in-memory cache for nearby search results (TTL: 1 hour)
const nearbySearchCache = new Map<string, { data: NearbyPlace[]; timestamp: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

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
          fields: 'place_id,name,formatted_address,rating,user_ratings_total,price_level,photos,opening_hours,geometry,address_components',
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
   */
  static async enrichPlace(name: string, locationHint?: string): Promise<Partial<GooglePlaceDetails> & { area_name?: string } | null> {
    try {
      const query = locationHint ? `${name} ${locationHint}` : name;
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
      logger.info(`[GooglePlaces] Enrichment success! Rating: ${details.rating}, Area: ${areaName}`);

      return {
        ...details,
        area_name: areaName || undefined,
      };
    } catch (error: any) {
      logger.error('[GooglePlaces] Enrichment error:', error.message);
      return null;
    }
  }
}

