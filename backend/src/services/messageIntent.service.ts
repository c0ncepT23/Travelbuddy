/**
 * Message Intent Classification Service
 * Determines when AI should respond vs stay silent in group chat
 * 
 * SIMPLIFIED APPROACH (no LLM calls):
 * 1. URL detected → AI processes automatically
 * 2. @AI or @TravelPal mentioned → AI responds
 * 3. Everything else → AI stays silent (member chat)
 */

import logger from '../config/logger';

export type MessageIntent = 
  | 'PROCESS_LINK'    // Contains URL to extract places from
  | 'AI_QUERY'        // User mentioned @AI/@TravelPal
  | 'MEMBER_CHAT';    // Users chatting with each other - AI stays silent

// URL patterns we can process
const PROCESSABLE_URL_PATTERNS = [
  /https?:\/\/(www\.)?youtube\.com\/watch/i,
  /https?:\/\/youtu\.be\//i,
  /https?:\/\/(www\.)?instagram\.com\/(p|reel|tv)\//i,
  /https?:\/\/(www\.)?reddit\.com\/r\//i,
  /https?:\/\/(www\.)?tiktok\.com\/@/i,
  /https?:\/\/vm\.tiktok\.com\//i,
];

// AI mention patterns
const AI_MENTION_PATTERNS = [
  /@ai\b/i,
  /@travelpal\b/i,
];

export class MessageIntentService {
  /**
   * Classify message intent - determines if AI should respond
   * 
   * Simple rules:
   * 1. Contains processable URL → PROCESS_LINK
   * 2. Contains @AI or @TravelPal → AI_QUERY
   * 3. Everything else → MEMBER_CHAT (AI stays silent)
   */
  static async classifyIntent(
    message: string,
    _senderName?: string
  ): Promise<{ intent: MessageIntent; confidence: number; reason: string }> {
    const trimmedMessage = message.trim();

    // 1. Contains URL → Always process
    if (this.containsProcessableUrl(trimmedMessage)) {
      logger.info('[Intent] URL detected - PROCESS_LINK');
      return {
        intent: 'PROCESS_LINK',
        confidence: 1.0,
        reason: 'Message contains a processable URL (YouTube/Instagram/Reddit/TikTok)',
      };
    }

    // 2. Contains @AI or @TravelPal → AI responds
    if (this.hasAIMention(trimmedMessage)) {
      logger.info('[Intent] @AI mention detected - AI_QUERY');
      return {
        intent: 'AI_QUERY',
        confidence: 1.0,
        reason: 'User explicitly mentioned @AI or @TravelPal',
      };
    }

    // 3. Everything else → Member chat, AI stays silent
    logger.info('[Intent] No URL or @AI mention - MEMBER_CHAT (AI silent)');
    return {
      intent: 'MEMBER_CHAT',
      confidence: 1.0,
      reason: 'No URL or @AI mention - member-to-member chat',
    };
  }

  /**
   * Check if message contains a URL we can process
   */
  static containsProcessableUrl(message: string): boolean {
    return PROCESSABLE_URL_PATTERNS.some(pattern => pattern.test(message));
  }

  /**
   * Check if user explicitly mentioned @AI or @TravelPal
   */
  private static hasAIMention(message: string): boolean {
    return AI_MENTION_PATTERNS.some(pattern => pattern.test(message));
  }

  /**
   * Extract URLs from message
   */
  static extractUrls(message: string): string[] {
    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    const matches = message.match(urlRegex);
    return matches || [];
  }
}
