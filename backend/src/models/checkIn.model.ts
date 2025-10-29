import { query } from '../config/database';

export interface CheckIn {
  id: string;
  user_id: string;
  trip_group_id: string;
  saved_item_id: string;
  checked_in_at: Date;
  checked_out_at?: Date;
  duration_minutes?: number;
  rating?: number;
  note?: string;
  cost?: number;
  currency?: string;
  photos?: string[];
  actual_location_lat?: number;
  actual_location_lng?: number;
  weather?: string;
  with_users?: string[];
  is_auto_checkin?: boolean;
  is_visible?: boolean;
  shared_publicly?: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface TimelineItem extends CheckIn {
  place_name: string;
  place_category: string;
  place_description: string;
  location_name?: string;
  location_lat?: number;
  location_lng?: number;
  location_confidence?: string;
  username: string;
}

export interface DayTimeline {
  date: string; // YYYY-MM-DD
  day_number: number;
  check_ins: TimelineItem[];
  stats: {
    total_places: number;
    total_duration_minutes: number;
    total_cost: number;
    avg_rating?: number;
  };
}

export class CheckInModel {
  /**
   * Create a new check-in
   */
  static async create(data: {
    userId: string;
    tripGroupId: string;
    savedItemId: string;
    checkedInAt?: Date;
    rating?: number;
    note?: string;
    cost?: number;
    currency?: string;
    photos?: string[];
    actualLocationLat?: number;
    actualLocationLng?: number;
    weather?: string;
    withUsers?: string[];
    isAutoCheckIn?: boolean;
    isVisible?: boolean;
    sharedPublicly?: boolean;
  }): Promise<CheckIn> {
    const result = await query(
      `INSERT INTO check_ins 
       (user_id, trip_group_id, saved_item_id, checked_in_at, rating, note, 
        cost, currency, photos, actual_location_lat, actual_location_lng,
        weather, with_users, is_auto_checkin, is_visible, shared_publicly)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       RETURNING *`,
      [
        data.userId,
        data.tripGroupId,
        data.savedItemId,
        data.checkedInAt || new Date(),
        data.rating,
        data.note,
        data.cost,
        data.currency || 'USD',
        data.photos ? JSON.stringify(data.photos) : '[]',
        data.actualLocationLat,
        data.actualLocationLng,
        data.weather,
        data.withUsers ? JSON.stringify(data.withUsers) : '[]',
        data.isAutoCheckIn || false,
        data.isVisible !== undefined ? data.isVisible : true,
        data.sharedPublicly || false,
      ]
    );

    return result.rows[0];
  }

  /**
   * Get check-in by ID
   */
  static async findById(id: string): Promise<CheckIn | null> {
    const result = await query('SELECT * FROM check_ins WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  /**
   * Get all check-ins for a trip
   */
  static async findByTrip(tripGroupId: string): Promise<CheckIn[]> {
    const result = await query(
      `SELECT * FROM check_ins 
       WHERE trip_group_id = $1 
       ORDER BY checked_in_at DESC`,
      [tripGroupId]
    );
    return result.rows;
  }

  /**
   * Get timeline view for a trip
   */
  static async getTimeline(tripGroupId: string): Promise<TimelineItem[]> {
    const result = await query(
      `SELECT * FROM trip_timeline 
       WHERE trip_group_id = $1 
       ORDER BY checked_in_at ASC`,
      [tripGroupId]
    );
    return result.rows;
  }

  /**
   * Get timeline grouped by day
   */
  static async getTimelineByDay(tripGroupId: string): Promise<DayTimeline[]> {
    const timeline = await this.getTimeline(tripGroupId);
    
    // Get trip start date for day numbering
    const tripResult = await query(
      'SELECT start_date FROM trip_groups WHERE id = $1',
      [tripGroupId]
    );
    const tripStartDate = tripResult.rows[0]?.start_date;

    // Group by date
    const byDate = new Map<string, TimelineItem[]>();
    
    for (const item of timeline) {
      const date = new Date(item.checked_in_at).toISOString().split('T')[0];
      if (!byDate.has(date)) {
        byDate.set(date, []);
      }
      byDate.get(date)!.push(item);
    }

    // Convert to array with stats
    const result: DayTimeline[] = [];
    let dayNumber = 1;

    for (const [date, checkIns] of Array.from(byDate.entries()).sort()) {
      const totalDuration = checkIns.reduce((sum, ci) => sum + (ci.duration_minutes || 0), 0);
      const totalCost = checkIns.reduce((sum, ci) => sum + (ci.cost || 0), 0);
      const ratings = checkIns.filter(ci => ci.rating).map(ci => ci.rating!);
      const avgRating = ratings.length > 0 
        ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length 
        : undefined;

      // Calculate day number from trip start
      if (tripStartDate) {
        const startDate = new Date(tripStartDate);
        const currentDate = new Date(date);
        dayNumber = Math.floor((currentDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      }

      result.push({
        date,
        day_number: dayNumber,
        check_ins: checkIns,
        stats: {
          total_places: checkIns.length,
          total_duration_minutes: totalDuration,
          total_cost: totalCost,
          avg_rating: avgRating,
        },
      });
      
      dayNumber++;
    }

    return result;
  }

  /**
   * Update check-in
   */
  static async update(
    id: string,
    updates: Partial<{
      checkedOutAt: Date;
      rating: number;
      note: string;
      cost: number;
      currency: string;
      photos: string[];
      weather: string;
      withUsers: string[];
      isVisible: boolean;
      sharedPublicly: boolean;
    }>
  ): Promise<CheckIn | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (updates.checkedOutAt !== undefined) {
      fields.push(`checked_out_at = $${paramCount++}`);
      values.push(updates.checkedOutAt);
    }

    if (updates.rating !== undefined) {
      fields.push(`rating = $${paramCount++}`);
      values.push(updates.rating);
    }

    if (updates.note !== undefined) {
      fields.push(`note = $${paramCount++}`);
      values.push(updates.note);
    }

    if (updates.cost !== undefined) {
      fields.push(`cost = $${paramCount++}`);
      values.push(updates.cost);
    }

    if (updates.currency !== undefined) {
      fields.push(`currency = $${paramCount++}`);
      values.push(updates.currency);
    }

    if (updates.photos !== undefined) {
      fields.push(`photos = $${paramCount++}`);
      values.push(JSON.stringify(updates.photos));
    }

    if (updates.weather !== undefined) {
      fields.push(`weather = $${paramCount++}`);
      values.push(updates.weather);
    }

    if (updates.withUsers !== undefined) {
      fields.push(`with_users = $${paramCount++}`);
      values.push(JSON.stringify(updates.withUsers));
    }

    if (updates.isVisible !== undefined) {
      fields.push(`is_visible = $${paramCount++}`);
      values.push(updates.isVisible);
    }

    if (updates.sharedPublicly !== undefined) {
      fields.push(`shared_publicly = $${paramCount++}`);
      values.push(updates.sharedPublicly);
    }

    if (fields.length === 0) return null;

    values.push(id);
    const result = await query(
      `UPDATE check_ins 
       SET ${fields.join(', ')}
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    );

    return result.rows[0] || null;
  }

  /**
   * Delete check-in
   */
  static async delete(id: string): Promise<boolean> {
    const result = await query('DELETE FROM check_ins WHERE id = $1', [id]);
    return result.rowCount! > 0;
  }

  /**
   * Get user's recent check-ins
   */
  static async getUserRecentCheckIns(userId: string, limit: number = 10): Promise<TimelineItem[]> {
    const result = await query(
      `SELECT * FROM trip_timeline 
       WHERE user_id = $1 
       ORDER BY checked_in_at DESC 
       LIMIT $2`,
      [userId, limit]
    );
    return result.rows;
  }

  /**
   * Check if user has already checked in to a place today
   */
  static async hasCheckedInToday(
    userId: string,
    savedItemId: string
  ): Promise<boolean> {
    const result = await query(
      `SELECT COUNT(*) as count FROM check_ins 
       WHERE user_id = $1 
       AND saved_item_id = $2 
       AND checked_in_at >= CURRENT_DATE`,
      [userId, savedItemId]
    );
    return parseInt(result.rows[0].count) > 0;
  }

  /**
   * Get trip statistics
   */
  static async getTripStats(tripGroupId: string) {
    const result = await query(
      'SELECT * FROM trip_stats WHERE trip_id = $1',
      [tripGroupId]
    );
    return result.rows[0] || null;
  }
}

