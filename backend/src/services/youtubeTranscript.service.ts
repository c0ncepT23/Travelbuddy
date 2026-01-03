/**
 * YouTube Transcript Service
 * 
 * Fetches transcripts using youtube-transcript package with residential proxy.
 * Falls back to Gemini Direct URL if transcript unavailable.
 */

import axios from 'axios';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { HttpsProxyAgent } from 'https-proxy-agent';
import config from '../config/env';
import logger from '../config/logger';
import { API_LIMITS } from '../config/constants';

const execAsync = promisify(exec);

export interface VideoData {
  transcript: string | null;
  description: string | null;
  title?: string;
  author?: string;
  thumbnailUrl?: string;
  extractionMethod?: 'native' | 'yt-dlp';
}

export class YouTubeTranscriptService {
  
  // ═══════════════════════════════════════════════════════════════════
  // PROXY CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════
  
  private static getProxyUrl(): string | null {
    const { host, port, user, pass } = config.proxy || {};
    if (!host || !port || !user || !pass) {
      return null;
    }
    return `http://${user}:${pass}@${host}:${port}`;
  }

  private static getHttpsAgent(): HttpsProxyAgent<string> | null {
    const proxyUrl = this.getProxyUrl();
    if (!proxyUrl) {
      logger.error('[YouTubeTranscript] Proxy not configured - aborting to prevent IP leak');
      return null;
    }
    return new HttpsProxyAgent(proxyUrl);
  }

  // ═══════════════════════════════════════════════════════════════════
  // MAIN ENTRY POINT (3-Tier Pipeline)
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Fetch video data using 3-tier fallback:
   * 1. Native axios scraping (fast, free)
   * 2. yt-dlp CLI (reliable, free)
   * 3. Returns null → ContentProcessor triggers Gemini Vision
   */
  static async fetchVideoData(videoId: string): Promise<VideoData> {
    
    // ─────────────────────────────────────────────────────────────────
    // TIER 1: Native Axios Scraping
    // ─────────────────────────────────────────────────────────────────
    logger.info(`[YouTubeTranscript] TIER 1: Attempting native scraping for ${videoId}`);
    const nativeResult = await this.fetchWithNativeScraping(videoId);
    
    if (nativeResult.transcript && nativeResult.transcript.length > 100) {
      logger.info(`[YouTubeTranscript] ✅ TIER 1 SUCCESS: Native scraping got ${nativeResult.transcript.length} chars`);
      return { ...nativeResult, extractionMethod: 'native' };
    }

    // ─────────────────────────────────────────────────────────────────
    // TIER 2: yt-dlp Fallback
    // ─────────────────────────────────────────────────────────────────
    logger.warn(`[YouTubeTranscript] TIER 1 FAILED: Native scraping returned insufficient text. Trying yt-dlp...`);
    this.recordTierUsage('yt-dlp', videoId);
    
    const ytdlpResult = await this.fetchWithYtDlp(videoId);
    
    if (ytdlpResult.transcript && ytdlpResult.transcript.length > 100) {
      logger.info(`[YouTubeTranscript] ✅ TIER 2 SUCCESS: yt-dlp got ${ytdlpResult.transcript.length} chars`);
      return { 
        ...ytdlpResult, 
        // Merge: prefer yt-dlp transcript but keep native metadata if richer
        description: ytdlpResult.description || nativeResult.description,
        title: ytdlpResult.title || nativeResult.title,
        author: ytdlpResult.author || nativeResult.author,
        extractionMethod: 'yt-dlp' 
      };
    }

    // ─────────────────────────────────────────────────────────────────
    // TIER 3: Return with whatever we have → Gemini Vision handles it
    // ─────────────────────────────────────────────────────────────────
    logger.warn(`[YouTubeTranscript] TIER 2 FAILED: yt-dlp returned no transcript. Gemini Vision will be used downstream.`);
    this.recordTierUsage('gemini-vision', videoId);
    
    return { 
      transcript: null, 
      description: nativeResult.description || ytdlpResult.description,
      title: nativeResult.title || ytdlpResult.title,
      author: nativeResult.author || ytdlpResult.author,
      thumbnailUrl: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      extractionMethod: undefined // Will trigger Gemini Vision in ContentProcessor
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // TIER 1: NATIVE AXIOS SCRAPING
  // ═══════════════════════════════════════════════════════════════════

  private static async fetchWithNativeScraping(videoId: string): Promise<VideoData> {
    try {
      const httpsAgent = this.getHttpsAgent();
      if (!httpsAgent) {
        throw new Error('Proxy required but not configured');
      }

      const videoPageResponse = await axios.get(
        `https://www.youtube.com/watch?v=${videoId}`,
        {
          httpsAgent,
          timeout: API_LIMITS.YOUTUBE_TRANSCRIPT_TIMEOUT_MS,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
          }
        }
      );

      const html = videoPageResponse.data;

      // Extract description (handles escaped quotes)
      let description: string | null = null;
      const descMatch = html.match(/"shortDescription":"((?:[^"\\]|\\.)*)"/);
      if (descMatch) {
        description = descMatch[1]
          .replace(/\\n/g, '\n')
          .replace(/\\u([\d\w]{4})/gi, (_: string, grp: string) => 
            String.fromCharCode(parseInt(grp, 16))
          );
      }

      // Extract metadata
      let title: string | undefined;
      let author: string | undefined;
      const titleMatch = html.match(/"title":"((?:[^"\\]|\\.)*)"/);
      if (titleMatch) title = titleMatch[1];
      const authorMatch = html.match(/"author":"((?:[^"\\]|\\.)*)"/);
      if (authorMatch) author = authorMatch[1];

      // Extract transcript via captionTracks
      let transcript: string | null = null;
      const playerCaptionsMatch = html.match(/"captionTracks":\s*(\[.*?\])/);
      if (playerCaptionsMatch) {
        try {
          const captionTracks = JSON.parse(playerCaptionsMatch[1]);
          const englishTrack = captionTracks.find(
            (t: any) => t.languageCode === 'en' || t.languageCode === 'en-US'
          ) || captionTracks[0];

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
          }
        } catch (e: any) {
          logger.warn(`[YouTubeTranscript] Failed to parse captionTracks: ${e.message}`);
        }
      }

      return { 
        transcript, 
        description, 
        title, 
        author,
        thumbnailUrl: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
      };
    } catch (error: any) {
      logger.warn(`[YouTubeTranscript] Native scraping error: ${error.message}`);
      return { transcript: null, description: null };
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // TIER 2: YT-DLP FALLBACK
  // ═══════════════════════════════════════════════════════════════════

  private static async fetchWithYtDlp(videoId: string): Promise<VideoData> {
    const tempDir = os.tmpdir();
    const subtitlePath = path.join(tempDir, `${videoId}.en.vtt`);
    
    try {
      const proxyUrl = this.getProxyUrl();
      const proxyArg = proxyUrl ? `--proxy "${proxyUrl}"` : '';
      const url = `https://www.youtube.com/watch?v=${videoId}`;

      // Step 1: Get metadata via --dump-json
      logger.info(`[YouTubeTranscript] yt-dlp: Fetching metadata for ${videoId}`);
      const { stdout: jsonOutput } = await execAsync(
        `yt-dlp ${proxyArg} --dump-json --skip-download "${url}"`,
        { timeout: 30000 }
      );
      
      const metadata = JSON.parse(jsonOutput);
      
      // Step 2: Try to get subtitles
      let transcript: string | null = null;
      
      const hasSubtitles = metadata.subtitles?.en || metadata.automatic_captions?.en;
      
      if (hasSubtitles) {
        logger.info(`[YouTubeTranscript] yt-dlp: Fetching subtitles for ${videoId}`);
        
        try {
          // Download subtitles to temp file
          await execAsync(
            `yt-dlp ${proxyArg} --skip-download --write-auto-sub --sub-lang en --sub-format vtt -o "${path.join(tempDir, '%(id)s')}" "${url}"`,
            { timeout: 30000 }
          );
          
          // Read and parse the VTT file
          if (fs.existsSync(subtitlePath)) {
            const vttContent = fs.readFileSync(subtitlePath, 'utf-8');
            transcript = this.parseVttToText(vttContent);
            logger.info(`[YouTubeTranscript] yt-dlp: Parsed ${transcript.length} chars from VTT`);
          }
        } catch (subError: any) {
          logger.warn(`[YouTubeTranscript] yt-dlp: Subtitle fetch failed: ${subError.message}`);
        }
      } else {
        logger.info(`[YouTubeTranscript] yt-dlp: No subtitles available for ${videoId}`);
      }

      return {
        transcript,
        description: metadata.description || null,
        title: metadata.title,
        author: metadata.uploader || metadata.channel,
        thumbnailUrl: metadata.thumbnail,
      };
      
    } catch (error: any) {
      logger.error(`[YouTubeTranscript] yt-dlp error: ${error.message}`);
      return { transcript: null, description: null };
    } finally {
      // Cleanup temp files
      try {
        const patterns = [
          path.join(tempDir, `${videoId}.en.vtt`),
          path.join(tempDir, `${videoId}.en-US.vtt`),
          path.join(tempDir, `${videoId}.vtt`)
        ];
        for (const p of patterns) {
          if (fs.existsSync(p)) {
            fs.unlinkSync(p);
          }
        }
      } catch (e) { /* ignore cleanup errors */ }
    }
  }

  /**
   * Convert VTT subtitle format to plain text
   */
  private static parseVttToText(vtt: string): string {
    return vtt
      .split('\n')
      .filter(line => {
        const trimmed = line.trim();
        return (
          trimmed &&
          !trimmed.startsWith('WEBVTT') &&
          !trimmed.startsWith('Kind:') &&
          !trimmed.startsWith('Language:') &&
          !trimmed.includes('-->') &&
          !/^\d+$/.test(trimmed) &&
          !/^\d{2}:\d{2}/.test(trimmed) // Skip timestamp lines
        );
      })
      .map(line => line.replace(/<[^>]*>/g, '').trim()) // Remove HTML tags
      .filter(line => line)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // ═══════════════════════════════════════════════════════════════════
  // MONITORING & METRICS
  // ═══════════════════════════════════════════════════════════════════

  private static tierUsage: Record<string, { count: number; since: Date }> = {
    'yt-dlp': { count: 0, since: new Date() },
    'gemini-vision': { count: 0, since: new Date() },
  };

  private static recordTierUsage(tier: 'yt-dlp' | 'gemini-vision', videoId: string): void {
    const now = new Date();
    const usage = this.tierUsage[tier];
    
    // Reset counter every hour
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    if (usage.since < hourAgo) {
      usage.count = 0;
      usage.since = now;
    }
    
    usage.count++;
    
    logger.info(`[YouTubeTranscript] 📊 ${tier} fallback used for ${videoId}. Rate: ${usage.count}/hour`);
    
    // Alert if yt-dlp usage is very high (native scraping may be broken)
    if (tier === 'yt-dlp' && usage.count >= 20) {
      logger.error(
        `[YouTubeTranscript] ⚠️ HIGH YT-DLP FALLBACK RATE: ${usage.count}/hour. ` +
        `Native regex scraping may be broken. Check YouTube HTML structure.`
      );
    }
    
    // Alert if Gemini Vision usage is high (both scrapers may be broken)
    if (tier === 'gemini-vision' && usage.count >= 10) {
      logger.error(
        `[YouTubeTranscript] ⚠️ HIGH GEMINI VISION USAGE: ${usage.count}/hour. ` +
        `Both native and yt-dlp may be failing. Investigate immediately.`
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // UTILITY METHODS
  // ═══════════════════════════════════════════════════════════════════

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

  static isShort(url: string): boolean {
    return url.includes('/shorts/');
  }

  /**
   * @deprecated Use fetchVideoData() instead
   */
  static async fetchTranscript(videoId: string): Promise<string | null> {
    const data = await this.fetchVideoData(videoId);
    return data.transcript;
  }

  static async fetchMetadata(videoId: string): Promise<{
    title: string;
    author: string;
    thumbnailUrl: string;
  } | null> {
    try {
      const httpsAgent = this.getHttpsAgent();
      const response = await axios.get(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
        { httpsAgent: httpsAgent || undefined, timeout: API_LIMITS.OEMBED_TIMEOUT_MS }
      );
      return {
        title: response.data.title || 'YouTube Video',
        author: response.data.author_name || 'Unknown',
        thumbnailUrl: response.data.thumbnail_url || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      };
    } catch (error: any) {
      logger.warn(`[YouTubeTranscript] Metadata fetch failed: ${error.message}`);
      return null;
    }
  }
}
