import { query } from '../config/database';
import { SavedItem, ItemCategory, ItemSourceType, ItemStatus } from '../types';

export class SavedItemModel {
  /**
   * Create a new saved item
   */
  static async create(
    tripGroupId: string,
    addedBy: string,
    name: string,
    category: ItemCategory,
    description: string,
    sourceType: ItemSourceType,
    locationName?: string,
    locationLat?: number,
    locationLng?: number,
    sourceUrl?: string,
    sourceTitle?: string,
    originalContent?: any,
    locationConfidence?: 'high' | 'medium' | 'low',
    locationConfidenceScore?: number,
    // Google Places enrichment fields
    googlePlaceId?: string,
    rating?: number,
    userRatingsTotal?: number,
    priceLevel?: number,
    formattedAddress?: string,
    areaName?: string,
    photosJson?: any[],
    openingHoursJson?: any
  ): Promise<SavedItem> {
    const result = await query(
      `INSERT INTO saved_items 
       (trip_group_id, added_by, name, category, description, location_name, 
        location_lat, location_lng, original_source_type, original_source_url, source_title, original_content,
        location_confidence, location_confidence_score, google_place_id, rating, user_ratings_total, 
        price_level, formatted_address, area_name, photos_json, opening_hours_json)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
       RETURNING *`,
      [
        tripGroupId,
        addedBy,
        name,
        category,
        description,
        locationName,
        locationLat,
        locationLng,
        sourceType,
        sourceUrl,
        sourceTitle,
        originalContent ? JSON.stringify(originalContent) : null,
        locationConfidence || 'low',
        locationConfidenceScore || 0,
        googlePlaceId,
        rating,
        userRatingsTotal,
        priceLevel,
        formattedAddress,
        areaName,
        photosJson ? JSON.stringify(photosJson) : null,
        openingHoursJson ? JSON.stringify(openingHoursJson) : null,
      ]
    );

    return result.rows[0];
  }

  /**
   * Find item by ID
   */
  static async findById(id: string): Promise<SavedItem | null> {
    const result = await query('SELECT * FROM saved_items WHERE id = $1', [id]);
    const row = result.rows[0];
    if (!row) return null;
    
    // Convert string lat/lng to numbers
    return {
      ...row,
      location_lat: row.location_lat ? parseFloat(row.location_lat) : null,
      location_lng: row.location_lng ? parseFloat(row.location_lng) : null,
    };
  }

  /**
   * Get all items for a trip
   */
  static async findByTrip(
    tripGroupId: string,
    filters?: {
      category?: ItemCategory;
      status?: ItemStatus;
      addedBy?: string;
    }
  ): Promise<SavedItem[]> {
    let queryText = 'SELECT * FROM saved_items WHERE trip_group_id = $1';
    const queryParams: any[] = [tripGroupId];
    let paramCount = 2;

    if (filters?.category) {
      queryText += ` AND category = $${paramCount++}`;
      queryParams.push(filters.category);
    }

    if (filters?.status) {
      queryText += ` AND status = $${paramCount++}`;
      queryParams.push(filters.status);
    }

    if (filters?.addedBy) {
      queryText += ` AND added_by = $${paramCount++}`;
      queryParams.push(filters.addedBy);
    }

    queryText += ' ORDER BY created_at DESC';

    const result = await query(queryText, queryParams);
    
    // Convert string lat/lng to numbers
    return result.rows.map((row: any) => ({
      ...row,
      location_lat: row.location_lat ? parseFloat(row.location_lat) : null,
      location_lng: row.location_lng ? parseFloat(row.location_lng) : null,
    }));
  }

  /**
   * Update item
   */
  static async update(
    id: string,
    updates: Partial<SavedItem>
  ): Promise<SavedItem | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (updates.name) {
      fields.push(`name = $${paramCount++}`);
      values.push(updates.name);
    }

    if (updates.category) {
      fields.push(`category = $${paramCount++}`);
      values.push(updates.category);
    }

    if (updates.description) {
      fields.push(`description = $${paramCount++}`);
      values.push(updates.description);
    }

    if (updates.status) {
      fields.push(`status = $${paramCount++}`);
      values.push(updates.status);
    }

    if (updates.location_name !== undefined) {
      fields.push(`location_name = $${paramCount++}`);
      values.push(updates.location_name);
    }

    if (updates.location_lat !== undefined) {
      fields.push(`location_lat = $${paramCount++}`);
      values.push(updates.location_lat);
    }

    if (updates.location_lng !== undefined) {
      fields.push(`location_lng = $${paramCount++}`);
      values.push(updates.location_lng);
    }

    if (updates.is_favorite !== undefined) {
      fields.push(`is_favorite = $${paramCount++}`);
      values.push(updates.is_favorite);
    }

    if (updates.is_must_visit !== undefined) {
      fields.push(`is_must_visit = $${paramCount++}`);
      values.push(updates.is_must_visit);
    }

    if (updates.planned_day !== undefined) {
      fields.push(`planned_day = $${paramCount++}`);
      values.push(updates.planned_day);
    }

    if (updates.day_order !== undefined) {
      fields.push(`day_order = $${paramCount++}`);
      values.push(updates.day_order);
    }

    if (updates.user_notes !== undefined) {
      fields.push(`user_notes = $${paramCount++}`);
      values.push(updates.user_notes);
    }

    if (fields.length === 0) {
      return null;
    }

    values.push(id);

    const result = await query(
      `UPDATE saved_items
       SET ${fields.join(', ')}
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    );

    return result.rows[0] || null;
  }

  /**
   * Delete item
   */
  static async delete(id: string): Promise<boolean> {
    const result = await query('DELETE FROM saved_items WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Mark item as visited
   */
  static async markAsVisited(itemId: string, userId: string, notes?: string): Promise<any> {
    // Update item status
    await query(
      'UPDATE saved_items SET status = $1 WHERE id = $2',
      [ItemStatus.VISITED, itemId]
    );

    // Create visit record
    const result = await query(
      `INSERT INTO item_visits (saved_item_id, user_id, notes)
       VALUES ($1, $2, $3)
       ON CONFLICT (saved_item_id, user_id) DO UPDATE
       SET visited_at = CURRENT_TIMESTAMP, notes = $3
       RETURNING *`,
      [itemId, userId, notes]
    );

    return result.rows[0];
  }

  /**
   * Get items near coordinates
   */
  static async findNearby(
    tripGroupId: string,
    lat: number,
    lng: number,
    radiusMeters: number = 500
  ): Promise<any[]> {
    // Using a simple approximation: 1 degree ≈ 111km
    // For more precise calculations, use PostGIS extension
    const latDelta = radiusMeters / 111000;
    const lngDelta = radiusMeters / (111000 * Math.cos((lat * Math.PI) / 180));

    const result = await query(
      `SELECT *
       FROM (
         SELECT *,
           (6371000 * acos(
             cos(radians($2)) * cos(radians(location_lat)) *
             cos(radians(location_lng) - radians($3)) +
             sin(radians($2)) * sin(radians(location_lat))
           )) AS distance
         FROM saved_items
         WHERE trip_group_id = $1
           AND location_lat IS NOT NULL
           AND location_lng IS NOT NULL
           AND location_lat BETWEEN $2 - $4 AND $2 + $4
           AND location_lng BETWEEN $3 - $5 AND $3 + $5
       ) s
       WHERE s.distance <= $6
       ORDER BY s.distance ASC`,
      [tripGroupId, lat, lng, latDelta, lngDelta, radiusMeters]
    );

    return result.rows;
  }

  /**
   * Search items
   */
  static async search(tripGroupId: string, searchQuery: string): Promise<SavedItem[]> {
    const result = await query(
      `SELECT * FROM saved_items
       WHERE trip_group_id = $1
       AND (
         name ILIKE $2
         OR description ILIKE $2
         OR location_name ILIKE $2
       )
       ORDER BY created_at DESC`,
      [tripGroupId, `%${searchQuery}%`]
    );

    return result.rows;
  }

  /**
   * Get item statistics for a trip
   */
  static async getStatistics(tripGroupId: string): Promise<any> {
    const result = await query(
      `SELECT
         COUNT(*) as total_items,
         COUNT(CASE WHEN status = 'visited' THEN 1 END) as visited_count,
         COUNT(CASE WHEN category = 'food' THEN 1 END) as food_count,
         COUNT(CASE WHEN category = 'place' THEN 1 END) as place_count,
         COUNT(CASE WHEN category = 'shopping' THEN 1 END) as shopping_count,
         COUNT(CASE WHEN category = 'accommodation' THEN 1 END) as accommodation_count,
         COUNT(CASE WHEN category = 'activity' THEN 1 END) as activity_count,
         COUNT(CASE WHEN category = 'tip' THEN 1 END) as tip_count
       FROM saved_items
       WHERE trip_group_id = $1`,
      [tripGroupId]
    );

    return result.rows[0];
  }

  /**
   * Check for duplicate items
   */
  static async findDuplicates(
    tripGroupId: string,
    name: string,
    locationName?: string
  ): Promise<SavedItem[]> {
    let queryText = `
      SELECT * FROM saved_items
      WHERE trip_group_id = $1
      AND (name ILIKE $2`;

    const params: any[] = [tripGroupId, `%${name}%`];

    if (locationName) {
      queryText += ` OR location_name ILIKE $3`;
      params.push(`%${locationName}%`);
    }

    queryText += ') ORDER BY created_at DESC LIMIT 5';

    const result = await query(queryText, params);
    return result.rows;
  }

  /**
   * Get items grouped by planned day
   */
  static async findByDay(
    tripGroupId: string
  ): Promise<{ day: number | null; items: SavedItem[] }[]> {
    const result = await query(
      `SELECT * FROM saved_items 
       WHERE trip_group_id = $1
       ORDER BY planned_day NULLS LAST, day_order ASC, created_at DESC`,
      [tripGroupId]
    );

    // Convert string lat/lng to numbers and group by day
    const items = result.rows.map((row: any) => ({
      ...row,
      location_lat: row.location_lat ? parseFloat(row.location_lat) : null,
      location_lng: row.location_lng ? parseFloat(row.location_lng) : null,
    }));

    // Group items by day
    const dayMap = new Map<number | null, SavedItem[]>();
    
    for (const item of items) {
      const day = item.planned_day;
      if (!dayMap.has(day)) {
        dayMap.set(day, []);
      }
      dayMap.get(day)!.push(item);
    }

    // Convert to array and sort (assigned days first, then unassigned)
    const grouped = Array.from(dayMap.entries())
      .map(([day, items]) => ({ day, items }))
      .sort((a, b) => {
        if (a.day === null) return 1;
        if (b.day === null) return -1;
        return a.day - b.day;
      });

    return grouped;
  }

  /**
   * Assign item to a specific day
   */
  static async assignToDay(
    itemId: string,
    day: number | null,
    order?: number
  ): Promise<SavedItem | null> {
    // If no order specified, put it at the end of the day
    let dayOrder = order;
    if (dayOrder === undefined && day !== null) {
      const item = await this.findById(itemId);
      if (item) {
        const result = await query(
          `SELECT COALESCE(MAX(day_order), -1) + 1 as next_order 
           FROM saved_items 
           WHERE trip_group_id = $1 AND planned_day = $2`,
          [item.trip_group_id, day]
        );
        dayOrder = result.rows[0]?.next_order || 0;
      }
    }

    const result = await query(
      `UPDATE saved_items 
       SET planned_day = $1, day_order = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [day, dayOrder ?? 0, itemId]
    );

    const row = result.rows[0];
    if (!row) return null;

    return {
      ...row,
      location_lat: row.location_lat ? parseFloat(row.location_lat) : null,
      location_lng: row.location_lng ? parseFloat(row.location_lng) : null,
    };
  }

  /**
   * Reorder items within a day (for drag-drop)
   */
  static async reorderInDay(
    tripGroupId: string,
    day: number | null,
    itemIds: string[]
  ): Promise<void> {
    // Update each item's order based on its position in the array
    for (let i = 0; i < itemIds.length; i++) {
      await query(
        `UPDATE saved_items 
         SET day_order = $1, planned_day = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3 AND trip_group_id = $4`,
        [i, day, itemIds[i], tripGroupId]
      );
    }
  }
}

