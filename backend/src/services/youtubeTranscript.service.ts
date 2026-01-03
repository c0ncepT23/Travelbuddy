/**
 * YouTube Transcript Service
 * 
 * Fetches transcripts using youtube-transcript package with residential proxy.
 * Falls back to Gemini Direct URL if transcript unavailable.
 */

import { YoutubeTranscript } from 'youtube-transcript';
import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import config from '../config/env';
import logger from '../config/logger';
import { API_LIMITS } from '../config/constants';

export class YouTubeTranscriptService {
  /**
   * Get HTTPS Agent for proxy support
   */
  private static getHttpsAgent(): HttpsProxyAgent<string> | undefined {
    const { host, port, user, pass } = config.proxy || {};
    if (!host || !port || !user || !pass) {
      logger.warn('[YouTubeTranscript] Proxy configuration incomplete');
      return undefined;
    }

    const proxyUrl = `http://${user}:${pass}@${host}:${port}`;
    return new HttpsProxyAgent(proxyUrl);
  }

  /**
   * Extract video ID from various YouTube URL formats
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
   * Check if URL is a YouTube Short
   */
  static isShort(url: string): boolean {
    return url.includes('/shorts/');
  }

  /**
   * Fetch transcript with proxy support
   * Returns null if transcript unavailable (common for Shorts)
   */
  static async fetchTranscript(videoId: string): Promise<string | null> {
    try {
      logger.info(`[YouTubeTranscript] Fetching transcript for ${videoId}`);

      // We use the library but attempt to fetch it via the proxy
      // The library might not support a custom agent directly, 
      // so if this fails we might need a direct Axios call to the timedtext API.
      const segments: any[] = await YoutubeTranscript.fetchTranscript(
        videoId,
        {
          // youtube-transcript doesn't support custom fetch or agents directly.
          // Fallback to manual fetch if needed.
        }
      );

      if (!segments || segments.length === 0) {
        logger.info(`[YouTubeTranscript] No transcript available for ${videoId}`);
        return null;
      }

      const fullTranscript = segments
        .map(seg => seg.text)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      logger.info(`[YouTubeTranscript] Got ${fullTranscript.length} chars for ${videoId}`);
      return fullTranscript;

    } catch (error: any) {
      logger.warn(`[YouTubeTranscript] Primary fetch failed for ${videoId}: ${error.message}. Trying manual fallback...`);
      
      // Manual fallback to timedtext API with proxy
      return await this.fetchTranscriptManually(videoId);
    }
  }

  /**
   * Manual fallback to YouTube's timedtext API
   */
  private static async fetchTranscriptManually(videoId: string): Promise<string | null> {
    try {
      const httpsAgent = this.getHttpsAgent();
      
      // First, get the video page to find the timedtext URL
      const videoPageResponse = await axios.get(`https://www.youtube.com/watch?v=${videoId}`, {
        httpsAgent,
        timeout: API_LIMITS.YOUTUBE_TRANSCRIPT_TIMEOUT_MS,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        }
      });

      const playerCaptionsMatch = videoPageResponse.data.match(/"captionTracks":\s*(\[.*?\])/);
      if (!playerCaptionsMatch) return null;

      const captionTracks = JSON.parse(playerCaptionsMatch[1]);
      const englishTrack = captionTracks.find((t: any) => t.languageCode === 'en') || captionTracks[0];
      
      if (!englishTrack?.baseUrl) return null;

      const transcriptResponse = await axios.get(englishTrack.baseUrl, {
        httpsAgent,
        timeout: API_LIMITS.YOUTUBE_TRANSCRIPT_TIMEOUT_MS
      });

      // Simple XML to Text extraction (removing tags)
      const transcript = transcriptResponse.data
        .replace(/<text.*?>/g, '')
        .replace(/<\/text>/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/<.*?>/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      logger.info(`[YouTubeTranscript] Manual fetch success: ${transcript.length} chars`);
      return transcript;
    } catch (error: any) {
      logger.error(`[YouTubeTranscript] Manual fetch failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Fetch video metadata via oEmbed with proxy support using Axios
   */
  static async fetchMetadata(videoId: string): Promise<{
    title: string;
    author: string;
    thumbnailUrl: string;
  } | null> {
    try {
      const httpsAgent = this.getHttpsAgent();

      const response = await axios.get(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
        { 
          httpsAgent,
          timeout: API_LIMITS.OEMBED_TIMEOUT_MS
        }
      );
      
      const data = response.data;
      return {
        title: data.title || 'YouTube Video',
        author: data.author_name || 'Unknown',
        thumbnailUrl: data.thumbnail_url || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      };
    } catch (error: any) {
      logger.warn(`[YouTubeTranscript] Metadata fetch failed: ${error.message}`);
      return null;
    }
  }
}
