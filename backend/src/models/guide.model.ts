import { query } from '../config/database';
import logger from '../config/logger';

export interface Guide {
  id: string;
  trip_group_id: string;
  source_url: string;
  source_type: 'youtube' | 'instagram' | 'reddit' | 'tiktok' | 'url';
  title: string;
  creator_name: string;
  creator_channel_id?: string;
  thumbnail_url?: string;
  has_day_structure: boolean;
  total_days: number;
  total_places: number;
  summary?: string;
  created_at: Date;
  updated_at: Date;
  added_by: string;
}

export interface GuidePlace {
  id: string;
  guide_id: string;
  saved_item_id: string;
  guide_day_number: number | null;
  order_in_day: number;
  guide_notes?: string;
  created_at: Date;
}

export interface GuideWithPlaces extends Guide {
  places: Array<{
    saved_item_id: string;
    guide_day_number: number | null;
    order_in_day: number;
    guide_notes?: string;
    // Joined from saved_items
    name: string;
    category: string;
    location_name?: string;
    location_lat?: number;
    location_lng?: number;
    rating?: number;
    area_name?: string;
    photos_json?: any;
    // User's plan status
    planned_day: number | null;
    day_order: number | null;
    status: string;
  }>;
}

export interface GuideDayGroup {
  day: number | null; // null for guides without day structure
  places: GuideWithPlaces['places'];
}

export class GuideModel {
  /**
   * Create a new guide
   */
  static async create(
    tripGroupId: string,
    sourceUrl: string,
    addedBy: string,
    options: {
      sourceType?: Guide['source_type'];
      title?: string;
      creatorName?: string;
      creatorChannelId?: string;
      thumbnailUrl?: string;
      hasDayStructure?: boolean;
      totalDays?: number;
      summary?: string;
    }
  ): Promise<Guide> {
    const result = await query(
      `INSERT INTO guides 
       (trip_group_id, source_url, source_type, title, creator_name, 
        creator_channel_id, thumbnail_url, has_day_structure, total_days, summary, added_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (trip_group_id, source_url) 
       DO UPDATE SET 
         title = COALESCE(EXCLUDED.title, guides.title),
         creator_name = COALESCE(EXCLUDED.creator_name, guides.creator_name),
         thumbnail_url = COALESCE(EXCLUDED.thumbnail_url, guides.thumbnail_url),
         has_day_structure = EXCLUDED.has_day_structure,
         total_days = EXCLUDED.total_days,
         summary = COALESCE(EXCLUDED.summary, guides.summary),
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [
        tripGroupId,
        sourceUrl,
        options.sourceType || 'youtube',
        options.title,
        options.creatorName,
        options.creatorChannelId,
        options.thumbnailUrl,
        options.hasDayStructure || false,
        options.totalDays || 0,
        options.summary,
        addedBy,
      ]
    );

    logger.info(`Created/updated guide: ${options.title} by ${options.creatorName}`);
    return this.parseGuide(result.rows[0]);
  }

  /**
   * Find guide by ID
   */
  static async findById(id: string): Promise<Guide | null> {
    const result = await query('SELECT * FROM guides WHERE id = $1', [id]);
    if (!result.rows[0]) return null;
    return this.parseGuide(result.rows[0]);
  }

  /**
   * Find guide by source URL for a trip
   */
  static async findBySourceUrl(tripGroupId: string, sourceUrl: string): Promise<Guide | null> {
    const result = await query(
      'SELECT * FROM guides WHERE trip_group_id = $1 AND source_url = $2',
      [tripGroupId, sourceUrl]
    );
    if (!result.rows[0]) return null;
    return this.parseGuide(result.rows[0]);
  }

  /**
   * Find all guides for a trip
   */
  static async findByTrip(tripGroupId: string): Promise<Guide[]> {
    const result = await query(
      `SELECT * FROM guides 
       WHERE trip_group_id = $1 
       ORDER BY created_at DESC`,
      [tripGroupId]
    );
    return result.rows.map(this.parseGuide);
  }

  /**
   * Get guide with all its places (joined with saved_items)
   */
  static async getGuideWithPlaces(guideId: string): Promise<GuideWithPlaces | null> {
    const guide = await this.findById(guideId);
    if (!guide) return null;

    const placesResult = await query(
      `SELECT 
         gp.saved_item_id,
         gp.guide_day_number,
         gp.order_in_day,
         gp.guide_notes,
         si.name,
         si.category,
         si.location_name,
         si.location_lat,
         si.location_lng,
         si.rating,
         si.area_name,
         si.photos_json,
         si.planned_day,
         si.day_order,
         si.status
       FROM guide_places gp
       JOIN saved_items si ON si.id = gp.saved_item_id
       WHERE gp.guide_id = $1
       ORDER BY gp.guide_day_number NULLS LAST, gp.order_in_day`,
      [guideId]
    );

    return {
      ...guide,
      places: placesResult.rows.map((row: any) => ({
        saved_item_id: row.saved_item_id,
        guide_day_number: row.guide_day_number,
        order_in_day: row.order_in_day,
        guide_notes: row.guide_notes,
        name: row.name,
        category: row.category,
        location_name: row.location_name,
        location_lat: row.location_lat ? parseFloat(row.location_lat) : undefined,
        location_lng: row.location_lng ? parseFloat(row.location_lng) : undefined,
        rating: row.rating ? parseFloat(row.rating) : undefined,
        area_name: row.area_name,
        photos_json: row.photos_json,
        planned_day: row.planned_day,
        day_order: row.day_order,
        status: row.status,
      })),
    };
  }

  /**
   * Get all guides for a trip with their places
   */
  static async getGuidesWithPlaces(tripGroupId: string): Promise<GuideWithPlaces[]> {
    const guides = await this.findByTrip(tripGroupId);
    const guidesWithPlaces: GuideWithPlaces[] = [];

    for (const guide of guides) {
      const withPlaces = await this.getGuideWithPlaces(guide.id);
      if (withPlaces) {
        guidesWithPlaces.push(withPlaces);
      }
    }

    return guidesWithPlaces;
  }

  /**
   * Get guide places grouped by day
   */
  static async getGuidePlacesByDay(guideId: string): Promise<GuideDayGroup[]> {
    const guideWithPlaces = await this.getGuideWithPlaces(guideId);
    if (!guideWithPlaces) return [];

    // Group by day
    const dayMap = new Map<number | null, GuideWithPlaces['places']>();

    for (const place of guideWithPlaces.places) {
      const day = place.guide_day_number;
      if (!dayMap.has(day)) {
        dayMap.set(day, []);
      }
      dayMap.get(day)!.push(place);
    }

    // Convert to array and sort
    const groups: GuideDayGroup[] = [];
    const sortedDays = Array.from(dayMap.keys()).sort((a, b) => {
      if (a === null) return 1;
      if (b === null) return -1;
      return a - b;
    });

    for (const day of sortedDays) {
      groups.push({
        day,
        places: dayMap.get(day)!,
      });
    }

    return groups;
  }

  /**
   * Add a place to a guide
   */
  static async addPlace(
    guideId: string,
    savedItemId: string,
    guideDayNumber: number | null,
    orderInDay?: number
  ): Promise<GuidePlace> {
    // Get order if not specified
    let order = orderInDay;
    if (order === undefined) {
      const orderResult = await query(
        `SELECT COALESCE(MAX(order_in_day), -1) + 1 as next_order 
         FROM guide_places 
         WHERE guide_id = $1 AND guide_day_number IS NOT DISTINCT FROM $2`,
        [guideId, guideDayNumber]
      );
      order = orderResult.rows[0]?.next_order || 0;
    }

    const result = await query(
      `INSERT INTO guide_places (guide_id, saved_item_id, guide_day_number, order_in_day)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (guide_id, saved_item_id) 
       DO UPDATE SET 
         guide_day_number = EXCLUDED.guide_day_number,
         order_in_day = EXCLUDED.order_in_day
       RETURNING *`,
      [guideId, savedItemId, guideDayNumber, order]
    );

    // Update total places count
    await this.updatePlaceCount(guideId);

    return result.rows[0];
  }

  /**
   * Remove a place from a guide
   */
  static async removePlace(guideId: string, savedItemId: string): Promise<boolean> {
    const result = await query(
      'DELETE FROM guide_places WHERE guide_id = $1 AND saved_item_id = $2',
      [guideId, savedItemId]
    );

    if ((result.rowCount ?? 0) > 0) {
      await this.updatePlaceCount(guideId);
      return true;
    }
    return false;
  }

  /**
   * Update total places count for a guide
   */
  private static async updatePlaceCount(guideId: string): Promise<void> {
    await query(
      `UPDATE guides 
       SET total_places = (
         SELECT COUNT(*) FROM guide_places WHERE guide_id = $1
       ),
       updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [guideId]
    );
  }

  /**
   * Delete a guide (cascade deletes guide_places)
   */
  static async delete(id: string): Promise<boolean> {
    const result = await query('DELETE FROM guides WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Check if a saved item is already added to user's plan
   */
  static async isPlaceInUserPlan(savedItemId: string): Promise<{ inPlan: boolean; plannedDay: number | null }> {
    const result = await query(
      'SELECT planned_day FROM saved_items WHERE id = $1',
      [savedItemId]
    );
    
    if (!result.rows[0]) {
      return { inPlan: false, plannedDay: null };
    }
    
    return {
      inPlan: result.rows[0].planned_day !== null,
      plannedDay: result.rows[0].planned_day,
    };
  }

  /**
   * Get all guides that contain a specific place
   */
  static async getGuidesContainingPlace(savedItemId: string): Promise<Array<{ guide: Guide; dayNumber: number | null }>> {
    const result = await query(
      `SELECT g.*, gp.guide_day_number
       FROM guides g
       JOIN guide_places gp ON gp.guide_id = g.id
       WHERE gp.saved_item_id = $1
       ORDER BY g.created_at DESC`,
      [savedItemId]
    );

    return result.rows.map((row: any) => ({
      guide: this.parseGuide(row),
      dayNumber: row.guide_day_number,
    }));
  }

  /**
   * Parse database row to Guide
   */
  private static parseGuide(row: any): Guide {
    return {
      id: row.id,
      trip_group_id: row.trip_group_id,
      source_url: row.source_url,
      source_type: row.source_type,
      title: row.title,
      creator_name: row.creator_name,
      creator_channel_id: row.creator_channel_id,
      thumbnail_url: row.thumbnail_url,
      has_day_structure: row.has_day_structure,
      total_days: row.total_days || 0,
      total_places: row.total_places || 0,
      summary: row.summary,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
      added_by: row.added_by,
    };
  }
}

