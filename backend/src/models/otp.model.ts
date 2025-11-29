import { query } from '../config/database';

export interface OTPCode {
  id: string;
  phone_number: string;
  otp_code: string;
  expires_at: Date;
  verified: boolean;
  created_at: Date;
}

export class OTPModel {
  /**
   * Create or update OTP for a phone number
   * Generates random 4-digit OTP in production, '0000' in development
   */
  static async createOTP(phoneNumber: string): Promise<string> {
    // Generate secure random OTP in production, use '0000' only in development
    const isDevelopment = process.env.NODE_ENV !== 'production';
    const otpCode = isDevelopment ? '0000' : this.generateSecureOTP();
    
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10); // Valid for 10 minutes

    // Delete any existing OTPs for this phone number
    await query('DELETE FROM otp_codes WHERE phone_number = $1', [phoneNumber]);

    // Create new OTP
    await query(
      'INSERT INTO otp_codes (phone_number, otp_code, expires_at) VALUES ($1, $2, $3)',
      [phoneNumber, otpCode, expiresAt]
    );

    return otpCode;
  }

  /**
   * Generate a cryptographically secure 4-digit OTP
   */
  private static generateSecureOTP(): string {
    const crypto = require('crypto');
    // Generate 2 random bytes and convert to a 4-digit number
    const randomBytes = crypto.randomBytes(2);
    const randomNum = (randomBytes[0] << 8 | randomBytes[1]) % 10000;
    return randomNum.toString().padStart(4, '0');
  }

  /**
   * Verify OTP for a phone number
   */
  static async verifyOTP(phoneNumber: string, otpCode: string): Promise<boolean> {
    const result = await query(
      `SELECT * FROM otp_codes 
       WHERE phone_number = $1 
       AND otp_code = $2 
       AND expires_at > NOW() 
       AND verified = FALSE 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [phoneNumber, otpCode]
    );

    if (result.rows.length === 0) {
      return false;
    }

    // Mark as verified
    await query('UPDATE otp_codes SET verified = TRUE WHERE id = $1', [
      result.rows[0].id,
    ]);

    return true;
  }

  /**
   * Delete expired OTPs (cleanup)
   */
  static async deleteExpired(): Promise<void> {
    await query('DELETE FROM otp_codes WHERE expires_at < NOW()');
  }

  /**
   * Check if OTP exists and is valid (for resend logic)
   */
  static async hasValidOTP(phoneNumber: string): Promise<boolean> {
    const result = await query(
      `SELECT * FROM otp_codes 
       WHERE phone_number = $1 
       AND expires_at > NOW() 
       AND verified = FALSE`,
      [phoneNumber]
    );

    return result.rows.length > 0;
  }
}

