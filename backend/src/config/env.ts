import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Server
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),

  // Database
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    name: process.env.DB_NAME || 'travel_agent_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
  },

  // JWT - SECURITY: Fail in production if secrets are not set
  jwt: {
    secret: (() => {
      const secret = process.env.JWT_SECRET;
      if (!secret && process.env.NODE_ENV === 'production') {
        throw new Error('SECURITY ERROR: JWT_SECRET must be set in production');
      }
      return secret || 'dev_jwt_secret_not_for_production';
    })(),
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshSecret: (() => {
      const secret = process.env.JWT_REFRESH_SECRET;
      if (!secret && process.env.NODE_ENV === 'production') {
        throw new Error('SECURITY ERROR: JWT_REFRESH_SECRET must be set in production');
      }
      return secret || 'dev_refresh_secret_not_for_production';
    })(),
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },

  // OpenAI
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
  },

  // Google Gemini
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
  },

  // Apify (Instagram scraping)
  apify: {
    token: process.env.APIFY_TOKEN || '',
  },

  // Google OAuth
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  },

  // Google Maps
  googleMaps: {
    apiKey: process.env.GOOGLE_MAPS_API_KEY || '',
  },

  // AWS S3
  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    region: process.env.AWS_REGION || 'us-east-1',
    s3Bucket: process.env.AWS_S3_BUCKET || 'travel-agent-media',
  },

  // FCM
  fcm: {
    serverKey: process.env.FCM_SERVER_KEY || '',
  },

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },

  // CORS
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:19000'],
  },
};

export default config;

