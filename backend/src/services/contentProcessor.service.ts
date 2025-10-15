import axios from 'axios';
import { load } from 'cheerio';
import Tesseract from 'tesseract.js';
import { TravelAgent } from '../agents/travelAgent';
import { GeminiService } from './gemini.service';
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
          originalContent = await this.fetchInstagramPost(url);
          textContent = `Caption: ${originalContent.caption}\nLocation: ${originalContent.location || 'Not specified'}`;
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

      // Use AI to process and categorize
      const processed = await TravelAgent.processContent(textContent, contentType);

      return {
        ...processed,
        originalContent,
      };
    } catch (error: any) {
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
      
      // Get video info
      const videoInfo = await youtube.getInfo(videoId);
      
      const title = videoInfo.basic_info.title || 'Untitled Video';
      const description = videoInfo.basic_info.short_description || '';
      const thumbnailUrl = videoInfo.basic_info.thumbnail?.[0]?.url || 
        `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

      // NEW: Fetch ACTUAL transcript from video captions
      let transcript = '';
      try {
        logger.info(`Fetching transcript for video ${videoId}...`);
        
        const transcriptData = await videoInfo.getTranscript();
        
        if (transcriptData && transcriptData.transcript) {
          const segments = transcriptData.transcript.content?.body?.initial_segments;
          
          if (segments && segments.length > 0) {
            // Combine all transcript segments with timestamps
            transcript = segments
              .map((segment: any) => {
                const startMs = segment.start_ms || 0;
                const timestamp = this.formatTimestamp(startMs);
                const text = segment.snippet?.text || '';
                return `[${timestamp}] ${text}`;
              })
              .join(' ');
            
            logger.info(`✅ Transcript fetched: ${transcript.length} characters`);
          }
        }
      } catch (transcriptError: any) {
        logger.warn(`No transcript available for ${videoId}: ${transcriptError.message}`);
        // Fallback to description if transcript unavailable
        transcript = description || '';
      }

      // If we still don't have content, use title at minimum
      if (!transcript || transcript.trim().length === 0) {
        transcript = description || title;
        logger.warn('Using description/title as transcript fallback');
      }

      logger.info(`Extracted video: ${title.substring(0, 50)}...`);
      logger.info(`Description length: ${description.length} characters`);
      logger.info(`Transcript length: ${transcript.length} characters`);

      return {
        title,
        description,
        transcript,
        thumbnail_url: thumbnailUrl,
      };
    } catch (error: any) {
      logger.error('YouTube fetch error:', error);
      throw new Error(`Failed to fetch YouTube video: ${error.message}`);
    }
  }

  /**
   * Format milliseconds to MM:SS timestamp
   */
  private static formatTimestamp(milliseconds: number): string {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  /**
   * Fetch Instagram post data
   */
  private static async fetchInstagramPost(url: string): Promise<InstagramPostData> {
    const postId = extractInstagramPostId(url);
    if (!postId) {
      throw new Error('Invalid Instagram URL');
    }

    try {
      // Note: Instagram requires authentication for API access
      // For MVP, we'll extract basic data from public pages

      const response = await axios.get(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      const html = response.data;
      const $ = load(html);

      const caption =
        $('meta[property="og:title"]').attr('content') || 'No caption available';

      const image = $('meta[property="og:image"]').attr('content') || '';

      const location = $('meta[property="og:location"]').attr('content') || '';

      return {
        caption,
        images: image ? [image] : [],
        location,
      };
    } catch (error) {
      logger.error('Instagram fetch error:', error);
      throw new Error('Failed to fetch Instagram post');
    }
  }

  /**
   * Fetch Reddit post data
   */
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
    video_type?: 'places' | 'howto';
    places: Array<ProcessedContent & { originalContent: any }>;
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
        source_title: videoData.title,
        originalContent: {
          ...videoData,
          video_type: 'places',
        },
      }));

      return {
        summary: analysis.summary,
        video_type: 'places',
        places: processedPlaces,
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
        source_title: `Reddit: ${redditData.title}`,
        originalContent: redditData,
      }));

      return {
        summary: analysis.summary,
        places: processedPlaces,
      };
    } catch (error: any) {
      logger.error('Error extracting places from Reddit:', error);
      throw new Error('Failed to extract places from Reddit post');
    }
  }
}

