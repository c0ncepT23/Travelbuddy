import axios from 'axios';
import { config } from '../config/env';
import logger from '../config/logger';

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
   * Priority: Sublocality Level 1/2 -> Locality -> Administrative Area Level 2
   */
  static identifyArea(addressComponents?: any[]): string | null {
    if (!addressComponents) return null;

    const getType = (type: string) => 
      addressComponents.find((c) => c.types.includes(type))?.long_name;

    // In Japan: 
    // ward = locality (e.g., "Shibuya City", "Minato City")
    // district = sublocality_level_1 (e.g., "Jinnan")
    // sub-district = sublocality_level_2 (e.g., "1-chome")

    const locality = getType('locality'); // e.g., "Shibuya City"
    const sublocality1 = getType('sublocality_level_1'); // e.g., "Jinnan"
    const neighborhood = getType('neighborhood');
    const adminArea2 = getType('administrative_area_level_2'); // County/City in some regions

    // Prefer "Locality" for Tokyo Wards as that matches the "City" grouping
    if (locality) return locality;
    
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

