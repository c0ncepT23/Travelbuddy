import { query } from '../config/database';
import { ScoutIntentRecord, DiscoveryIntentType } from '../types';

export class ScoutIntentModel {
  /**
   * Create a new scout intent
   */
  static async create(
    tripGroupId: string,
    userId: string,
    intent: {
      type: DiscoveryIntentType;
      item: string;
      city: string;
      vibe?: string;
      scout_query?: string;
    },
    results: any[] = []
  ): Promise<ScoutIntentRecord> {
    const result = await query(
      `INSERT INTO scout_intents 
       (trip_group_id, user_id, intent_type, item, city, vibe, scout_query, scout_results)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        tripGroupId,
        userId,
        intent.type,
        intent.item,
        intent.city,
        intent.vibe,
        intent.scout_query,
        JSON.stringify(results)
      ]
    );

    return result.rows[0];
  }

  /**
   * Find active scouts for a trip
   */
  static async findActiveByTrip(tripGroupId: string): Promise<ScoutIntentRecord[]> {
    const result = await query(
      `SELECT * FROM scout_intents 
       WHERE trip_group_id = $1 AND status = 'active'
       ORDER BY created_at DESC`,
      [tripGroupId]
    );
    return result.rows;
  }

  /**
   * Update scout status
   */
  static async updateStatus(id: string, status: 'active' | 'resolved' | 'dismissed'): Promise<void> {
    await query(
      'UPDATE scout_intents SET status = $1, updated_at = NOW() WHERE id = $2',
      [status, id]
    );
  }

  /**
   * Update scout results
   */
  static async updateResults(id: string, results: any[]): Promise<void> {
    await query(
      'UPDATE scout_intents SET scout_results = $1, updated_at = NOW() WHERE id = $2',
      [JSON.stringify(results), id]
    );
  }

  /**
   * Delete a scout intent
   */
  static async delete(id: string): Promise<void> {
    await query('DELETE FROM scout_intents WHERE id = $1', [id]);
  }
}

