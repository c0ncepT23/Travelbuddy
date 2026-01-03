import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import config from '../config/env';
import logger from '../config/logger';
import { VIDEO_CONFIG } from '../config/constants';

export class VideoDownloader {
  /**
   * Download a video from a URL to a temporary file
   * Routes through IPRoyal Proxy to avoid being blocked
   */
  static async download(videoUrl: string, platform: string): Promise<string> {
    const tempDir = os.tmpdir();
    
    logger.info(`[VideoDownloader] Starting ${platform} download via Proxy: ${videoUrl}`);

    // Configure Proxy Agent
    const { host, port, user, pass } = config.proxy || {};
    let httpsAgent;

    if (host && port && user && pass) {
      const proxyUrl = `http://${user}:${pass}@${host}:${port}`;
      httpsAgent = new HttpsProxyAgent(proxyUrl);
      logger.info(`[VideoDownloader] Using proxy for ${platform} download`);
    }

    try {
      const response = await axios({
        method: 'GET',
        url: videoUrl,
        responseType: 'stream',
        httpsAgent: httpsAgent,
        timeout: VIDEO_CONFIG.DOWNLOAD_TIMEOUT_MS,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });

      // Detect file extension from Content-Type header
      const contentType = response.headers['content-type'] || 'video/mp4';
      const ext = contentType.includes('webm') ? '.webm' 
                : contentType.includes('quicktime') ? '.mov'
                : '.mp4';
      
      const filename = `${platform}_video_${crypto.randomUUID()}${ext}`;
      const filepath = path.join(tempDir, filename);

      logger.info(`[VideoDownloader] Detected format: ${ext} from ${contentType} -> ${filepath}`);

      const writer = fs.createWriteStream(filepath);
      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', () => resolve(filepath));
        writer.on('error', (err) => {
          if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
          reject(err);
        });
      });
    } catch (error: any) {
      logger.error(`[VideoDownloader] Failed to download from ${videoUrl}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Cleanup temporary video files
   */
  static cleanup(filepath: string | null): void {
    if (filepath && fs.existsSync(filepath)) {
      try {
        fs.unlinkSync(filepath);
        logger.info(`[VideoDownloader] Cleaned up: ${filepath}`);
      } catch (error: any) {
        logger.warn(`[VideoDownloader] Failed to cleanup ${filepath}: ${error.message}`);
      }
    }
  }

  /**
   * Cleanup all old temporary video files in the temp directory
   * Should be called on server startup
   */
  static cleanupOldFiles(): void {
    try {
      const tempDir = os.tmpdir();
      const files = fs.readdirSync(tempDir);
      const prefixes = ['insta_reel_', 'youtube_video_', 'tiktok_video_', 'yori_video_', 'instagram_video_'];
      
      let count = 0;
      for (const file of files) {
        if (prefixes.some(p => file.startsWith(p))) {
          const filePath = path.join(tempDir, file);
          const stats = fs.statSync(filePath);
          
          // Only delete files older than 1 hour to avoid deleting active downloads
          if (Date.now() - stats.mtimeMs > VIDEO_CONFIG.CLEANUP_AGE_MS) {
            fs.unlinkSync(filePath);
            count++;
          }
        }
      }
      if (count > 0) logger.info(`[VideoDownloader] Cleaned up ${count} orphaned video files (>1hr old)`);
    } catch (error: any) {
      logger.error(`[VideoDownloader] Startup cleanup failed: ${error.message}`);
    }
  }
}

