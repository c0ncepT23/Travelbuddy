import axios from 'axios';
import { GOOGLE_MAPS_API_KEY } from '../config/maps';
import logger from '../config/logger';

interface GeocodeResult {
  lat: number;
  lng: number;
  formatted_address: string;
  confidence: 'high' | 'medium' | 'low';
  confidence_score: number; // 0-100
}

export class GeocodingService {
  /**
   * Geocode a place name to get lat/lng coordinates
   * Uses Google Maps Geocoding API
   */
  static async geocodePlace(
    placeName: string,
    locationContext?: string
  ): Promise<GeocodeResult | null> {
    try {
      // Combine place name with location context for better accuracy
      const searchQuery = locationContext
        ? `${placeName}, ${locationContext}`
        : placeName;

      logger.info(`[Geocoding] Searching for: "${searchQuery}"`);

      const response = await axios.get(
        'https://maps.googleapis.com/maps/api/geocode/json',
        {
          params: {
            address: searchQuery,
            key: GOOGLE_MAPS_API_KEY,
          },
        }
      );

      if (response.data.status === 'OK' && response.data.results.length > 0) {
        const result = response.data.results[0];
        const location = result.geometry.location;

        // Calculate confidence score
        const confidence = this.calculateConfidence(result, searchQuery, response.data.results);

        logger.info(`[Geocoding] Found: ${result.formatted_address} at (${location.lat}, ${location.lng}) [Confidence: ${confidence.level} ${confidence.score}%]`);

        return {
          lat: location.lat,
          lng: location.lng,
          formatted_address: result.formatted_address,
          confidence: confidence.level,
          confidence_score: confidence.score,
        };
      }

      logger.warn(`[Geocoding] No results for: "${searchQuery}"`);
      return null;
    } catch (error: any) {
      logger.error('[Geocoding] Error:', error.message);
      return null;
    }
  }

  /**
   * Calculate confidence score for geocoding result
   */
  private static calculateConfidence(
    result: any,
    searchQuery: string,
    allResults: any[]
  ): { level: 'high' | 'medium' | 'low'; score: number } {
    let score = 0;
    
    // Factor 1: Result type (40 points)
    const types = result.types || [];
    if (types.includes('establishment') || types.includes('point_of_interest')) {
      score += 40; // Exact business/POI
    } else if (types.includes('street_address') || types.includes('route')) {
      score += 25; // Street level
    } else if (types.includes('locality') || types.includes('neighborhood')) {
      score += 10; // General area only
    }

    // Factor 2: Name matching (30 points)
    const searchName = searchQuery.toLowerCase().split(',')[0].trim();
    const resultName = result.formatted_address.toLowerCase();
    const nameWords = searchName.split(' ');
    const matchedWords = nameWords.filter(word => 
      word.length > 2 && resultName.includes(word)
    );
    const nameMatchRatio = nameWords.length > 0 ? matchedWords.length / nameWords.length : 0;
    score += Math.round(nameMatchRatio * 30);

    // Factor 3: Location specificity (20 points)
    const addressComponents = result.address_components?.length || 0;
    if (addressComponents >= 5) {
      score += 20; // Very specific address
    } else if (addressComponents >= 3) {
      score += 10; // Moderate specificity
    }

    // Factor 4: Uniqueness (10 points)
    // If multiple results, confidence is lower
    if (allResults.length === 1) {
      score += 10;
    } else if (allResults.length <= 3) {
      score += 5;
    }

    // Determine level based on score
    let level: 'high' | 'medium' | 'low';
    if (score >= 75) {
      level = 'high';
    } else if (score >= 50) {
      level = 'medium';
    } else {
      level = 'low';
    }

    return { level, score };
  }

  /**
   * Geocode multiple places in batch
   * Adds a small delay between requests to avoid rate limiting
   */
  static async geocodePlaces(
    places: Array<{ name: string; location?: string }>
  ): Promise<Array<{ 
    name: string; 
    lat: number | null; 
    lng: number | null; 
    formatted_address?: string;
    confidence?: 'high' | 'medium' | 'low';
    confidence_score?: number;
  }>> {
    const results = [];

    for (const place of places) {
      const result = await this.geocodePlace(place.name, place.location);

      results.push({
        name: place.name,
        lat: result?.lat || null,
        lng: result?.lng || null,
        formatted_address: result?.formatted_address,
        confidence: result?.confidence,
        confidence_score: result?.confidence_score,
      });

      // Small delay to avoid rate limiting (40 requests per second limit)
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    return results;
  }
}

