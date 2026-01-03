import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import config from '../config/env';
import logger from '../config/logger';

export class VideoDownloader {
  /**
   * Download a video from a URL to a temporary file
   * Routes through IPRoyal Proxy to avoid being blocked
   */
  static async download(videoUrl: string, platform: string): Promise<string> {
    const tempDir = os.tmpdir();
    const filename = `${platform}_video_${crypto.randomUUID()}.mp4`;
    const filepath = path.join(tempDir, filename);

    logger.info(`[VideoDownloader] Downloading ${platform} video via Proxy to: ${filepath}`);

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
        timeout: 60000, // 60s timeout
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });

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
      if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
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
      const prefixes = ['insta_reel_', 'youtube_video_', 'tiktok_video_', 'yori_video_'];
      
      let count = 0;
      for (const file of files) {
        if (prefixes.some(p => file.startsWith(p))) {
          const filePath = path.join(tempDir, file);
          
          // Delete files older than 1 hour or just clean all on startup
          fs.unlinkSync(filePath);
          count++;
        }
      }
      if (count > 0) logger.info(`[VideoDownloader] Cleaned up ${count} orphaned video files`);
    } catch (error: any) {
      logger.error(`[VideoDownloader] Startup cleanup failed: ${error.message}`);
    }
  }
}

