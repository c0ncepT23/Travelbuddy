import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

/**
 * Generate a unique UUID
 */
export const generateUUID = (): string => {
  return uuidv4();
};

/**
 * Generate a cryptographically secure 6-character alphanumeric invite code
 * Uses crypto.randomBytes for security instead of Math.random
 */
export const generateInviteCode = (): string => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = crypto.randomBytes(6);
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += characters.charAt(bytes[i] % characters.length);
  }
  return code;
};

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in meters
 */
export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

/**
 * Extract YouTube video ID from URL (supports regular videos, shorts, and embeds)
 */
export const extractYouTubeVideoId = (url: string): string | null => {
  const regex =
    /(?:youtube\.com\/(?:shorts\/|[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
};

/**
 * Extract Instagram post ID from URL
 */
export const extractInstagramPostId = (url: string): string | null => {
  const regex = /(?:instagram\.com\/(?:p|reel|reels)\/)([A-Za-z0-9_-]+)/;
  const match = url.match(regex);
  return match ? match[1] : null;
};

/**
 * Extract Reddit post info from URL
 */
export const extractRedditPostInfo = (
  url: string
): { subreddit: string; postId: string } | null => {
  const regex = /reddit\.com\/r\/([^\/]+)\/comments\/([^\/]+)/;
  const match = url.match(regex);
  return match ? { subreddit: match[1], postId: match[2] } : null;
};

/**
 * Sanitize user input
 */
export const sanitizeInput = (input: string): string => {
  return input.trim().replace(/[<>]/g, '');
};

/**
 * Format date to ISO string
 */
export const formatDate = (date: Date): string => {
  return date.toISOString();
};

/**
 * Check if URL is valid and safe (not internal/localhost)
 * Prevents SSRF attacks
 */
export const isValidUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    
    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return false;
    }
    
    // Block internal/localhost URLs to prevent SSRF
    const hostname = parsed.hostname.toLowerCase();
    const blockedHosts = [
      'localhost',
      '127.0.0.1',
      '0.0.0.0',
      '::1',
      '169.254.169.254', // AWS metadata
      'metadata.google.internal', // GCP metadata
    ];
    
    if (blockedHosts.includes(hostname)) {
      return false;
    }
    
    // Block private IP ranges
    const ipv4Pattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const match = hostname.match(ipv4Pattern);
    if (match) {
      const [, a, b] = match.map(Number);
      // Block 10.x.x.x, 172.16-31.x.x, 192.168.x.x
      if (a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) {
        return false;
      }
    }
    
    return true;
  } catch {
    return false;
  }
};

/**
 * Extract URLs from text
 */
export const extractUrls = (text: string): string[] => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const matches = text.match(urlRegex);
  return matches || [];
};

/**
 * Check if text contains any URLs
 */
export const containsUrl = (text: string): boolean => {
  const urls = extractUrls(text);
  return urls.length > 0;
};

/**
 * Generate random string
 */
export const generateRandomString = (length: number): string => {
  return crypto.randomBytes(length).toString('hex');
};

/**
 * Sleep utility for delays
 */
export const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

