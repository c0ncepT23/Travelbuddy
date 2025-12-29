/**
 * Apify YouTube Service
 * 
 * Uses Apify actors to scrape YouTube videos when yt-dlp is blocked.
 * Provides transcript extraction, metadata, and video download capabilities.
 */

import axios from 'axios';
import { config } from '../config/env';
import logger from '../config/logger';

// Apify API configuration
const APIFY_API_BASE = 'https://api.apify.com/v2';

// YouTube actors on Apify (free, no monthly fee)
// Transcript: https://apify.com/pintostudio/youtube-transcript-scraper
// Fallback: https://apify.com/starvibe/youtube-video-transcript
// Video Download: https://apify.com/streamers/youtube-video-downloader
const YOUTUBE_TRANSCRIPT_ACTOR = 'pintostudio~youtube-transcript-scraper';
const YOUTUBE_SCRAPER_ACTOR = 'starvibe~youtube-video-transcript';
const YOUTUBE_DOWNLOADER_ACTOR = 'streamers~youtube-video-downloader';

interface YouTubeTranscriptResult {
  videoId: string;
  title: string;
  channelName: string;
  transcript: string;
  thumbnailUrl: string;
  description?: string;
}

interface ApifyTranscriptResponse {
  videoId: string;
  title?: string;
  channelName?: string;
  channelId?: string;
  thumbnailUrl?: string;
  transcript?: string;
  subtitles?: Array<{
    text: string;
    start: number;
    duration: number;
  }>;
}

export class ApifyYoutubeService {
  private static readonly APIFY_TOKEN = config.apify.token;

  /**
   * Check if Apify is configured
   */
  static isConfigured(): boolean {
    return !!this.APIFY_TOKEN;
  }

  /**
   * Extract video ID from YouTube URL
   */
  static extractVideoId(url: string): string | null {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  }

  /**
   * Scrape YouTube video transcript using Apify
   */
  static async getVideoTranscript(url: string): Promise<YouTubeTranscriptResult | null> {
    if (!this.APIFY_TOKEN) {
      logger.warn('[ApifyYoutube] Token not configured');
      return null;
    }

    const videoId = this.extractVideoId(url);
    if (!videoId) {
      throw new Error('Invalid YouTube URL');
    }

    try {
      logger.info(`[ApifyYoutube] Starting transcript extraction for: ${videoId}`);

      // Try transcript scraper first
      const result = await this.scrapeWithTranscriptActor(url, videoId);
      if (result) return result;

      // Fallback to general scraper
      logger.info('[ApifyYoutube] Transcript actor failed, trying general scraper...');
      return await this.scrapeWithGeneralActor(url, videoId);

    } catch (error: any) {
      logger.error('[ApifyYoutube] Scrape error:', error.message);
      throw error;
    }
  }

  /**
   * Use the transcript-specific Apify actor
   * Tries multiple input formats since actors have different schemas
   */
  private static async scrapeWithTranscriptActor(
    url: string,
    videoId: string
  ): Promise<YouTubeTranscriptResult | null> {
    try {
      logger.info(`[ApifyYoutube] Using actor: ${YOUTUBE_TRANSCRIPT_ACTOR}`);

      // Different actors accept different input formats - try the most common ones
      const inputPayload = {
        // Most common formats
        startUrls: [{ url }],
        urls: [url],
        videoUrls: [url],
        videoUrl: url,
        // Settings
        language: 'en',
        maxResults: 1,
      };

      const runResponse = await axios.post(
        `${APIFY_API_BASE}/acts/${YOUTUBE_TRANSCRIPT_ACTOR}/runs`,
        inputPayload,
        {
          headers: {
            'Authorization': `Bearer ${this.APIFY_TOKEN}`,
            'Content-Type': 'application/json',
          },
          params: {
            waitForFinish: 120, // Wait up to 2 minutes
          },
          timeout: 130000,
        }
      );

      const runId = runResponse.data.data.id;
      const datasetId = runResponse.data.data.defaultDatasetId;

      logger.info(`[ApifyYoutube] Run started: ${runId}, waiting for results...`);

      // Get results from dataset
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
        logger.warn('[ApifyYoutube] No results from transcript actor');
        return null;
      }

      const item: ApifyTranscriptResponse = items[0];

      // Build transcript from various possible fields
      let transcript = '';
      if (item.transcript && typeof item.transcript === 'string') {
        transcript = item.transcript;
      } else if (item.subtitles && Array.isArray(item.subtitles)) {
        transcript = item.subtitles.map((s: any) => s.text || s).join(' ');
      } else if ((item as any).text) {
        transcript = (item as any).text;
      } else if ((item as any).captions) {
        const captions = (item as any).captions;
        transcript = Array.isArray(captions) ? captions.map((c: any) => c.text || c).join(' ') : captions;
      }

      // Clean up transcript
      transcript = transcript.replace(/\s+/g, ' ').trim();

      if (!transcript) {
        logger.warn('[ApifyYoutube] No transcript found in results');
        return null;
      }

      logger.info(`[ApifyYoutube] Transcript extracted: ${transcript.length} chars`);

      return {
        videoId,
        title: item.title || (item as any).videoTitle || 'YouTube Video',
        channelName: item.channelName || (item as any).channel || (item as any).author || 'Unknown',
        transcript,
        thumbnailUrl: item.thumbnailUrl || (item as any).thumbnail || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      };

    } catch (error: any) {
      logger.error('[ApifyYoutube] Transcript actor error:', error.message);
      return null;
    }
  }

  /**
   * Use the fallback YouTube scraper (TurboScraper)
   */
  private static async scrapeWithGeneralActor(
    url: string,
    videoId: string
  ): Promise<YouTubeTranscriptResult | null> {
    try {
      logger.info(`[ApifyYoutube] Using fallback actor: ${YOUTUBE_SCRAPER_ACTOR}`);

      // TurboScraper input format
      const inputPayload = {
        startUrls: [{ url }],
        urls: [url],
        videoUrls: [url],
        maxResults: 1,
        language: 'en',
      };

      const runResponse = await axios.post(
        `${APIFY_API_BASE}/acts/${YOUTUBE_SCRAPER_ACTOR}/runs`,
        inputPayload,
        {
          headers: {
            'Authorization': `Bearer ${this.APIFY_TOKEN}`,
            'Content-Type': 'application/json',
          },
          params: {
            waitForFinish: 120,
          },
          timeout: 130000,
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
      if (!items || items.length === 0) {
        logger.warn('[ApifyYoutube] No results from fallback scraper');
        return null;
      }

      const item = items[0];

      // Try to get subtitles/transcript from various fields
      let transcript = '';
      if (item.transcript && typeof item.transcript === 'string') {
        transcript = item.transcript;
      } else if (item.subtitles) {
        if (typeof item.subtitles === 'string') {
          transcript = item.subtitles;
        } else if (Array.isArray(item.subtitles)) {
          transcript = item.subtitles.map((s: any) => s.text || s).join(' ');
        }
      } else if (item.text) {
        transcript = item.text;
      } else if (item.captions) {
        const captions = item.captions;
        transcript = Array.isArray(captions) ? captions.map((c: any) => c.text || c).join(' ') : captions;
      }

      // Clean up
      transcript = transcript.replace(/\s+/g, ' ').trim();

      logger.info(`[ApifyYoutube] Fallback scraper - Title: "${item.title}", Transcript: ${transcript.length} chars`);

      return {
        videoId,
        title: item.title || item.videoTitle || 'YouTube Video',
        channelName: item.channelName || item.channel?.name || item.author || 'Unknown',
        transcript,
        thumbnailUrl: item.thumbnailUrl || item.thumbnail || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        description: item.description,
      };

    } catch (error: any) {
      logger.error('[ApifyYoutube] Fallback scraper error:', error.message);
      return null;
    }
  }

  /**
   * Get video metadata only (faster, no transcript)
   * Used when we just need title/channel for oEmbed-style fallback
   */
  static async getVideoMetadata(url: string): Promise<{
    title: string;
    channelName: string;
    thumbnailUrl: string;
    description?: string;
  } | null> {
    const videoId = this.extractVideoId(url);
    if (!videoId) return null;

    try {
      // Use YouTube oEmbed (free, fast, always works)
      const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
      const response = await axios.get(oembedUrl, {
        timeout: 10000,
      });

      return {
        title: response.data.title,
        channelName: response.data.author_name,
        thumbnailUrl: response.data.thumbnail_url,
      };
    } catch (error) {
      logger.error('[ApifyYoutube] oEmbed metadata fetch failed');
      return null;
    }
  }

  /**
   * Download YouTube video via Apify (bypasses YouTube blocks)
   * Returns a direct download URL that can be used to fetch the video
   * Cost: ~$0.02-0.05 per video
   */
  static async downloadVideo(url: string): Promise<{
    downloadUrl: string;
    title: string;
    duration: number;
    fileSize?: number;
  } | null> {
    if (!this.APIFY_TOKEN) {
      logger.warn('[ApifyYoutube] Token not configured for video download');
      return null;
    }

    const videoId = this.extractVideoId(url);
    if (!videoId) {
      throw new Error('Invalid YouTube URL');
    }

    try {
      logger.info(`[ApifyYoutube] Starting video download for: ${videoId}`);

      // Use Streamers YouTube Video Downloader actor
      // Docs: https://apify.com/streamers/youtube-video-downloader
      const inputPayload = {
        startUrls: [{ url }],
        urls: [url],           // Some actors use this format
        downloadVideo: true,
        quality: 'lowest',     // Lowest quality = smallest file = fastest for Gemini
        maxVideos: 1,
      };

      const runResponse = await axios.post(
        `${APIFY_API_BASE}/acts/${YOUTUBE_DOWNLOADER_ACTOR}/runs`,
        inputPayload,
        {
          headers: {
            'Authorization': `Bearer ${this.APIFY_TOKEN}`,
            'Content-Type': 'application/json',
          },
          params: {
            waitForFinish: 180, // Wait up to 3 minutes for download
          },
          timeout: 200000,
        }
      );

      const datasetId = runResponse.data.data.defaultDatasetId;
      logger.info(`[ApifyYoutube] Download run started, getting results...`);

      // Get results from dataset
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
        logger.warn('[ApifyYoutube] No download results');
        return null;
      }

      const item = items[0];
      
      // Different actors return URLs in different fields - try all common ones
      const downloadUrl = item.videoUrl || item.downloadUrl || item.url || 
                          item.video_url || item.mediaUrl || item.media_url ||
                          item.fileUrl || item.file_url;
      
      if (!downloadUrl) {
        logger.warn('[ApifyYoutube] No download URL in results. Fields:', Object.keys(item));
        return null;
      }

      logger.info(`[ApifyYoutube] Video download ready: ${item.title || 'Video'} - URL: ${downloadUrl.substring(0, 50)}...`);

      return {
        downloadUrl,
        title: item.title || 'YouTube Video',
        duration: item.duration || 0,
        fileSize: item.fileSize,
      };

    } catch (error: any) {
      logger.error('[ApifyYoutube] Video download error:', error.message);
      return null;
    }
  }

  /**
   * Full extraction pipeline: Transcript OR Video Download + Gemini Analysis
   * This is the main entry point for YouTube processing
   * 
   * Flow:
   * 1. Try to get transcript via Apify
   * 2. If no transcript (common for Shorts), download video
   * 3. Return video file for Gemini analysis
   */
  static async getVideoContent(url: string): Promise<{
    videoId: string;
    title: string;
    channelName: string;
    thumbnailUrl: string;
    transcript?: string;       // If transcript available
    videoDownloadUrl?: string; // If video needs Gemini analysis
    description?: string;
  } | null> {
    const videoId = this.extractVideoId(url);
    if (!videoId) return null;

    // Step 1: Always get basic metadata first (fast, free)
    const metadata = await this.getVideoMetadata(url);
    const title = metadata?.title || 'YouTube Video';
    const channelName = metadata?.channelName || 'Unknown';
    const thumbnailUrl = metadata?.thumbnailUrl || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

    // Step 2: Try to get transcript
    try {
      const transcriptResult = await this.getVideoTranscript(url);
      if (transcriptResult && transcriptResult.transcript && transcriptResult.transcript.length > 50) {
        logger.info(`[ApifyYoutube] Got transcript for ${videoId}: ${transcriptResult.transcript.length} chars`);
        return {
          videoId,
          title: transcriptResult.title || title,
          channelName: transcriptResult.channelName || channelName,
          thumbnailUrl: transcriptResult.thumbnailUrl || thumbnailUrl,
          transcript: transcriptResult.transcript,
          description: transcriptResult.description,
        };
      }
    } catch (e: any) {
      logger.warn(`[ApifyYoutube] Transcript extraction failed: ${e.message}`);
    }

    // Step 3: No transcript - download video for Gemini analysis
    logger.info(`[ApifyYoutube] No transcript, downloading video for ${videoId}...`);
    
    try {
      const downloadResult = await this.downloadVideo(url);
      if (downloadResult && downloadResult.downloadUrl) {
        return {
          videoId,
          title: downloadResult.title || title,
          channelName,
          thumbnailUrl,
          videoDownloadUrl: downloadResult.downloadUrl,
        };
      }
    } catch (e: any) {
      logger.warn(`[ApifyYoutube] Video download failed: ${e.message}`);
    }

    // Step 4: All failed - return metadata only
    logger.warn(`[ApifyYoutube] All extraction methods failed for ${videoId}, returning metadata only`);
    return {
      videoId,
      title,
      channelName,
      thumbnailUrl,
    };
  }
}

