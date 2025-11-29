import { query } from '../config/database';
import { User } from '../types';
import bcrypt from 'bcrypt';

export class UserModel {
  /**
   * Create a new user
   */
  static async create(email: string, password: string, name: string): Promise<User> {
    const passwordHash = await bcrypt.hash(password, 10);
    
    const result = await query(
      `INSERT INTO users (email, password_hash, name)
       VALUES ($1, $2, $3)
       RETURNING id, email, name, avatar_url, created_at, updated_at`,
      [email, passwordHash, name]
    );

    return result.rows[0];
  }

  /**
   * Create user from OAuth (no password)
   */
  static async createFromOAuth(
    email: string,
    name: string,
    avatarUrl?: string
  ): Promise<User> {
    const result = await query(
      `INSERT INTO users (email, name, avatar_url)
       VALUES ($1, $2, $3)
       RETURNING id, email, name, avatar_url, created_at, updated_at`,
      [email, name, avatarUrl]
    );

    return result.rows[0];
  }

  /**
   * Find user by email
   */
  static async findByEmail(email: string): Promise<User | null> {
    const result = await query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    return result.rows[0] || null;
  }

  /**
   * Find user by ID
   */
  static async findById(id: string): Promise<User | null> {
    const result = await query(
      'SELECT id, email, name, avatar_url, created_at, updated_at FROM users WHERE id = $1',
      [id]
    );

    return result.rows[0] || null;
  }

  /**
   * Verify password
   */
  static async verifyPassword(email: string, password: string): Promise<boolean> {
    const result = await query(
      'SELECT password_hash FROM users WHERE email = $1',
      [email]
    );

    if (!result.rows[0] || !result.rows[0].password_hash) {
      return false;
    }

    return await bcrypt.compare(password, result.rows[0].password_hash);
  }

  /**
   * Update user profile
   */
  static async update(
    id: string,
    updates: Partial<Pick<User, 'name' | 'avatar_url' | 'cover_url'>>
  ): Promise<User | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (updates.name) {
      fields.push(`name = $${paramCount++}`);
      values.push(updates.name);
    }

    if (updates.avatar_url !== undefined) {
      fields.push(`avatar_url = $${paramCount++}`);
      values.push(updates.avatar_url);
    }

    if (updates.cover_url !== undefined) {
      fields.push(`cover_url = $${paramCount++}`);
      values.push(updates.cover_url);
    }

    if (fields.length === 0) {
      return null;
    }

    values.push(id);

    const result = await query(
      `UPDATE users
       SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${paramCount}
       RETURNING id, email, phone_number, name, avatar_url, cover_url, created_at, updated_at`,
      values
    );

    return result.rows[0] || null;
  }

  /**
   * Delete user
   */
  static async delete(id: string): Promise<boolean> {
    const result = await query('DELETE FROM users WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Check if email exists
   */
  static async emailExists(email: string): Promise<boolean> {
    const result = await query(
      'SELECT 1 FROM users WHERE email = $1',
      [email]
    );
    return result.rows.length > 0;
  }

  /**
   * Create user with phone number (OTP-based registration)
   */
  static async createWithPhone(phoneNumber: string, name: string): Promise<User> {
    const result = await query(
      `INSERT INTO users (phone_number, name)
       VALUES ($1, $2)
       RETURNING id, email, phone_number, name, avatar_url, created_at, updated_at`,
      [phoneNumber, name]
    );

    return result.rows[0];
  }

  /**
   * Find user by phone number
   */
  static async findByPhone(phoneNumber: string): Promise<User | null> {
    const result = await query(
      'SELECT id, email, phone_number, name, avatar_url, created_at, updated_at FROM users WHERE phone_number = $1',
      [phoneNumber]
    );

    return result.rows[0] || null;
  }

  /**
   * Check if phone number exists
   */
  static async phoneExists(phoneNumber: string): Promise<boolean> {
    const result = await query(
      'SELECT 1 FROM users WHERE phone_number = $1',
      [phoneNumber]
    );
    return result.rows.length > 0;
  }
}

