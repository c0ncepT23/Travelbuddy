import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  FlatList,
  Image,
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
  description: string;
  emoji: string;
  gradient: string[];
}

const SLIDES: OnboardingSlide[] = [
  {
    id: '1',
    title: 'Your Perfect Trip,\nPlanned in Seconds.',
    description: 'Let AI organize your dream destinations into a seamless day-by-day itinerary.',
    emoji: '✈️',
    gradient: ['#EEF2FF', '#DBEAFE', '#E0F2FE'],
  },
  {
    id: '2',
    title: 'Just Paste a Link.\nWe\'ll Find the Places.',
    description: 'Share YouTube videos, Instagram posts, or blog links. Our AI extracts every location mentioned.',
    emoji: '🔗',
    gradient: ['#F0F9FF', '#E0F2FE', '#ECFEFF'],
  },
  {
    id: '3',
    title: 'Turn Travel Dreams\ninto Itineraries.',
    subtitle: 'Your AI Companion for\nSeamless Planning.',
    description: 'From inspiration to adventure - we handle the planning so you can focus on exploring.',
    emoji: '🤖',
    gradient: ['#EFF6FF', '#DBEAFE', '#E0F2FE'],
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

  const renderSlide = ({ item, index }: { item: OnboardingSlide; index: number }) => {
    return (
      <LinearGradient
        colors={item.gradient}
        style={styles.slide}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.slideContent}>
          {/* Main Illustration Area */}
          <View style={styles.illustrationContainer}>
            {/* Decorative elements */}
            <View style={styles.decorCircle1} />
            <View style={styles.decorCircle2} />
            
            {/* Phone mockup with content */}
            <View style={styles.phoneMockup}>
              <View style={styles.phoneScreen}>
                {index === 0 && (
                  <>
                    <View style={styles.mapPreview}>
                      <View style={styles.mapPin}><Text style={styles.pinEmoji}>📍</Text></View>
                      <View style={[styles.mapPin, styles.mapPin2]}><Text style={styles.pinEmoji}>📍</Text></View>
                      <View style={[styles.mapPin, styles.mapPin3]}><Text style={styles.pinEmoji}>📍</Text></View>
                    </View>
                    <View style={styles.dayCard}>
                      <Text style={styles.dayCardTitle}>Day 1</Text>
                      <View style={styles.dayCardItem}><Text>📍 Eiffel Tower</Text></View>
                      <View style={styles.dayCardItem}><Text>📍 Louvre</Text></View>
                    </View>
                  </>
                )}
                {index === 1 && (
                  <View style={styles.funnelContainer}>
                    <View style={styles.linkIcons}>
                      <View style={styles.linkIcon}><Ionicons name="logo-youtube" size={24} color="#FF0000" /></View>
                      <View style={styles.linkIcon}><Ionicons name="link" size={20} color="#3B82F6" /></View>
                      <View style={styles.linkIcon}><Ionicons name="logo-instagram" size={22} color="#E4405F" /></View>
                    </View>
                    <View style={styles.funnel} />
                    <View style={styles.extractedPlaces}>
                      <View style={styles.placeChip}><Text style={styles.placeChipText}>📍 Paris</Text></View>
                      <View style={styles.placeChip}><Text style={styles.placeChipText}>📍 Tokyo</Text></View>
                    </View>
                  </View>
                )}
                {index === 2 && (
                  <View style={styles.youtubePreview}>
                    <View style={styles.ytThumbnail}>
                      <Ionicons name="play-circle" size={40} color="rgba(255,255,255,0.9)" />
                    </View>
                    <Text style={styles.ytTitle}>Epic Travel Vlog!</Text>
                    <View style={styles.landmarkIcons}>
                      <Text style={styles.landmark}>🗼</Text>
                      <Text style={styles.landmark}>🗽</Text>
                      <Text style={styles.landmark}>🏛️</Text>
                    </View>
                  </View>
                )}
              </View>
            </View>

            {/* Robot mascot */}
            <View style={styles.robotContainer}>
              <Text style={styles.robotEmoji}>🤖</Text>
            </View>
          </View>

          {/* Text Content */}
          <View style={styles.textContainer}>
            <Text style={styles.title}>{item.title}</Text>
            {item.subtitle && <Text style={styles.subtitle}>{item.subtitle}</Text>}
            <Text style={styles.description}>{item.description}</Text>
          </View>
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
          <Ionicons 
            name={currentIndex === SLIDES.length - 1 ? 'checkmark' : 'arrow-forward'} 
            size={20} 
            color="#FFFFFF" 
          />
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
    paddingTop: Platform.OS === 'ios' ? 100 : 80,
  },

  // Illustration
  illustrationContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  decorCircle1: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    top: 20,
    left: -50,
  },
  decorCircle2: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(139, 92, 246, 0.08)',
    bottom: 100,
    right: -30,
  },
  phoneMockup: {
    width: SCREEN_WIDTH * 0.55,
    height: SCREEN_WIDTH * 0.9,
    backgroundColor: '#1F2937',
    borderRadius: 30,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 15,
  },
  phoneScreen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
    padding: 12,
  },
  robotContainer: {
    position: 'absolute',
    bottom: 80,
    left: 30,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  robotEmoji: {
    fontSize: 32,
  },

  // Map preview (slide 1)
  mapPreview: {
    flex: 1,
    backgroundColor: '#E5E7EB',
    borderRadius: 12,
    position: 'relative',
    marginBottom: 8,
  },
  mapPin: {
    position: 'absolute',
    top: 20,
    left: 30,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  mapPin2: {
    top: 50,
    left: 80,
  },
  mapPin3: {
    top: 80,
    left: 50,
  },
  pinEmoji: {
    fontSize: 12,
  },
  dayCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  dayCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  dayCardItem: {
    paddingVertical: 4,
  },

  // Funnel (slide 2)
  funnelContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkIcons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  linkIcon: {
    width: 40,
    height: 40,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  funnel: {
    width: 0,
    height: 0,
    borderLeftWidth: 50,
    borderRightWidth: 50,
    borderTopWidth: 60,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: 'rgba(59, 130, 246, 0.2)',
    marginVertical: 16,
  },
  extractedPlaces: {
    flexDirection: 'row',
    gap: 8,
  },
  placeChip: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  placeChipText: {
    fontSize: 12,
    color: '#3B82F6',
    fontWeight: '500',
  },

  // YouTube preview (slide 3)
  youtubePreview: {
    flex: 1,
    alignItems: 'center',
  },
  ytThumbnail: {
    width: '100%',
    height: 100,
    backgroundColor: '#1F2937',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  ytTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  landmarkIcons: {
    flexDirection: 'row',
    gap: 16,
  },
  landmark: {
    fontSize: 32,
  },

  // Text
  textContainer: {
    paddingHorizontal: 32,
    paddingBottom: 180,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1E3A5F',
    textAlign: 'center',
    lineHeight: 36,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '500',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 12,
  },
  description: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
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
    marginBottom: 24,
    gap: 8,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#CBD5E1',
  },
  paginationDotActive: {
    width: 24,
    backgroundColor: '#3B82F6',
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 8,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  nextButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

