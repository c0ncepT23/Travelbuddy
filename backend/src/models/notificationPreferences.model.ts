import { query } from '../config/database';
import { NotificationPreferences } from '../types';
import logger from '../config/logger';

export class NotificationPreferencesModel {
  /**
   * Get notification preferences for a user (and optionally for a specific trip)
   */
  static async findByUser(
    userId: string,
    tripGroupId?: string
  ): Promise<NotificationPreferences | null> {
    const result = await query(
      `SELECT * FROM notification_preferences 
       WHERE user_id = $1 AND (trip_group_id = $2 OR ($2 IS NULL AND trip_group_id IS NULL))
       ORDER BY trip_group_id NULLS LAST
       LIMIT 1`,
      [userId, tripGroupId || null]
    );

    if (!result.rows[0]) return null;
    return this.parsePreferences(result.rows[0]);
  }

  /**
   * Get or create default preferences for a user
   */
  static async getOrCreate(
    userId: string,
    tripGroupId?: string
  ): Promise<NotificationPreferences> {
    const existing = await this.findByUser(userId, tripGroupId);
    if (existing) return existing;

    // Create default preferences
    const result = await query(
      `INSERT INTO notification_preferences 
       (user_id, trip_group_id, morning_briefing, meal_suggestions, nearby_alerts, 
        evening_recap, segment_alerts, quiet_start, quiet_end, max_daily_notifications)
       VALUES ($1, $2, true, true, true, true, true, '22:00', '07:00', 10)
       RETURNING *`,
      [userId, tripGroupId || null]
    );

    logger.info(`[NotificationPrefs] Created defaults for user ${userId}`);
    return this.parsePreferences(result.rows[0]);
  }

  /**
   * Update notification preferences
   */
  static async update(
    userId: string,
    updates: Partial<Omit<NotificationPreferences, 'id' | 'user_id' | 'created_at' | 'updated_at'>>,
    tripGroupId?: string
  ): Promise<NotificationPreferences> {
    // Ensure preferences exist
    await this.getOrCreate(userId, tripGroupId);

    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    const fieldMap: Record<string, string> = {
      morning_briefing: 'morning_briefing',
      meal_suggestions: 'meal_suggestions',
      nearby_alerts: 'nearby_alerts',
      evening_recap: 'evening_recap',
      segment_alerts: 'segment_alerts',
      quiet_start: 'quiet_start',
      quiet_end: 'quiet_end',
      max_daily_notifications: 'max_daily_notifications',
    };

    for (const [key, dbField] of Object.entries(fieldMap)) {
      if ((updates as any)[key] !== undefined) {
        fields.push(`${dbField} = $${paramCount++}`);
        values.push((updates as any)[key]);
      }
    }

    if (fields.length === 0) {
      return (await this.findByUser(userId, tripGroupId))!;
    }

    values.push(userId);
    const userParamIdx = paramCount++;
    
    let whereClause = `user_id = $${userParamIdx}`;
    if (tripGroupId) {
      values.push(tripGroupId);
      whereClause += ` AND trip_group_id = $${paramCount}`;
    } else {
      whereClause += ` AND trip_group_id IS NULL`;
    }

    const result = await query(
      `UPDATE notification_preferences 
       SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE ${whereClause}
       RETURNING *`,
      values
    );

    logger.info(`[NotificationPrefs] Updated for user ${userId}`);
    return this.parsePreferences(result.rows[0]);
  }

  /**
   * Check if notifications should be sent based on quiet hours
   */
  static async isQuietTime(userId: string, timezone?: string): Promise<boolean> {
    const prefs = await this.findByUser(userId);
    if (!prefs) return false;

    const tz = timezone || 'UTC';
    const now = new Date();
    
    // Convert to user's timezone
    const userTime = new Date(now.toLocaleString('en-US', { timeZone: tz }));
    const currentTime = userTime.toTimeString().substring(0, 5); // HH:MM
    
    const quietStart = prefs.quiet_start;
    const quietEnd = prefs.quiet_end;

    // Handle overnight quiet hours (e.g., 22:00 to 07:00)
    if (quietStart > quietEnd) {
      return currentTime >= quietStart || currentTime < quietEnd;
    }
    
    return currentTime >= quietStart && currentTime < quietEnd;
  }

  /**
   * Get all users who should receive morning briefing now
   */
  static async getUsersForMorningBriefing(targetHour: number = 8): Promise<Array<{
    userId: string;
    tripGroupId: string;
    timezone: string;
  }>> {
    // Find users who:
    // 1. Have morning_briefing enabled
    // 2. Are in a trip with an active segment (trip is happening now)
    // 3. Current time in their timezone is around targetHour
    const result = await query(
      `SELECT DISTINCT 
         np.user_id, 
         ts.trip_group_id,
         COALESCE(ts.timezone, 'UTC') as timezone
       FROM notification_preferences np
       INNER JOIN trip_members tm ON np.user_id = tm.user_id
       INNER JOIN trip_segments ts ON tm.trip_group_id = ts.trip_group_id
       WHERE np.morning_briefing = true
         AND ts.start_date <= CURRENT_DATE
         AND ts.end_date >= CURRENT_DATE
         AND (np.trip_group_id IS NULL OR np.trip_group_id = ts.trip_group_id)`,
      []
    );

    // Filter by current hour in user's timezone
    return result.rows.filter((row: any) => {
      try {
        const now = new Date();
        const userTime = new Date(now.toLocaleString('en-US', { timeZone: row.timezone }));
        const userHour = userTime.getHours();
        return userHour === targetHour;
      } catch {
        return false;
      }
    }).map((row: any) => ({
      userId: row.user_id,
      tripGroupId: row.trip_group_id,
      timezone: row.timezone,
    }));
  }

  /**
   * Get users who should receive evening recap
   */
  static async getUsersForEveningRecap(targetHour: number = 20): Promise<Array<{
    userId: string;
    tripGroupId: string;
    timezone: string;
  }>> {
    const result = await query(
      `SELECT DISTINCT 
         np.user_id, 
         ts.trip_group_id,
         COALESCE(ts.timezone, 'UTC') as timezone
       FROM notification_preferences np
       INNER JOIN trip_members tm ON np.user_id = tm.user_id
       INNER JOIN trip_segments ts ON tm.trip_group_id = ts.trip_group_id
       WHERE np.evening_recap = true
         AND ts.start_date <= CURRENT_DATE
         AND ts.end_date >= CURRENT_DATE
         AND (np.trip_group_id IS NULL OR np.trip_group_id = ts.trip_group_id)`,
      []
    );

    return result.rows.filter((row: any) => {
      try {
        const now = new Date();
        const userTime = new Date(now.toLocaleString('en-US', { timeZone: row.timezone }));
        return userTime.getHours() === targetHour;
      } catch {
        return false;
      }
    }).map((row: any) => ({
      userId: row.user_id,
      tripGroupId: row.trip_group_id,
      timezone: row.timezone,
    }));
  }

  /**
   * Check if user has nearby alerts enabled
   */
  static async hasNearbyAlertsEnabled(userId: string, tripGroupId?: string): Promise<boolean> {
    const prefs = await this.findByUser(userId, tripGroupId);
    return prefs?.nearby_alerts ?? true;
  }

  /**
   * Parse database row to NotificationPreferences
   */
  private static parsePreferences(row: any): NotificationPreferences {
    return {
      id: row.id,
      user_id: row.user_id,
      trip_group_id: row.trip_group_id,
      morning_briefing: row.morning_briefing,
      meal_suggestions: row.meal_suggestions,
      nearby_alerts: row.nearby_alerts,
      evening_recap: row.evening_recap,
      segment_alerts: row.segment_alerts,
      quiet_start: row.quiet_start,
      quiet_end: row.quiet_end,
      max_daily_notifications: row.max_daily_notifications,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
    };
  }
}

