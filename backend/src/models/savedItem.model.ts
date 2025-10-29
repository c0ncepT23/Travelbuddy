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
    locationConfidenceScore?: number
  ): Promise<SavedItem> {
    const result = await query(
      `INSERT INTO saved_items 
       (trip_group_id, added_by, name, category, description, location_name, 
        location_lat, location_lng, original_source_type, original_source_url, source_title, original_content,
        location_confidence, location_confidence_score)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
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
}

