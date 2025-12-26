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
  FlatList,
} from 'react-native';
import { MotiView, AnimatePresence } from 'moti';
import { Easing } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import FastImage from 'react-native-fast-image';
import { HapticFeedback } from '../utils/haptics';
import api from '../config/api';
import { getPlacePhotoUrl } from '../config/maps';

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

interface ScoutResult {
  place_id: string;
  name: string;
  address: string;
  rating?: number;
  user_rating_count?: number;
  generative_summary?: string;
  vibe_match_score: number;
  social_label: string;
  photos?: any[];
  location: {
    lat: number;
    lng: number;
  };
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
  discovery_intent?: {
    type: string;
    item: string;
    city: string;
    vibe: string;
    scout_query: string;
  };
  scout_results?: ScoutResult[];
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

// Scout Result Card
const ScoutCard: React.FC<{ result: ScoutResult; onSelect: (result: ScoutResult) => void }> = ({ result, onSelect }) => {
  const photoUrl = useMemo(() => getPlacePhotoUrl(result.photos, 400), [result.photos]);
  
  return (
    <TouchableOpacity 
      style={styles.scoutCard} 
      activeOpacity={0.9}
      onPress={() => onSelect(result)}
    >
      <View style={styles.scoutImageContainer}>
        {photoUrl ? (
          <FastImage source={{ uri: photoUrl }} style={styles.scoutImage} resizeMode="cover" />
        ) : (
          <View style={styles.scoutPlaceholder}>
            <Ionicons name="restaurant" size={32} color="rgba(255,255,255,0.3)" />
          </View>
        )}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.8)']}
          style={styles.scoutImageOverlay}
        />
        <View style={styles.scoutLabelBadge}>
          <Text style={styles.scoutLabelText}>{result.social_label}</Text>
        </View>
      </View>
      
      <View style={styles.scoutInfo}>
        <Text style={styles.scoutName} numberOfLines={1}>{result.name}</Text>
        <View style={styles.scoutMeta}>
          <View style={styles.scoutRating}>
            <Ionicons name="star" size={12} color="#FFD700" />
            <Text style={styles.scoutRatingText}>{result.rating?.toFixed(1) || 'N/A'}</Text>
          </View>
          <Text style={styles.scoutMatchScore}>{Math.round(result.vibe_match_score * 10)}% Vibe Match</Text>
        </View>
        <Text style={styles.scoutSummary} numberOfLines={2}>
          {result.generative_summary || "Checking details..."}
        </Text>
      </View>
      
      <View style={styles.scoutButton}>
        <Text style={styles.scoutButtonText}>Add to Trip</Text>
        <Ionicons name="add-circle" size={20} color="#FFFFFF" />
      </View>
    </TouchableOpacity>
  );
};

export const SmartShareProcessor: React.FC<SmartShareProcessorProps> = ({
  url,
  onComplete,
  onError,
  onClose,
}) => {
  const [stage, setStage] = useState<ProcessingStage>('detecting');
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [selectedScoutMatch, setSelectedScoutMatch] = useState<ScoutResult | null>(null);
  const [isSavingScout, setIsSavingScout] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  // ... (rest of the refs)

  const handleScoutSelect = async (scoutMatch: ScoutResult) => {
    if (!result?.tripId) return;
    
    HapticFeedback.medium();
    setSelectedScoutMatch(scoutMatch);
    setIsSavingScout(true);
    
    try {
      // Create a real place from the scouted match
      const response = await api.post(`/api/trips/${result.tripId}/items`, {
        name: scoutMatch.name,
        category: 'food', // Assuming food for culinary goals
        location_name: scoutMatch.address,
        location_lat: scoutMatch.location.lat,
        location_lng: scoutMatch.location.lng,
        google_place_id: scoutMatch.place_id,
        description: scoutMatch.generative_summary,
        source_url: url,
        rating: scoutMatch.rating,
      });
      
      HapticFeedback.success();
      setShowConfetti(true);
      
      // Complete the process with the new place
      setTimeout(() => {
        onComplete({
          ...result,
          placesExtracted: 1,
          places: [{
            id: response.data.id,
            name: scoutMatch.name,
            category: 'food',
            description: scoutMatch.generative_summary || '',
            location_lat: scoutMatch.location.lat,
            location_lng: scoutMatch.location.lng,
            rating: scoutMatch.rating
          }]
        });
      }, 2000);
    } catch (error) {
      console.error('[SmartShare] Scout save error:', error);
      setIsSavingScout(false);
    }
  };
  
  // Animation values
  const orbScale = useRef(new Animated.Value(1)).current;
  const orbRotate = useRef(new Animated.Value(0)).current;
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

  // Start animations
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

    // Orb rotation
    Animated.loop(
      Animated.timing(orbRotate, {
        toValue: 1,
        duration: 8000,
        easing: RNEasing.linear,
        useNativeDriver: true,
      })
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
  }, []);

  // Stop rotation on complete/error
  useEffect(() => {
    if (stage === 'complete' || stage === 'error') {
      orbRotate.stopAnimation();
    }
  }, [stage]);

  const processUrl = async () => {
    try {
      // Stage 1: Detecting
      HapticFeedback.light();
      setStage('detecting');
      await delay(800);

      // Stage 2: Extracting
      setStage('extracting');
      HapticFeedback.light();

      // Make API call
      const response = await api.post('/share/process', { url });
      
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

      // If we have scout results but no specific places, don't auto-complete
      // Let the user pick a match first
      if (response.data.scout_results?.length > 0 && (!response.data.places || response.data.places.length === 0)) {
        console.log('[SmartShare] Scout results found, waiting for user selection');
        return;
      }

      setShowConfetti(true);

      // Wait for confetti animation to complete (2000ms animation + 500ms delay + 1000ms to enjoy)
      setTimeout(() => {
        try {
          onComplete(response.data);
        } catch (navError) {
          console.error('[SmartShare] Navigation error:', navError);
        }
      }, 3500);

    } catch (error: any) {
      const msg = error.response?.data?.error || error.message || 'Failed to process';
      console.error('[SmartShare] Error:', error);
      setStage('error');
      setErrorMessage(msg);
      HapticFeedback.error();
      
      setTimeout(() => {
        onError(msg);
      }, 2500);
    }
  };

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const orbRotation = orbRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

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

          {/* Main orb with gradient */}
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
            {/* Rotating background gradient */}
            <Animated.View
              style={[
                StyleSheet.absoluteFill,
                {
                  transform: [{ rotate: orbRotation }],
                }
              ]}
            >
              <LinearGradient
                colors={['#22D3EE', '#A78BFA', '#F472B6']}
                style={styles.orbGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
            </Animated.View>

            {/* Inner glow */}
            <Animated.View style={[styles.innerGlow, { opacity: glowOpacity }]} />
            
            {/* Stage indicator - STABLE (Doesn't rotate) */}
            <View style={styles.stageIconContainer}>
              <AnimatePresence exitBeforeEnter>
                <MotiView
                  key={stage}
                  from={{ opacity: 0, scale: 0.5, rotate: '-45deg' }}
                  animate={{ opacity: 1, scale: 1, rotate: '0deg' }}
                  transition={{ type: 'spring', damping: 15 }}
                  style={styles.stageIconMoti}
                >
                  {stage === 'complete' ? (
                    <Ionicons name="checkmark" size={54} color="#FFFFFF" />
                  ) : stage === 'error' ? (
                    <Ionicons name="close" size={54} color="#FFFFFF" />
                  ) : (
                    <Ionicons name="sparkles" size={48} color="#FFFFFF" />
                  )}
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
            key={stage + (isSavingScout ? '-saving' : '')}
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 300 }}
          >
            <Text style={styles.stageMessage}>
              {isSavingScout ? 'Saving your choice...' : STAGE_MESSAGES[stage]}
            </Text>
          </MotiView>

          {/* ... (dots and sub-messages) */}
        </View>

        {/* Result preview / Scout Carousel */}
        {stage === 'complete' && result && (
          <View style={styles.resultContainerWrapper}>
            {(result.scout_results?.length ?? 0) > 0 && result.placesExtracted === 0 && !selectedScoutMatch ? (
              <MotiView 
                from={{ opacity: 0, scale: 0.9, translateY: 20 }}
                animate={{ opacity: 1, scale: 1, translateY: 0 }}
                style={styles.scoutSection}
              >
                <Text style={styles.scoutTitle}>
                  Matched {result.discovery_intent?.item || 'places'} in {result.discovery_intent?.city}! 🗺️
                </Text>
                <Text style={styles.scoutSubtitle}>Tap a spot to add it to your trip:</Text>
                
                <FlatList
                  data={result.scout_results}
                  keyExtractor={(item) => item.place_id}
                  renderItem={({ item }) => <ScoutCard result={item} onSelect={handleScoutSelect} />}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.scoutList}
                  snapToInterval={260}
                  decelerationRate="fast"
                />
              </MotiView>
            ) : (
              <MotiView
                from={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', delay: 200 }}
                style={styles.resultContainer}
              >
                <Text style={styles.resultEmoji}>{selectedScoutMatch ? '🍰' : '🗺️'}</Text>
                <Text style={styles.resultCountry}>
                  {selectedScoutMatch ? selectedScoutMatch.name : (result.destinationCountry || result.destination || 'Adventure')}
                </Text>
                <Text style={styles.resultPlaces}>
                  {selectedScoutMatch ? 'Added to your NYC trip!' : `${result.placesExtracted ?? 0} place${(result.placesExtracted ?? 0) !== 1 ? 's' : ''} discovered!`}
                </Text>
                {result.isNewTrip && !selectedScoutMatch && (
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
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  ring2: {
    borderColor: 'rgba(167, 139, 250, 0.4)',
  },
  mainOrb: {
    width: 140,
    height: 140,
    borderRadius: 70,
    overflow: 'hidden',
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 60,
    elevation: 20,
  },
  orbGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  innerGlow: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    bottom: 16,
    borderRadius: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
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
  // Scout Styles
  scoutSection: {
    width: SCREEN_WIDTH,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginTop: 20,
  },
  scoutTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 4,
  },
  scoutSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 20,
  },
  scoutList: {
    paddingHorizontal: 10,
    paddingBottom: 20,
  },
  scoutCard: {
    width: 240,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    marginHorizontal: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  scoutImageContainer: {
    width: '100%',
    height: 120,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  scoutImage: {
    width: '100%',
    height: '100%',
  },
  scoutImageOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  scoutPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoutLabelBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: '#06B6D4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  scoutLabelText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  scoutInfo: {
    padding: 12,
  },
  scoutName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  scoutMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  scoutRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  scoutRatingText: {
    fontSize: 12,
    color: '#FFD700',
    fontWeight: '600',
  },
  scoutMatchScore: {
    fontSize: 11,
    color: '#22D3EE',
    fontWeight: '600',
  },
  scoutSummary: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 16,
  },
  scoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingVertical: 10,
    gap: 8,
  },
  scoutButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
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
});

export default SmartShareProcessor;
