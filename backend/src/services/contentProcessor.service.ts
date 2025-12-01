import axios from 'axios';
import { load } from 'cheerio';
import Tesseract from 'tesseract.js';
import { TravelAgent } from '../agents/travelAgent';
import { GeminiService } from './gemini.service';
import { GooglePlacesService } from './googlePlaces.service';
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
} from '../types';
import logger from '../config/logger';

type YouTubeModule = typeof import('youtubei.js');

const loadYouTubeModule = async (): Promise<YouTubeModule> => {
  const dynamicImport = new Function('specifier', 'return import(specifier);');
  return dynamicImport('youtubei.js') as Promise<YouTubeModule>;
};

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
   * Fetch YouTube video data with REAL transcripts using Innertube
   */
  private static async fetchYouTubeVideo(url: string): Promise<YouTubeVideoData> {
    const videoId = extractYouTubeVideoId(url);
    if (!videoId) {
      throw new Error('Invalid YouTube URL');
    }

    try {
      logger.info(`Fetching video info and transcript for ${videoId}...`);

      // Initialize Innertube (dynamic import for ESM module)
      const ytModule = await loadYouTubeModule();
      const Innertube = ytModule.Innertube || (ytModule as any).default?.Innertube;
      if (!Innertube) {
        throw new Error('Failed to load youtubei.js module (Innertube not found)');
      }
      const youtube = await Innertube.create();

      const videoInfo = await youtube.getInfo(videoId);

      let transcript = '';
      try {
        const transcriptData = await videoInfo.getTranscript();
        if (transcriptData?.transcript?.content?.body?.initial_segments) {
          transcript = transcriptData.transcript.content.body.initial_segments
            .map((segment: any) => segment.snippet.text)
            .join(' ');
        }
      } catch (e) {
        logger.warn('Could not fetch transcript for video', videoId);
      }

      return {
        title: videoInfo.basic_info.title || '',
        description: videoInfo.basic_info.short_description || '',
        transcript,
        thumbnail_url: videoInfo.basic_info.thumbnail?.[0]?.url || '',
        thumbnail: videoInfo.basic_info.thumbnail?.[0]?.url || '',
        channel: videoInfo.basic_info.channel?.name || '',
      };
    } catch (error) {
      logger.error('YouTube fetch error:', error);
      throw new Error('Failed to fetch YouTube video');
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
   * Extract multiple places from YouTube video using Gemini (NEW!)
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
    duration_days?: number;
  }> {
    try {
      logger.info('Processing YouTube video metadata...');

      // Fetch video metadata (title + description)
      const videoData = await this.fetchYouTubeVideo(url);

      logger.info(`Video: ${videoData.title}`);
      logger.info(`Transcript length: ${videoData.transcript.length} characters`);

      // Use Gemini to analyze with REAL TRANSCRIPT (not just description!)
      const analysis = await GeminiService.analyzeVideoMetadata(
        videoData.title,
        videoData.description,
        videoData.transcript  // ✅ NOW USING REAL TRANSCRIPT!
      );

      logger.info(`Video type: ${analysis.video_type}`);
      logger.info(`Found ${analysis.places.length} places in video`);

      // Handle GUIDE/ITINERARY videos - return with preview for user choice
      if (analysis.video_type === 'guide') {
        logger.info(`Guide video detected: ${analysis.duration_days} days in ${analysis.destination}`);

        const processedPlaces = analysis.places.map((place) => ({
          name: place.name,
          category: place.category,
          description: place.description,
          location_name: place.location || analysis.destination,
          location_lat: undefined as number | undefined,
          location_lng: undefined as number | undefined,
          source_title: videoData.title,
          day: place.day,
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
          duration_days: analysis.duration_days,
        };
      }

      // Handle HOW-TO videos differently
      if (analysis.video_type === 'howto') {
        logger.info('How-to video detected - saving as single guide item');

        return {
          summary: analysis.summary,
          video_type: 'howto',
          places: [
            {
              name: videoData.title,
              category: ItemCategory.TIP,
              description: analysis.summary,
              location_name: undefined,
              source_title: videoData.title,
              originalContent: {
                ...videoData,
                video_type: 'howto',
              },
            },
          ],
        };
      }

      // PLACES video handling
      if (analysis.places.length === 0) {
        // No places found, save video as single item with summary
        const processed = await TravelAgent.processContent(
          `${videoData.title}. ${analysis.summary}`,
          ItemSourceType.YOUTUBE
        );

        return {
          summary: analysis.summary,
          video_type: 'places',
          places: [
            {
              ...processed,
              originalContent: {
                ...videoData,
                video_type: 'places',
              },
            },
          ],
        };
      }

      // Process each place found by Gemini
      const processedPlaces = analysis.places.map((place) => ({
        name: place.name,
        category: place.category,
        description: place.description,
        location_name: place.location,
        location_lat: undefined as number | undefined,
        location_lng: undefined as number | undefined,
        source_title: videoData.title,
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
              logger.info(`✅ [ENRICH] Got data for "${place.name}": Rating=${enriched.rating}, Area=${enriched.area_name}, Photos=${enriched.photos?.length || 0}`);
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

      return {
        summary: analysis.summary,
        video_type: 'places',
        places: enrichedPlaces,
      };
    } catch (error: any) {
      logger.error('Error extracting multiple places:', error);
      throw new Error('Failed to extract places from video');
    }
  }

  /**
   * Extract multiple places from Reddit post using Gemini (NEW!)
   */
  static async extractMultiplePlacesFromReddit(
    url: string
  ): Promise<{
    summary: string;
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

      if (analysis.places.length === 0) {
        // No places found, save post as single item with summary
        const processed = await TravelAgent.processContent(
          `${redditData.title}. ${analysis.summary}`,
          ItemSourceType.REDDIT
        );

        return {
          summary: analysis.summary,
          places: [
            {
              ...processed,
              originalContent: redditData,
            },
          ],
        };
      }

      // Process each place found by Gemini
      const processedPlaces = analysis.places.map((place) => ({
        name: place.name,
        category: place.category,
        description: place.description,
        location_name: place.location,
        location_lat: undefined as number | undefined,
        location_lng: undefined as number | undefined,
        source_title: `Reddit: ${redditData.title}`,
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
              logger.info(`✅ [ENRICH] Got data for "${place.name}": Rating=${enriched.rating}, Area=${enriched.area_name}`);
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
        places: enrichedPlaces,
      };
    } catch (error: any) {
      logger.error('Error extracting places from Reddit:', error);
      throw new Error('Failed to extract places from Reddit post');
    }
  }

  /**
   * Extract multiple places from Instagram post/reel using Gemini (NEW!)
   */
  static async extractMultiplePlacesFromInstagram(
    url: string
  ): Promise<{
    summary: string;
    places: Array<ProcessedContent & { originalContent: any }>;
  }> {
    try {
      logger.info('Processing Instagram post...');

      // Fetch Instagram data
      const instaData = await this.fetchInstagramPost(url);

      logger.info(`Instagram Caption Length: ${instaData.caption.length}`);
      logger.info(`Instagram Caption Content: "${instaData.caption}"`);

      // Use Gemini to analyze caption and extract places
      const analysis = await GeminiService.analyzeInstagramPost(
        instaData.caption,
        instaData.images[0] // Pass image URL if available (future enhancement: process image)
      );

      logger.info(`Found ${analysis.places.length} places in Instagram post`);

      if (analysis.places.length === 0) {
        // No places found, save as single item with summary
        const processed = await TravelAgent.processContent(
          `${analysis.summary} (Source: Instagram)`,
          ItemSourceType.INSTAGRAM
        );

        return {
          summary: analysis.summary,
          places: [
            {
              ...processed,
              originalContent: instaData,
            },
          ],
        };
      }

      // Process each place found by Gemini
      const processedPlaces = analysis.places.map((place) => ({
        name: place.name,
        category: place.category,
        description: place.description,
        location_name: place.location,
        location_lat: undefined as number | undefined,
        location_lng: undefined as number | undefined,
        source_title: 'Instagram Discovery',
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
              logger.info(`✅ [ENRICH] Got data for "${place.name}": Rating=${enriched.rating}, Area=${enriched.area_name}`);
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
        places: enrichedPlaces,
      };
    } catch (error: any) {
      logger.error('Error extracting places from Instagram:', error);
      throw new Error('Failed to extract places from Instagram post');
    }
  }
}
