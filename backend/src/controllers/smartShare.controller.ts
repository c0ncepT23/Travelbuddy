/**
 * Smart Share Controller
 * 
 * Handles zero-friction content sharing:
 * 1. User shares a URL from YouTube/Instagram/Reddit
 * 2. AI extracts destination and places
 * 3. Trip is auto-created/found based on destination country
 * 4. Places are saved and user is shown results immediately
 * 
 * NO manual trip selection required!
 */

import { Response } from 'express';
import { AuthRequest } from '../types';
import { TripGroupModel } from '../models/tripGroup.model';
import { TripGroup } from '../types';
import { SavedItemModel } from '../models/savedItem.model';
import { ContentProcessorService } from '../services/contentProcessor.service';
import logger from '../config/logger';

interface ProcessResult {
  success: boolean;
  tripId: string;
  tripName: string;
  destination: string;
  destinationCountry: string;
  isNewTrip: boolean;
  placesExtracted: number;
  places: Array<{
    id: string;
    name: string;
    category: string;
    description: string;
    cuisine_type?: string;
    place_type?: string;
    location_lat?: number;
    location_lng?: number;
    rating?: number;
  }>;
}

export class SmartShareController {
  /**
   * Process a shared URL with zero friction
   * - Extracts destination from content
   * - Finds or creates a trip for that country
   * - Saves all extracted places
   * - Returns everything needed to show instant results
   */
  static async processSharedUrl(req: AuthRequest, res: Response): Promise<void> {
    const userId = req.user?.id;
    const { url } = req.body;

    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    if (!url) {
      res.status(400).json({ success: false, error: 'URL is required' });
      return;
    }

    logger.info(`🚀 [SmartShare] Processing URL for user ${userId}: ${url}`);

    try {
      // Step 1: Detect content type and extract places + destination
      const contentType = detectContentType(url);
      logger.info(`📍 [SmartShare] Detected content type: ${contentType}`);

      let extractionResult: any;
      
      switch (contentType) {
        case 'youtube':
          extractionResult = await ContentProcessorService.extractMultiplePlacesFromVideo(url);
          break;
        case 'instagram':
          extractionResult = await ContentProcessorService.extractMultiplePlacesFromInstagram(url);
          break;
        case 'reddit':
          extractionResult = await ContentProcessorService.extractMultiplePlacesFromReddit(url);
          break;
        default:
          // Generic URL processing
          extractionResult = await ContentProcessorService.extractMultiplePlacesFromVideo(url);
      }

      if (!extractionResult?.places?.length) {
        res.status(200).json({
          success: true,
          message: 'No places found in this content',
          tripId: null,
          placesExtracted: 0,
          places: [],
        });
        return;
      }

      // Step 2: Determine destination
      const destination = extractionResult.destination || extractionResult.places[0]?.location_name || 'Unknown';
      const destinationCountry = extractionResult.destination_country || inferCountryFromDestination(destination);
      
      logger.info(`🌍 [SmartShare] Destination: ${destination}, Country: ${destinationCountry}`);

      // Step 3: Find or create trip for this country
      const { trip, isNewTrip } = await findOrCreateTripForCountry(userId, destinationCountry);
      
      logger.info(`✈️ [SmartShare] Using trip: ${trip.name} (${trip.id}), isNew: ${isNewTrip}`);

      // Step 4: Save all extracted places to the trip
      const savedPlaces: ProcessResult['places'] = [];
      
      for (const place of extractionResult.places) {
        try {
          const savedItem = await SavedItemModel.create(
            trip.id,                                    // tripGroupId
            userId,                                     // addedBy
            place.name,                                 // name
            place.category || 'place',                  // category
            place.description || '',                    // description
            contentType as any,                         // sourceType
            place.location_name || destination,         // locationName
            place.location_lat || undefined,            // locationLat
            place.location_lng || undefined,            // locationLng
            url,                                        // sourceUrl
            place.source_title || undefined,            // sourceTitle
            place.originalContent || undefined,         // originalContent
            undefined,                                  // locationConfidence
            undefined,                                  // locationConfidenceScore
            place.google_place_id || undefined,         // googlePlaceId
            place.rating || undefined,                  // rating
            place.user_ratings_total || undefined,      // userRatingsTotal
            place.price_level || undefined,             // priceLevel
            place.formatted_address || undefined,       // formattedAddress
            place.area_name || undefined,               // areaName
            place.photos_json || undefined,             // photosJson
            place.opening_hours_json || undefined,      // openingHoursJson
            place.tags || undefined,                    // tags
            place.cuisine_type || undefined,            // cuisineType
            place.place_type || undefined,              // placeType
            destination                                 // destination
          );

          savedPlaces.push({
            id: savedItem.id,
            name: savedItem.name,
            category: savedItem.category,
            description: savedItem.description || '',
            cuisine_type: place.cuisine_type,
            place_type: place.place_type,
            location_lat: savedItem.location_lat,
            location_lng: savedItem.location_lng,
            rating: savedItem.rating,
          });
        } catch (saveError: any) {
          logger.error(`❌ [SmartShare] Failed to save place "${place.name}":`, saveError.message);
          // Continue with other places
        }
      }

      logger.info(`🎉 [SmartShare] Saved ${savedPlaces.length}/${extractionResult.places.length} places`);

      // Step 5: Return result
      const result: ProcessResult = {
        success: true,
        tripId: trip.id,
        tripName: trip.name,
        destination: destination,
        destinationCountry: destinationCountry,
        isNewTrip: isNewTrip,
        placesExtracted: savedPlaces.length,
        places: savedPlaces,
      };

      res.status(200).json(result);
    } catch (error: any) {
      logger.error(`❌ [SmartShare] Error processing URL:`, error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to process shared content',
      });
    }
  }

  /**
   * Get user's country-based trips for quick selection
   * Used as fallback if auto-detection fails
   */
  static async getCountryTrips(req: AuthRequest, res: Response): Promise<void> {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    try {
      const trips = await TripGroupModel.findByUser(userId);
      
      // Group trips by destination country
      const countryTrips = trips.reduce((acc: Record<string, any[]>, trip: TripGroup) => {
        const country = trip.destination || 'Other';
        if (!acc[country]) acc[country] = [];
        acc[country].push({
          id: trip.id,
          name: trip.name,
          destination: trip.destination,
        });
        return acc;
      }, {});

      res.status(200).json({
        success: true,
        trips: countryTrips,
      });
    } catch (error: any) {
      logger.error(`❌ [SmartShare] Error fetching trips:`, error);
      res.status(500).json({ success: false, error: 'Failed to fetch trips' });
    }
  }
}

// Helper functions

function detectContentType(url: string): 'youtube' | 'instagram' | 'reddit' | 'tiktok' | 'web' {
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) return 'youtube';
  if (lowerUrl.includes('instagram.com')) return 'instagram';
  if (lowerUrl.includes('reddit.com')) return 'reddit';
  if (lowerUrl.includes('tiktok.com')) return 'tiktok';
  return 'web';
}

function inferCountryFromDestination(destination: string): string {
  // Common city -> country mappings
  const cityToCountry: Record<string, string> = {
    'tokyo': 'Japan',
    'kyoto': 'Japan',
    'osaka': 'Japan',
    'nara': 'Japan',
    'hiroshima': 'Japan',
    'fukuoka': 'Japan',
    'sapporo': 'Japan',
    'paris': 'France',
    'nice': 'France',
    'lyon': 'France',
    'london': 'United Kingdom',
    'manchester': 'United Kingdom',
    'rome': 'Italy',
    'milan': 'Italy',
    'venice': 'Italy',
    'florence': 'Italy',
    'barcelona': 'Spain',
    'madrid': 'Spain',
    'bangkok': 'Thailand',
    'chiang mai': 'Thailand',
    'phuket': 'Thailand',
    'seoul': 'South Korea',
    'busan': 'South Korea',
    'bali': 'Indonesia',
    'jakarta': 'Indonesia',
    'singapore': 'Singapore',
    'new york': 'United States',
    'los angeles': 'United States',
    'san francisco': 'United States',
    'las vegas': 'United States',
    'istanbul': 'Turkey',
    'dubai': 'United Arab Emirates',
    'hong kong': 'Hong Kong',
    'taipei': 'Taiwan',
    'hanoi': 'Vietnam',
    'ho chi minh': 'Vietnam',
    'kuala lumpur': 'Malaysia',
    'sydney': 'Australia',
    'melbourne': 'Australia',
    'amsterdam': 'Netherlands',
    'berlin': 'Germany',
    'munich': 'Germany',
    'vienna': 'Austria',
    'prague': 'Czech Republic',
    'cairo': 'Egypt',
    'marrakech': 'Morocco',
    'lisbon': 'Portugal',
    'porto': 'Portugal',
    'athens': 'Greece',
    'santorini': 'Greece',
    'reykjavik': 'Iceland',
    'dublin': 'Ireland',
    'edinburgh': 'Scotland',
    'zurich': 'Switzerland',
    'geneva': 'Switzerland',
  };

  const lowerDest = destination.toLowerCase().trim();
  
  // Check direct match
  if (cityToCountry[lowerDest]) {
    return cityToCountry[lowerDest];
  }

  // Check partial match
  for (const [city, country] of Object.entries(cityToCountry)) {
    if (lowerDest.includes(city) || city.includes(lowerDest)) {
      return country;
    }
  }

  // If destination looks like a country already
  const knownCountries = [
    'Japan', 'France', 'Italy', 'Spain', 'Thailand', 'South Korea', 'Indonesia',
    'Singapore', 'United States', 'Turkey', 'United Arab Emirates', 'Vietnam',
    'Malaysia', 'Australia', 'Netherlands', 'Germany', 'Austria', 'Czech Republic',
    'Egypt', 'Morocco', 'Portugal', 'Greece', 'Iceland', 'Ireland', 'Switzerland',
    'United Kingdom', 'Taiwan', 'Hong Kong', 'China', 'India', 'Philippines',
    'Mexico', 'Brazil', 'Argentina', 'Canada', 'New Zealand', 'South Africa',
  ];

  for (const country of knownCountries) {
    if (lowerDest.includes(country.toLowerCase())) {
      return country;
    }
  }

  // Default: use the destination as-is (might already be a country)
  return destination;
}

async function findOrCreateTripForCountry(
  userId: string, 
  country: string
): Promise<{ trip: TripGroup; isNewTrip: boolean }> {
  // First, look for an existing trip for this country
  const existingTrips = await TripGroupModel.findByUser(userId);
  
  // Find a trip that matches the country
  const matchingTrip = existingTrips.find((trip: TripGroup) => {
    const tripDest = (trip.destination || '').toLowerCase();
    const countryLower = country.toLowerCase();
    
    return tripDest.includes(countryLower) || countryLower.includes(tripDest);
  });

  if (matchingTrip) {
    return { trip: matchingTrip, isNewTrip: false };
  }

  // No matching trip found - create a new one!
  const tripName = `${country} Trip`;
  const newTrip = await TripGroupModel.create(
    tripName,
    country,
    userId  // createdBy is the 3rd parameter
  );

  logger.info(`✨ [SmartShare] Auto-created new trip: "${tripName}" for ${country}`);

  return { trip: newTrip, isNewTrip: true };
}

