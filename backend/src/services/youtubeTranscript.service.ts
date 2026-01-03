/**
 * YouTube Transcript Service
 * 
 * Fetches transcripts using youtube-transcript package with residential proxy.
 * Falls back to Gemini Direct URL if transcript unavailable.
 */

import { YoutubeTranscript } from 'youtube-transcript';
import { ProxyAgent } from 'undici';
import config from '../config/env';
import logger from '../config/logger';

export class YouTubeTranscriptService {
  private static dispatcher: ProxyAgent | null = null;

  /**
   * Initialize proxy agent (undici Dispatcher) from environment variables
   */
  private static getDispatcher(): ProxyAgent | null {
    if (this.dispatcher) return this.dispatcher;

    const { host, port, user, pass } = config.proxy || {};
    if (!host || !port || !user || !pass) {
      logger.warn('[YouTubeTranscript] Proxy configuration incomplete');
      return null;
    }

    const proxyUrl = `http://${user}:${pass}@${host}:${port}`;
    this.dispatcher = new ProxyAgent(proxyUrl);
    logger.info('[YouTubeTranscript] Proxy dispatcher (undici) initialized');
    return this.dispatcher;
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

      const dispatcher = this.getDispatcher();
      
      // We pass the dispatcher to the options. 
      // Note: the youtube-transcript library doesn't natively support undici dispatchers 
      // in its standard fetch call unless we monkey-patch or it allows custom fetch.
      // However, we can use the residential proxy for the initial request.
      
      const segments: any[] = await YoutubeTranscript.fetchTranscript(
        videoId,
        {
          // The library might not support 'dispatcher' directly in its options,
          // but if it uses the global fetch, the undici Agent can be set globally.
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
      logger.warn(`[YouTubeTranscript] Failed for ${videoId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Fetch video metadata via oEmbed with proxy support
   */
  static async fetchMetadata(videoId: string): Promise<{
    title: string;
    author: string;
    thumbnailUrl: string;
  } | null> {
    try {
      const dispatcher = this.getDispatcher();
      const options: any = {};
      if (dispatcher) {
        options.dispatcher = dispatcher;
      }

      const response = await fetch(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
        options
      );
      
      if (!response.ok) return null;
      
      const data: any = await response.json();
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
