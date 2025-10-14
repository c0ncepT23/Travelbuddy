import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { config } from '../config/env';
import { UserModel } from '../models/user.model';
import { RefreshTokenModel } from '../models/refreshToken.model';
import { OTPModel } from '../models/otp.model';
import { AuthUser, User } from '../types';
import logger from '../config/logger';

const googleClient = new OAuth2Client(config.google.clientId);

export class AuthService {
  /**
   * Generate JWT access token
   */
  static generateAccessToken(user: AuthUser): string {
    return jwt.sign(user, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn as any,
    });
  }

  /**
   * Generate JWT refresh token
   */
  static generateRefreshToken(userId: string): string {
    return jwt.sign({ userId }, config.jwt.refreshSecret, {
      expiresIn: config.jwt.refreshExpiresIn as any,
    });
  }

  /**
   * Verify access token
   */
  static verifyAccessToken(token: string): AuthUser | null {
    try {
      return jwt.verify(token, config.jwt.secret) as AuthUser;
    } catch (error) {
      logger.error('Access token verification failed:', error);
      return null;
    }
  }

  /**
   * Verify refresh token
   */
  static verifyRefreshToken(token: string): { userId: string } | null {
    try {
      return jwt.verify(token, config.jwt.refreshSecret) as { userId: string };
    } catch (error) {
      logger.error('Refresh token verification failed:', error);
      return null;
    }
  }

  /**
   * Register new user
   */
  static async register(
    email: string,
    password: string,
    name: string
  ): Promise<{ user: User; accessToken: string; refreshToken: string }> {
    // Check if user already exists
    const existingUser = await UserModel.findByEmail(email);
    if (existingUser) {
      throw new Error('Email already registered');
    }

    // Create user
    const user = await UserModel.create(email, password, name);

    // Generate tokens
    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar_url: user.avatar_url,
    };

    const accessToken = this.generateAccessToken(authUser);
    const refreshToken = this.generateRefreshToken(user.id);

    // Store refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days
    await RefreshTokenModel.create(user.id, refreshToken, expiresAt);

    return { user, accessToken, refreshToken };
  }

  /**
   * Login user
   */
  static async login(
    email: string,
    password: string
  ): Promise<{ user: User; accessToken: string; refreshToken: string }> {
    // Find user
    const user = await UserModel.findByEmail(email);
    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Verify password
    const isValid = await UserModel.verifyPassword(email, password);
    if (!isValid) {
      throw new Error('Invalid credentials');
    }

    // Generate tokens
    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar_url: user.avatar_url,
    };

    const accessToken = this.generateAccessToken(authUser);
    const refreshToken = this.generateRefreshToken(user.id);

    // Store refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    await RefreshTokenModel.create(user.id, refreshToken, expiresAt);

    return { user, accessToken, refreshToken };
  }

  /**
   * Refresh access token
   */
  static async refreshAccessToken(
    refreshToken: string
  ): Promise<{ accessToken: string; refreshToken: string }> {
    // Verify refresh token
    const decoded = this.verifyRefreshToken(refreshToken);
    if (!decoded) {
      throw new Error('Invalid refresh token');
    }

    // Check if token exists in database
    const tokenExists = await RefreshTokenModel.isValid(refreshToken);
    if (!tokenExists) {
      throw new Error('Refresh token not found or expired');
    }

    // Get user
    const user = await UserModel.findById(decoded.userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Generate new tokens
    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar_url: user.avatar_url,
    };

    const newAccessToken = this.generateAccessToken(authUser);
    const newRefreshToken = this.generateRefreshToken(user.id);

    // Delete old refresh token and create new one
    await RefreshTokenModel.delete(refreshToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    await RefreshTokenModel.create(user.id, newRefreshToken, expiresAt);

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  }

  /**
   * Logout user
   */
  static async logout(refreshToken: string): Promise<void> {
    await RefreshTokenModel.delete(refreshToken);
  }

  /**
   * Google OAuth login
   */
  static async googleLogin(
    idToken: string
  ): Promise<{ user: User; accessToken: string; refreshToken: string }> {
    try {
      // Verify Google token
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: config.google.clientId,
      });

      const payload = ticket.getPayload();
      if (!payload || !payload.email) {
        throw new Error('Invalid Google token');
      }

      const { email, name, picture } = payload;

      // Check if user exists
      let user = await UserModel.findByEmail(email);

      // Create user if doesn't exist
      if (!user) {
        user = await UserModel.createFromOAuth(email, name || email, picture);
      }

      // Generate tokens
      const authUser: AuthUser = {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar_url: user.avatar_url,
      };

      const accessToken = this.generateAccessToken(authUser);
      const refreshToken = this.generateRefreshToken(user.id);

      // Store refresh token
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);
      await RefreshTokenModel.create(user.id, refreshToken, expiresAt);

      return { user, accessToken, refreshToken };
    } catch (error) {
      logger.error('Google OAuth error:', error);
      throw new Error('Google authentication failed');
    }
  }

  /**
   * Send OTP to phone number
   * For development, always returns "0000"
   */
  static async sendOTP(phoneNumber: string): Promise<{ message: string; otpCode?: string }> {
    try {
      // Validate phone number format (basic validation)
      if (!phoneNumber || phoneNumber.length < 10) {
        throw new Error('Invalid phone number');
      }

      // Create OTP (hardcoded to "0000")
      const otpCode = await OTPModel.createOTP(phoneNumber);

      logger.info(`OTP sent to ${phoneNumber}: ${otpCode}`);

      // In production, send SMS via Twilio/AWS SNS/etc.
      // For development, return the OTP code
      return {
        message: 'OTP sent successfully',
        otpCode: otpCode, // Remove this in production!
      };
    } catch (error) {
      logger.error('Send OTP error:', error);
      throw new Error('Failed to send OTP');
    }
  }

  /**
   * Register with phone number and OTP
   */
  static async registerWithPhone(
    phoneNumber: string,
    otpCode: string,
    name: string
  ): Promise<{ user: User; accessToken: string; refreshToken: string }> {
    try {
      // Verify OTP
      const isValid = await OTPModel.verifyOTP(phoneNumber, otpCode);
      if (!isValid) {
        throw new Error('Invalid or expired OTP');
      }

      // Check if phone already registered
      const existingUser = await UserModel.findByPhone(phoneNumber);
      if (existingUser) {
        throw new Error('Phone number already registered');
      }

      // Create user
      const user = await UserModel.createWithPhone(phoneNumber, name);

      // Generate tokens
      const authUser: AuthUser = {
        id: user.id,
        phone_number: user.phone_number,
        name: user.name,
        avatar_url: user.avatar_url,
      };

      const accessToken = this.generateAccessToken(authUser);
      const refreshToken = this.generateRefreshToken(user.id);

      // Store refresh token
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);
      await RefreshTokenModel.create(user.id, refreshToken, expiresAt);

      return { user, accessToken, refreshToken };
    } catch (error: any) {
      logger.error('Register with phone error:', error);
      throw error;
    }
  }

  /**
   * Login with phone number and OTP
   */
  static async loginWithPhone(
    phoneNumber: string,
    otpCode: string
  ): Promise<{ user: User; accessToken: string; refreshToken: string }> {
    try {
      // Verify OTP
      const isValid = await OTPModel.verifyOTP(phoneNumber, otpCode);
      if (!isValid) {
        throw new Error('Invalid or expired OTP');
      }

      // Find user
      const user = await UserModel.findByPhone(phoneNumber);
      if (!user) {
        throw new Error('Phone number not registered. Please sign up first.');
      }

      // Generate tokens
      const authUser: AuthUser = {
        id: user.id,
        phone_number: user.phone_number,
        name: user.name,
        avatar_url: user.avatar_url,
      };

      const accessToken = this.generateAccessToken(authUser);
      const refreshToken = this.generateRefreshToken(user.id);

      // Store refresh token
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);
      await RefreshTokenModel.create(user.id, refreshToken, expiresAt);

      return { user, accessToken, refreshToken };
    } catch (error: any) {
      logger.error('Login with phone error:', error);
      throw error;
    }
  }
}

