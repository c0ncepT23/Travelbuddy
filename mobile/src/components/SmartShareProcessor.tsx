/**
 * Smart Share Processor
 * 
 * Zero-friction content processing:
 * - Shows immediately when user shares from YouTube/Instagram/Reddit
 * - Auto-processes the URL (no trip selection needed!)
 * - Shows animated progress with place extraction
 * - Auto-navigates to map when done
 * 
 * Inspired by Zenly's instant, delightful interactions
 */

import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Animated,
  Easing,
} from 'react-native';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { HapticFeedback } from '../utils/haptics';
import api from '../config/api';
import theme from '../config/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ProcessedPlace {
  id: string;
  name: string;
  category: string;
  description: string;
  cuisine_type?: string;
  place_type?: string;
  location_lat?: number;
  location_lng?: number;
  rating?: number;
}

interface ProcessResult {
  success: boolean;
  tripId: string;
  tripName: string;
  destination: string;
  destinationCountry: string;
  isNewTrip: boolean;
  placesExtracted: number;
  places: ProcessedPlace[];
}

interface SmartShareProcessorProps {
  url: string;
  onComplete: (result: ProcessResult) => void;
  onError: (error: string) => void;
  onClose: () => void;
}

type ProcessingStage = 'detecting' | 'extracting' | 'saving' | 'complete' | 'error';

const STAGE_MESSAGES: Record<ProcessingStage, string> = {
  detecting: 'Detecting destination...',
  extracting: 'Extracting places...',
  saving: 'Saving to your map...',
  complete: 'Done!',
  error: 'Something went wrong',
};

const STAGE_EMOJIS: Record<ProcessingStage, string> = {
  detecting: '🔍',
  extracting: '✨',
  saving: '💾',
  complete: '🎉',
  error: '😕',
};

export const SmartShareProcessor: React.FC<SmartShareProcessorProps> = ({
  url,
  onComplete,
  onError,
  onClose,
}) => {
  const [stage, setStage] = useState<ProcessingStage>('detecting');
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Animation values
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Platform detection
  const platform = detectPlatform(url);
  const platformInfo = getPlatformInfo(platform);

  // Start animations
  useEffect(() => {
    // Pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Rotate animation
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  // Process the URL
  useEffect(() => {
    processUrl();
  }, []);

  const processUrl = async () => {
    try {
      // Stage 1: Detecting
      HapticFeedback.light();
      setStage('detecting');
      await animateProgress(0, 0.2);

      // Stage 2: Extracting
      setStage('extracting');
      HapticFeedback.light();
      await animateProgress(0.2, 0.6);

      // Make API call
      const response = await api.post('/share/process', { url });
      
      if (!response.data.success && !response.data.tripId) {
        throw new Error(response.data.message || 'No places found');
      }

      // Stage 3: Saving
      setStage('saving');
      HapticFeedback.medium();
      await animateProgress(0.6, 0.9);

      // Stage 4: Complete!
      setStage('complete');
      setResult(response.data);
      HapticFeedback.success();
      await animateProgress(0.9, 1);

      // Wait a moment to show success, then complete
      setTimeout(() => {
        onComplete(response.data);
      }, 1500);

    } catch (error: any) {
      console.error('[SmartShare] Error:', error);
      setStage('error');
      setErrorMessage(error.response?.data?.error || error.message || 'Failed to process');
      HapticFeedback.error();
      
      setTimeout(() => {
        onError(errorMessage || 'Failed to process');
      }, 2000);
    }
  };

  const animateProgress = (from: number, to: number): Promise<void> => {
    return new Promise((resolve) => {
      progressAnim.setValue(from);
      Animated.timing(progressAnim, {
        toValue: to,
        duration: 500,
        easing: Easing.out(Easing.ease),
        useNativeDriver: false,
      }).start(() => resolve());
    });
  };

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.container}>
      {/* Background gradient */}
      <LinearGradient
        colors={stage === 'complete' ? ['#10B981', '#059669'] : stage === 'error' ? ['#EF4444', '#DC2626'] : platformInfo.gradient}
        style={styles.background}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Content */}
      <MotiView
        from={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', damping: 15 }}
        style={styles.content}
      >
        {/* Platform badge */}
        <View style={styles.platformBadge}>
          <Text style={styles.platformIcon}>{platformInfo.icon}</Text>
          <Text style={styles.platformName}>{platformInfo.name}</Text>
        </View>

        {/* Main animation area */}
        <View style={styles.animationArea}>
          <Animated.View
            style={[
              styles.orb,
              {
                transform: [{ scale: pulseAnim }],
              },
            ]}
          >
            <Animated.View
              style={[
                styles.orbInner,
                { transform: [{ rotate: rotation }] },
              ]}
            >
              <Text style={styles.stageEmoji}>{STAGE_EMOJIS[stage]}</Text>
            </Animated.View>
          </Animated.View>

          {/* Decorative rings */}
          <View style={[styles.ring, styles.ring1]} />
          <View style={[styles.ring, styles.ring2]} />
          <View style={[styles.ring, styles.ring3]} />
        </View>

        {/* Stage message */}
        <MotiView
          key={stage}
          from={{ opacity: 0, translateY: 10 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 300 }}
        >
          <Text style={styles.stageMessage}>{STAGE_MESSAGES[stage]}</Text>
        </MotiView>

        {/* Progress bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBg}>
            <Animated.View
              style={[
                styles.progressFill,
                { width: progressWidth },
              ]}
            />
          </View>
        </View>

        {/* Result preview (when complete) */}
        {stage === 'complete' && result && (
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'spring', delay: 300 }}
            style={styles.resultPreview}
          >
            <Text style={styles.resultCountry}>
              🗺️ {result.destinationCountry}
            </Text>
            <Text style={styles.resultPlaces}>
              {result.placesExtracted} place{result.placesExtracted !== 1 ? 's' : ''} saved
            </Text>
            {result.isNewTrip && (
              <View style={styles.newTripBadge}>
                <Text style={styles.newTripText}>✨ New trip created!</Text>
              </View>
            )}
          </MotiView>
        )}

        {/* Error message */}
        {stage === 'error' && errorMessage && (
          <MotiView
            from={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={styles.errorContainer}
          >
            <Text style={styles.errorText}>{errorMessage}</Text>
          </MotiView>
        )}

        {/* URL preview */}
        <View style={styles.urlPreview}>
          <Text style={styles.urlText} numberOfLines={1}>
            {truncateUrl(url, 45)}
          </Text>
        </View>
      </MotiView>
    </View>
  );
};

// Helper functions
function detectPlatform(url: string): string {
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) return 'youtube';
  if (lowerUrl.includes('instagram.com')) return 'instagram';
  if (lowerUrl.includes('reddit.com')) return 'reddit';
  if (lowerUrl.includes('tiktok.com')) return 'tiktok';
  return 'web';
}

function getPlatformInfo(platform: string): { icon: string; name: string; gradient: [string, string] } {
  switch (platform) {
    case 'youtube':
      return { icon: '📺', name: 'YouTube', gradient: ['#FF0000', '#CC0000'] };
    case 'instagram':
      return { icon: '📷', name: 'Instagram', gradient: ['#E1306C', '#833AB4'] };
    case 'reddit':
      return { icon: '💬', name: 'Reddit', gradient: ['#FF4500', '#FF5722'] };
    case 'tiktok':
      return { icon: '🎵', name: 'TikTok', gradient: ['#000000', '#25F4EE'] };
    default:
      return { icon: '🌐', name: 'Web', gradient: ['#6366F1', '#8B5CF6'] };
  }
}

function truncateUrl(url: string, maxLength: number): string {
  if (url.length <= maxLength) return url;
  return url.substring(0, maxLength - 3) + '...';
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  background: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  content: {
    alignItems: 'center',
    padding: 40,
  },
  platformBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 40,
  },
  platformIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  platformName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  animationArea: {
    width: 160,
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  orb: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  orbInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stageEmoji: {
    fontSize: 40,
  },
  ring: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 1000,
  },
  ring1: {
    width: 120,
    height: 120,
  },
  ring2: {
    width: 140,
    height: 140,
  },
  ring3: {
    width: 160,
    height: 160,
  },
  stageMessage: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 24,
  },
  progressContainer: {
    width: SCREEN_WIDTH * 0.6,
    marginBottom: 32,
  },
  progressBg: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 3,
  },
  resultPreview: {
    alignItems: 'center',
    marginTop: 16,
  },
  resultCountry: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  resultPlaces: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 12,
  },
  newTripBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  newTripText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  errorContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 16,
  },
  errorText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  urlPreview: {
    position: 'absolute',
    bottom: -60,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  urlText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '500',
  },
});

export default SmartShareProcessor;

