/**
 * Application-wide constants and configuration limits
 */

export const VIDEO_CONFIG = {
  DOWNLOAD_TIMEOUT_MS: 60000,
  MAX_SIZE_MB: 50,
  CLEANUP_AGE_MS: 3600000, // 1 hour
};

export const GEMINI_CONFIG = {
  CHAT: {
    MAX_TOKENS: 500,
    TEMPERATURE: 0.8,
  },
  EXTRACTION: {
    TEMPERATURE: 0.1,
    MAX_TOKENS: 2000,
  },
};

export const API_LIMITS = {
  GOOGLE_PLACES_CONCURRENT: 3,
  APIFY_WAIT_SECONDS: 180,
  YOUTUBE_TRANSCRIPT_TIMEOUT_MS: 10000,
  OEMBED_TIMEOUT_MS: 10000,
};

