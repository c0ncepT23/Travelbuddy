import { query } from '../config/database';

export interface DiscoveryQueueItem {
  id: string;
  user_id: string;
  trip_group_id: string;
  item: string;
  city: string;
  country?: string;
  vibe?: string;
  source_url?: string;
  source_title?: string;
  source_platform?: string;
  status: 'pending' | 'explored' | 'saved' | 'dismissed';
  created_at: Date;
  explored_at?: Date;
  updated_at: Date;
}

export class DiscoveryQueueModel {
  /**
   * Add an item to the discovery queue
   * Uses upsert to avoid duplicates for same item/city
   */
  static async add(
    userId: string,
    tripGroupId: string,
    data: {
      item: string;
      city: string;
      country?: string;
      vibe?: string;
      source_url?: string;
      source_title?: string;
      source_platform?: string;
    }
  ): Promise<DiscoveryQueueItem> {
    const result = await query(
      `INSERT INTO discovery_queue 
       (user_id, trip_group_id, item, city, country, vibe, source_url, source_title, source_platform)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (user_id, LOWER(item), LOWER(city)) WHERE status = 'pending'
       DO UPDATE SET 
         source_url = COALESCE(EXCLUDED.source_url, discovery_queue.source_url),
         source_title = COALESCE(EXCLUDED.source_title, discovery_queue.source_title),
         updated_at = NOW()
       RETURNING *`,
      [
        userId,
        tripGroupId,
        data.item,
        data.city,
        data.country,
        data.vibe,
        data.source_url,
        data.source_title,
        data.source_platform
      ]
    );

    return result.rows[0];
  }

  /**
   * Get pending queue items for a user, optionally filtered by country
   */
  static async getPendingByUser(
    userId: string,
    country?: string
  ): Promise<DiscoveryQueueItem[]> {
    let sql = `
      SELECT * FROM discovery_queue 
      WHERE user_id = $1 AND status = 'pending'
    `;
    const params: any[] = [userId];

    if (country) {
      sql += ` AND LOWER(country) = LOWER($2)`;
      params.push(country);
    }

    sql += ` ORDER BY created_at DESC`;

    const result = await query(sql, params);
    return result.rows;
  }

  /**
   * Get pending queue items for a trip
   */
  static async getPendingByTrip(tripGroupId: string): Promise<DiscoveryQueueItem[]> {
    const result = await query(
      `SELECT * FROM discovery_queue 
       WHERE trip_group_id = $1 AND status = 'pending'
       ORDER BY created_at DESC`,
      [tripGroupId]
    );
    return result.rows;
  }

  /**
   * Get pending queue items for a specific city
   */
  static async getPendingByCity(
    userId: string,
    city: string
  ): Promise<DiscoveryQueueItem[]> {
    const result = await query(
      `SELECT * FROM discovery_queue 
       WHERE user_id = $1 AND LOWER(city) = LOWER($2) AND status = 'pending'
       ORDER BY created_at DESC`,
      [userId, city]
    );
    return result.rows;
  }

  /**
   * Mark an item as explored (user tapped on it)
   */
  static async markExplored(id: string): Promise<void> {
    await query(
      `UPDATE discovery_queue 
       SET status = 'explored', explored_at = NOW() 
       WHERE id = $1`,
      [id]
    );
  }

  /**
   * Mark an item as saved (user saved a place from suggestions)
   */
  static async markSaved(id: string): Promise<void> {
    await query(
      `UPDATE discovery_queue SET status = 'saved' WHERE id = $1`,
      [id]
    );
  }

  /**
   * Dismiss an item (user no longer interested)
   */
  static async dismiss(id: string): Promise<void> {
    await query(
      `UPDATE discovery_queue SET status = 'dismissed' WHERE id = $1`,
      [id]
    );
  }

  /**
   * Get a single item by ID
   */
  static async getById(id: string): Promise<DiscoveryQueueItem | null> {
    const result = await query(
      `SELECT * FROM discovery_queue WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Delete old dismissed/saved items (cleanup)
   */
  static async cleanupOld(daysOld: number = 30): Promise<number> {
    const result = await query(
      `DELETE FROM discovery_queue 
       WHERE status IN ('dismissed', 'saved') 
       AND updated_at < NOW() - INTERVAL '${daysOld} days'`
    );
    return result.rowCount || 0;
  }

  /**
   * Count pending items for a user in a specific country
   */
  static async countPendingByCountry(
    userId: string,
    country: string
  ): Promise<number> {
    const result = await query(
      `SELECT COUNT(*) as count FROM discovery_queue 
       WHERE user_id = $1 AND LOWER(country) = LOWER($2) AND status = 'pending'`,
      [userId, country]
    );
    return parseInt(result.rows[0]?.count || '0', 10);
  }
}

