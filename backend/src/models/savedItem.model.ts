import { query } from '../config/database';
import { SavedItem, ItemCategory, ItemSourceType, ItemStatus } from '../types';

export class SavedItemModel {
  /**
   * Create a new saved item
   * Now supports sub-categorization fields: tags, cuisine_type, place_type, destination
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
    openingHoursJson?: any,
    // Sub-categorization fields (for smart clustering)
    tags?: string[],
    cuisineType?: string,
    placeType?: string,
    parentLocation?: string,
    destination?: string,
    clonedFromJourneyId?: string,
    clonedFromOwnerName?: string
  ): Promise<SavedItem> {
    const result = await query(
      `INSERT INTO saved_items 
       (trip_group_id, added_by, name, category, description, location_name, 
        location_lat, location_lng, original_source_type, original_source_url, source_title, original_content,
        location_confidence, location_confidence_score, google_place_id, rating, user_ratings_total, 
        price_level, formatted_address, area_name, photos_json, opening_hours_json,
        tags, cuisine_type, place_type, parent_location, destination, cloned_from_journey_id, cloned_from_owner_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29)
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
        tags ? JSON.stringify(tags) : '[]',
        cuisineType,
        placeType,
        parentLocation,
        destination,
        clonedFromJourneyId,
        clonedFromOwnerName,
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

    // Google Places enrichment fields
    if (updates.google_place_id !== undefined) {
      fields.push(`google_place_id = $${paramCount++}`);
      values.push(updates.google_place_id);
    }

    if (updates.rating !== undefined) {
      fields.push(`rating = $${paramCount++}`);
      values.push(updates.rating);
    }

    if (updates.user_ratings_total !== undefined) {
      fields.push(`user_ratings_total = $${paramCount++}`);
      values.push(updates.user_ratings_total);
    }

    if (updates.price_level !== undefined) {
      fields.push(`price_level = $${paramCount++}`);
      values.push(updates.price_level);
    }

    if (updates.formatted_address !== undefined) {
      fields.push(`formatted_address = $${paramCount++}`);
      values.push(updates.formatted_address);
    }

    if (updates.area_name !== undefined) {
      fields.push(`area_name = $${paramCount++}`);
      values.push(updates.area_name);
    }

    if (updates.photos_json !== undefined) {
      fields.push(`photos_json = $${paramCount++}`);
      values.push(updates.photos_json);
    }

    if (updates.opening_hours_json !== undefined) {
      fields.push(`opening_hours_json = $${paramCount++}`);
      values.push(updates.opening_hours_json);
    }

    if (updates.cloned_from_journey_id !== undefined) {
      fields.push(`cloned_from_journey_id = $${paramCount++}`);
      values.push(updates.cloned_from_journey_id);
    }

    if (updates.cloned_from_owner_name !== undefined) {
      fields.push(`cloned_from_owner_name = $${paramCount++}`);
      values.push(updates.cloned_from_owner_name);
    }

    if (updates.parent_location !== undefined) {
      fields.push(`parent_location = $${paramCount++}`);
      values.push(updates.parent_location);
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
    locationName?: string,
    googlePlaceId?: string
  ): Promise<SavedItem[]> {
    const params: any[] = [tripGroupId];
    let paramCount = 2;
    
    let queryText = `
      SELECT * FROM saved_items
      WHERE trip_group_id = $1
      AND (
    `;

    const conditions: string[] = [];
    
    // Condition 1: Name match (ILIKE)
    conditions.push(`name ILIKE $${paramCount++}`);
    params.push(`%${name}%`);

    // Condition 2: Location name match
    if (locationName) {
      conditions.push(`location_name ILIKE $${paramCount++}`);
      params.push(`%${locationName}%`);
    }

    // Condition 3: Google Place ID match (Strongest signal)
    if (googlePlaceId) {
      conditions.push(`google_place_id = $${paramCount++}`);
      params.push(googlePlaceId);
    }

    queryText += conditions.join(' OR ') + ') ORDER BY created_at DESC LIMIT 5';

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

  /**
   * Get items for a specific city (by segment or city name matching)
   */
  static async findByCity(
    tripGroupId: string,
    city: string,
    segmentId?: string
  ): Promise<SavedItem[]> {
    const result = await query(
      `SELECT * FROM saved_items
       WHERE trip_group_id = $1
       AND (
         segment_id = $2
         OR area_name ILIKE '%' || $3 || '%'
         OR location_name ILIKE '%' || $3 || '%'
       )
       ORDER BY rating DESC NULLS LAST, created_at DESC`,
      [tripGroupId, segmentId || '', city]
    );

    return result.rows.map((row: any) => ({
      ...row,
      location_lat: row.location_lat ? parseFloat(row.location_lat) : null,
      location_lng: row.location_lng ? parseFloat(row.location_lng) : null,
    }));
  }

  /**
   * Get top-rated items for a trip/city
   */
  static async getTopRated(
    tripGroupId: string,
    options?: {
      city?: string;
      segmentId?: string;
      limit?: number;
      excludeVisited?: boolean;
      category?: ItemCategory;
    }
  ): Promise<SavedItem[]> {
    let queryText = `
      SELECT * FROM saved_items
      WHERE trip_group_id = $1
      AND rating IS NOT NULL
    `;
    const params: any[] = [tripGroupId];
    let paramCount = 2;

    if (options?.city) {
      queryText += ` AND (
        segment_id = $${paramCount++}
        OR area_name ILIKE '%' || $${paramCount++} || '%'
        OR location_name ILIKE '%' || $${paramCount++} || '%'
      )`;
      params.push(options.segmentId || '', options.city, options.city);
    }

    if (options?.excludeVisited) {
      queryText += ` AND status != 'visited'`;
    }

    if (options?.category) {
      queryText += ` AND category = $${paramCount++}`;
      params.push(options.category);
    }

    queryText += ` ORDER BY rating DESC, user_ratings_total DESC NULLS LAST`;
    queryText += ` LIMIT $${paramCount}`;
    params.push(options?.limit || 5);

    const result = await query(queryText, params);

    return result.rows.map((row: any) => ({
      ...row,
      location_lat: row.location_lat ? parseFloat(row.location_lat) : null,
      location_lng: row.location_lng ? parseFloat(row.location_lng) : null,
    }));
  }

  /**
   * Get must-visit items for a trip
   */
  static async getMustVisit(
    tripGroupId: string,
    options?: {
      city?: string;
      excludeVisited?: boolean;
      limit?: number;
    }
  ): Promise<SavedItem[]> {
    let queryText = `
      SELECT * FROM saved_items
      WHERE trip_group_id = $1
      AND is_must_visit = true
    `;
    const params: any[] = [tripGroupId];
    let paramCount = 2;

    if (options?.city) {
      queryText += ` AND (
        area_name ILIKE '%' || $${paramCount++} || '%'
        OR location_name ILIKE '%' || $${paramCount++} || '%'
      )`;
      params.push(options.city, options.city);
    }

    if (options?.excludeVisited) {
      queryText += ` AND status != 'visited'`;
    }

    queryText += ` ORDER BY rating DESC NULLS LAST, created_at ASC`;

    if (options?.limit) {
      queryText += ` LIMIT $${paramCount}`;
      params.push(options.limit);
    }

    const result = await query(queryText, params);

    return result.rows.map((row: any) => ({
      ...row,
      location_lat: row.location_lat ? parseFloat(row.location_lat) : null,
      location_lng: row.location_lng ? parseFloat(row.location_lng) : null,
    }));
  }

  /**
   * Get items near a specific location (for hotel proximity)
   */
  static async findNearLocation(
    tripGroupId: string,
    lat: number,
    lng: number,
    options?: {
      radiusMeters?: number;
      excludeVisited?: boolean;
      category?: ItemCategory;
      limit?: number;
    }
  ): Promise<Array<SavedItem & { distance: number }>> {
    const radius = options?.radiusMeters || 2000;
    const latDelta = radius / 111000;
    const lngDelta = radius / (111000 * Math.cos((lat * Math.PI) / 180));

    let queryText = `
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
    `;
    const params: any[] = [tripGroupId, lat, lng, latDelta, lngDelta];
    let paramCount = 6;

    if (options?.excludeVisited) {
      queryText += ` AND status != 'visited'`;
    }

    if (options?.category) {
      queryText += ` AND category = $${paramCount++}`;
      params.push(options.category);
    }

    queryText += ` HAVING (6371000 * acos(
      cos(radians($2)) * cos(radians(location_lat)) *
      cos(radians(location_lng) - radians($3)) +
      sin(radians($2)) * sin(radians(location_lat))
    )) <= $${paramCount++}`;
    params.push(radius);

    queryText += ` ORDER BY distance ASC`;

    if (options?.limit) {
      queryText += ` LIMIT $${paramCount}`;
      params.push(options.limit);
    }

    const result = await query(queryText, params);

    return result.rows.map((row: any) => ({
      ...row,
      location_lat: row.location_lat ? parseFloat(row.location_lat) : null,
      location_lng: row.location_lng ? parseFloat(row.location_lng) : null,
      distance: parseFloat(row.distance),
    }));
  }

  /**
   * Get statistics for a specific city/segment
   */
  static async getCityStatistics(
    tripGroupId: string,
    city: string,
    segmentId?: string
  ): Promise<{
    total: number;
    visited: number;
    unvisited: number;
    byCategory: Record<string, number>;
  }> {
    const result = await query(
      `SELECT
         COUNT(*) as total,
         COUNT(CASE WHEN status = 'visited' THEN 1 END) as visited,
         COUNT(CASE WHEN status != 'visited' THEN 1 END) as unvisited,
         COUNT(CASE WHEN category = 'food' THEN 1 END) as food_count,
         COUNT(CASE WHEN category = 'place' THEN 1 END) as place_count,
         COUNT(CASE WHEN category = 'shopping' THEN 1 END) as shopping_count,
         COUNT(CASE WHEN category = 'accommodation' THEN 1 END) as accommodation_count,
         COUNT(CASE WHEN category = 'activity' THEN 1 END) as activity_count,
         COUNT(CASE WHEN category = 'tip' THEN 1 END) as tip_count
       FROM saved_items
       WHERE trip_group_id = $1
       AND (
         segment_id = $2
         OR area_name ILIKE '%' || $3 || '%'
         OR location_name ILIKE '%' || $3 || '%'
       )`,
      [tripGroupId, segmentId || '', city]
    );

    const row = result.rows[0];
    return {
      total: parseInt(row?.total) || 0,
      visited: parseInt(row?.visited) || 0,
      unvisited: parseInt(row?.unvisited) || 0,
      byCategory: {
        food: parseInt(row?.food_count) || 0,
        place: parseInt(row?.place_count) || 0,
        shopping: parseInt(row?.shopping_count) || 0,
        accommodation: parseInt(row?.accommodation_count) || 0,
        activity: parseInt(row?.activity_count) || 0,
        tip: parseInt(row?.tip_count) || 0,
      },
    };
  }

  /**
   * Get sub-clusters for smart grouping within categories
   * Returns cuisine_types for food, place_types for places, etc.
   * Now also uses primary_tag as fallback when cuisine_type/place_type is not set
   */
  static async getSubClusters(
    tripGroupId: string,
    category?: ItemCategory
  ): Promise<{
    cuisine_types: Array<{ type: string; count: number; items: SavedItem[] }>;
    place_types: Array<{ type: string; count: number; items: SavedItem[] }>;
    destinations: Array<{ destination: string; count: number }>;
    tags: Array<{ tag: string; count: number }>;
  }> {
    // Get cuisine types (for food items) - use COALESCE with primary_tag for fallback
    // primary_tag_group = 'cuisine' indicates a food-related tag
    const cuisineResult = await query(
      `SELECT COALESCE(cuisine_type, 
              CASE WHEN primary_tag_group IN ('cuisine', 'food') THEN primary_tag ELSE NULL END
             ) as cuisine_type, 
             COUNT(*) as count
       FROM saved_items
       WHERE trip_group_id = $1 
         AND (cuisine_type IS NOT NULL 
              OR (primary_tag_group IN ('cuisine', 'food') AND primary_tag IS NOT NULL))
         ${category ? 'AND category = $2' : ''}
       GROUP BY COALESCE(cuisine_type, 
                CASE WHEN primary_tag_group IN ('cuisine', 'food') THEN primary_tag ELSE NULL END)
       HAVING COALESCE(cuisine_type, 
              CASE WHEN primary_tag_group IN ('cuisine', 'food') THEN primary_tag ELSE NULL END) IS NOT NULL
       ORDER BY count DESC`,
      category ? [tripGroupId, category] : [tripGroupId]
    );

    // Get place types (for non-food items) - use COALESCE with primary_tag for fallback
    // primary_tag_group = 'landmark', 'attraction', 'shopping' indicates a place-related tag
    const placeTypeResult = await query(
      `SELECT COALESCE(place_type,
              CASE WHEN primary_tag_group IN ('landmark', 'attraction', 'shopping', 'activity', 'landmark_type') THEN primary_tag ELSE NULL END
             ) as place_type, 
             COUNT(*) as count
       FROM saved_items
       WHERE trip_group_id = $1 
         AND (place_type IS NOT NULL 
              OR (primary_tag_group IN ('landmark', 'attraction', 'shopping', 'activity', 'landmark_type') AND primary_tag IS NOT NULL))
         ${category ? 'AND category = $2' : ''}
       GROUP BY COALESCE(place_type,
                CASE WHEN primary_tag_group IN ('landmark', 'attraction', 'shopping', 'activity', 'landmark_type') THEN primary_tag ELSE NULL END)
       HAVING COALESCE(place_type,
              CASE WHEN primary_tag_group IN ('landmark', 'attraction', 'shopping', 'activity', 'landmark_type') THEN primary_tag ELSE NULL END) IS NOT NULL
       ORDER BY count DESC`,
      category ? [tripGroupId, category] : [tripGroupId]
    );

    // Get destinations
    const destinationResult = await query(
      `SELECT destination, COUNT(*) as count
       FROM saved_items
       WHERE trip_group_id = $1 
         AND destination IS NOT NULL
       GROUP BY destination
       ORDER BY count DESC`,
      [tripGroupId]
    );

    // Get tag counts (JSONB aggregation)
    const tagsResult = await query(
      `SELECT tag, COUNT(*) as count
       FROM saved_items, jsonb_array_elements_text(COALESCE(tags, '[]'::jsonb)) as tag
       WHERE trip_group_id = $1
         ${category ? 'AND category = $2' : ''}
       GROUP BY tag
       ORDER BY count DESC
       LIMIT 20`,
      category ? [tripGroupId, category] : [tripGroupId]
    );

    // For each cuisine type, get the actual items (including those matched by primary_tag)
    const cuisineTypes = await Promise.all(
      cuisineResult.rows.map(async (row: any) => {
        const itemsResult = await query(
          `SELECT * FROM saved_items 
           WHERE trip_group_id = $1 
             AND (cuisine_type = $2 
                  OR (primary_tag = $2 AND primary_tag_group IN ('cuisine', 'food')))
           ORDER BY rating DESC NULLS LAST, created_at DESC`,
          [tripGroupId, row.cuisine_type]
        );
        return {
          type: row.cuisine_type,
          count: parseInt(row.count),
          items: itemsResult.rows.map((item: any) => ({
            ...item,
            location_lat: item.location_lat ? parseFloat(item.location_lat) : null,
            location_lng: item.location_lng ? parseFloat(item.location_lng) : null,
          })),
        };
      })
    );

    // For each place type, get the actual items (including those matched by primary_tag)
    const placeTypes = await Promise.all(
      placeTypeResult.rows.map(async (row: any) => {
        const itemsResult = await query(
          `SELECT * FROM saved_items 
           WHERE trip_group_id = $1 
             AND (place_type = $2 
                  OR (primary_tag = $2 AND primary_tag_group IN ('landmark', 'attraction', 'shopping', 'activity', 'landmark_type')))
           ORDER BY rating DESC NULLS LAST, created_at DESC`,
          [tripGroupId, row.place_type]
        );
        return {
          type: row.place_type,
          count: parseInt(row.count),
          items: itemsResult.rows.map((item: any) => ({
            ...item,
            location_lat: item.location_lat ? parseFloat(item.location_lat) : null,
            location_lng: item.location_lng ? parseFloat(item.location_lng) : null,
          })),
        };
      })
    );

    return {
      cuisine_types: cuisineTypes,
      place_types: placeTypes,
      destinations: destinationResult.rows.map((row: any) => ({
        destination: row.destination,
        count: parseInt(row.count),
      })),
      tags: tagsResult.rows.map((row: any) => ({
        tag: row.tag,
        count: parseInt(row.count),
      })),
    };
  }

  /**
   * Get items by sub-type (cuisine_type or place_type)
   */
  static async findBySubType(
    tripGroupId: string,
    subType: string,
    subTypeField: 'cuisine_type' | 'place_type'
  ): Promise<SavedItem[]> {
    const result = await query(
      `SELECT * FROM saved_items
       WHERE trip_group_id = $1 AND ${subTypeField} = $2
       ORDER BY rating DESC NULLS LAST, created_at DESC`,
      [tripGroupId, subType]
    );

    return result.rows.map((row: any) => ({
      ...row,
      location_lat: row.location_lat ? parseFloat(row.location_lat) : null,
      location_lng: row.location_lng ? parseFloat(row.location_lng) : null,
    }));
  }

  /**
   * Get items by destination (for auto-grouping without trips)
   */
  static async findByDestination(
    tripGroupId: string,
    destination: string
  ): Promise<SavedItem[]> {
    const result = await query(
      `SELECT * FROM saved_items
       WHERE trip_group_id = $1 AND destination ILIKE $2
       ORDER BY category, created_at DESC`,
      [tripGroupId, `%${destination}%`]
    );

    return result.rows.map((row: any) => ({
      ...row,
      location_lat: row.location_lat ? parseFloat(row.location_lat) : null,
      location_lng: row.location_lng ? parseFloat(row.location_lng) : null,
    }));
  }
}
