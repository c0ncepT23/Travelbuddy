import { query } from '../config/database';
import logger from '../config/logger';

export interface VideoCacheItem {
  id: string;
  video_id: string;
  platform: string;
  url: string;
  title?: string;
  channel_name?: string;
  thumbnail_url?: string;
  transcript?: string;
  summary?: string;
  video_type?: string;
  destination?: string;
  destination_country?: string;
  places_json?: any[];
  discovery_intent_json?: any;
  created_at: Date;
  hit_count: number;
}

export class VideoCacheModel {
  /**
   * Get cached result for a video
   */
  static async get(videoId: string, platform: string): Promise<VideoCacheItem | null> {
    try {
      const result = await query(
        `SELECT * FROM video_cache 
         WHERE video_id = $1 AND platform = $2
         AND (expires_at IS NULL OR expires_at > NOW())`,
        [videoId, platform]
      );

      if (result.rows.length === 0) {
        return null;
      }

      // Update hit count
      await query(
        `UPDATE video_cache SET hit_count = hit_count + 1, last_hit_at = NOW() WHERE id = $1`,
        [result.rows[0].id]
      );

      logger.info(`[VideoCache] HIT for ${platform}:${videoId} (${result.rows[0].hit_count + 1} total hits)`);
      return result.rows[0];
    } catch (error: any) {
      logger.error('[VideoCache] Get error:', error.message);
      return null;
    }
  }

  /**
   * Save extraction results to cache
   */
  static async set(data: {
    videoId: string;
    platform: string;
    url: string;
    title?: string;
    channelName?: string;
    thumbnailUrl?: string;
    transcript?: string;
    summary?: string;
    videoType?: string;
    destination?: string;
    destinationCountry?: string;
    places?: any[];
    discoveryIntent?: any;
    expiresInDays?: number; // Optional TTL in days
  }): Promise<VideoCacheItem> {
    const expiresAt = data.expiresInDays 
      ? new Date(Date.now() + data.expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    const result = await query(
      `INSERT INTO video_cache 
       (video_id, platform, url, title, channel_name, thumbnail_url, transcript,
        summary, video_type, destination, destination_country, places_json, discovery_intent_json, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       ON CONFLICT (video_id, platform) 
       DO UPDATE SET
         title = COALESCE(EXCLUDED.title, video_cache.title),
         channel_name = COALESCE(EXCLUDED.channel_name, video_cache.channel_name),
         summary = COALESCE(EXCLUDED.summary, video_cache.summary),
         places_json = COALESCE(EXCLUDED.places_json, video_cache.places_json),
         discovery_intent_json = COALESCE(EXCLUDED.discovery_intent_json, video_cache.discovery_intent_json)
       RETURNING *`,
      [
        data.videoId,
        data.platform,
        data.url,
        data.title,
        data.channelName,
        data.thumbnailUrl,
        data.transcript,
        data.summary,
        data.videoType,
        data.destination,
        data.destinationCountry,
        data.places ? JSON.stringify(data.places) : null,
        data.discoveryIntent ? JSON.stringify(data.discoveryIntent) : null,
        expiresAt,
      ]
    );

    logger.info(`[VideoCache] SAVED ${data.platform}:${data.videoId} - ${data.places?.length || 0} places`);
    return result.rows[0];
  }

  /**
   * Delete old cache entries
   */
  static async cleanup(daysOld: number = 90): Promise<number> {
    const result = await query(
      `DELETE FROM video_cache WHERE created_at < NOW() - INTERVAL '${daysOld} days'`
    );
    return result.rowCount || 0;
  }

  /**
   * Get cache stats
   */
  static async getStats(): Promise<{ totalCached: number; totalHits: number }> {
    const result = await query(
      `SELECT COUNT(*) as total, SUM(hit_count) as hits FROM video_cache`
    );
    return {
      totalCached: parseInt(result.rows[0].total || '0'),
      totalHits: parseInt(result.rows[0].hits || '0'),
    };
  }
}

