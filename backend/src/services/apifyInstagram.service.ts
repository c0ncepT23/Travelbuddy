import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { config } from '../config/env';
import { GeminiService } from './gemini.service';
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
    originalContent: any;
    google_place_id?: string;
    rating?: number;
    user_ratings_total?: number;
    price_level?: number;
    formatted_address?: string;
    area_name?: string;
    photos_json?: any[];
    opening_hours_json?: any;
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
      logger.error('[Apify] Scrape error:', error.response?.data || error.message);
      
      // If first actor fails, try the community fallback
      logger.info('[Apify] Trying community scraper as fallback...');
      try {
        return await this.scrapeWithActor(url, INSTAGRAM_POST_SCRAPER, postId);
      } catch (fallbackError) {
        logger.error('[Apify] Fallback also failed');
      }
      
      throw new Error(`Apify scrape failed: ${error.message}`);
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
   */
  private static async downloadVideo(videoUrl: string): Promise<string> {
    const tempDir = os.tmpdir();
    const filename = `insta_reel_${Date.now()}.mp4`;
    const filepath = path.join(tempDir, filename);

    logger.info(`[Apify] Downloading video to: ${filepath}`);

    const response = await axios({
      method: 'GET',
      url: videoUrl,
      responseType: 'stream',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
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

      // Use Gemini 2.0 Flash Exp for multimodal analysis (supports video)
      const model = genAI.getGenerativeModel({ 
        model: 'gemini-2.0-flash-exp',
        generationConfig: {
          responseMimeType: 'application/json',
        }
      });

      const prompt = `Analyze this Instagram Reel and extract ALL places mentioned or shown.

Caption: "${caption}"
${locationHint ? `Location tagged: ${locationHint}` : ''}

**IMPORTANT: Read ALL on-screen text carefully!**
- Look for restaurant names, shop names, place names shown as text overlays/captions
- Look for addresses or location indicators
- Look for signs, logos, storefront text
- Listen for spoken place names

**CRITICAL RULES FOR PLACE EXTRACTION:**
1. Extract the OFFICIAL BUSINESS/RESTAURANT NAME, NOT dish descriptions
   - ✅ CORRECT: "Pad Thai Fai Ta Lu" (the restaurant)
   - ❌ WRONG: "Smoky Pad Thai" (the dish)
2. Each place should appear ONLY ONCE
3. Use the exact name as shown/spoken in the video

For FOOD places, identify cuisine_type: "ramen", "street food", "cafe", "fine dining", etc.
For OTHER places, identify place_type: "temple", "market", "viewpoint", "shopping mall", etc.

RESPOND WITH VALID JSON:
{
  "summary": "Brief description of what this reel shows",
  "destination": "City name (e.g., Bangkok, Tokyo)",
  "destination_country": "Country name (e.g., Thailand, Japan)",
  "places": [
    {
      "name": "Exact business/place name",
      "category": "food" or "place" or "shopping" or "activity",
      "description": "What makes this place special",
      "location": "Area/neighborhood if mentioned",
      "cuisine_type": "For food places",
      "place_type": "For non-food places"
    }
  ]
}

If no specific places are identifiable, return empty places array but still try to identify destination.`;

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
   * Full pipeline: Scrape Instagram + Analyze with Gemini + Enrich with Google Places
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
            originalContent: { url },
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
        }>;
      };

      // Step 2: Analyze content
      if (scraped.videoUrl) {
        // Video/Reel - Use full multimodal analysis
        logger.info('[Apify] Video detected, using multimodal analysis');
        videoPath = await this.downloadVideo(scraped.videoUrl);

        analysisResult = await this.analyzeVideoWithGemini(
          videoPath,
          scraped.caption,
          scraped.locationName
        );
      } else {
        // Image post - Use text analysis with caption
        logger.info('[Apify] Image post, using caption analysis');
        analysisResult = await GeminiService.analyzeInstagramPost(
          scraped.caption,
          scraped.displayUrl
        );
      }

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
                originalContent: {
                  ...scraped,
                  analysisMethod: scraped.videoUrl ? 'gemini_video' : 'gemini_caption',
                },
              };
            }

            return {
              name: place.name,
              category: place.category,
              description: place.description,
              location_name: place.location,
              originalContent: scraped,
            };
          } catch (error: any) {
            logger.warn(`[Apify] Failed to enrich "${place.name}": ${error.message}`);
            return {
              name: place.name,
              category: place.category,
              description: place.description,
              location_name: place.location,
              originalContent: scraped,
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
