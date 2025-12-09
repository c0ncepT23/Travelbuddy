import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  FlatList,
  Platform,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface OnboardingSlide {
  id: string;
  title: string;
  subtitle?: string;
  type: 'youtube' | 'funnel' | 'planner';
}

// Correct order as specified by user
const SLIDES: OnboardingSlide[] = [
  {
    id: '1',
    title: 'Turn Travel\nDreams into\nItineraries.',
    subtitle: 'Your AI Companion for\nSeamless Planning.',
    type: 'youtube',
  },
  {
    id: '2',
    title: 'Just Paste a\nLink. We\'ll Find\nthe Places.',
    type: 'funnel',
  },
  {
    id: '3',
    title: 'Your Perfect\nTrip, Planned\nin Seconds.',
    type: 'planner',
  },
];

interface OnboardingScreenProps {
  onComplete: () => void;
}

export default function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const handleNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
      setCurrentIndex(currentIndex + 1);
    } else {
      handleComplete();
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleComplete = async () => {
    try {
      await AsyncStorage.setItem('hasSeenOnboarding', 'true');
    } catch (error) {
      console.error('Failed to save onboarding state:', error);
    }
    onComplete();
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index || 0);
    }
  }).current;

  // Slide 1: YouTube + Landmarks floating around phone
  const renderYouTubeSlide = () => (
    <View style={styles.illustrationContainer}>
      {/* Floating landmark icons */}
      <View style={[styles.floatingIcon, styles.floatingTopLeft]}>
        <Text style={styles.landmarkEmoji}>🗼</Text>
      </View>
      <View style={[styles.floatingIcon, styles.floatingTopRight]}>
        <Text style={styles.landmarkEmoji}>🏛️</Text>
      </View>
      <View style={[styles.floatingIcon, styles.floatingMidLeft]}>
        <Text style={styles.landmarkEmoji}>🗽</Text>
      </View>
      <View style={[styles.floatingIcon, styles.floatingMidRight]}>
        <Text style={styles.landmarkEmoji}>🕌</Text>
      </View>
      <View style={[styles.floatingIcon, styles.floatingBottomLeft]}>
        <Text style={styles.landmarkEmoji}>🏰</Text>
      </View>
      <View style={[styles.floatingIcon, styles.floatingBottomRight]}>
        <Text style={styles.landmarkEmoji}>⛩️</Text>
      </View>

      {/* Phone with YouTube */}
      <View style={styles.phoneMockup}>
        <View style={styles.phoneScreen}>
          {/* YouTube header */}
          <View style={styles.ytHeader}>
            <Ionicons name="logo-youtube" size={20} color="#FF0000" />
            <Text style={styles.ytHeaderText}>YouTube</Text>
          </View>
          
          {/* Video thumbnail */}
          <View style={styles.ytVideoThumb}>
            <LinearGradient
              colors={['#4F46E5', '#7C3AED']}
              style={styles.ytThumbGradient}
            >
              <Ionicons name="play-circle" size={36} color="rgba(255,255,255,0.95)" />
            </LinearGradient>
          </View>
          
          {/* Video title */}
          <Text style={styles.ytVideoTitle}>Epic Travel Vlog: Top 10 Destinations!</Text>
          <Text style={styles.ytVideoMeta}>110K views · 1 year ago</Text>
          
          {/* Channel */}
          <View style={styles.ytChannel}>
            <View style={styles.ytChannelAvatar} />
            <Text style={styles.ytChannelName}>Wanderlust Adventures</Text>
            <View style={styles.ytSubscribeBtn}>
              <Text style={styles.ytSubscribeText}>Subscribe</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Robot mascot */}
      <View style={styles.robotFloating}>
        <Text style={styles.robotEmoji}>🤖</Text>
      </View>
    </View>
  );

  // Slide 2: Funnel with links going in, places coming out
  const renderFunnelSlide = () => (
    <View style={styles.illustrationContainer}>
      {/* Floating link/video icons at top */}
      <View style={styles.linksCloud}>
        <View style={[styles.linkIconBox, { transform: [{ rotate: '-15deg' }] }]}>
          <Ionicons name="link" size={18} color="#3B82F6" />
        </View>
        <View style={[styles.linkIconBox, { marginTop: -20 }]}>
          <Ionicons name="logo-youtube" size={20} color="#FF0000" />
        </View>
        <View style={[styles.linkIconBox, { transform: [{ rotate: '10deg' }] }]}>
          <Ionicons name="videocam" size={18} color="#3B82F6" />
        </View>
        <View style={[styles.linkIconBox, { marginTop: -10, transform: [{ rotate: '-5deg' }] }]}>
          <Ionicons name="link" size={16} color="#6366F1" />
        </View>
        <View style={[styles.linkIconBox, { transform: [{ rotate: '20deg' }] }]}>
          <Ionicons name="play-circle" size={18} color="#EF4444" />
        </View>
      </View>

      {/* Funnel */}
      <View style={styles.funnelShape}>
        <LinearGradient
          colors={['rgba(59, 130, 246, 0.3)', 'rgba(59, 130, 246, 0.1)']}
          style={styles.funnelGradient}
        />
      </View>

      {/* Robot mascot next to funnel */}
      <View style={styles.robotBeside}>
        <Text style={styles.robotEmoji}>🤖</Text>
      </View>

      {/* Extracted places on map */}
      <View style={styles.mapOutput}>
        <View style={styles.mapFold}>
          {/* Place pins on map */}
          <View style={[styles.mapPlacePin, { top: 15, left: 20 }]}>
            <View style={styles.pinMarker} />
            <View style={styles.pinLabel}>
              <Text style={styles.pinLabelText}>Paris</Text>
            </View>
          </View>
          <View style={[styles.mapPlacePin, { top: 25, right: 30 }]}>
            <View style={styles.pinMarker} />
            <View style={styles.pinLabel}>
              <Text style={styles.pinLabelText}>Tokyo</Text>
            </View>
          </View>
        </View>
        
        {/* Extracted place chips below */}
        <View style={styles.extractedChips}>
          <View style={styles.placeChip}>
            <View style={styles.chipPin} />
            <Text style={styles.chipText}>Paris</Text>
          </View>
          <View style={styles.placeChip}>
            <View style={styles.chipPin} />
            <Text style={styles.chipText}>Tokyo</Text>
          </View>
        </View>
      </View>
    </View>
  );

  // Slide 3: Phone with map + Day planner + travelers
  const renderPlannerSlide = () => (
    <View style={styles.illustrationContainer}>
      {/* Phone mockup with map and itinerary */}
      <View style={styles.phoneMockup}>
        <View style={styles.phoneScreen}>
          {/* Map area with pins */}
          <View style={styles.mapArea}>
            <View style={[styles.mapPinFloat, { top: 10, left: 15 }]}>
              <View style={styles.pinBubble}>
                <Text style={styles.pinBubbleText}>Eiffel Tower</Text>
              </View>
            </View>
            <View style={[styles.mapPinFloat, { top: 30, right: 10 }]}>
              <View style={styles.pinBubble}>
                <Text style={styles.pinBubbleText}>Louvre</Text>
              </View>
            </View>
            <View style={[styles.mapPinFloat, { bottom: 15, right: 20 }]}>
              <View style={styles.pinBubble}>
                <Text style={styles.pinBubbleText}>Tokyo</Text>
              </View>
            </View>
          </View>
          
          {/* Day planner card */}
          <View style={styles.dayPlannerCard}>
            <Text style={styles.dayPlannerTitle}>Day 1</Text>
            <View style={styles.dayPlannerItem}>
              <View style={styles.timelineDot} />
              <Text style={styles.dayPlannerText}>Eiffel Tower</Text>
            </View>
            <View style={styles.timelineLine} />
            <View style={styles.dayPlannerItem}>
              <View style={styles.timelineDot} />
              <Text style={styles.dayPlannerText}>Louvre</Text>
            </View>
            <View style={styles.timelineLine} />
            <View style={styles.dayPlannerItem}>
              <View style={styles.timelineDot} />
              <Text style={styles.dayPlannerText}>Tokyo</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Robot mascot on left */}
      <View style={styles.robotLeft}>
        <Text style={styles.robotEmoji}>🤖</Text>
      </View>

      {/* Travelers on right */}
      <View style={styles.travelersRight}>
        <Text style={styles.travelerEmoji}>🧑‍🤝‍🧑</Text>
        <Text style={styles.travelerEmoji2}>🎒</Text>
      </View>
    </View>
  );

  const renderSlide = ({ item, index }: { item: OnboardingSlide; index: number }) => {
    return (
      <LinearGradient
        colors={['#EFF6FF', '#DBEAFE', '#E0F2FE']}
        style={styles.slide}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.slideContent}>
          {/* Title at top */}
          <View style={styles.titleContainer}>
            <Text style={styles.title}>{item.title}</Text>
            {item.subtitle && <Text style={styles.subtitle}>{item.subtitle}</Text>}
          </View>

          {/* Illustration based on type */}
          {item.type === 'youtube' && renderYouTubeSlide()}
          {item.type === 'funnel' && renderFunnelSlide()}
          {item.type === 'planner' && renderPlannerSlide()}
        </View>
      </LinearGradient>
    );
  };

  const renderPagination = () => (
    <View style={styles.pagination}>
      {SLIDES.map((_, index) => (
        <View
          key={index}
          style={[
            styles.paginationDot,
            currentIndex === index && styles.paginationDotActive,
          ]}
        />
      ))}
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Skip Button */}
      <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      {/* Slides */}
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={renderSlide}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
        scrollEventThrottle={16}
      />

      {/* Bottom Section */}
      <View style={styles.bottomSection}>
        {renderPagination()}
        
        <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
          <Text style={styles.nextButtonText}>
            {currentIndex === SLIDES.length - 1 ? 'Get Started' : 'Next'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  skipButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    right: 20,
    zIndex: 100,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  skipText: {
    fontSize: 16,
    color: '#64748B',
    fontWeight: '500',
  },
  slide: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  slideContent: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 80 : 60,
  },

  // Title
  titleContainer: {
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1E3A5F',
    lineHeight: 40,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '500',
    color: '#64748B',
    lineHeight: 26,
    marginTop: 12,
  },

  // Illustration container
  illustrationContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    paddingBottom: 160,
  },

  // Phone mockup
  phoneMockup: {
    width: SCREEN_WIDTH * 0.55,
    height: SCREEN_WIDTH * 0.95,
    backgroundColor: '#1F2937',
    borderRadius: 32,
    padding: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 15,
  },
  phoneScreen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    overflow: 'hidden',
  },

  // Robot
  robotEmoji: {
    fontSize: 40,
  },
  robotFloating: {
    position: 'absolute',
    right: 30,
    top: '35%',
    width: 65,
    height: 65,
    borderRadius: 32,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  robotBeside: {
    position: 'absolute',
    left: 25,
    top: '30%',
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  robotLeft: {
    position: 'absolute',
    left: 20,
    top: '25%',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },

  // Floating landmarks (Slide 1)
  floatingIcon: {
    position: 'absolute',
    width: 50,
    height: 50,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  floatingTopLeft: { top: 0, left: 20 },
  floatingTopRight: { top: 20, right: 25 },
  floatingMidLeft: { top: '35%', left: 10 },
  floatingMidRight: { top: '40%', right: 15 },
  floatingBottomLeft: { bottom: 180, left: 30 },
  floatingBottomRight: { bottom: 200, right: 20 },
  landmarkEmoji: {
    fontSize: 24,
  },

  // YouTube styles (Slide 1)
  ytHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    gap: 6,
  },
  ytHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  ytVideoThumb: {
    height: 100,
    marginHorizontal: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
  ytThumbGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ytVideoTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1F2937',
    paddingHorizontal: 8,
    marginTop: 8,
  },
  ytVideoMeta: {
    fontSize: 9,
    color: '#64748B',
    paddingHorizontal: 8,
    marginTop: 2,
  },
  ytChannel: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    gap: 6,
  },
  ytChannelAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E5E7EB',
  },
  ytChannelName: {
    flex: 1,
    fontSize: 10,
    color: '#1F2937',
  },
  ytSubscribeBtn: {
    backgroundColor: '#1F2937',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  ytSubscribeText: {
    fontSize: 9,
    color: '#FFFFFF',
    fontWeight: '600',
  },

  // Funnel styles (Slide 2)
  linksCloud: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 20,
    paddingHorizontal: 40,
  },
  linkIconBox: {
    width: 44,
    height: 44,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  funnelShape: {
    width: 120,
    height: 100,
    marginVertical: 10,
  },
  funnelGradient: {
    width: 0,
    height: 0,
    borderLeftWidth: 60,
    borderRightWidth: 60,
    borderTopWidth: 100,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: 'rgba(59, 130, 246, 0.25)',
    borderRadius: 10,
  },
  mapOutput: {
    alignItems: 'center',
    marginTop: 10,
  },
  mapFold: {
    width: SCREEN_WIDTH * 0.7,
    height: 80,
    backgroundColor: '#E5E7EB',
    borderRadius: 8,
    position: 'relative',
    transform: [{ perspective: 500 }, { rotateX: '-5deg' }],
  },
  mapPlacePin: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
  },
  pinMarker: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3B82F6',
    marginRight: 4,
  },
  pinLabel: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  pinLabelText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#3B82F6',
  },
  extractedChips: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  placeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  chipPin: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3B82F6',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
  },

  // Planner styles (Slide 3)
  mapArea: {
    flex: 1,
    backgroundColor: '#E5E7EB',
    position: 'relative',
  },
  mapPinFloat: {
    position: 'absolute',
  },
  pinBubble: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  pinBubbleText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#1F2937',
  },
  dayPlannerCard: {
    backgroundColor: '#FFFFFF',
    margin: 8,
    padding: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  dayPlannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 10,
  },
  dayPlannerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3B82F6',
    marginRight: 10,
  },
  timelineLine: {
    width: 2,
    height: 12,
    backgroundColor: '#CBD5E1',
    marginLeft: 4,
  },
  dayPlannerText: {
    fontSize: 12,
    color: '#475569',
  },
  travelersRight: {
    position: 'absolute',
    right: 15,
    bottom: 180,
    alignItems: 'center',
  },
  travelerEmoji: {
    fontSize: 36,
  },
  travelerEmoji2: {
    fontSize: 24,
    marginTop: -5,
  },

  // Bottom
  bottomSection: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 50 : 30,
    backgroundColor: 'transparent',
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    gap: 8,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#CBD5E1',
  },
  paginationDotActive: {
    width: 28,
    backgroundColor: '#3B82F6',
  },
  nextButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    paddingVertical: 18,
    borderRadius: 16,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  nextButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
