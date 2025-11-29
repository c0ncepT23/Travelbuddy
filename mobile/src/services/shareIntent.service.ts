/**
 * Share Intent Service
 * Handles receiving shared content from other apps (YouTube, Instagram, Reddit, etc.)
 */

import { Platform, Linking } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';

export interface SharedContent {
  type: 'text' | 'url' | 'image' | 'file';
  data: string;
  mimeType?: string;
  extraData?: any;
}

class ShareIntentService {
  private listeners: ((content: SharedContent) => void)[] = [];
  private pendingShare: SharedContent | null = null;

  /**
   * Initialize the share intent listener
   */
  async initialize(): Promise<SharedContent | null> {
    try {
      // Check if app was opened via a share intent
      const initialUrl = await Linking.getInitialURL();
      
      if (initialUrl) {
        const content = this.parseSharedContent(initialUrl);
        if (content) {
          console.log('[ShareIntent] App opened with shared content:', content);
          this.pendingShare = content;
          return content;
        }
      }

      // Listen for future share intents
      Linking.addEventListener('url', (event) => {
        const content = this.parseSharedContent(event.url);
        if (content) {
          console.log('[ShareIntent] Received shared content:', content);
          this.notifyListeners(content);
        }
      });

      return null;
    } catch (error) {
      console.error('[ShareIntent] Initialize error:', error);
      return null;
    }
  }

  /**
   * Parse shared content from URL/intent data
   */
  private parseSharedContent(data: string): SharedContent | null {
    if (!data) return null;

    try {
      // Check if it's a URL
      if (this.isValidUrl(data)) {
        return {
          type: 'url',
          data: data,
        };
      }

      // Check if it contains a URL
      const urlMatch = data.match(/(https?:\/\/[^\s]+)/);
      if (urlMatch) {
        return {
          type: 'url',
          data: urlMatch[1],
        };
      }

      // Plain text
      if (data.length > 0) {
        return {
          type: 'text',
          data: data,
        };
      }

      return null;
    } catch (error) {
      console.error('[ShareIntent] Parse error:', error);
      return null;
    }
  }

  /**
   * Check if string is a valid URL
   */
  private isValidUrl(string: string): boolean {
    try {
      new URL(string);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if URL is from a supported platform
   */
  static detectPlatform(url: string): 'youtube' | 'instagram' | 'reddit' | 'tiktok' | 'web' | 'unknown' {
    const lowerUrl = url.toLowerCase();
    
    if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) {
      return 'youtube';
    }
    if (lowerUrl.includes('instagram.com')) {
      return 'instagram';
    }
    if (lowerUrl.includes('reddit.com')) {
      return 'reddit';
    }
    if (lowerUrl.includes('tiktok.com')) {
      return 'tiktok';
    }
    if (lowerUrl.startsWith('http://') || lowerUrl.startsWith('https://')) {
      return 'web';
    }
    return 'unknown';
  }

  /**
   * Get platform icon for display
   */
  static getPlatformIcon(platform: string): string {
    switch (platform) {
      case 'youtube': return '📺';
      case 'instagram': return '📷';
      case 'reddit': return '💬';
      case 'tiktok': return '🎵';
      case 'web': return '🌐';
      default: return '🔗';
    }
  }

  /**
   * Get platform name for display
   */
  static getPlatformName(platform: string): string {
    switch (platform) {
      case 'youtube': return 'YouTube';
      case 'instagram': return 'Instagram';
      case 'reddit': return 'Reddit';
      case 'tiktok': return 'TikTok';
      case 'web': return 'Web Link';
      default: return 'Link';
    }
  }

  /**
   * Add listener for shared content
   */
  addListener(callback: (content: SharedContent) => void): () => void {
    this.listeners.push(callback);
    
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(content: SharedContent) {
    this.listeners.forEach(listener => {
      try {
        listener(content);
      } catch (error) {
        console.error('[ShareIntent] Listener error:', error);
      }
    });
  }

  /**
   * Get and clear pending share
   */
  getPendingShare(): SharedContent | null {
    const share = this.pendingShare;
    this.pendingShare = null;
    return share;
  }

  /**
   * Set pending share (for when user shares while app is running)
   */
  setPendingShare(content: SharedContent) {
    this.pendingShare = content;
    this.notifyListeners(content);
  }

  /**
   * Clear pending share
   */
  clearPendingShare() {
    this.pendingShare = null;
  }
}

export const shareIntentService = new ShareIntentService();
export default shareIntentService;

