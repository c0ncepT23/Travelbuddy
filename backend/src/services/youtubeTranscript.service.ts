/**
 * YouTube Transcript Service
 * 
 * Fetches transcripts using youtube-transcript package with residential proxy.
 * Falls back to Gemini Direct URL if transcript unavailable.
 */

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
   * Fetch transcript and description with proxy support
   * Returns object with both or nulls if unavailable
   */
  static async fetchVideoData(videoId: string): Promise<{ 
    transcript: string | null; 
    description: string | null;
    title?: string;
    author?: string;
    thumbnailUrl?: string;
  }> {
    try {
      logger.info(`[YouTubeTranscript] Fetching full video data for ${videoId}`);
      const httpsAgent = this.getHttpsAgent();
      
      // 1. Fetch the main video page to get description and caption tracks
      const videoPageResponse = await axios.get(`https://www.youtube.com/watch?v=${videoId}`, {
        httpsAgent,
        timeout: API_LIMITS.YOUTUBE_TRANSCRIPT_TIMEOUT_MS,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        }
      });

      const html = videoPageResponse.data;
      
      // 2. Extract Description (it's hidden in the ytInitialData JSON)
      let description = null;
      try {
        const descMatch = html.match(/"shortDescription":"(.*?)"/);
        if (descMatch) {
          description = descMatch[1]
            .replace(/\\n/g, '\n')
            .replace(/\\u([\d\w]{4})/gi, (_: string, grp: string) => String.fromCharCode(parseInt(grp, 16)));
          logger.info(`[YouTubeTranscript] Extracted description (${description.length} chars)`);
        }
      } catch (e) {
        logger.warn(`[YouTubeTranscript] Failed to parse description for ${videoId}`);
      }

      // 3. Extract Metadata (Title, Author) if not provided
      let title = undefined;
      let author = undefined;
      try {
        const titleMatch = html.match(/"title":"(.*?)"/);
        if (titleMatch) title = titleMatch[1];
        const authorMatch = html.match(/"author":"(.*?)"/);
        if (authorMatch) author = authorMatch[1];
      } catch (e) { /* ignore */ }

      // 4. Try to fetch Transcript
      let transcript = null;
      try {
        const playerCaptionsMatch = html.match(/"captionTracks":\s*(\[.*?\])/);
        if (playerCaptionsMatch) {
          const captionTracks = JSON.parse(playerCaptionsMatch[1]);
          const englishTrack = captionTracks.find((t: any) => t.languageCode === 'en' || t.languageCode === 'en-US') || captionTracks[0];
          
          if (englishTrack?.baseUrl) {
            const transcriptResponse = await axios.get(englishTrack.baseUrl, {
              httpsAgent,
              timeout: API_LIMITS.YOUTUBE_TRANSCRIPT_TIMEOUT_MS,
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9',
              }
            });

            transcript = transcriptResponse.data
              .replace(/<text.*?>/g, '')
              .replace(/<\/text>/g, ' ')
              .replace(/&amp;/g, '&')
              .replace(/&quot;/g, '"')
              .replace(/&#39;/g, "'")
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/<.*?>/g, '')
              .replace(/\s+/g, ' ')
              .trim();
            
            logger.info(`[YouTubeTranscript] Extracted transcript (${transcript.length} chars)`);
          }
        }
      } catch (e: any) {
        logger.warn(`[YouTubeTranscript] Failed to fetch transcript for ${videoId}: ${e.message}`);
      }

      return { 
        transcript, 
        description,
        title,
        author,
        thumbnailUrl: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
      };

    } catch (error: any) {
      logger.error(`[YouTubeTranscript] Failed to fetch video data for ${videoId}: ${error.message}`);
      return { transcript: null, description: null };
    }
  }

  /**
   * Fetch transcript with proxy support
   * @deprecated Use fetchVideoData() instead
   */
  static async fetchTranscript(videoId: string): Promise<string | null> {
    const data = await this.fetchVideoData(videoId);
    return data.transcript;
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
