import { query } from '../config/database';
import { TripGroup, TripMember, TripMemberRole } from '../types';
import { generateInviteCode } from '../utils/helpers';

export class TripGroupModel {
  /**
   * Create a new trip group
   */
  static async create(
    name: string,
    destination: string,
    createdBy: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<TripGroup> {
    const inviteCode = generateInviteCode();

    const result = await query(
      `INSERT INTO trip_groups (name, destination, start_date, end_date, invite_code, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name, destination, startDate, endDate, inviteCode, createdBy]
    );

    const trip = result.rows[0];

    // Add creator as owner
    await query(
      `INSERT INTO trip_members (trip_group_id, user_id, role)
       VALUES ($1, $2, $3)`,
      [trip.id, createdBy, TripMemberRole.OWNER]
    );

    return trip;
  }

  /**
   * Find trip by ID
   */
  static async findById(id: string): Promise<TripGroup | null> {
    const result = await query('SELECT * FROM trip_groups WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  /**
   * Find trip by invite code
   */
  static async findByInviteCode(inviteCode: string): Promise<TripGroup | null> {
    const result = await query('SELECT * FROM trip_groups WHERE invite_code = $1', [
      inviteCode,
    ]);
    return result.rows[0] || null;
  }

  /**
   * Get all trips for a user
   */
  static async findByUser(userId: string): Promise<TripGroup[]> {
    const result = await query(
      `SELECT tg.* FROM trip_groups tg
       INNER JOIN trip_members tm ON tg.id = tm.trip_group_id
       WHERE tm.user_id = $1
       ORDER BY tg.created_at DESC`,
      [userId]
    );

    return result.rows;
  }

  /**
   * Update trip
   */
  static async update(
    id: string,
    updates: Partial<Pick<TripGroup, 'name' | 'destination' | 'start_date' | 'end_date'>>
  ): Promise<TripGroup | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (updates.name) {
      fields.push(`name = $${paramCount++}`);
      values.push(updates.name);
    }

    if (updates.destination) {
      fields.push(`destination = $${paramCount++}`);
      values.push(updates.destination);
    }

    if (updates.start_date !== undefined) {
      fields.push(`start_date = $${paramCount++}`);
      values.push(updates.start_date);
    }

    if (updates.end_date !== undefined) {
      fields.push(`end_date = $${paramCount++}`);
      values.push(updates.end_date);
    }

    if (fields.length === 0) {
      return null;
    }

    values.push(id);

    const result = await query(
      `UPDATE trip_groups
       SET ${fields.join(', ')}
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    );

    return result.rows[0] || null;
  }

  /**
   * Delete trip
   */
  static async delete(id: string): Promise<boolean> {
    const result = await query('DELETE FROM trip_groups WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Add member to trip
   */
  static async addMember(
    tripGroupId: string,
    userId: string,
    role: TripMemberRole = TripMemberRole.MEMBER
  ): Promise<TripMember> {
    const result = await query(
      `INSERT INTO trip_members (trip_group_id, user_id, role)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [tripGroupId, userId, role]
    );

    return result.rows[0];
  }

  /**
   * Remove member from trip
   */
  static async removeMember(tripGroupId: string, userId: string): Promise<boolean> {
    const result = await query(
      'DELETE FROM trip_members WHERE trip_group_id = $1 AND user_id = $2',
      [tripGroupId, userId]
    );

    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Get all members of a trip
   */
  static async getMembers(tripGroupId: string): Promise<any[]> {
    const result = await query(
      `SELECT u.id, u.name, u.email, u.avatar_url, tm.role, tm.joined_at
       FROM users u
       INNER JOIN trip_members tm ON u.id = tm.user_id
       WHERE tm.trip_group_id = $1
       ORDER BY tm.joined_at ASC`,
      [tripGroupId]
    );

    return result.rows;
  }

  /**
   * Check if user is member of trip
   */
  static async isMember(tripGroupId: string, userId: string): Promise<boolean> {
    const result = await query(
      'SELECT 1 FROM trip_members WHERE trip_group_id = $1 AND user_id = $2',
      [tripGroupId, userId]
    );

    return result.rows.length > 0;
  }

  /**
   * Check if user is owner of trip
   */
  static async isOwner(tripGroupId: string, userId: string): Promise<boolean> {
    const result = await query(
      `SELECT 1 FROM trip_members 
       WHERE trip_group_id = $1 AND user_id = $2 AND role = $3`,
      [tripGroupId, userId, TripMemberRole.OWNER]
    );

    return result.rows.length > 0;
  }

  /**
   * Get member role
   */
  static async getMemberRole(
    tripGroupId: string,
    userId: string
  ): Promise<TripMemberRole | null> {
    const result = await query(
      'SELECT role FROM trip_members WHERE trip_group_id = $1 AND user_id = $2',
      [tripGroupId, userId]
    );

    return result.rows[0]?.role || null;
  }

  /**
   * Update trip banner
   */
  static async updateBanner(
    tripGroupId: string,
    bannerUrl: string
  ): Promise<TripGroup | null> {
    const result = await query(
      `UPDATE trip_groups 
       SET banner_url = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2 
       RETURNING *`,
      [bannerUrl, tripGroupId]
    );

    return result.rows[0] || null;
  }
}

