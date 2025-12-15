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
  Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface OnboardingSlide {
  id: string;
  image: any;
  title: string;
  subtitle?: string;
}

const SLIDES: OnboardingSlide[] = [
  {
    id: '1',
    image: require('../../../assets/splash-1.png'),
    title: 'Just paste a link.\nWe extract the places',
    subtitle: 'YouTube, Instagram, Reddit\n→ Map pins in seconds',
  },
  {
    id: '2',
    image: require('../../../assets/splash-2.png'),
    title: 'Discover places\nnearby',
    subtitle: 'Get notified when you\'re\nclose to a saved spot',
  },
  {
    id: '3',
    image: require('../../../assets/splash-3.png'),
    title: 'Plan together\nwith friends',
    subtitle: 'Share your trip and\nexplore as a group',
  },
  {
    id: '4',
    image: require('../../../assets/splash-4.png'),
    title: 'Ready for your\nnext adventure?',
    subtitle: 'Let\'s make it unforgettable',
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

  const renderSlide = ({ item }: { item: OnboardingSlide }) => (
    <View style={styles.slide}>
      {/* Title at top */}
      <View style={styles.titleContainer}>
        <Text style={styles.title}>{item.title}</Text>
        {item.subtitle && (
          <Text style={styles.subtitle}>{item.subtitle}</Text>
        )}
      </View>
      
      {/* Image - below title, no overlap */}
      <Image
        source={item.image}
        style={styles.splashImage}
        resizeMode="contain"
      />
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Skip Button */}
      <TouchableOpacity style={styles.skipBtn} onPress={handleSkip}>
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
      />

      {/* Bottom: Dots + Button */}
      <View style={styles.bottom}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[styles.dot, currentIndex === i && styles.dotActive]} />
          ))}
        </View>
        <TouchableOpacity style={styles.nextBtn} onPress={handleNext}>
          <Text style={styles.nextText}>
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
    backgroundColor: '#EDF5FF',
  },
  skipBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    right: 24,
    zIndex: 100,
  },
  skipText: {
    fontSize: 16,
    color: '#64748B',
    fontWeight: '600',
  },
  slide: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    paddingTop: Platform.OS === 'ios' ? 100 : 80,
  },
  titleContainer: {
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    lineHeight: 42,
  },
  subtitle: {
    fontSize: 18,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 26,
  },
  splashImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.55,
    alignSelf: 'center',
  },
  bottom: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 50 : 30,
    left: 32,
    right: 32,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 24,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(148, 163, 184, 0.5)',
  },
  dotActive: {
    width: 32,
    backgroundColor: '#3B82F6',
  },
  nextBtn: {
    backgroundColor: '#3B82F6',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 4,
  },
  nextText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
});
