import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import logger from '../config/logger';

const execAsync = promisify(exec);
const readFileAsync = promisify(fs.readFile);
const unlinkAsync = promisify(fs.unlink);
const mkdirAsync = promisify(fs.mkdir);

export interface YouTubeVideoData {
  id: string;
  title: string;
  description: string;
  transcript: string;
  duration: number;
  thumbnailUrl: string;
  channelName: string;
  uploadDate: string;
}

export class YtDlpService {
  private static tempDir = '/tmp/ytdlp';

  /**
   * Ensure temp directory exists
   */
  private static async ensureTempDir(): Promise<void> {
    try {
      await mkdirAsync(this.tempDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  }

  /**
   * Extract video ID from YouTube URL
   */
  static extractVideoId(url: string): string | null {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^&\n?#]+)/,
      /youtube\.com\/shorts\/([^&\n?#]+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  }

  /**
   * Get video metadata using yt-dlp
   */
  static async getVideoMetadata(url: string): Promise<{
    id: string;
    title: string;
    description: string;
    duration: number;
    thumbnailUrl: string;
    channelName: string;
    uploadDate: string;
  }> {
    try {
      logger.info(`[YtDlp] Fetching metadata for: ${url}`);
      
      const { stdout } = await execAsync(
        `yt-dlp --dump-json --no-download "${url}"`,
        { maxBuffer: 10 * 1024 * 1024 } // 10MB buffer for large metadata
      );

      const data = JSON.parse(stdout);

      return {
        id: data.id,
        title: data.title || '',
        description: data.description || '',
        duration: data.duration || 0,
        thumbnailUrl: data.thumbnail || '',
        channelName: data.channel || data.uploader || '',
        uploadDate: data.upload_date || '',
      };
    } catch (error: any) {
      logger.error('[YtDlp] Failed to get metadata:', error.message);
      throw new Error(`Failed to fetch video metadata: ${error.message}`);
    }
  }

  /**
   * Get video transcript/subtitles using yt-dlp
   * Tries multiple methods: manual subs, auto-generated subs
   */
  static async getTranscript(url: string): Promise<string> {
    await this.ensureTempDir();
    
    const videoId = this.extractVideoId(url);
    if (!videoId) {
      throw new Error('Invalid YouTube URL');
    }

    const outputPath = path.join(this.tempDir, videoId);
    
    try {
      logger.info(`[YtDlp] Fetching transcript for video: ${videoId}`);

      // Try to get subtitles (prefer manual, fallback to auto-generated)
      // --write-subs: manual subtitles
      // --write-auto-subs: auto-generated
      // --sub-langs: language preference
      const command = `yt-dlp --write-subs --write-auto-subs --sub-langs "en.*,en" --skip-download --no-warnings -o "${outputPath}" "${url}"`;
      
      await execAsync(command, { maxBuffer: 10 * 1024 * 1024 });

      // Look for subtitle files
      const possibleFiles = [
        `${outputPath}.en.vtt`,
        `${outputPath}.en-orig.vtt`,
        `${outputPath}.en-US.vtt`,
        `${outputPath}.en.srt`,
      ];

      let transcript = '';
      
      for (const file of possibleFiles) {
        try {
          if (fs.existsSync(file)) {
            const content = await readFileAsync(file, 'utf-8');
            transcript = this.parseSubtitles(content);
            
            // Clean up file
            await unlinkAsync(file).catch(() => {});
            
            if (transcript.length > 100) {
              logger.info(`[YtDlp] Got transcript from ${path.basename(file)}: ${transcript.length} chars`);
              break;
            }
          }
        } catch {
          // Try next file
        }
      }

      // Clean up any remaining subtitle files
      this.cleanupFiles(outputPath);

      if (!transcript) {
        logger.warn(`[YtDlp] No transcript found for ${videoId}`);
        return '';
      }

      return transcript;
    } catch (error: any) {
      logger.error('[YtDlp] Failed to get transcript:', error.message);
      this.cleanupFiles(outputPath);
      return ''; // Return empty string instead of throwing - we can still use metadata
    }
  }

  /**
   * Parse VTT/SRT subtitle file into plain text
   */
  private static parseSubtitles(content: string): string {
    // Remove VTT header
    let text = content.replace(/^WEBVTT\n.*?\n\n/s, '');
    
    // Remove timestamps and formatting
    text = text
      // Remove timestamp lines (00:00:00.000 --> 00:00:00.000)
      .replace(/\d{2}:\d{2}:\d{2}[.,]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[.,]\d{3}.*\n/g, '')
      // Remove SRT sequence numbers
      .replace(/^\d+\n/gm, '')
      // Remove VTT cue settings
      .replace(/<[^>]+>/g, '')
      // Remove alignment tags
      .replace(/\{\\an\d\}/g, '')
      // Remove duplicate lines (common in auto-generated subs)
      .split('\n')
      .filter((line, index, arr) => line.trim() && line !== arr[index - 1])
      .join(' ')
      // Clean up whitespace
      .replace(/\s+/g, ' ')
      .trim();

    return text;
  }

  /**
   * Clean up temporary files
   */
  private static cleanupFiles(basePath: string): void {
    const extensions = ['.vtt', '.srt', '.en.vtt', '.en.srt', '.en-orig.vtt', '.en-US.vtt'];
    
    for (const ext of extensions) {
      try {
        const file = basePath + ext;
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Get complete video data (metadata + transcript)
   * This is the main method to use
   */
  static async getVideoData(url: string): Promise<YouTubeVideoData> {
    logger.info(`[YtDlp] Processing video: ${url}`);

    // Fetch metadata and transcript in parallel
    const [metadata, transcript] = await Promise.all([
      this.getVideoMetadata(url),
      this.getTranscript(url),
    ]);

    const result: YouTubeVideoData = {
      ...metadata,
      transcript,
    };

    logger.info(`[YtDlp] Complete - Title: "${metadata.title.substring(0, 50)}...", Transcript: ${transcript.length} chars`);

    return result;
  }

  /**
   * Check if yt-dlp is installed and working
   */
  static async healthCheck(): Promise<boolean> {
    try {
      const { stdout } = await execAsync('yt-dlp --version');
      logger.info(`[YtDlp] Version: ${stdout.trim()}`);
      return true;
    } catch (error) {
      logger.error('[YtDlp] Not installed or not working');
      return false;
    }
  }

  /**
   * Get direct video download URL (for video analysis)
   * Returns the best quality video URL that can be downloaded
   */
  static async getVideoDownloadUrl(url: string): Promise<string | null> {
    try {
      logger.info(`[YtDlp] Getting video download URL for: ${url}`);
      
      // Get the best video URL (prefer mp4, max 720p to save bandwidth)
      const { stdout } = await execAsync(
        `yt-dlp -f "best[height<=720][ext=mp4]/best[height<=720]/best" --get-url "${url}"`,
        { timeout: 30000 }
      );
      
      const videoUrl = stdout.trim();
      
      if (videoUrl && videoUrl.startsWith('http')) {
        logger.info(`[YtDlp] Got video URL (${videoUrl.substring(0, 50)}...)`);
        return videoUrl;
      }
      
      logger.warn('[YtDlp] Could not extract video URL');
      return null;
    } catch (error: any) {
      logger.error('[YtDlp] Failed to get video URL:', error.message);
      return null;
    }
  }
}

