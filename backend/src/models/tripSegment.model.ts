import { query } from '../config/database';
import { TripSegment, TripSegmentWithStats, CurrentSegmentInfo } from '../types';
import logger from '../config/logger';

export class TripSegmentModel {
  /**
   * Create a new trip segment
   */
  static async create(
    tripGroupId: string,
    city: string,
    startDate: Date,
    endDate: Date,
    createdBy: string,
    options?: {
      area?: string;
      country?: string;
      timezone?: string;
      accommodationName?: string;
      accommodationAddress?: string;
      accommodationLat?: number;
      accommodationLng?: number;
      accommodationPlaceId?: string;
      notes?: string;
    }
  ): Promise<TripSegment> {
    // Get the next order index
    const orderResult = await query(
      `SELECT COALESCE(MAX(order_index), -1) + 1 as next_order 
       FROM trip_segments WHERE trip_group_id = $1`,
      [tripGroupId]
    );
    const orderIndex = orderResult.rows[0]?.next_order || 0;

    const result = await query(
      `INSERT INTO trip_segments 
       (trip_group_id, city, area, country, timezone, start_date, end_date,
        accommodation_name, accommodation_address, accommodation_lat, accommodation_lng,
        accommodation_place_id, order_index, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING *`,
      [
        tripGroupId,
        city,
        options?.area,
        options?.country,
        options?.timezone || 'UTC',
        startDate,
        endDate,
        options?.accommodationName,
        options?.accommodationAddress,
        options?.accommodationLat,
        options?.accommodationLng,
        options?.accommodationPlaceId,
        orderIndex,
        options?.notes,
        createdBy,
      ]
    );

    logger.info(`Created trip segment: ${city} for trip ${tripGroupId}`);
    return this.parseSegment(result.rows[0]);
  }

  /**
   * Find segment by ID
   */
  static async findById(id: string): Promise<TripSegment | null> {
    const result = await query('SELECT * FROM trip_segments WHERE id = $1', [id]);
    if (!result.rows[0]) return null;
    return this.parseSegment(result.rows[0]);
  }

  /**
   * Get all segments for a trip (ordered by order_index)
   */
  static async findByTrip(tripGroupId: string): Promise<TripSegment[]> {
    const result = await query(
      `SELECT * FROM trip_segments 
       WHERE trip_group_id = $1 
       ORDER BY order_index ASC, start_date ASC`,
      [tripGroupId]
    );
    return result.rows.map(this.parseSegment);
  }

  /**
   * Get segments with place statistics
   */
  static async findByTripWithStats(tripGroupId: string): Promise<TripSegmentWithStats[]> {
    const result = await query(
      `SELECT 
        ts.*,
        COUNT(DISTINCT si.id) FILTER (WHERE si.id IS NOT NULL) as places_count,
        COUNT(DISTINCT si.id) FILTER (WHERE si.status = 'visited') as visited_count
       FROM trip_segments ts
       LEFT JOIN saved_items si ON (
         si.trip_group_id = ts.trip_group_id 
         AND (
           si.area_name ILIKE '%' || ts.city || '%'
           OR si.location_name ILIKE '%' || ts.city || '%'
           OR si.segment_id = ts.id
         )
       )
       WHERE ts.trip_group_id = $1
       GROUP BY ts.id
       ORDER BY ts.order_index ASC, ts.start_date ASC`,
      [tripGroupId]
    );
    
    return result.rows.map((row: any) => ({
      ...this.parseSegment(row),
      places_count: parseInt(row.places_count) || 0,
      visited_count: parseInt(row.visited_count) || 0,
    }));
  }

  /**
   * Get current segment based on today's date
   */
  static async getCurrentSegment(tripGroupId: string, forDate?: Date): Promise<CurrentSegmentInfo> {
    const checkDate = forDate || new Date();
    const dateStr = checkDate.toISOString().split('T')[0];

    // Find segment that contains today's date
    const result = await query(
      `SELECT * FROM trip_segments 
       WHERE trip_group_id = $1 
       AND start_date <= $2 AND end_date >= $2
       ORDER BY order_index ASC
       LIMIT 1`,
      [tripGroupId, dateStr]
    );

    if (!result.rows[0]) {
      // No segment for today - check if between segments (transit day)
      const beforeAfter = await query(
        `SELECT 
          (SELECT end_date FROM trip_segments WHERE trip_group_id = $1 AND end_date < $2 ORDER BY end_date DESC LIMIT 1) as prev_end,
          (SELECT start_date FROM trip_segments WHERE trip_group_id = $1 AND start_date > $2 ORDER BY start_date ASC LIMIT 1) as next_start
        `,
        [tripGroupId, dateStr]
      );

      const prevEnd = beforeAfter.rows[0]?.prev_end;
      const nextStart = beforeAfter.rows[0]?.next_start;
      
      // If today is between two segments, it's a transit day
      const isTransitDay = !!(prevEnd && nextStart);

      return {
        segment: null,
        dayNumber: 0,
        totalDays: 0,
        daysRemaining: 0,
        isTransitDay,
      };
    }

    const segment = this.parseSegment(result.rows[0]);
    
    // Calculate day number within segment
    const segmentStart = new Date(segment.start_date);
    const segmentEnd = new Date(segment.end_date);
    const today = new Date(dateStr);
    
    const dayNumber = Math.floor((today.getTime() - segmentStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const totalDays = Math.floor((segmentEnd.getTime() - segmentStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const daysRemaining = totalDays - dayNumber;

    return {
      segment,
      dayNumber,
      totalDays,
      daysRemaining,
      isTransitDay: false,
    };
  }

  /**
   * Get next upcoming segment
   */
  static async getNextSegment(tripGroupId: string, afterDate?: Date): Promise<TripSegment | null> {
    const checkDate = afterDate || new Date();
    const dateStr = checkDate.toISOString().split('T')[0];

    const result = await query(
      `SELECT * FROM trip_segments 
       WHERE trip_group_id = $1 AND start_date > $2
       ORDER BY start_date ASC
       LIMIT 1`,
      [tripGroupId, dateStr]
    );

    if (!result.rows[0]) return null;
    return this.parseSegment(result.rows[0]);
  }

  /**
   * Update segment
   */
  static async update(
    id: string,
    updates: Partial<Omit<TripSegment, 'id' | 'trip_group_id' | 'created_at' | 'created_by'>>
  ): Promise<TripSegment | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    const fieldMap: Record<string, string> = {
      city: 'city',
      area: 'area',
      country: 'country',
      timezone: 'timezone',
      start_date: 'start_date',
      end_date: 'end_date',
      accommodation_name: 'accommodation_name',
      accommodation_address: 'accommodation_address',
      accommodation_lat: 'accommodation_lat',
      accommodation_lng: 'accommodation_lng',
      accommodation_place_id: 'accommodation_place_id',
      order_index: 'order_index',
      notes: 'notes',
    };

    for (const [key, dbField] of Object.entries(fieldMap)) {
      if ((updates as any)[key] !== undefined) {
        fields.push(`${dbField} = $${paramCount++}`);
        values.push((updates as any)[key]);
      }
    }

    if (fields.length === 0) return this.findById(id);

    values.push(id);

    const result = await query(
      `UPDATE trip_segments SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    if (!result.rows[0]) return null;
    return this.parseSegment(result.rows[0]);
  }

  /**
   * Delete segment
   */
  static async delete(id: string): Promise<boolean> {
    const result = await query('DELETE FROM trip_segments WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Reorder segments
   */
  static async reorder(tripGroupId: string, segmentIds: string[]): Promise<void> {
    for (let i = 0; i < segmentIds.length; i++) {
      await query(
        `UPDATE trip_segments SET order_index = $1 WHERE id = $2 AND trip_group_id = $3`,
        [i, segmentIds[i], tripGroupId]
      );
    }
  }

  /**
   * Get places count for a city within a trip
   */
  static async getPlacesCountForCity(tripGroupId: string, city: string): Promise<{ total: number; visited: number }> {
    const result = await query(
      `SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'visited') as visited
       FROM saved_items 
       WHERE trip_group_id = $1 
       AND (area_name ILIKE '%' || $2 || '%' OR location_name ILIKE '%' || $2 || '%')`,
      [tripGroupId, city]
    );

    return {
      total: parseInt(result.rows[0]?.total) || 0,
      visited: parseInt(result.rows[0]?.visited) || 0,
    };
  }

  /**
   * Link saved item to segment
   */
  static async linkItemToSegment(itemId: string, segmentId: string): Promise<void> {
    await query(
      `UPDATE saved_items SET segment_id = $1 WHERE id = $2`,
      [segmentId, itemId]
    );
  }

  /**
   * Auto-link places to segments based on city matching
   */
  static async autoLinkPlacesToSegments(tripGroupId: string): Promise<number> {
    const result = await query(
      `WITH segment_matches AS (
        SELECT si.id as item_id, ts.id as segment_id
        FROM saved_items si
        CROSS JOIN trip_segments ts
        WHERE si.trip_group_id = $1
        AND ts.trip_group_id = $1
        AND si.segment_id IS NULL
        AND (
          si.area_name ILIKE '%' || ts.city || '%'
          OR si.location_name ILIKE '%' || ts.city || '%'
        )
      )
      UPDATE saved_items si
      SET segment_id = sm.segment_id
      FROM segment_matches sm
      WHERE si.id = sm.item_id
      RETURNING si.id`,
      [tripGroupId]
    );

    const count = result.rowCount ?? 0;
    logger.info(`Auto-linked ${count} places to segments for trip ${tripGroupId}`);
    return count;
  }

  /**
   * Parse database row to TripSegment object
   */
  private static parseSegment(row: any): TripSegment {
    return {
      id: row.id,
      trip_group_id: row.trip_group_id,
      city: row.city,
      area: row.area,
      country: row.country,
      timezone: row.timezone,
      start_date: new Date(row.start_date),
      end_date: new Date(row.end_date),
      accommodation_name: row.accommodation_name,
      accommodation_address: row.accommodation_address,
      accommodation_lat: row.accommodation_lat ? parseFloat(row.accommodation_lat) : undefined,
      accommodation_lng: row.accommodation_lng ? parseFloat(row.accommodation_lng) : undefined,
      accommodation_place_id: row.accommodation_place_id,
      order_index: row.order_index,
      notes: row.notes,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
      created_by: row.created_by,
    };
  }
}

