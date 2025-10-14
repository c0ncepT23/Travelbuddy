import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import logger from '../config/logger';

export class AuthController {
  /**
   * Register new user
   */
  static async register(req: Request, res: Response): Promise<void> {
    try {
      const { email, password, name } = req.body;

      const result = await AuthService.register(email, password, name);

      res.status(201).json({
        success: true,
        data: {
          user: {
            id: result.user.id,
            email: result.user.email,
            name: result.user.name,
            avatar_url: result.user.avatar_url,
          },
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
        },
        message: 'Registration successful',
      });
    } catch (error: any) {
      logger.error('Registration error:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Registration failed',
      });
    }
  }

  /**
   * Login user
   */
  static async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;

      const result = await AuthService.login(email, password);

      res.status(200).json({
        success: true,
        data: {
          user: {
            id: result.user.id,
            email: result.user.email,
            name: result.user.name,
            avatar_url: result.user.avatar_url,
          },
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
        },
        message: 'Login successful',
      });
    } catch (error: any) {
      logger.error('Login error:', error);
      res.status(401).json({
        success: false,
        error: error.message || 'Login failed',
      });
    }
  }

  /**
   * Refresh access token
   */
  static async refresh(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        res.status(400).json({
          success: false,
          error: 'Refresh token required',
        });
        return;
      }

      const result = await AuthService.refreshAccessToken(refreshToken);

      res.status(200).json({
        success: true,
        data: result,
        message: 'Token refreshed successfully',
      });
    } catch (error: any) {
      logger.error('Token refresh error:', error);
      res.status(401).json({
        success: false,
        error: error.message || 'Token refresh failed',
      });
    }
  }

  /**
   * Logout user
   */
  static async logout(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        res.status(400).json({
          success: false,
          error: 'Refresh token required',
        });
        return;
      }

      await AuthService.logout(refreshToken);

      res.status(200).json({
        success: true,
        message: 'Logout successful',
      });
    } catch (error: any) {
      logger.error('Logout error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Logout failed',
      });
    }
  }

  /**
   * Google OAuth login
   */
  static async googleLogin(req: Request, res: Response): Promise<void> {
    try {
      const { idToken } = req.body;

      if (!idToken) {
        res.status(400).json({
          success: false,
          error: 'Google ID token required',
        });
        return;
      }

      const result = await AuthService.googleLogin(idToken);

      res.status(200).json({
        success: true,
        data: {
          user: {
            id: result.user.id,
            email: result.user.email,
            name: result.user.name,
            avatar_url: result.user.avatar_url,
          },
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
        },
        message: 'Google login successful',
      });
    } catch (error: any) {
      logger.error('Google login error:', error);
      res.status(401).json({
        success: false,
        error: error.message || 'Google login failed',
      });
    }
  }

  /**
   * Send OTP to phone number
   */
  static async sendOTP(req: Request, res: Response): Promise<void> {
    try {
      const { phoneNumber } = req.body;

      if (!phoneNumber) {
        res.status(400).json({
          success: false,
          error: 'Phone number required',
        });
        return;
      }

      const result = await AuthService.sendOTP(phoneNumber);

      res.status(200).json({
        success: true,
        data: result,
        message: 'OTP sent successfully',
      });
    } catch (error: any) {
      logger.error('Send OTP error:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to send OTP',
      });
    }
  }

  /**
   * Register with phone number and OTP
   */
  static async registerWithPhone(req: Request, res: Response): Promise<void> {
    try {
      const { phoneNumber, otpCode, name } = req.body;

      if (!phoneNumber || !otpCode || !name) {
        res.status(400).json({
          success: false,
          error: 'Phone number, OTP code, and name are required',
        });
        return;
      }

      const result = await AuthService.registerWithPhone(phoneNumber, otpCode, name);

      res.status(201).json({
        success: true,
        data: {
          user: {
            id: result.user.id,
            phone_number: result.user.phone_number,
            name: result.user.name,
            avatar_url: result.user.avatar_url,
          },
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
        },
        message: 'Registration successful',
      });
    } catch (error: any) {
      logger.error('Register with phone error:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Registration failed',
      });
    }
  }

  /**
   * Login with phone number and OTP
   */
  static async loginWithPhone(req: Request, res: Response): Promise<void> {
    try {
      const { phoneNumber, otpCode } = req.body;

      if (!phoneNumber || !otpCode) {
        res.status(400).json({
          success: false,
          error: 'Phone number and OTP code are required',
        });
        return;
      }

      const result = await AuthService.loginWithPhone(phoneNumber, otpCode);

      res.status(200).json({
        success: true,
        data: {
          user: {
            id: result.user.id,
            phone_number: result.user.phone_number,
            name: result.user.name,
            avatar_url: result.user.avatar_url,
          },
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
        },
        message: 'Login successful',
      });
    } catch (error: any) {
      logger.error('Login with phone error:', error);
      res.status(401).json({
        success: false,
        error: error.message || 'Login failed',
      });
    }
  }
}

