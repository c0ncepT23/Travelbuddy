import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { config } from '../config/env';
import { GeminiService, MODELS } from './gemini.service';
import { GooglePlacesService } from './googlePlaces.service';
import { ItemCategory, ProcessedContent } from '../types';
import logger from '../config/logger';

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
            waitForFinish: 180, // Wait up to 3 minutes for completion
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
          waitForFinish: 180,
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
   * Download video to temp file for Gemini analysis
   * UPDATED: Routes through IPRoyal Proxy to avoid Instagram blocks
   */
  private static async downloadVideo(videoUrl: string): Promise<string> {
    const tempDir = os.tmpdir();
    const filename = `insta_reel_${crypto.randomUUID()}.mp4`;
    const filepath = path.join(tempDir, filename);

    logger.info(`[Apify] Downloading video via Proxy to: ${filepath}`);

    // 1. Configure Proxy Agent (Same as Gemini Service)
    const { host, port, user, pass } = config.proxy || {};
    let httpsAgent;

    if (host && port && user && pass) {
      const proxyUrl = `http://${user}:${pass}@${host}:${port}`;
      httpsAgent = new HttpsProxyAgent(proxyUrl);
      logger.info('[Apify] Routing download through IPRoyal Proxy');
    }

    // 2. Download with Agent
    const response = await axios({
      method: 'GET',
      url: videoUrl,
      responseType: 'stream',
      httpsAgent: httpsAgent, // <--- CRITICAL: Routes traffic through IPRoyal
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    const writer = fs.createWriteStream(filepath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => resolve(filepath));
      writer.on('error', reject);
    });
  }

  /**
   * Analyze Instagram video using Gemini 2.5 multimodal
   */
  static async analyzeVideoWithGemini(
    videoPath: string,
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
    try {
      // Import Gemini SDK
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const { GoogleAIFileManager, FileState } = await import('@google/generative-ai/server');

      const genAI = new GoogleGenerativeAI(config.gemini.apiKey);
      const fileManager = new GoogleAIFileManager(config.gemini.apiKey);

      logger.info('[Apify] Uploading video to Gemini...');

      // Upload the video file
      const uploadResult = await fileManager.uploadFile(videoPath, {
        mimeType: 'video/mp4',
        displayName: 'Instagram Reel',
      });

      logger.info(`[Apify] Video uploaded: ${uploadResult.file.name}`);

      // Wait for processing
      let file = await fileManager.getFile(uploadResult.file.name);
      while (file.state === FileState.PROCESSING) {
        logger.info('[Apify] Waiting for video processing...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        file = await fileManager.getFile(uploadResult.file.name);
      }

      if (file.state === FileState.FAILED) {
        throw new Error('Video processing failed');
      }

      logger.info('[Apify] Video ready, analyzing with Gemini...');

      // Use stable Gemini 2.5 Flash for multimodal analysis
      const model = genAI.getGenerativeModel({ 
        model: MODELS.FLASH,
        generationConfig: {
          responseMimeType: 'application/json',
        }
      });

      const prompt = `Analyze this Instagram Reel and extract only the MAJOR geographical locations (Hero Places) visited.

RULES FOR EXTRACTION:
1. Identify the "HERO" locations: These are the main destinations the creator actually spent time at.
2. ONE PIN PER COMPLEX: If the video shows multiple spots inside a single complex (e.g., "Giraffe Terrace" or "Blossom Restaurant" inside "Safari World"), do NOT create separate entries for them. 
3. RICH DESCRIPTIONS: Instead, create ONE entry for the Parent Place (e.g., "Safari World Bangkok") and put all the specific spots, food items, and tips into the "description" field as bullet points.
4. IGNORE TRANSIT POINTS: Do not extract pickup points, meeting spots, or airports unless they are an actual destination visited.

Caption: "${caption}"
${locationHint ? `Location tagged: ${locationHint}` : ''}

RESPOND WITH VALID JSON:
{
  "summary": "Brief description of the reel",
  "destination": "City name",
  "destination_country": "Country name",
  "places": [
    {
      "name": "Exact Major Place Name",
      "category": "food" or "place" or "shopping" or "activity",
      "description": "Rich summary with tips:\n• Highlight 1\n• Highlight 2",
      "location": "Area if mentioned",
      "cuisine_type": "Only if major place is a restaurant",
      "place_type": "Zoo, Mall, etc."
    }
  ]
}`;

      const result = await model.generateContent([
        prompt,
        {
          fileData: {
            fileUri: file.uri,
            mimeType: 'video/mp4',
          },
        },
      ]);

      const response = result.response;
      const text = response.text();

      // Parse JSON
      let cleanText = text.trim();
      cleanText = cleanText.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/```\s*$/, '');

      const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Failed to parse Gemini response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      logger.info(`[Apify] Gemini extracted ${parsed.places?.length || 0} places from video`);
      if (parsed.destination) {
        logger.info(`[Apify] Destination: ${parsed.destination} (${parsed.destination_country})`);
      }

      // Cleanup: Delete the uploaded file
      try {
        await fileManager.deleteFile(uploadResult.file.name);
        logger.info('[Apify] Cleaned up uploaded video from Gemini');
      } catch (e) {
        // Non-critical cleanup error
      }

      return {
        summary: parsed.summary || 'Instagram Reel',
        destination: parsed.destination,
        destination_country: parsed.destination_country,
        places: parsed.places || [],
      };
    } catch (error: any) {
      logger.error('[Apify] Gemini video analysis error:', error.message);
      throw error;
    }
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
    
    // Check minimum length (at least 15 chars of actual content)
    if (cleaned.length < 15) {
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
    let videoPath: string | null = null;

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
            videoPath = await this.downloadVideo(scraped.videoUrl);
            analysisResult = await this.analyzeVideoWithGemini(
              videoPath,
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
            videoPath = await this.downloadVideo(scraped.videoUrl);
            analysisResult = await this.analyzeVideoWithGemini(
              videoPath,
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
        videoPath = await this.downloadVideo(scraped.videoUrl);
        analysisResult = await this.analyzeVideoWithGemini(
          videoPath,
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

      // Step 3: Enrich with Google Places
      const enrichedPlaces = await Promise.all(
        analysisResult.places.map(async (place, index) => {
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
    } finally {
      // Cleanup temp video file
      if (videoPath && fs.existsSync(videoPath)) {
        try {
          fs.unlinkSync(videoPath);
          logger.info('[Apify] Cleaned up temp video file');
        } catch (e) {
          // Non-critical cleanup error
        }
      }
    }
  }
}
