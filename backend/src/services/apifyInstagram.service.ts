import axios from 'axios';
import pLimit from 'p-limit';
import { config } from '../config/env';
import { GeminiService } from './gemini.service';
import { GooglePlacesService } from './googlePlaces.service';
import { ItemCategory, ProcessedContent } from '../types';
import logger from '../config/logger';
import { API_LIMITS } from '../config/constants';

// Apify API configuration
const APIFY_API_BASE = 'https://api.apify.com/v2';
// Use community actors that are actively maintained
// See: https://apify.com/store?search=instagram
const INSTAGRAM_SCRAPER_ACTOR = 'apify~instagram-scraper'; // URL-safe format
const INSTAGRAM_POST_SCRAPER = 'shu8hami~instagram-scraper'; // Community fallback

interface ApifyInstagramResult {
  id: string;
  shortCode: string;
  caption: string;
  url: string;
  videoUrl?: string;
  displayUrl?: string;
  ownerUsername: string;
  ownerFullName?: string;
  locationName?: string;
  timestamp: string;
  likesCount: number;
  commentsCount: number;
  type: 'Image' | 'Video' | 'Sidecar';
}

interface InstagramExtractionResult {
  summary: string;
  source_title: string;
  destination?: string;
  destination_country?: string;
  places: Array<ProcessedContent & { 
    original_content: any;
    google_place_id?: string;
    rating?: number;
    user_ratings_total?: number;
    price_level?: number;
    formatted_address?: string;
    area_name?: string;
    photos_json?: any[];
    opening_hours_json?: any;
    parent_location?: string;
  }>;
}

export class ApifyInstagramService {
  private static readonly APIFY_TOKEN = config.apify.token;

  /**
   * Check if Apify is configured
   */
  static isConfigured(): boolean {
    return !!this.APIFY_TOKEN;
  }

  /**
   * Extract Instagram post/reel ID from URL
   */
  static extractPostId(url: string): string | null {
    // Matches: /p/ABC123/, /reel/ABC123/, /reels/ABC123/
    const regex = /(?:instagram\.com\/(?:p|reel|reels)\/)([A-Za-z0-9_-]+)/;
    const match = url.match(regex);
    return match ? match[1] : null;
  }

  /**
   * Determine if URL is a reel or regular post
   */
  static isReel(url: string): boolean {
    return url.includes('/reel/') || url.includes('/reels/');
  }

  /**
   * Scrape Instagram post/reel using Apify
   */
  static async scrapeInstagramPost(url: string): Promise<ApifyInstagramResult | null> {
    if (!this.APIFY_TOKEN) {
      logger.warn('[Apify] Token not configured, falling back to basic scraping');
      return null;
    }

    const postId = this.extractPostId(url);
    if (!postId) {
      throw new Error('Invalid Instagram URL');
    }

    // Determine which actor to use based on URL type
    const isReelUrl = this.isReel(url);
    // Use the main scraper for both (it handles posts and reels)
    const actorId = INSTAGRAM_SCRAPER_ACTOR;

    try {
      logger.info(`[Apify] Starting scrape for: ${url}`);
      logger.info(`[Apify] Using actor: ${actorId}`);

      // Prepare input based on actor type
      const runInput = isReelUrl 
        ? {
            // Reel scraper input format
            directUrls: [url],
            resultsLimit: 1,
          }
        : {
            // Post scraper input format
            directUrls: [url],
            resultsLimit: 1,
          };

      // Start the actor run
      const runResponse = await axios.post(
        `${APIFY_API_BASE}/acts/${actorId}/runs`,
        runInput,
        {
          headers: {
            'Authorization': `Bearer ${this.APIFY_TOKEN}`,
            'Content-Type': 'application/json',
          },
          params: {
            waitForFinish: API_LIMITS.APIFY_WAIT_SECONDS, // Wait up to 3 minutes for completion
          },
        }
      );

      const runId = runResponse.data.data.id;
      const datasetId = runResponse.data.data.defaultDatasetId;

      logger.info(`[Apify] Run started: ${runId}, waiting for results...`);

      // Get results from the dataset
      const datasetResponse = await axios.get(
        `${APIFY_API_BASE}/datasets/${datasetId}/items`,
        {
          headers: {
            'Authorization': `Bearer ${this.APIFY_TOKEN}`,
          },
        }
      );

      const items = datasetResponse.data;

      if (!items || items.length === 0) {
        logger.warn('[Apify] No results returned - post may be private or unavailable');
        return null;
      }

      const result = items[0];
      logger.info(`[Apify] Successfully scraped: ${result.shortCode || postId}`);

      // Normalize the result (different actors return slightly different formats)
      return {
        id: result.id || result.inputUrl || postId,
        shortCode: result.shortCode || result.code || postId,
        caption: result.caption || result.description || '',
        url: result.url || result.inputUrl || url,
        videoUrl: result.videoUrl || result.video_url || result.videoPlaybackUrl,
        displayUrl: result.displayUrl || result.display_url || result.thumbnailUrl,
        ownerUsername: result.ownerUsername || result.owner?.username || result.username || 'unknown',
        ownerFullName: result.ownerFullName || result.owner?.full_name,
        locationName: result.locationName || result.location?.name,
        timestamp: result.timestamp || result.taken_at_timestamp,
        likesCount: result.likesCount || result.likes_count || result.likesCount || 0,
        commentsCount: result.commentsCount || result.comments_count || 0,
        type: result.type || (result.videoUrl || result.video_url ? 'Video' : 'Image'),
      };
    } catch (error: any) {
      logger.warn(`[Apify] Primary scraper failed: ${error.message}`);
      
      // If first actor fails, try the community fallback
      logger.info('[Apify] Trying community scraper as fallback...');
      try {
        return await this.scrapeWithActor(url, INSTAGRAM_POST_SCRAPER, postId);
      } catch (fallbackError: any) {
        // Capture both errors for better debugging
        const msg = `All Instagram scrapers failed. Primary: ${error.message}. Fallback: ${fallbackError.message}`;
        logger.error(`[Apify] ${msg}`);
        throw new Error(msg);
      }
    }
  }

  /**
   * Helper to scrape with a specific actor
   */
  private static async scrapeWithActor(
    url: string, 
    actorId: string, 
    postId: string
  ): Promise<ApifyInstagramResult | null> {
    const runResponse = await axios.post(
      `${APIFY_API_BASE}/acts/${actorId}/runs`,
      {
        directUrls: [url],
        resultsLimit: 1,
      },
      {
        headers: {
          'Authorization': `Bearer ${this.APIFY_TOKEN}`,
          'Content-Type': 'application/json',
        },
        params: {
          waitForFinish: API_LIMITS.APIFY_WAIT_SECONDS,
        },
      }
    );

    const datasetId = runResponse.data.data.defaultDatasetId;
    const datasetResponse = await axios.get(
      `${APIFY_API_BASE}/datasets/${datasetId}/items`,
      {
        headers: {
          'Authorization': `Bearer ${this.APIFY_TOKEN}`,
        },
      }
    );

    const items = datasetResponse.data;
    if (!items || items.length === 0) return null;

    const result = items[0];
    return {
      id: result.id || postId,
      shortCode: result.shortCode || result.code || postId,
      caption: result.caption || result.description || '',
      url: result.url || url,
      videoUrl: result.videoUrl || result.video_url || result.videoPlaybackUrl,
      displayUrl: result.displayUrl || result.display_url || result.thumbnailUrl,
      ownerUsername: result.ownerUsername || result.owner?.username || 'unknown',
      ownerFullName: result.ownerFullName || result.owner?.full_name,
      locationName: result.locationName || result.location?.name,
      timestamp: result.timestamp,
      likesCount: result.likesCount || result.likes_count || 0,
      commentsCount: result.commentsCount || result.comments_count || 0,
      type: result.videoUrl || result.video_url ? 'Video' : 'Image',
    };
  }

  /**
   * Analyze Instagram video using Gemini 2.5 multimodal
   * UPDATED: Now calls the unified GeminiService.analyzeVideoContent
   */
  static async analyzeVideoWithGemini(
    videoUrl: string,
    caption: string,
    locationHint?: string
  ): Promise<{
    summary: string;
    destination?: string;
    destination_country?: string;
    places: Array<{
      name: string;
      category: ItemCategory;
      description: string;
      location?: string;
      cuisine_type?: string;
      place_type?: string;
      parent_location?: string;
    }>;
  }> {
    const result = await GeminiService.analyzeVideoContent(videoUrl, {
      platform: 'instagram',
      caption: caption,
      title: locationHint ? `Reel at ${locationHint}` : 'Instagram Reel',
    });

    return {
      summary: result.summary,
      destination: result.destination,
      destination_country: result.destination_country,
      places: result.places.map(p => ({
        ...p,
        category: p.category as ItemCategory,
      })),
    };
  }

  /**
   * Check if caption has useful content for place extraction
   * Returns true if caption has enough content to try text-based analysis
   */
  private static hasUsefulCaption(caption: string): boolean {
    if (!caption) return false;
    
    // Remove emojis, hashtags, and common filler words
    const cleaned = caption
      .replace(/[\u{1F600}-\u{1F6FF}]/gu, '') // emojis
      .replace(/#\w+/g, '') // hashtags
      .replace(/@\w+/g, '') // mentions
      .replace(/\n+/g, ' ')
      .trim();
    
    // Check minimum length (at least 30 chars of actual content)
    if (cleaned.length < 30) {
      logger.info(`[Apify] Caption too short (${cleaned.length} chars) - not useful`);
      return false;
    }
    
    // Check if it mentions location-related keywords
    const locationKeywords = [
      'restaurant', 'cafe', 'bar', 'hotel', 'resort', 'temple', 'museum',
      'market', 'shop', 'store', 'beach', 'park', 'street', 'road',
      'visit', 'went to', 'at the', 'located', 'address', 'find us',
      'place', 'spot', 'try', 'must', 'best', 'recommend'
    ];
    
    const hasLocationContext = locationKeywords.some(kw => 
      cleaned.toLowerCase().includes(kw)
    );
    
    if (hasLocationContext) {
      logger.info('[Apify] Caption has location-related keywords - useful');
      return true;
    }
    
    // If long enough but no keywords, still try it
    if (cleaned.length > 100) {
      logger.info('[Apify] Caption is long enough - worth trying');
      return true;
    }
    
    logger.info('[Apify] Caption lacks useful location content');
    return false;
  }

  /**
   * Full pipeline: Scrape Instagram + Analyze with Gemini + Enrich with Google Places
   * Smart approach: Try caption first (cheaper), video analysis as fallback
   */
  static async extractPlacesFromInstagram(url: string): Promise<InstagramExtractionResult> {
    try {
      // Step 1: Scrape with Apify
      const scraped = await this.scrapeInstagramPost(url);

      if (!scraped) {
        // Fallback to basic Gemini caption analysis if Apify not available
        logger.info('[Apify] Falling back to caption-only analysis');
        const fallbackResult = await GeminiService.analyzeInstagramPost('Instagram post', undefined);
        return {
          summary: fallbackResult.summary,
          source_title: 'Instagram Discovery',
          destination: fallbackResult.destination,
          destination_country: fallbackResult.destination_country,
          places: fallbackResult.places.map(place => ({
            ...place,
            location_name: place.location,
            original_content: { url },
          })),
        };
      }

      let analysisResult: {
        summary: string;
        destination?: string;
        destination_country?: string;
        places: Array<{
          name: string;
          category: ItemCategory;
          description: string;
          location?: string;
          cuisine_type?: string;
          place_type?: string;
          parent_location?: string;
        }>;
      };

      // Step 2: Smart analysis - try caption first, video as fallback
      const hasGoodCaption = this.hasUsefulCaption(scraped.caption);
      let usedVideoAnalysis = false;
      
      if (hasGoodCaption) {
        // Try caption-based analysis first (cheaper, faster)
        logger.info('[Apify] Caption looks useful, trying text analysis first...');
        try {
          const captionResult = await GeminiService.analyzeInstagramPost(
            scraped.caption,
            scraped.displayUrl
          );
          
          // Check if caption analysis found places
          if (captionResult.places && captionResult.places.length > 0) {
            logger.info(`[Apify] Caption analysis found ${captionResult.places.length} places - using text results`);
            analysisResult = captionResult;
          } else if (scraped.videoUrl) {
            // No places from caption, try video analysis
            logger.info('[Apify] Caption analysis found 0 places, falling back to video analysis...');
            analysisResult = await this.analyzeVideoWithGemini(
              scraped.videoUrl,
              scraped.caption,
              scraped.locationName
            );
            usedVideoAnalysis = true;
          } else {
            // No video to analyze, use caption result
            analysisResult = captionResult;
          }
        } catch (captionError: any) {
          logger.warn(`[Apify] Caption analysis failed: ${captionError.message}`);
          if (scraped.videoUrl) {
            logger.info('[Apify] Falling back to video analysis...');
            analysisResult = await this.analyzeVideoWithGemini(
              scraped.videoUrl,
              scraped.caption,
              scraped.locationName
            );
            usedVideoAnalysis = true;
          } else {
            throw captionError;
          }
        }
      } else if (scraped.videoUrl) {
        // Caption not useful - use video analysis directly (reads burned-in subtitles)
        logger.info('[Apify] Caption not useful, using VIDEO analysis (reads on-screen text)...');
        analysisResult = await this.analyzeVideoWithGemini(
          scraped.videoUrl,
          scraped.caption,
          scraped.locationName
        );
        usedVideoAnalysis = true;
      } else {
        // Image post with poor caption - best effort with caption
        logger.info('[Apify] Image post with poor caption, trying anyway...');
        analysisResult = await GeminiService.analyzeInstagramPost(
          scraped.caption,
          scraped.displayUrl
        );
      }
      
      logger.info(`[Apify] Analysis complete. Method: ${usedVideoAnalysis ? 'VIDEO' : 'CAPTION'}, Places found: ${analysisResult.places?.length || 0}`)

      // Step 3: Enrich with Google Places (max concurrent)
      const limit = pLimit(API_LIMITS.GOOGLE_PLACES_CONCURRENT);
      const enrichedPlaces = await Promise.all(
        analysisResult.places.map(async (place, index) => {
          return limit(async () => {
            try {
              logger.info(`[Apify] Enriching place ${index + 1}/${analysisResult.places.length}: "${place.name}"`);
              
              const enriched = await GooglePlacesService.enrichPlace(
                place.name,
                place.location
              );

              if (enriched) {
                // Validate/enrich cuisine and place types with Google data
                let finalCuisineType = place.cuisine_type;
                let finalPlaceType = place.place_type;
                
                if (enriched.google_cuisine_type && !place.cuisine_type) {
                  finalCuisineType = enriched.google_cuisine_type;
                }
                if (enriched.google_place_type && !place.place_type) {
                  finalPlaceType = enriched.google_place_type;
                }
                
                return {
                  name: place.name,
                  category: place.category,
                  description: place.description,
                  location_name: place.location,
                  location_lat: enriched.geometry?.location.lat,
                  location_lng: enriched.geometry?.location.lng,
                  google_place_id: enriched.place_id,
                  rating: enriched.rating,
                  user_ratings_total: enriched.user_ratings_total,
                  price_level: enriched.price_level,
                  formatted_address: enriched.formatted_address,
                  area_name: enriched.area_name,
                  photos_json: enriched.photos,
                  opening_hours_json: enriched.opening_hours,
                  cuisine_type: finalCuisineType,
                  place_type: finalPlaceType,
                  parent_location: place.parent_location,
                  tags: enriched.google_tags || [],
                  original_content: {
                    ...scraped,
                    analysisMethod: usedVideoAnalysis ? 'gemini_video' : 'gemini_caption',
                  },
                };
              }

              return {
                name: place.name,
                category: place.category,
                description: place.description,
                location_name: place.location,
                cuisine_type: place.cuisine_type,
                place_type: place.place_type,
                parent_location: place.parent_location,
                original_content: scraped,
              };
            } catch (error: any) {
              logger.warn(`[Apify] Failed to enrich "${place.name}": ${error.message}`);
              return {
                name: place.name,
                category: place.category,
                description: place.description,
                location_name: place.location,
                cuisine_type: place.cuisine_type,
                place_type: place.place_type,
                parent_location: place.parent_location,
                original_content: scraped,
              };
            }
          });
        })
      );

      const source_title = scraped.ownerUsername 
        ? `@${scraped.ownerUsername}'s ${scraped.type === 'Video' ? 'Reel' : 'Post'}`
        : 'Instagram Discovery';

      return {
        summary: analysisResult.summary,
        source_title,
        destination: analysisResult.destination,
        destination_country: analysisResult.destination_country,
        places: enrichedPlaces,
      };
    } catch (error: any) {
      logger.error(`[Apify] Error in Instagram pipeline: ${error.message}`);
      throw error;
    }
  }
}
