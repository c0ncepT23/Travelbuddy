import { query } from '../config/database';
import crypto from 'crypto';

export interface TripStory {
  id: string;
  trip_group_id: string;
  user_id: string;
  share_code: string;
  slug?: string;
  is_public: boolean;
  title?: string;
  description?: string;
  hero_image_url?: string;
  cover_photos?: string[];
  theme_color?: string;
  show_ratings: boolean;
  show_photos: boolean;
  show_costs: boolean;
  show_notes: boolean;
  show_companions: boolean;
  views_count: number;
  copies_count: number;
  shares_count: number;
  last_viewed_at?: Date;
  expires_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export class TripStoryModel {
  /**
   * Generate a unique share code
   */
  private static generateShareCode(length: number = 8): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const bytes = crypto.randomBytes(length);
    
    for (let i = 0; i < length; i++) {
      result += chars[bytes[i] % chars.length];
    }
    
    return result;
  }

  /**
   * Generate a slug from trip name
   */
  private static generateSlug(tripName: string, userName: string): string {
    const combined = `${tripName}-${userName}`.toLowerCase();
    return combined
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 100);
  }

  /**
   * Create a trip story
   */
  static async create(data: {
    tripGroupId: string;
    userId: string;
    isPublic?: boolean;
    title?: string;
    description?: string;
    heroImageUrl?: string;
    coverPhotos?: string[];
    themeColor?: string;
    showRatings?: boolean;
    showPhotos?: boolean;
    showCosts?: boolean;
    showNotes?: boolean;
    showCompanions?: boolean;
    expiresAt?: Date;
  }): Promise<TripStory> {
    // Generate unique share code
    let shareCode: string;
    let isUnique = false;
    let attempts = 0;
    
    while (!isUnique && attempts < 10) {
      shareCode = this.generateShareCode();
      const existing = await query(
        'SELECT id FROM trip_stories WHERE share_code = $1',
        [shareCode]
      );
      if (existing.rows.length === 0) {
        isUnique = true;
      }
      attempts++;
    }

    if (!isUnique) {
      throw new Error('Failed to generate unique share code');
    }

    // Generate slug if title provided
    let slug: string | undefined;
    if (data.title) {
      const userResult = await query('SELECT username FROM users WHERE id = $1', [data.userId]);
      const username = userResult.rows[0]?.username || 'user';
      slug = this.generateSlug(data.title, username);
      
      // Make slug unique
      const existingSlug = await query(
        'SELECT id FROM trip_stories WHERE slug = $1',
        [slug]
      );
      if (existingSlug.rows.length > 0) {
        slug = `${slug}-${shareCode!.substring(0, 4)}`;
      }
    }

    const result = await query(
      `INSERT INTO trip_stories 
       (trip_group_id, user_id, share_code, slug, is_public, title, description,
        hero_image_url, cover_photos, theme_color, show_ratings, show_photos,
        show_costs, show_notes, show_companions, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       RETURNING *`,
      [
        data.tripGroupId,
        data.userId,
        shareCode!,
        slug,
        data.isPublic !== undefined ? data.isPublic : false,
        data.title,
        data.description,
        data.heroImageUrl,
        data.coverPhotos ? JSON.stringify(data.coverPhotos) : '[]',
        data.themeColor || '#6366F1',
        data.showRatings !== undefined ? data.showRatings : true,
        data.showPhotos !== undefined ? data.showPhotos : true,
        data.showCosts !== undefined ? data.showCosts : false,
        data.showNotes !== undefined ? data.showNotes : true,
        data.showCompanions !== undefined ? data.showCompanions : false,
        data.expiresAt,
      ]
    );

    return result.rows[0];
  }

  /**
   * Find story by share code
   */
  static async findByShareCode(shareCode: string): Promise<TripStory | null> {
    const result = await query(
      'SELECT * FROM trip_stories WHERE share_code = $1',
      [shareCode]
    );
    return result.rows[0] || null;
  }

  /**
   * Find story by slug
   */
  static async findBySlug(slug: string): Promise<TripStory | null> {
    const result = await query(
      'SELECT * FROM trip_stories WHERE slug = $1',
      [slug]
    );
    return result.rows[0] || null;
  }

  /**
   * Find story by trip ID
   */
  static async findByTrip(tripGroupId: string): Promise<TripStory | null> {
    const result = await query(
      'SELECT * FROM trip_stories WHERE trip_group_id = $1',
      [tripGroupId]
    );
    return result.rows[0] || null;
  }

  /**
   * Update story
   */
  static async update(
    id: string,
    updates: Partial<{
      isPublic: boolean;
      title: string;
      description: string;
      heroImageUrl: string;
      coverPhotos: string[];
      themeColor: string;
      showRatings: boolean;
      showPhotos: boolean;
      showCosts: boolean;
      showNotes: boolean;
      showCompanions: boolean;
      expiresAt: Date;
    }>
  ): Promise<TripStory | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (updates.isPublic !== undefined) {
      fields.push(`is_public = $${paramCount++}`);
      values.push(updates.isPublic);
    }

    if (updates.title !== undefined) {
      fields.push(`title = $${paramCount++}`);
      values.push(updates.title);
    }

    if (updates.description !== undefined) {
      fields.push(`description = $${paramCount++}`);
      values.push(updates.description);
    }

    if (updates.heroImageUrl !== undefined) {
      fields.push(`hero_image_url = $${paramCount++}`);
      values.push(updates.heroImageUrl);
    }

    if (updates.coverPhotos !== undefined) {
      fields.push(`cover_photos = $${paramCount++}`);
      values.push(JSON.stringify(updates.coverPhotos));
    }

    if (updates.themeColor !== undefined) {
      fields.push(`theme_color = $${paramCount++}`);
      values.push(updates.themeColor);
    }

    if (updates.showRatings !== undefined) {
      fields.push(`show_ratings = $${paramCount++}`);
      values.push(updates.showRatings);
    }

    if (updates.showPhotos !== undefined) {
      fields.push(`show_photos = $${paramCount++}`);
      values.push(updates.showPhotos);
    }

    if (updates.showCosts !== undefined) {
      fields.push(`show_costs = $${paramCount++}`);
      values.push(updates.showCosts);
    }

    if (updates.showNotes !== undefined) {
      fields.push(`show_notes = $${paramCount++}`);
      values.push(updates.showNotes);
    }

    if (updates.showCompanions !== undefined) {
      fields.push(`show_companions = $${paramCount++}`);
      values.push(updates.showCompanions);
    }

    if (updates.expiresAt !== undefined) {
      fields.push(`expires_at = $${paramCount++}`);
      values.push(updates.expiresAt);
    }

    if (fields.length === 0) return null;

    values.push(id);
    const result = await query(
      `UPDATE trip_stories 
       SET ${fields.join(', ')}
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    );

    return result.rows[0] || null;
  }

  /**
   * Increment view count
   */
  static async incrementViews(id: string): Promise<void> {
    await query(
      `UPDATE trip_stories 
       SET views_count = views_count + 1,
           last_viewed_at = NOW()
       WHERE id = $1`,
      [id]
    );
  }

  /**
   * Increment copies count
   */
  static async incrementCopies(id: string): Promise<void> {
    await query(
      'UPDATE trip_stories SET copies_count = copies_count + 1 WHERE id = $1',
      [id]
    );
  }

  /**
   * Increment shares count
   */
  static async incrementShares(id: string): Promise<void> {
    await query(
      'UPDATE trip_stories SET shares_count = shares_count + 1 WHERE id = $1',
      [id]
    );
  }

  /**
   * Delete story
   */
  static async delete(id: string): Promise<boolean> {
    const result = await query('DELETE FROM trip_stories WHERE id = $1', [id]);
    return result.rowCount! > 0;
  }

  /**
   * Get user's stories
   */
  static async findByUser(userId: string): Promise<TripStory[]> {
    const result = await query(
      'SELECT * FROM trip_stories WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    return result.rows;
  }

  /**
   * Check if story is expired
   */
  static async isExpired(story: TripStory): Promise<boolean> {
    if (!story.expires_at) return false;
    return new Date(story.expires_at) < new Date();
  }
}

