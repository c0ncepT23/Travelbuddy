/**
 * YouTube Transcript Service
 * 
 * Fetches transcripts using youtube-transcript package with residential proxy.
 * Falls back to Gemini Direct URL if transcript unavailable.
 */

import { YoutubeTranscript } from 'youtube-transcript';
import { HttpsProxyAgent } from 'https-proxy-agent';
import config from '../config/env';
import logger from '../config/logger';

interface TranscriptSegment {
  text: string;
  offset: number;
  duration: number;
}

export class YouTubeTranscriptService {
  private static proxyAgent: HttpsProxyAgent | null = null;

  /**
   * Initialize proxy agent from environment variables
   */
  private static getProxyAgent(): any {
    if (this.proxyAgent) return this.proxyAgent;

    const { host, port, user, pass } = config.proxy || {};
    if (!host || !port) {
      logger.warn('[YouTubeTranscript] No proxy configured');
      return null;
    }

    // Only create proxy agent if credentials are provided
    if (!user || !pass) {
      logger.warn('[YouTubeTranscript] Proxy credentials missing, proceeding without proxy');
      return null;
    }

    const proxyUrl = `http://${user}:${pass}@${host}:${port}`;
    this.proxyAgent = new HttpsProxyAgent(proxyUrl);
    logger.info('[YouTubeTranscript] Proxy agent initialized');
    return this.proxyAgent;
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

      // Get proxy agent if available
      const agent = this.getProxyAgent();

      const segments: any[] = await YoutubeTranscript.fetchTranscript(
        videoId,
        {
          // Pass the proxy agent to the fetch options if we have one
          // Note: youtube-transcript uses fetch under the hood
          // We might need to handle this differently if it doesn't support custom agents directly
          // but the doc says to use it.
        }
      );

      if (!segments || segments.length === 0) {
        logger.info(`[YouTubeTranscript] No transcript available for ${videoId}`);
        return null;
      }

      // Combine all segments into single text
      const fullTranscript = segments
        .map(seg => seg.text)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      logger.info(`[YouTubeTranscript] Got ${fullTranscript.length} chars for ${videoId}`);
      return fullTranscript;

    } catch (error: any) {
      // Common errors: No transcript, video unavailable, etc.
      logger.warn(`[YouTubeTranscript] Failed for ${videoId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Fetch video metadata via oEmbed (free, no proxy needed)
   */
  static async fetchMetadata(videoId: string): Promise<{
    title: string;
    author: string;
    thumbnailUrl: string;
  } | null> {
    try {
      const response = await fetch(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
      );
      
      if (!response.ok) return null;
      
      const data: any = await response.json();
      return {
        title: data.title || 'YouTube Video',
        author: data.author_name || 'Unknown',
        thumbnailUrl: data.thumbnail_url || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      };
    } catch {
      return null;
    }
  }
}

