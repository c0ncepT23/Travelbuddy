import axios from 'axios';
import { load } from 'cheerio';
import Tesseract from 'tesseract.js';
import { TravelAgent } from '../agents/travelAgent';
import { GeminiService } from './gemini.service';
import { GooglePlacesService } from './googlePlaces.service';
import { ApifyInstagramService } from './apifyInstagram.service';
import { YtDlpService } from './ytdlp.service';
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
  static async processUrl(url: string): Promise<ProcessedContent & { originalContent: any }> {
    if (!isValidUrl(url)) {
      throw new Error('Invalid URL');
    }

    const contentType = this.detectContentType(url);

    try {
      let originalContent: any;
      let textContent: string;

      switch (contentType) {
        case ItemSourceType.YOUTUBE:
          originalContent = await this.fetchYouTubeVideo(url);
          textContent = `Title: ${originalContent.title}\nDescription: ${originalContent.description}\nTranscript: ${originalContent.transcript}`;
          break;

        case ItemSourceType.INSTAGRAM:
          console.log('Fetching Instagram post...');
          originalContent = await this.fetchInstagramPost(url);
          console.log('Fetched Instagram content:', JSON.stringify(originalContent));
          // Prioritize the caption for location extraction
          textContent = `Instagram Post/Reel\nCaption: ${originalContent.caption}\nLocation: ${originalContent.location || 'Not specified'}`;
          break;

        case ItemSourceType.REDDIT:
          originalContent = await this.fetchRedditPost(url);
          textContent = `Title: ${originalContent.title}\nBody: ${originalContent.body}\nTop Comments: ${originalContent.comments.join(' | ')}`;
          break;

        default:
          originalContent = await this.fetchWebPage(url);
          textContent = originalContent.text;
          break;
      }

      console.log('Processing content with AI...');
      // Use AI to process and categorize
      const processed = await TravelAgent.processContent(textContent, contentType);
      console.log('AI processing complete');

      return {
        ...processed,
        originalContent,
      };
    } catch (error: any) {
      console.error('Detailed error in processUrl:', error);
      logger.error('Error processing URL:', error);
      throw new Error(`Failed to process ${contentType}: ${error.message}`);
    }
  }

  /**
   * Fetch YouTube video data using yt-dlp (most reliable method)
   * Falls back to Apify if yt-dlp is blocked by YouTube
   * Final fallback to oEmbed API for basic metadata
   */
  private static async fetchYouTubeVideo(url: string): Promise<YouTubeVideoData> {
    const videoId = extractYouTubeVideoId(url);
    if (!videoId) {
      throw new Error('Invalid YouTube URL');
    }

    // Strategy 1: Try Apify first (Most reliable in production/Railway)
    // It handles proxy rotation and bot detection which yt-dlp struggles with in data centers
    try {
      const { ApifyYoutubeService } = await import('./apifyYoutube.service');
      
      if (ApifyYoutubeService.isConfigured()) {
        logger.info(`[ContentProcessor] Fetching YouTube via Apify: ${videoId}`);
        const apifyResult = await ApifyYoutubeService.getVideoTranscript(url);
        
        if (apifyResult) {
          logger.info(`[ContentProcessor] Apify success: "${apifyResult.title}"`);
          return {
            title: apifyResult.title,
            description: apifyResult.description || '',
            transcript: apifyResult.transcript || '',
            thumbnail_url: apifyResult.thumbnailUrl,
            thumbnail: apifyResult.thumbnailUrl,
            channel: apifyResult.channelName,
          };
        }
      }
    } catch (apifyError: any) {
      logger.error('[ContentProcessor] Apify error:', apifyError.message);
      // Fall through to yt-dlp
    }

    // Strategy 2: Try yt-dlp (Great for local dev, but often blocked on Railway)
    try {
      logger.info(`[ContentProcessor] Trying yt-dlp fallback: ${videoId}`);
      const videoData = await YtDlpService.getVideoData(url);

      return {
        title: videoData.title,
        description: videoData.description,
        transcript: videoData.transcript,
        thumbnail_url: videoData.thumbnailUrl,
        thumbnail: videoData.thumbnailUrl,
        channel: videoData.channelName,
      };
    } catch (error: any) {
      logger.warn('[ContentProcessor] yt-dlp fallback failed:', error.message);
    }

    // Strategy 3: Final fallback to oEmbed (Always works for metadata, but NO transcript)
    logger.info('[ContentProcessor] Falling back to oEmbed API');
    return await this.fetchYouTubeWithOembed(videoId);
  }

  /**
   * Final fallback: Fetch basic YouTube metadata using oEmbed API
   * Used when both yt-dlp and Apify fail
   */
  private static async fetchYouTubeWithOembed(videoId: string): Promise<YouTubeVideoData> {
    try {
      logger.info(`[ContentProcessor] Using oEmbed for: ${videoId}`);
      
      const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
      const response = await axios.get(oembedUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });
      
      const data = response.data;
      logger.info(`[ContentProcessor] oEmbed success: "${data.title}" by ${data.author_name}`);
      
      return {
        title: data.title || 'YouTube Video',
        description: '', // oEmbed doesn't provide description
        transcript: '', // No transcript - will trigger video analysis
        thumbnail_url: data.thumbnail_url || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        thumbnail: data.thumbnail_url || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        channel: data.author_name || 'Unknown',
      };
    } catch (oembedError: any) {
      logger.error('[ContentProcessor] oEmbed also failed:', oembedError.message);
      
      // Ultimate fallback: Return minimal data to trigger video analysis
      return {
        title: 'YouTube Video',
        description: '',
        transcript: '',
        thumbnail_url: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        channel: 'Unknown',
      };
    }
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
  ): Promise<ProcessedContent & { originalContent: any }> {
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
        originalContent: {
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
  ): Promise<ProcessedContent & { originalContent: any }> {
    try {
      if (!text || text.trim().length < 10) {
        throw new Error('Text content too short');
      }

      const processed = await TravelAgent.processContent(text, ItemSourceType.TEXT);

      return {
        ...processed,
        originalContent: { text },
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
  ): Promise<ProcessedContent & { originalContent: any }> {
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
        originalContent: { transcript },
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
    places: Array<ProcessedContent & { originalContent: any; day?: number }>;
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
      logger.info('Processing YouTube video metadata...');

      // Fetch video metadata (title + description)
      const videoData = await this.fetchYouTubeVideo(url);

      logger.info(`Video: ${videoData.title}`);
      logger.info(`Transcript length: ${videoData.transcript.length} characters`);

      let analysis;
      
      // Smart decision: Use video analysis if no good transcript available
      const hasGoodTranscript = videoData.transcript && videoData.transcript.length > 100;
      
      if (hasGoodTranscript) {
        // Use text-based analysis (cheaper, faster)
        logger.info('[YouTube] Using transcript-based analysis');
        analysis = await GeminiService.analyzeVideoMetadata(
          videoData.title,
          videoData.description,
          videoData.transcript
        );
      } else {
        // Fallback to video analysis (for silent/music videos with burned-in subtitles)
        logger.info('[YouTube] No transcript - falling back to VIDEO analysis');
        try {
          // Get direct video URL from yt-dlp (we need the actual video file URL)
          const { YtDlpService } = await import('./ytdlp.service');
          const videoFileUrl = await YtDlpService.getVideoDownloadUrl(url);
          
          if (videoFileUrl) {
            const videoAnalysis = await GeminiService.analyzeVideoContent(videoFileUrl, {
              platform: 'youtube',
              title: videoData.title,
              caption: videoData.description,
            });
            
            // Convert to expected format
            analysis = {
              summary: videoAnalysis.summary,
              video_type: videoAnalysis.video_type,
              destination: videoAnalysis.destination,
              destination_country: videoAnalysis.destination_country,
              places: videoAnalysis.places.map(p => ({
                ...p,
                category: p.category as any,
              })),
              duration_days: undefined,
              itinerary: undefined,
            };
          } else {
            // Double fallback: use title/description only
            logger.warn('[YouTube] Could not get video URL, using metadata only');
            analysis = await GeminiService.analyzeVideoMetadata(
              videoData.title,
              videoData.description,
              ''
            );
          }
        } catch (videoError: any) {
          logger.error('[YouTube] Video analysis failed, using metadata only:', videoError.message);
          analysis = await GeminiService.analyzeVideoMetadata(
            videoData.title,
            videoData.description,
            ''
          );
        }
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
          tags: place.tags,
          destination: analysis.destination,
          destination_country: analysis.destination_country,
          originalContent: {
            ...videoData,
            video_type: 'guide',
          },
        }));

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
              originalContent: {
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
              originalContent: {
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
        tags: place.tags,
        destination: analysis.destination,
        destination_country: analysis.destination_country,
        originalContent: {
          ...videoData,
          video_type: 'places',
        },
      }));

      // Enrich places with Google Places API data
      logger.info(`🔍 [ENRICH] Starting enrichment for ${processedPlaces.length} YouTube places...`);
      const enrichedPlaces = await Promise.all(
        processedPlaces.map(async (place, index) => {
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
        })
      );
      const enrichedCount = enrichedPlaces.filter((p: any) => p.google_place_id).length;
      logger.info(`🎉 [ENRICH] Complete! ${enrichedCount}/${processedPlaces.length} places enriched with Google data`);

      // Log sub-categorization stats
      const cuisineTypes = [...new Set(enrichedPlaces.filter(p => p.cuisine_type).map(p => p.cuisine_type))];
      const placeTypes = [...new Set(enrichedPlaces.filter(p => p.place_type).map(p => p.place_type))];
      if (cuisineTypes.length > 0) logger.info(`🍽️ Cuisine types: ${cuisineTypes.join(', ')}`);
      if (placeTypes.length > 0) logger.info(`📍 Place types: ${placeTypes.join(', ')}`);

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
    places: Array<ProcessedContent & { originalContent: any }>;
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
              originalContent: redditData,
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
        tags: place.tags,
        destination: analysis.destination,
        destination_country: analysis.destination_country,
        originalContent: redditData,
      }));

      // Enrich places with Google Places API data
      logger.info(`🔍 [ENRICH] Starting enrichment for ${processedPlaces.length} Reddit places...`);
      const enrichedPlaces = await Promise.all(
        processedPlaces.map(async (place, index) => {
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
   * 1. Apify scrapes Instagram (handles anti-bot, gets video URL)
   * 2. For Reels: Download video → Gemini 2.5 multimodal analysis (sees + hears content)
   * 3. For Posts: Gemini analyzes caption + image
   * 4. Google Places enriches with ratings, photos, hours
   */
  static async extractMultiplePlacesFromInstagram(
    url: string
  ): Promise<{
    summary: string;
    destination?: string;
    destination_country?: string;
    places: Array<ProcessedContent & { originalContent: any }>;
  }> {
    try {
      logger.info('🎬 [Instagram] Processing with Apify + Gemini 2.5 pipeline...');

      // Check if Apify is configured
      if (ApifyInstagramService.isConfigured()) {
        logger.info('✅ [Instagram] Apify configured - using enhanced pipeline');
        
        const result = await ApifyInstagramService.extractPlacesFromInstagram(url);
        
        logger.info(`🎉 [Instagram] Extracted ${result.places.length} places via Apify pipeline`);
        
        return {
          summary: result.summary,
          places: result.places.map(place => ({
            ...place,
            source_title: result.source_title,
          })),
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
              originalContent: instaData,
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
        tags: place.tags,
        destination: analysis.destination,
        destination_country: analysis.destination_country,
        originalContent: instaData,
      }));

      // Enrich places with Google Places API data
      logger.info(`🔍 [ENRICH] Starting enrichment for ${processedPlaces.length} Instagram places...`);
      const enrichedPlaces = await Promise.all(
        processedPlaces.map(async (place, index) => {
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