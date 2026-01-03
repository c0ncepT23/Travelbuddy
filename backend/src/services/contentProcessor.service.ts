import axios from 'axios';
import { load } from 'cheerio';
import Tesseract from 'tesseract.js';
import pLimit from 'p-limit';
import { TravelAgent } from '../agents/travelAgent';
import { GeminiService } from './gemini.service';
import { GooglePlacesService } from './googlePlaces.service';
import { ApifyInstagramService } from './apifyInstagram.service';
import { YouTubeTranscriptService } from './youtubeTranscript.service';
import { GeminiDirectUrlService } from './geminiDirectUrl.service';
import { VideoCacheModel } from '../models/videoCache.model';
import { API_LIMITS } from '../config/constants';
import {
  extractYouTubeVideoId,
  extractInstagramPostId,
  extractRedditPostInfo,
  isValidUrl,
} from '../utils/helpers';
import {
  ItemSourceType,
  ItemCategory,
  YouTubeVideoData,
  InstagramPostData,
  RedditPostData,
  ProcessedContent,
  DiscoveryIntent,
} from '../types';
import logger from '../config/logger';

export class ContentProcessorService {
  /**
   * Detect content type from URL
   */
  static detectContentType(url: string): ItemSourceType {
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      return ItemSourceType.YOUTUBE;
    } else if (url.includes('instagram.com')) {
      return ItemSourceType.INSTAGRAM;
    } else if (url.includes('reddit.com')) {
      return ItemSourceType.REDDIT;
    } else {
      return ItemSourceType.URL;
    }
  }

  /**
   * Process any URL
   */
  static async processUrl(url: string): Promise<ProcessedContent & { original_content: any }> {
    if (!isValidUrl(url)) {
      throw new Error('Invalid URL');
    }

    const contentType = this.detectContentType(url);

    try {
      let original_content: any;
      let textContent: string;

      switch (contentType) {
        case ItemSourceType.YOUTUBE:
          original_content = await this.fetchYouTubeVideo(url);
          textContent = `Title: ${original_content.title}\nDescription: ${original_content.description}\nTranscript: ${original_content.transcript}`;
          break;

        case ItemSourceType.INSTAGRAM:
          console.log('Fetching Instagram post...');
          original_content = await this.fetchInstagramPost(url);
          console.log('Fetched Instagram content:', JSON.stringify(original_content));
          // Prioritize the caption for location extraction
          textContent = `Instagram Post/Reel\nCaption: ${original_content.caption}\nLocation: ${original_content.location || 'Not specified'}`;
          break;

        case ItemSourceType.REDDIT:
          original_content = await this.fetchRedditPost(url);
          textContent = `Title: ${original_content.title}\nBody: ${original_content.body}\nTop Comments: ${original_content.comments.join(' | ')}`;
          break;

        default:
          original_content = await this.fetchWebPage(url);
          textContent = original_content.text;
          break;
      }

      console.log('Processing content with AI...');
      // Use AI to process and categorize
      const processed = await TravelAgent.processContent(textContent, contentType);
      console.log('AI processing complete');

      return {
        ...processed,
        original_content,
      };
    } catch (error: any) {
      console.error('Detailed error in processUrl:', error);
      logger.error('Error processing URL:', error);
      throw new Error(`Failed to process ${contentType}: ${error.message}`);
    }
  }

  /**
   * UPDATED: Fetch YouTube video data (No Apify)
   * 
   * Flow:
   * 1. If Short → Gemini Direct URL (skip transcript)
   * 2. If Long-form → Try Transcript API with proxy
   * 3. If no transcript → Fall back to Gemini Direct URL
   */
  private static async fetchYouTubeVideo(url: string): Promise<YouTubeVideoData> {
    const videoId = YouTubeTranscriptService.extractVideoId(url);
    if (!videoId) {
      throw new Error('Invalid YouTube URL');
    }

    // New unified fetch: Get everything (transcript, description, metadata) in one proxy-call
    const videoData = await YouTubeTranscriptService.fetchVideoData(videoId);
    
    // Fallback metadata via oEmbed if scraping failed to get title/author
    if (!videoData.title) {
      const oembed = await YouTubeTranscriptService.fetchMetadata(videoId);
      if (oembed) {
        videoData.title = oembed.title;
        videoData.author = oembed.author;
      }
    }

    // Path 1: YouTube Shorts → Skip transcript, use Gemini Direct URL
    if (YouTubeTranscriptService.isShort(url)) {
      logger.info(`[ContentProcessor] YouTube Short detected → Gemini Direct URL`);
      return {
        title: videoData.title || 'YouTube Short',
        description: videoData.description || '',
        transcript: '', // Empty - will trigger Gemini Direct URL path
        thumbnail_url: videoData.thumbnailUrl || '',
        thumbnail: videoData.thumbnailUrl || '',
        channel: videoData.author || 'Unknown',
        useDirectUrl: true, // Flag for downstream processing
      };
    }

    // Path 2: Long-form video → Use transcript or rich description
    const hasTranscript = videoData.transcript && videoData.transcript.length > 100;
    const hasRichDescription = videoData.description && videoData.description.length > 200;

    if (hasTranscript || hasRichDescription) {
      logger.info(`[ContentProcessor] Got useful text context (Transcript: ${!!hasTranscript}, Desc: ${!!hasRichDescription})`);
      return {
        title: videoData.title || 'YouTube Video',
        description: videoData.description || '',
        transcript: videoData.transcript || '',
        thumbnail_url: videoData.thumbnailUrl || '',
        thumbnail: videoData.thumbnailUrl || '',
        channel: videoData.author || 'Unknown',
        useDirectUrl: false, // Text analysis is good enough
      };
    }

    // Path 3: No useful text → Fall back to Gemini Direct URL (Vision)
    logger.info(`[ContentProcessor] No useful text context → Gemini Direct URL fallback`);
    return {
      title: videoData.title || 'YouTube Video',
      description: videoData.description || '',
      transcript: '',
      thumbnail_url: videoData.thumbnailUrl || '',
      thumbnail: videoData.thumbnailUrl || '',
      channel: videoData.author || 'Unknown',
      useDirectUrl: true,
    };
  }

  private static async fetchInstagramPost(url: string): Promise<InstagramPostData> {
    const postId = extractInstagramPostId(url);
    if (!postId) {
      throw new Error('Invalid Instagram URL');
    }

    try {
      // Strategy 1: Use the embed URL (often less restricted)
      const embedUrl = `https://www.instagram.com/p/${postId}/embed/captioned/`;
      
      // Strategy 2: Try standard URL with headers
      // const directUrl = `https://www.instagram.com/p/${postId}/`;

      const response = await axios.get(embedUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });

      const html = response.data;
      const $ = load(html);

      let caption = '';
      let image = '';
      let location = '';

      // 1. Try meta description (usually contains caption snippet)
      // Format: "Likes, Comments - Account (@handle) on Instagram: "Caption text...""
      const metaDesc = $('meta[name="description"]').attr('content') || ''; // Standard meta
      
      // 2. Try the Caption class (Embed specific)
      const embedCaption = $('.Caption').text() || $('.CaptionUsername').next().text();
      
      // 3. Try extracting from script data (window.__additionalDataLoaded)
      let scriptCaption = '';
      $('script').each((_, el) => {
        const content = $(el).html() || '';
        if (content.includes('window.__additionalDataLoaded')) {
          try {
            const match = content.match(/"caption":\s*"([^"]+)"/);
            if (match && match[1]) {
              scriptCaption = match[1]
                .replace(/\\n/g, '\n')
                .replace(/\\u([\d\w]{4})/gi, (_, grp) => String.fromCharCode(parseInt(grp, 16)));
            }
          } catch (e) { }
        }
      });

      // Prioritize extraction methods
      if (scriptCaption && scriptCaption.length > 10) {
        caption = scriptCaption;
      } else if (embedCaption && embedCaption.length > 10) {
        caption = embedCaption;
      } else if (metaDesc) {
        // Clean up meta description to get just the caption
        // Remove "100 Likes, 5 Comments - " prefix and " on Instagram: "
        const captionMatch = metaDesc.match(/on Instagram: "(.+)"$/);
        if (captionMatch) {
          caption = captionMatch[1];
        } else {
          caption = metaDesc;
        }
      }

      // Clean up caption
      caption = caption.trim();
      
      // Get image
      image = $('img.EmbeddedMediaImage').attr('src') || '';

      return {
        caption: caption || 'Instagram Post',
        images: image ? [image] : [],
        location,
      };
    } catch (error) {
      logger.error('Instagram fetch error:', error);
      return {
        caption: 'Instagram Post',
        images: [],
        location: '',
      };
    }
  }

  private static async fetchRedditPost(url: string): Promise<RedditPostData> {
    const postInfo = extractRedditPostInfo(url);
    if (!postInfo) {
      throw new Error('Invalid Reddit URL');
    }

    try {
      // Use Reddit JSON API
      const jsonUrl = `${url}.json`;
      const response = await axios.get(jsonUrl, {
        headers: {
          'User-Agent': 'TravelAgentApp/1.0',
        },
      });

      const data = response.data;
      const post = data[0]?.data?.children[0]?.data;
      const comments = data[1]?.data?.children || [];

      const title = post?.title || 'Untitled Post';
      const body = post?.selftext || '';

      const topComments = comments
        .slice(0, 5)
        .map((c: any) => c.data?.body)
        .filter((text: string) => text && text.length > 10);

      return {
        title,
        body,
        comments: topComments,
      };
    } catch (error) {
      logger.error('Reddit fetch error:', error);
      throw new Error('Failed to fetch Reddit post');
    }
  }

  /**
   * Fetch general web page content
   */
  private static async fetchWebPage(url: string): Promise<{ title: string; text: string }> {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      const html = response.data;
      const $ = load(html);

      // Remove script and style tags
      $('script, style, nav, header, footer, aside').remove();

      const title =
        $('title').text() || $('meta[property="og:title"]').attr('content') || 'Untitled';

      // Extract main content
      const text =
        $('article').text() || $('main').text() || $('body').text() || '';

      // Clean up text
      const cleanText = text
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 5000);

      return { title, text: cleanText };
    } catch (error) {
      logger.error('Web page fetch error:', error);
      throw new Error('Failed to fetch web page');
    }
  }

  /**
   * Process image with OCR
   */
  static async processImage(
    imageBuffer: Buffer
  ): Promise<ProcessedContent & { original_content: any }> {
    try {
      // Perform OCR
      const result = await Tesseract.recognize(imageBuffer, 'eng', {
        logger: (m) => logger.debug('Tesseract:', m),
      });

      const extractedText = result.data.text;

      if (!extractedText || extractedText.trim().length < 10) {
        throw new Error('Could not extract meaningful text from image');
      }

      // Use AI to process extracted text
      const processed = await TravelAgent.processContent(
        extractedText,
        ItemSourceType.PHOTO
      );

      return {
        ...processed,
        original_content: {
          extractedText,
          confidence: result.data.confidence,
        },
      };
    } catch (error: any) {
      logger.error('Image processing error:', error);
      throw new Error(`Failed to process image: ${error.message}`);
    }
  }

  /**
   * Process text content directly
   */
  static async processText(
    text: string
  ): Promise<ProcessedContent & { original_content: any }> {
    try {
      if (!text || text.trim().length < 10) {
        throw new Error('Text content too short');
      }

      const processed = await TravelAgent.processContent(text, ItemSourceType.TEXT);

      return {
        ...processed,
        original_content: { text },
      };
    } catch (error: any) {
      logger.error('Text processing error:', error);
      throw new Error(`Failed to process text: ${error.message}`);
    }
  }

  /**
   * Process voice/audio transcript
   */
  static async processVoiceTranscript(
    transcript: string
  ): Promise<ProcessedContent & { original_content: any }> {
    try {
      if (!transcript || transcript.trim().length < 10) {
        throw new Error('Transcript too short');
      }

      const processed = await TravelAgent.processContent(
        transcript,
        ItemSourceType.VOICE
      );

      return {
        ...processed,
        original_content: { transcript },
      };
    } catch (error: any) {
      logger.error('Voice processing error:', error);
      throw new Error(`Failed to process voice: ${error.message}`);
    }
  }

  /**
   * Extract multiple places from YouTube video using Gemini
   * Now also extracts:
   * - destination/destination_country for auto-grouping
   * - cuisine_type/place_type for smart sub-clustering
   * - tags for additional insights
   */
  static async extractMultiplePlacesFromVideo(
    url: string
  ): Promise<{
    summary: string;
    video_type?: 'places' | 'howto' | 'guide';
    places: Array<ProcessedContent & { original_content: any; day?: number }>;
    // Guide-specific fields
    itinerary?: Array<{
      day: number;
      title: string;
      places: string[];
    }>;
    destination?: string;
    destination_country?: string;
    duration_days?: number;
    // Guide metadata (for creating Guide record)
    guideMetadata?: {
      title: string;
      creatorName: string;
      creatorChannelId?: string;
      thumbnailUrl?: string;
      hasDayStructure: boolean;
      totalDays: number;
    };
    discovery_intent?: DiscoveryIntent;
  }> {
    try {
      const videoId = extractYouTubeVideoId(url);
      if (!videoId) {
        throw new Error('Invalid YouTube URL');
      }

      // ========== STEP 1: CHECK CACHE ==========
      try {
        const cached = await VideoCacheModel.get(videoId, 'youtube');
        if (cached && cached.places_json) {
          logger.info(`[YouTube] 🎯 CACHE HIT for ${videoId} - returning ${cached.places_json.length} cached places`);
          
          return {
            summary: cached.summary || '',
            video_type: (cached.video_type as 'places' | 'guide' | 'howto') || 'places',
            destination: cached.destination,
            destination_country: cached.destination_country,
            places: cached.places_json,
            guideMetadata: {
              title: cached.title || 'YouTube Video',
              creatorName: cached.channel_name || 'Unknown',
              thumbnailUrl: cached.thumbnail_url,
              hasDayStructure: false,
              totalDays: 0,
            },
            discovery_intent: cached.discovery_intent_json,
          };
        }
      } catch (cacheError: any) {
        logger.warn('[YouTube] Cache lookup failed:', cacheError.message);
        // Continue with processing
      }

      logger.info(`[YouTube] Processing video: ${videoId}`);

      // ========== STEP 2: FETCH VIDEO DATA ==========
      const videoData = await this.fetchYouTubeVideo(url);

      logger.info(`Video: ${videoData.title}`);
      logger.info(`Transcript: ${videoData.transcript?.length || 0} chars, UseDirectUrl: ${videoData.useDirectUrl ? 'YES' : 'NO'}`);

      let analysis;
      
      // ========== STEP 3: ANALYZE CONTENT ==========
      if (videoData.useDirectUrl) {
        // Use Gemini Direct URL analysis
        logger.info('[YouTube] Using Gemini Direct URL analysis');
        const directAnalysis = await GeminiDirectUrlService.analyzeYouTubeVideo(url, {
          title: videoData.title,
          description: videoData.description
        });
        
        analysis = {
          summary: directAnalysis.summary,
          video_type: 'places' as const, // Gemini Direct URL service currently returns places
          destination: directAnalysis.destination,
          destination_country: directAnalysis.destination_country,
          places: directAnalysis.places.map(p => ({
            ...p,
            category: p.category as any,
          })),
          duration_days: undefined,
          itinerary: undefined,
          discovery_intent: undefined,
        };
      } else if (videoData.transcript && videoData.transcript.length > 100) {
        // Best case: We have a transcript - use text-based analysis (fast, cheap)
        logger.info('[YouTube] Using transcript-based analysis');
        analysis = await GeminiService.analyzeVideoMetadata(
          videoData.title,
          videoData.description,
          videoData.transcript
        );
      } else {
        // Fallback: Use Gemini Direct URL if transcript is poor or missing
        logger.info('[YouTube] Poor transcript - falling back to Gemini Direct URL');
        const directAnalysis = await GeminiDirectUrlService.analyzeYouTubeVideo(url, {
          title: videoData.title,
          description: videoData.description
        });

        analysis = {
          summary: directAnalysis.summary,
          video_type: 'places' as const,
          destination: directAnalysis.destination,
          destination_country: directAnalysis.destination_country,
          places: directAnalysis.places.map(p => ({
            ...p,
            category: p.category as any,
          })),
          duration_days: undefined,
          itinerary: undefined,
          discovery_intent: undefined,
        };
      }

      logger.info(`Video type: ${analysis.video_type}`);
      logger.info(`Found ${analysis.places.length} places in video`);

      // Build guide metadata for creating Guide record
      const guideMetadata = {
        title: videoData.title,
        creatorName: videoData.channel || 'Unknown Creator',
        thumbnailUrl: videoData.thumbnail_url,
        hasDayStructure: analysis.video_type === 'guide' && (analysis.duration_days || 0) > 0,
        totalDays: analysis.duration_days || 0,
      };

      // Handle GUIDE/ITINERARY videos - return with preview for user choice
      if (analysis.video_type === 'guide') {
        logger.info(`Guide video detected: ${analysis.duration_days} days in ${analysis.destination}`);

        const processedPlaces = analysis.places.map((place: any) => ({
          name: place.name,
          category: place.category,
          description: place.description,
          location_name: place.location || analysis.destination,
          location_lat: undefined as number | undefined,
          location_lng: undefined as number | undefined,
        source_title: videoData.title,
        day: place.day, // May be undefined for video analysis fallback
        // Sub-categorization
        cuisine_type: place.cuisine_type,
        place_type: place.place_type,
        parent_location: place.parent_location,
        tags: place.tags,
        destination: analysis.destination,
        destination_country: analysis.destination_country,
        original_content: {
          ...videoData,
          video_type: 'guide',
        },
      }));

      // Cache guide results
      try {
        await VideoCacheModel.set({
          videoId,
          platform: 'youtube',
          url,
          title: videoData.title,
          channelName: videoData.channel,
          thumbnailUrl: videoData.thumbnail_url,
          summary: analysis.summary,
          videoType: 'guide',
          destination: analysis.destination,
          destinationCountry: analysis.destination_country,
          parentLocation: undefined, // Guides don't usually have a single parent
          places: processedPlaces,
          discoveryIntent: analysis.discovery_intent,
          expiresInDays: 30,
        });
      } catch (e) { /* ignore cache errors */ }

        return {
          summary: analysis.summary,
          video_type: 'guide',
          places: processedPlaces,
          itinerary: analysis.itinerary,
          destination: analysis.destination,
          destination_country: analysis.destination_country,
          duration_days: analysis.duration_days,
          guideMetadata,
          discovery_intent: analysis.discovery_intent,
        };
      }

      // Handle HOW-TO videos differently
      if (analysis.video_type === 'howto') {
        logger.info('How-to video detected - saving as single guide item');

        return {
          summary: analysis.summary,
          video_type: 'howto',
          destination: analysis.destination,
          destination_country: analysis.destination_country,
          places: [
            {
              name: videoData.title,
              category: ItemCategory.TIP,
              description: analysis.summary,
              location_name: undefined,
              source_title: videoData.title,
              destination: analysis.destination,
              destination_country: analysis.destination_country,
              tags: ['travel tips', 'guide'],
              original_content: {
                ...videoData,
                video_type: 'howto',
              },
            },
          ],
          guideMetadata,
          discovery_intent: analysis.discovery_intent,
        };
      }

      // PLACES video handling
      if (analysis.places.length === 0) {
        // If we have a discovery intent, return it so SmartShare can save to discovery_queue
        if (analysis.discovery_intent) {
          logger.info(`[YouTube] No places found, but found discovery intent: ${analysis.discovery_intent.item} in ${analysis.discovery_intent.city}`);
          
          // Cache even discovery intents (same video = same result)
          try {
            await VideoCacheModel.set({
              videoId,
              platform: 'youtube',
              url,
              title: videoData.title,
              channelName: videoData.channel,
              summary: analysis.summary,
              videoType: 'places',
              destination: analysis.destination,
              destinationCountry: analysis.destination_country,
              places: [],
              discoveryIntent: analysis.discovery_intent,
              expiresInDays: 30,
            });
          } catch (e) { /* ignore cache errors */ }

          // Return empty places with the intent - SmartShare controller will save to discovery_queue
          return {
            summary: analysis.summary,
            video_type: 'places',
            destination: analysis.destination,
            destination_country: analysis.destination_country,
            places: [],
            guideMetadata,
            discovery_intent: analysis.discovery_intent,
          };
        }

        // No places found and no intent, save video as single item with summary
        const processed = await TravelAgent.processContent(
          `${videoData.title}. ${analysis.summary}`,
          ItemSourceType.YOUTUBE
        );

        return {
          summary: analysis.summary,
          video_type: 'places',
          destination: analysis.destination,
          destination_country: analysis.destination_country,
          places: [
            {
              ...processed,
              destination: analysis.destination,
              destination_country: analysis.destination_country,
              original_content: {
                ...videoData,
                video_type: 'places',
              },
            },
          ],
          guideMetadata,
        };
      }

      // Process each place found by Gemini - now with sub-categorization!
      const processedPlaces = analysis.places.map((place) => ({
        name: place.name,
        category: place.category,
        description: place.description,
        location_name: place.location,
        location_lat: undefined as number | undefined,
        location_lng: undefined as number | undefined,
        source_title: videoData.title,
        // Sub-categorization for smart clustering
        cuisine_type: place.cuisine_type,
        place_type: place.place_type,
        parent_location: place.parent_location,
        tags: place.tags,
        destination: analysis.destination,
        destination_country: analysis.destination_country,
        original_content: {
          ...videoData,
          video_type: 'places',
        },
      }));

      // Enrich places with Google Places API data (max concurrent to avoid rate limits)
      logger.info(`🔍 [ENRICH] Starting enrichment for ${processedPlaces.length} YouTube places...`);
      const limit = pLimit(API_LIMITS.GOOGLE_PLACES_CONCURRENT);
      const enrichedPlaces = await Promise.all(
        processedPlaces.map(async (place, index) => {
          return limit(async () => {
            try {
              logger.info(`🔍 [ENRICH] [${index + 1}/${processedPlaces.length}] Enriching "${place.name}" in "${place.location_name}"`);
              const enriched = await GooglePlacesService.enrichPlace(
                place.name,
                place.location_name
              );
              if (enriched) {
                // Validate/enrich AI's sub-type extraction with Google's data
                let finalCuisineType = place.cuisine_type;
                let finalPlaceType = place.place_type;
                
                // If Google has cuisine/place type, use it to validate or fill gaps
                if (enriched.google_cuisine_type) {
                  if (!place.cuisine_type) {
                    finalCuisineType = enriched.google_cuisine_type;
                    logger.info(`🔍 [VALIDATE] Google filled missing cuisine_type: "${enriched.google_cuisine_type}" for "${place.name}"`);
                  } else if (place.cuisine_type !== enriched.google_cuisine_type) {
                    logger.info(`🔍 [VALIDATE] AI said "${place.cuisine_type}", Google says "${enriched.google_cuisine_type}" for "${place.name}" - keeping AI's choice`);
                  } else {
                    logger.info(`✅ [VALIDATE] Google confirms cuisine_type: "${place.cuisine_type}" for "${place.name}"`);
                  }
                }
                
                if (enriched.google_place_type) {
                  if (!place.place_type) {
                    finalPlaceType = enriched.google_place_type;
                    logger.info(`🔍 [VALIDATE] Google filled missing place_type: "${enriched.google_place_type}" for "${place.name}"`);
                  } else if (place.place_type !== enriched.google_place_type) {
                    logger.info(`🔍 [VALIDATE] AI said "${place.place_type}", Google says "${enriched.google_place_type}" for "${place.name}" - keeping AI's choice`);
                  } else {
                    logger.info(`✅ [VALIDATE] Google confirms place_type: "${place.place_type}" for "${place.name}"`);
                  }
                }
                
                logger.info(`✅ [ENRICH] Got data for "${place.name}": Rating=${enriched.rating}, Area=${enriched.area_name}, Photos=${enriched.photos?.length || 0}, Tags=${enriched.google_tags?.length || 0}`);
                return {
                  ...place,
                  google_place_id: enriched.place_id,
                  rating: enriched.rating,
                  user_ratings_total: enriched.user_ratings_total,
                  price_level: enriched.price_level,
                  formatted_address: enriched.formatted_address,
                  area_name: enriched.area_name,
                  photos_json: enriched.photos,
                  opening_hours_json: enriched.opening_hours,
                  location_lat: enriched.geometry?.location.lat || place.location_lat,
                  location_lng: enriched.geometry?.location.lng || place.location_lng,
                  // Use validated sub-types
                  cuisine_type: finalCuisineType,
                  place_type: finalPlaceType,
                  parent_location: place.parent_location,
                  // Add tags from Google
                  tags: enriched.google_tags || [],
                };
              } else {
                logger.warn(`⚠️ [ENRICH] No Google data found for "${place.name}"`);
              }
              return place;
            } catch (error: any) {
              logger.error(`❌ [ENRICH] Failed to enrich "${place.name}":`, error.message);
              return place;
            }
          });
        })
      );
      const enrichedCount = enrichedPlaces.filter((p: any) => p.google_place_id).length;
      logger.info(`🎉 [ENRICH] Complete! ${enrichedCount}/${processedPlaces.length} places enriched with Google data`);

      // Log sub-categorization stats
      const cuisineTypes = [...new Set(enrichedPlaces.filter(p => p.cuisine_type).map(p => p.cuisine_type))];
      const placeTypes = [...new Set(enrichedPlaces.filter(p => p.place_type).map(p => p.place_type))];
      if (cuisineTypes.length > 0) logger.info(`🍽️ Cuisine types: ${cuisineTypes.join(', ')}`);
      if (placeTypes.length > 0) logger.info(`📍 Place types: ${placeTypes.join(', ')}`);

      // ========== SAVE TO CACHE ==========
      try {
        await VideoCacheModel.set({
          videoId,
          platform: 'youtube',
          url,
          title: videoData.title,
          channelName: videoData.channel,
          thumbnailUrl: videoData.thumbnail_url,
          transcript: videoData.transcript,
          summary: analysis.summary,
          videoType: 'places',
          destination: analysis.destination,
          destinationCountry: analysis.destination_country,
          parentLocation: undefined, // Multiple places, no single parent
          places: enrichedPlaces,
          discoveryIntent: analysis.discovery_intent,
          expiresInDays: 30, // Cache for 30 days
        });
      } catch (cacheError: any) {
        logger.warn('[YouTube] Failed to save to cache:', cacheError.message);
        // Don't fail the request if caching fails
      }

      return {
        summary: analysis.summary,
        video_type: 'places',
        destination: analysis.destination,
        destination_country: analysis.destination_country,
        places: enrichedPlaces,
        guideMetadata,
        discovery_intent: analysis.discovery_intent,
      };
    } catch (error: any) {
      logger.error('Error extracting multiple places:', error);
      throw new Error('Failed to extract places from video');
    }
  }

  /**
   * Extract multiple places from Reddit post using Gemini
   * Now also extracts cuisine_type, place_type, tags, and destination
   */
  static async extractMultiplePlacesFromReddit(
    url: string
  ): Promise<{
    summary: string;
    destination?: string;
    destination_country?: string;
    places: Array<ProcessedContent & { original_content: any }>;
  }> {
    try {
      logger.info('Processing Reddit post...');

      // Fetch Reddit post data (title + body + comments)
      const redditData = await this.fetchRedditPost(url);

      logger.info(`Reddit: ${redditData.title}`);
      logger.info(`Comments: ${redditData.comments.length}`);

      // Use Gemini to analyze post and extract ALL places from comments
      const analysis = await GeminiService.analyzeRedditPost(
        redditData.title,
        redditData.body,
        redditData.comments
      );

      logger.info(`Found ${analysis.places.length} places in Reddit post`);
      logger.info(`Destination: ${analysis.destination || 'Unknown'} (${analysis.destination_country || 'Unknown'})`);

      if (analysis.places.length === 0) {
        // No places found, save post as single item with summary
        const processed = await TravelAgent.processContent(
          `${redditData.title}. ${analysis.summary}`,
          ItemSourceType.REDDIT
        );

        return {
          summary: analysis.summary,
          destination: analysis.destination,
          destination_country: analysis.destination_country,
          places: [
            {
              ...processed,
              destination: analysis.destination,
              destination_country: analysis.destination_country,
              original_content: redditData,
            },
          ],
        };
      }

      // Process each place found by Gemini - now with sub-categorization!
      const processedPlaces = analysis.places.map((place) => ({
        name: place.name,
        category: place.category,
        description: place.description,
        location_name: place.location,
        location_lat: undefined as number | undefined,
        location_lng: undefined as number | undefined,
        source_title: `Reddit: ${redditData.title}`,
        // Sub-categorization for smart clustering
        cuisine_type: place.cuisine_type,
        place_type: place.place_type,
        parent_location: place.parent_location,
        tags: place.tags,
        destination: analysis.destination,
        destination_country: analysis.destination_country,
        original_content: redditData,
      }));

      // Enrich places with Google Places API data (max concurrent)
      logger.info(`🔍 [ENRICH] Starting enrichment for ${processedPlaces.length} Reddit places...`);
      const limit = pLimit(API_LIMITS.GOOGLE_PLACES_CONCURRENT);
      const enrichedPlaces = await Promise.all(
        processedPlaces.map(async (place, index) => {
          return limit(async () => {
            try {
              logger.info(`🔍 [ENRICH] [${index + 1}/${processedPlaces.length}] Enriching "${place.name}" in "${place.location_name}"`);
              const enriched = await GooglePlacesService.enrichPlace(
                place.name,
                place.location_name
              );
              if (enriched) {
                // Validate/enrich AI's sub-type extraction with Google's data
                let finalCuisineType = place.cuisine_type;
                let finalPlaceType = place.place_type;
                
                if (enriched.google_cuisine_type && !place.cuisine_type) {
                  finalCuisineType = enriched.google_cuisine_type;
                  logger.info(`🔍 [VALIDATE] Google filled missing cuisine_type: "${enriched.google_cuisine_type}" for "${place.name}"`);
                }
                if (enriched.google_place_type && !place.place_type) {
                  finalPlaceType = enriched.google_place_type;
                  logger.info(`🔍 [VALIDATE] Google filled missing place_type: "${enriched.google_place_type}" for "${place.name}"`);
                }
                
                logger.info(`✅ [ENRICH] Got data for "${place.name}": Rating=${enriched.rating}, Area=${enriched.area_name}, Tags=${enriched.google_tags?.length || 0}`);
                return {
                  ...place,
                  google_place_id: enriched.place_id,
                  rating: enriched.rating,
                  user_ratings_total: enriched.user_ratings_total,
                  price_level: enriched.price_level,
                  formatted_address: enriched.formatted_address,
                  area_name: enriched.area_name,
                  photos_json: enriched.photos,
                  opening_hours_json: enriched.opening_hours,
                  location_lat: enriched.geometry?.location.lat || place.location_lat,
                  location_lng: enriched.geometry?.location.lng || place.location_lng,
                  cuisine_type: finalCuisineType,
                  place_type: finalPlaceType,
                  parent_location: place.parent_location,
                  tags: enriched.google_tags || [],
                  original_content: place.original_content,
                };
              } else {
                logger.warn(`⚠️ [ENRICH] No Google data found for "${place.name}"`);
              }
              return place;
            } catch (error: any) {
              logger.error(`❌ [ENRICH] Failed to enrich "${place.name}":`, error.message);
              return place;
            }
          });
        })
      );
      const enrichedCount = enrichedPlaces.filter((p: any) => p.google_place_id).length;
      logger.info(`🎉 [ENRICH] Complete! ${enrichedCount}/${processedPlaces.length} Reddit places enriched`);

      return {
        summary: analysis.summary,
        destination: analysis.destination,
        destination_country: analysis.destination_country,
        places: enrichedPlaces,
      };
    } catch (error: any) {
      logger.error('Error extracting places from Reddit:', error);
      throw new Error('Failed to extract places from Reddit post');
    }
  }

  /**
   * Extract multiple places from Instagram post/reel using Apify + Gemini 2.5 Video Analysis
   * Now also extracts cuisine_type, place_type, tags, and destination
   * 
   * Pipeline:
   * 1. CHECK CACHE first (same reel = instant results)
   * 2. Apify scrapes Instagram (handles anti-bot, gets video URL)
   * 3. For Reels: Download video → Gemini 2.5 multimodal analysis (sees + hears content)
   * 4. For Posts: Gemini analyzes caption + image
   * 5. Google Places enriches with ratings, photos, hours
   * 6. SAVE TO CACHE for future users
   */
  static async extractMultiplePlacesFromInstagram(
    url: string
  ): Promise<{
    summary: string;
    destination?: string;
    destination_country?: string;
    places: Array<ProcessedContent & { original_content: any }>;
  }> {
    try {
      // Extract Instagram post ID for caching
      const postId = extractInstagramPostId(url);
      
      // ========== CHECK CACHE FIRST ==========
      if (postId) {
        try {
          const cached = await VideoCacheModel.get(postId, 'instagram');
          if (cached && cached.places_json) {
            logger.info(`[Instagram] 🎯 CACHE HIT for ${postId} - returning ${cached.places_json.length} cached places`);
            return {
              summary: cached.summary || '',
              destination: cached.destination,
              destination_country: cached.destination_country,
              places: cached.places_json,
            };
          }
        } catch (cacheError: any) {
          logger.warn('[Instagram] Cache lookup failed:', cacheError.message);
        }
      }

      logger.info('🎬 [Instagram] Processing with Apify + Gemini 2.5 pipeline...');

      // Check if Apify is configured
      if (ApifyInstagramService.isConfigured()) {
        logger.info('✅ [Instagram] Apify configured - using enhanced pipeline');
        
        const result = await ApifyInstagramService.extractPlacesFromInstagram(url);
        
        logger.info(`🎉 [Instagram] Extracted ${result.places.length} places via Apify pipeline`);
        
        const places = result.places.map(place => ({
          ...place,
          source_title: result.source_title,
          parent_location: place.parent_location,
          original_content: { url },
        }));

        // ========== SAVE TO CACHE ==========
        if (postId) {
          try {
            await VideoCacheModel.set({
              videoId: postId,
              platform: 'instagram',
              url,
              title: result.source_title,
              summary: result.summary,
              destination: result.destination,
              destinationCountry: result.destination_country,
              parentLocation: undefined,
              places,
              expiresInDays: 30,
            });
          } catch (cacheError: any) {
            logger.warn('[Instagram] Failed to save to cache:', cacheError.message);
          }
        }
        
        return {
          summary: result.summary,
          destination: result.destination,
          destination_country: result.destination_country,
          places,
        };
      }

      // Fallback to basic scraping if Apify not configured
      logger.warn('⚠️ [Instagram] Apify not configured, using basic fallback...');
      
      // Fetch Instagram data using basic method
      const instaData = await this.fetchInstagramPost(url);

      logger.info(`Instagram Caption Length: ${instaData.caption.length}`);

      // Use Gemini to analyze caption and extract places
      const analysis = await GeminiService.analyzeInstagramPost(
        instaData.caption,
        instaData.images[0]
      );

      logger.info(`Found ${analysis.places.length} places in Instagram post`);
      logger.info(`Destination: ${analysis.destination || 'Unknown'} (${analysis.destination_country || 'Unknown'})`);

      if (analysis.places.length === 0) {
        const processed = await TravelAgent.processContent(
          `${analysis.summary} (Source: Instagram)`,
          ItemSourceType.INSTAGRAM
        );

        return {
          summary: analysis.summary,
          destination: analysis.destination,
          destination_country: analysis.destination_country,
          places: [
            {
              ...processed,
              destination: analysis.destination,
              destination_country: analysis.destination_country,
              original_content: instaData,
            },
          ],
        };
      }

      // Process and enrich places - now with sub-categorization!
      const processedPlaces = analysis.places.map((place) => ({
        name: place.name,
        category: place.category,
        description: place.description,
        location_name: place.location,
        location_lat: undefined as number | undefined,
        location_lng: undefined as number | undefined,
        source_title: 'Instagram Discovery',
        // Sub-categorization for smart clustering
        cuisine_type: place.cuisine_type,
        place_type: place.place_type,
        parent_location: place.parent_location,
        tags: place.tags,
        destination: analysis.destination,
        destination_country: analysis.destination_country,
        original_content: instaData,
      }));

      // Enrich places with Google Places API data (max concurrent)
      logger.info(`🔍 [ENRICH] Starting enrichment for ${processedPlaces.length} Instagram places...`);
      const limit = pLimit(API_LIMITS.GOOGLE_PLACES_CONCURRENT);
      const enrichedPlaces = await Promise.all(
        processedPlaces.map(async (place, index) => {
          return limit(async () => {
            try {
              logger.info(`🔍 [ENRICH] [${index + 1}/${processedPlaces.length}] Enriching "${place.name}" in "${place.location_name}"`);
              const enriched = await GooglePlacesService.enrichPlace(
                place.name,
                place.location_name
              );
              if (enriched) {
                // Validate/enrich AI's sub-type extraction with Google's data
                let finalCuisineType = place.cuisine_type;
                let finalPlaceType = place.place_type;
                
                if (enriched.google_cuisine_type && !place.cuisine_type) {
                  finalCuisineType = enriched.google_cuisine_type;
                  logger.info(`🔍 [VALIDATE] Google filled missing cuisine_type: "${enriched.google_cuisine_type}" for "${place.name}"`);
                }
                if (enriched.google_place_type && !place.place_type) {
                  finalPlaceType = enriched.google_place_type;
                  logger.info(`🔍 [VALIDATE] Google filled missing place_type: "${enriched.google_place_type}" for "${place.name}"`);
                }
                
                logger.info(`✅ [ENRICH] Got data for "${place.name}": Rating=${enriched.rating}, Area=${enriched.area_name}, Tags=${enriched.google_tags?.length || 0}`);
                return {
                  ...place,
                  google_place_id: enriched.place_id,
                  rating: enriched.rating,
                  user_ratings_total: enriched.user_ratings_total,
                  price_level: enriched.price_level,
                  formatted_address: enriched.formatted_address,
                  area_name: enriched.area_name,
                  photos_json: enriched.photos,
                  opening_hours_json: enriched.opening_hours,
                  location_lat: enriched.geometry?.location.lat || place.location_lat,
                  location_lng: enriched.geometry?.location.lng || place.location_lng,
                  cuisine_type: finalCuisineType,
                  place_type: finalPlaceType,
                  parent_location: place.parent_location,
                  tags: enriched.google_tags || [],
                  original_content: place.original_content,
                };
              } else {
                logger.warn(`⚠️ [ENRICH] No Google data found for "${place.name}"`);
              }
              return place;
            } catch (error: any) {
              logger.error(`❌ [ENRICH] Failed to enrich "${place.name}":`, error.message);
              return place;
            }
          });
        })
      );
      const enrichedCount = enrichedPlaces.filter((p: any) => p.google_place_id).length;
      logger.info(`🎉 [ENRICH] Complete! ${enrichedCount}/${processedPlaces.length} Instagram places enriched`);

      return {
        summary: analysis.summary,
        destination: analysis.destination,
        destination_country: analysis.destination_country,
        places: enrichedPlaces,
      };
    } catch (error: any) {
      logger.error('Error extracting places from Instagram:', error);
      throw new Error('Failed to extract places from Instagram post');
    }
  }
}