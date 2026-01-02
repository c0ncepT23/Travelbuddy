/**
 * Smart Share Processor - Magical AI Edition ✨
 * 
 * Beautiful animated processing screen with:
 * - Deep purple/indigo/pink gradient
 * - Floating particles
 * - Pulsing orb with rings
 * - Glitter/confetti on completion
 */

import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Animated,
  Easing as RNEasing,
  TouchableOpacity,
} from 'react-native';
import { MotiView, AnimatePresence } from 'moti';
import { Easing } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { HapticFeedback } from '../utils/haptics';
import api from '../config/api';
import { useYoriStore } from '../stores/yoriStore';
import { Image } from 'react-native';

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
  message?: string;
  // Discovery Queue: When no places found but food/activity intent detected
  discovery_queued?: boolean;
  queued_item?: {
    id: string;
    item: string;
    city: string;
    vibe?: string;
  };
}

interface SmartShareProcessorProps {
  url: string;
  onComplete: (result: ProcessResult) => void;
  onError: (error: string) => void;
  onClose: () => void;
}

type ProcessingStage = 'detecting' | 'extracting' | 'enriching' | 'complete' | 'error';

const STAGE_MESSAGES: Record<ProcessingStage, string> = {
  detecting: 'Discovering destinations...',
  extracting: 'Finding hidden gems...',
  enriching: 'Adding the magic touches...',
  complete: 'Adventure awaits!',
  error: 'Oops, hit a bump!',
};

const SUB_MESSAGES = [
  'Your AI travel scout is on it ✨',
  'Mapping your next adventure...',
  'Unlocking travel secrets...',
  'Almost there, explorer!',
];

// Floating particle data
const generateParticles = (count: number) => {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 8 + 4,
    duration: Math.random() * 3000 + 2000,
    delay: Math.random() * 2000,
  }));
};

// Confetti particle
const Confetti: React.FC<{ delay: number; x: number }> = ({ delay, x }) => (
  <MotiView
    from={{ opacity: 1, translateY: 0, translateX: 0, rotate: '0deg' }}
    animate={{ 
      opacity: 0, 
      translateY: 400, 
      translateX: (Math.random() - 0.5) * 200,
      rotate: `${Math.random() * 720}deg` 
    }}
    transition={{ 
      type: 'timing', 
      duration: 2000, 
      delay,
      easing: Easing.bezier(0.25, 0.46, 0.45, 0.94), // quad-out, worklet-safe
    }}
    style={[
      styles.confetti,
      { 
        left: x,
        backgroundColor: ['#A78BFA', '#F472B6', '#34D399', '#FBBF24', '#60A5FA'][Math.floor(Math.random() * 5)],
      }
    ]}
  />
);

export const SmartShareProcessor: React.FC<SmartShareProcessorProps> = ({
  url,
  onComplete,
  onError,
  onClose,
}) => {
  const [stage, setStage] = useState<ProcessingStage>('detecting');
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const { setYoriState, resetToIdle } = useYoriStore();

  // Animation values
  const orbScale = useRef(new Animated.Value(1)).current;
  const ring1Scale = useRef(new Animated.Value(1)).current;
  const ring1Opacity = useRef(new Animated.Value(0.5)).current;
  const ring2Scale = useRef(new Animated.Value(1)).current;
  const ring2Opacity = useRef(new Animated.Value(0.6)).current;
  const glowOpacity = useRef(new Animated.Value(0.3)).current;

  // Generate particles once
  const particles = useMemo(() => generateParticles(15), []);
  const confettiPieces = useMemo(() => 
    Array.from({ length: 30 }, (_, i) => ({
      id: i,
      x: Math.random() * SCREEN_WIDTH,
      delay: Math.random() * 500,
    })), 
  []);

  // Platform detection
  const platform = detectPlatform(url);
  const platformInfo = getPlatformInfo(platform);

  // Handle "Got it!" for discovery queue - just close and navigate
  const handleDiscoveryQueueAck = () => {
    HapticFeedback.light();
    onComplete(result!);
  };

  // Start animations on mount
  useEffect(() => {
    // Orb pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(orbScale, {
          toValue: 1.05,
          duration: 2000,
          easing: RNEasing.inOut(RNEasing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(orbScale, {
          toValue: 1,
          duration: 2000,
          easing: RNEasing.inOut(RNEasing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Ring 1 pulse outward
    Animated.loop(
      Animated.parallel([
        Animated.timing(ring1Scale, {
          toValue: 1.3,
          duration: 2500,
          easing: RNEasing.out(RNEasing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(ring1Opacity, {
          toValue: 0,
          duration: 2500,
          easing: RNEasing.out(RNEasing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Ring 2 pulse (delayed)
    setTimeout(() => {
      Animated.loop(
        Animated.parallel([
          Animated.timing(ring2Scale, {
            toValue: 1.2,
            duration: 2500,
            easing: RNEasing.out(RNEasing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(ring2Opacity, {
            toValue: 0,
            duration: 2500,
            easing: RNEasing.out(RNEasing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();
    }, 500);

    // Glow animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowOpacity, {
          toValue: 0.6,
          duration: 2000,
          easing: RNEasing.inOut(RNEasing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(glowOpacity, {
          toValue: 0.3,
          duration: 2000,
          easing: RNEasing.inOut(RNEasing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  // Process the URL
  useEffect(() => {
    processUrl();
  }, [url]); // Re-run if URL changes

  const processUrl = async (retryCount = 0) => {
    try {
      // Stage 1: Detecting
      if (retryCount === 0) {
        HapticFeedback.light();
        setStage('detecting');
        setYoriState('THINKING', "Yori-san is watching the reel...");
      }
      
      // Minimal delay - just enough for UI to render
      await delay(retryCount === 0 ? 300 : 200);

      // Stage 2: Extracting
      setStage('extracting');
      if (retryCount === 0) HapticFeedback.light();

      // Make API call
      console.log(`[SmartShare] Calling /share/process (Attempt ${retryCount + 1}) for URL: ${url}`);
      const response = await api.post('/share/process', { url });
      
      console.log('[SmartShare] API Response:', JSON.stringify({
        success: response.data.success,
        tripId: response.data.tripId,
        placesExtracted: response.data.places?.length || 0,
        discoveryQueued: response.data.discovery_queued,
        queuedItem: response.data.queued_item,
      }));
      
      // Check for actual API failure
      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to process');
      }
      
      // Check if we got a valid trip (even if no places were extracted, trip should exist)
      if (!response.data.tripId) {
        throw new Error(response.data.message || 'No destination could be determined');
      }

      // Stage 3: Enriching
      setStage('enriching');
      HapticFeedback.medium();
      await delay(600);

      // Stage 4: Complete!
      setStage('complete');
      setResult(response.data);
      HapticFeedback.success();
      setYoriState('CELEBRATING', "Found it! Yori-san marked it on the map.");

      // If discovery was queued (food/activity intent but no places), 
      // show the "I'll remember this!" UI and wait for user to acknowledge
      if (response.data.discovery_queued) {
        console.log('[SmartShare] Discovery queued for AI Chat:', response.data.queued_item);
        return;
      }

      // If places were extracted, show confetti and complete
      if (response.data.placesExtracted > 0) {
        setShowConfetti(true);
        setTimeout(() => {
          try {
            onComplete(response.data);
          } catch (navError) {
            console.error('[SmartShare] Navigation error:', navError);
          }
        }, 3500);
        return;
      }

      // No places and no discovery - just show message and let user close
      // Don't auto-close, let user read the message

    } catch (error: any) {
      // Retry logic for Network Errors (common on cold boot)
      // Note: ECONNABORTED = timeout, Network Error = connection issues
      if ((error.message === 'Network Error' || error.code === 'ECONNABORTED') && retryCount < 2) {
        console.log(`[SmartShare] Network error, waiting 2s before retry (${retryCount + 1}/2)...`);
        await delay(2000); // Wait before retrying to let backend stabilize
        processUrl(retryCount + 1);
        return;
      }

      const msg = error.response?.data?.error || error.message || 'Failed to process';
      console.error('[SmartShare] Error:', msg);
      setStage('error');
      setErrorMessage(msg);
      HapticFeedback.error();
      setYoriState('ANNOYED', "Yori-san dropped the map. Try again?");
      
      setTimeout(() => {
        onError(msg);
      }, 2500);
    }
  };

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // If minimized, show small indicator with actual status
  if (isMinimized) {
    const isComplete = stage === 'complete';
    const isError = stage === 'error';
    
    return (
      <TouchableOpacity 
        style={styles.minimizedContainer}
        onPress={() => setIsMinimized(false)}
      >
        <LinearGradient
          colors={isComplete ? ['#10B981', '#059669'] : isError ? ['#EF4444', '#DC2626'] : ['#A78BFA', '#818CF8']}
          style={styles.minimizedBubble}
        >
          {isComplete ? (
            <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
          ) : isError ? (
            <Ionicons name="alert-circle" size={20} color="#FFFFFF" />
          ) : (
            <MotiView
              from={{ rotate: '0deg' }}
              animate={{ rotate: '360deg' }}
              transition={{ type: 'timing', duration: 2000, loop: true }}
            >
              <Ionicons name="sparkles" size={20} color="#FFFFFF" />
            </MotiView>
          )}
          <Text style={styles.minimizedText}>
            {isComplete ? 'Done! Tap to view' : isError ? 'Error occurred' : 'Processing...'}
          </Text>
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      {/* Deep magical gradient background */}
      <LinearGradient
        colors={
          stage === 'complete' 
            ? ['#065F46', '#047857', '#10B981'] 
            : stage === 'error'
            ? ['#7F1D1D', '#991B1B', '#DC2626']
            : ['#1E1B4B', '#4C1D95', '#701A75']
        }
        style={styles.background}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Animated gradient overlay */}
      <MotiView
        from={{ opacity: 0.3 }}
        animate={{ opacity: 0.6 }}
        transition={{ type: 'timing', duration: 4000, loop: true }}
        style={styles.gradientOverlay}
      >
        <LinearGradient
          colors={['rgba(59, 130, 246, 0.2)', 'rgba(168, 85, 247, 0.2)', 'rgba(236, 72, 153, 0.2)']}
          style={StyleSheet.absoluteFill}
        />
      </MotiView>

      {/* Floating particles */}
      {particles.map((particle) => (
        <MotiView
          key={particle.id}
          from={{ 
            opacity: 0.2, 
            translateY: 0,
            scale: 1,
          }}
          animate={{ 
            opacity: [0.2, 0.8, 0.2], 
            translateY: -30,
            scale: [1, 1.2, 1],
          }}
          transition={{
            type: 'timing',
            duration: particle.duration,
            delay: particle.delay,
            loop: true,
          }}
          style={[
            styles.particle,
            {
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              width: particle.size,
              height: particle.size,
            }
          ]}
        />
      ))}

      {/* Confetti on complete */}
      {showConfetti && confettiPieces.map((piece) => (
        <Confetti key={piece.id} delay={piece.delay} x={piece.x} />
      ))}

      {/* Minimize button */}
      <TouchableOpacity 
        style={styles.minimizeButton}
        onPress={() => setIsMinimized(true)}
      >
        <Ionicons name="remove" size={24} color="rgba(255,255,255,0.6)" />
      </TouchableOpacity>

      {/* Main content */}
      <View style={styles.content}>
        {/* Platform badge */}
        <MotiView
          from={{ opacity: 0, translateY: -20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'spring', delay: 200 }}
          style={styles.platformBadge}
        >
          <Text style={styles.platformIcon}>{platformInfo.icon}</Text>
          <Text style={styles.platformName}>{platformInfo.name}</Text>
        </MotiView>

        {/* Central orb with layers */}
        <View style={styles.orbContainer}>
          {/* Outer pulsing ring 1 */}
          <Animated.View
            style={[
              styles.ring,
              {
                transform: [{ scale: ring1Scale }],
                opacity: ring1Opacity,
              }
            ]}
          />

          {/* Outer pulsing ring 2 */}
          <Animated.View
            style={[
              styles.ring,
              styles.ring2,
              {
                transform: [{ scale: ring2Scale }],
                opacity: ring2Opacity,
              }
            ]}
          />

          {/* Main orb - Transparent container for Yori-san */}
          <Animated.View
            style={[
              styles.mainOrb,
              {
                transform: [
                  { scale: orbScale },
                ],
              }
            ]}
          >
            {/* Yori-san Mascot Image */}
            <View style={styles.mascotImageContainer}>
              <Image 
                source={require('../../assets/yori-san.gif')} 
                style={styles.mascotImage}
                resizeMode="contain"
              />
            </View>

            {/* Stage indicator overlay (subtle) */}
            <View style={styles.stageIconContainer}>
              <AnimatePresence exitBeforeEnter>
                <MotiView
                  key={stage}
                  from={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 0.6, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  style={styles.stageIconMoti}
                >
                  {stage === 'complete' && <Ionicons name="checkmark" size={60} color="#7FFF00" />}
                  {stage === 'error' && <Ionicons name="close" size={60} color="#FF4500" />}
                </MotiView>
              </AnimatePresence>
            </View>
          </Animated.View>

          {/* Orbiting particles */}
          {[0, 1, 2, 3].map((index) => (
            <MotiView
              key={index}
              from={{ rotate: `${index * 90}deg` }}
              animate={{ rotate: `${index * 90 + 360}deg` }}
              transition={{
                type: 'timing',
                duration: 3000,
                loop: true,
                delay: index * 200,
              }}
              style={styles.orbitPath}
            >
              <View style={styles.orbitParticle} />
            </MotiView>
          ))}
        </View>

        {/* Text content */}
        <View style={styles.textContent}>
          <MotiView
            key={stage}
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 300 }}
          >
            <Text style={styles.stageMessage}>
              {STAGE_MESSAGES[stage]}
            </Text>
          </MotiView>
        </View>

        {/* Result preview */}
        {stage === 'complete' && result && (
          <View style={styles.resultContainerWrapper}>
            {result.discovery_queued && result.queued_item ? (
              /* Discovery Queue UI - "I'll remember this!" */
              <MotiView
                from={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', delay: 200 }}
                style={styles.resultContainer}
              >
                <Text style={styles.resultEmoji}>💭</Text>
                <Text style={styles.resultCountry}>
                  {result.queued_item.item}
                </Text>
                <Text style={styles.discoverySubtext}>
                  No specific places found in this video
                </Text>
                
                <View style={styles.discoveryCard}>
                  <Ionicons name="chatbubbles" size={24} color="#A78BFA" />
                  <View style={styles.discoveryCardText}>
                    <Text style={styles.discoveryCardTitle}>
                      I'll remember this!
                    </Text>
                    <Text style={styles.discoveryCardDesc}>
                      Ask me in AI Chat for {result.queued_item.item} recommendations in {result.queued_item.city}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity 
                  style={styles.gotItButton} 
                  onPress={handleDiscoveryQueueAck}
                >
                  <Text style={styles.gotItText}>Got it! ✨</Text>
                </TouchableOpacity>
              </MotiView>
            ) : result.placesExtracted === 0 ? (
              <MotiView
                from={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                style={styles.resultContainer}
              >
                <Text style={styles.resultEmoji}>🔍</Text>
                <Text style={styles.resultCountry}>No places found</Text>
                <Text style={styles.resultPlaces}>{result.message}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={onClose}>
                  <Text style={styles.retryText}>Done</Text>
                </TouchableOpacity>
              </MotiView>
            ) : (
              <MotiView
                from={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', delay: 200 }}
                style={styles.resultContainer}
              >
                <Text style={styles.resultEmoji}>🗺️</Text>
                <Text style={styles.resultCountry}>
                  {result.destinationCountry || result.destination || 'Adventure'}
                </Text>
                <Text style={styles.resultPlaces}>
                  {result.placesExtracted ?? 0} place{(result.placesExtracted ?? 0) !== 1 ? 's' : ''} discovered!
                </Text>
                {result.isNewTrip && (
                  <View style={styles.newTripBadge}>
                    <Text style={styles.newTripText}>✨ New adventure created</Text>
                  </View>
                )}
              </MotiView>
            )}
          </View>
        )}

        {/* Error message */}
        {stage === 'error' && (
          <MotiView
            from={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={styles.errorContainer}
          >
            <Text style={styles.errorText}>{errorMessage}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={onClose}>
              <Text style={styles.retryText}>Dismiss</Text>
            </TouchableOpacity>
          </MotiView>
        )}

        {/* URL preview */}
        <View style={styles.urlPreview}>
          <Text style={styles.urlText} numberOfLines={1}>
            {truncateUrl(url, 50)}
          </Text>
        </View>
      </View>

      {/* Bottom glow */}
      <MotiView
        from={{ scale: 1, opacity: 0.2 }}
        animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }}
        transition={{ type: 'timing', duration: 4000, loop: true }}
        style={styles.bottomGlow}
      />

      {/* Corner decorative glows */}
      <MotiView
        from={{ scale: 1, opacity: 0.3 }}
        animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.6, 0.3] }}
        transition={{ type: 'timing', duration: 3000, loop: true }}
        style={styles.cornerGlowTopRight}
      />
      <MotiView
        from={{ scale: 1, opacity: 0.3 }}
        animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
        transition={{ type: 'timing', duration: 3500, delay: 500, loop: true }}
        style={styles.cornerGlowBottomLeft}
      />
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

function getPlatformInfo(platform: string): { icon: string; name: string } {
  switch (platform) {
    case 'youtube':
      return { icon: '📺', name: 'YouTube' };
    case 'instagram':
      return { icon: '📷', name: 'Instagram' };
    case 'reddit':
      return { icon: '💬', name: 'Reddit' };
    case 'tiktok':
      return { icon: '🎵', name: 'TikTok' };
    default:
      return { icon: '🌐', name: 'Web' };
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
  gradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  particle: {
    position: 'absolute',
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  confetti: {
    position: 'absolute',
    top: -20,
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  minimizeButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  minimizedContainer: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    zIndex: 9999,
  },
  minimizedBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  minimizedText: {
    color: '#FFFFFF',
    fontWeight: '600',
    marginLeft: 8,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  platformBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 48,
  },
  platformIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  platformName: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
    letterSpacing: 1,
  },
  orbContainer: {
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 48,
  },
  ring: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  ring2: {
    borderColor: 'rgba(167, 139, 250, 0.4)',
  },
  mainOrb: {
    width: 160,
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mascotImageContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  mascotImage: {
    width: 140, 
    height: 140,
  },
  stageIconContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  stageIconMoti: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  orbitPath: {
    position: 'absolute',
    width: 180,
    height: 180,
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  orbitParticle: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 5,
  },
  textContent: {
    alignItems: 'center',
    gap: 16,
  },
  stageMessage: {
    fontSize: 20,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.9)',
    letterSpacing: 1,
    textAlign: 'center',
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#A78BFA',
    shadowColor: '#A78BFA',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
  },
  subText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 8,
  },
  resultContainerWrapper: {
    width: '100%',
    alignItems: 'center',
  },
  resultContainer: {
    alignItems: 'center',
    marginTop: 24,
  },
  resultEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  resultCountry: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  resultPlaces: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 16,
  },
  newTripBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  newTripText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  errorContainer: {
    alignItems: 'center',
    marginTop: 24,
  },
  errorText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  retryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  urlPreview: {
    position: 'absolute',
    bottom: -80,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  urlText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  bottomGlow: {
    position: 'absolute',
    bottom: 0,
    width: SCREEN_WIDTH,
    height: 300,
    borderRadius: 200,
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
  },
  cornerGlowTopRight: {
    position: 'absolute',
    top: 40,
    right: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(34, 211, 238, 0.2)',
  },
  cornerGlowBottomLeft: {
    position: 'absolute',
    bottom: 40,
    left: -40,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(244, 114, 182, 0.2)',
  },
  // Discovery Queue styles
  discoverySubtext: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginBottom: 20,
  },
  discoveryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(167, 139, 250, 0.15)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.3)',
  },
  discoveryCardText: {
    flex: 1,
  },
  discoveryCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  discoveryCardDesc: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 18,
  },
  gotItButton: {
    backgroundColor: '#A78BFA',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 24,
    shadowColor: '#A78BFA',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  gotItText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export default SmartShareProcessor;
