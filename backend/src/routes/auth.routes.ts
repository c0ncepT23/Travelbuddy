import { Router } from 'express';
import { body } from 'express-validator';
import { AuthController } from '../controllers/auth.controller';
import { validate } from '../middleware/validation';
import { authLimiter } from '../middleware/rateLimiter';
import { authenticate } from '../middleware/auth';

const router = Router();

// Apply auth rate limiter to all auth routes
router.use(authLimiter);

// Register
router.post(
  '/signup',
  validate([
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters'),
    body('name').trim().notEmpty().withMessage('Name is required'),
  ]),
  AuthController.register
);

// Login
router.post(
  '/login',
  validate([
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').notEmpty().withMessage('Password is required'),
  ]),
  AuthController.login
);

// Refresh token
router.post(
  '/refresh',
  validate([body('refreshToken').notEmpty().withMessage('Refresh token required')]),
  AuthController.refresh
);

// Logout
router.post(
  '/logout',
  validate([body('refreshToken').notEmpty().withMessage('Refresh token required')]),
  AuthController.logout
);

// Google OAuth
router.post(
  '/google',
  validate([body('idToken').notEmpty().withMessage('Google ID token required')]),
  AuthController.googleLogin
);

// Phone OTP - Send OTP
router.post(
  '/send-otp',
  validate([
    body('phoneNumber')
      .trim()
      .notEmpty()
      .withMessage('Phone number required')
      .isLength({ min: 10 })
      .withMessage('Phone number must be at least 10 digits'),
  ]),
  AuthController.sendOTP
);

// Phone OTP - Register
router.post(
  '/register-phone',
  validate([
    body('phoneNumber')
      .trim()
      .notEmpty()
      .withMessage('Phone number required')
      .isLength({ min: 10 })
      .withMessage('Phone number must be at least 10 digits'),
    body('otpCode')
      .trim()
      .notEmpty()
      .withMessage('OTP code required')
      .isLength({ min: 4, max: 4 })
      .withMessage('OTP code must be 4 digits'),
    body('name').trim().notEmpty().withMessage('Name is required'),
  ]),
  AuthController.registerWithPhone
);

// Phone OTP - Login
router.post(
  '/login-phone',
  validate([
    body('phoneNumber')
      .trim()
      .notEmpty()
      .withMessage('Phone number required')
      .isLength({ min: 10 })
      .withMessage('Phone number must be at least 10 digits'),
    body('otpCode')
      .trim()
      .notEmpty()
      .withMessage('OTP code required')
      .isLength({ min: 4, max: 4 })
      .withMessage('OTP code must be 4 digits'),
  ]),
  AuthController.loginWithPhone
);

// Update profile (requires authentication)
router.patch(
  '/profile',
  authenticate,
  AuthController.updateProfile
);

export default router;

