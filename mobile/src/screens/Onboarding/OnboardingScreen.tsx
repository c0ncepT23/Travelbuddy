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
import { LinearGradient } from 'expo-linear-gradient';
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
  },
  {
    id: '2',
    image: require('../../../assets/splash-2.png'),
    title: 'Your wishlist finds you.\nNot the other way around',
  },
  {
    id: '3',
    image: require('../../../assets/splash-3.png'),
    title: 'Invite friends.\nPlan the trip together',
  },
  {
    id: '4',
    image: require('../../../assets/splash-4.png'),
    title: 'Ready for your\nnext adventure?',
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
      {/* AI Magic Stars */}
      <Text style={[styles.star, styles.star1]}>✦</Text>
      <Text style={[styles.star, styles.star2]}>✦</Text>
      <Text style={[styles.star, styles.star3]}>✦</Text>
      
      {/* Top section with gradient and text */}
      <LinearGradient
        colors={['#56A0D8', '#56A0D8', 'transparent']}
        style={styles.topGradient}
      >
        <View style={styles.titleContainer}>
          <Text style={styles.title}>{item.title}</Text>
          {item.subtitle && (
            <Text style={styles.subtitle}>{item.subtitle}</Text>
          )}
        </View>
      </LinearGradient>
      
      {/* Image in the middle-bottom area */}
      <View style={styles.imageContainer}>
        <Image
          source={item.image}
          style={styles.splashImage}
          resizeMode="contain"
        />
      </View>
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
    backgroundColor: '#56A0D8',
  },
  skipBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    right: 24,
    zIndex: 100,
  },
  skipText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  slide: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: '#56A0D8',
  },
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: Platform.OS === 'ios' ? 100 : 80,
    paddingBottom: 30,
    zIndex: 10,
  },
  titleContainer: {
    paddingHorizontal: 28,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 36,
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.85)',
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 22,
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 150 : 130,
    paddingBottom: 160,
  },
  splashImage: {
    width: SCREEN_WIDTH * 0.95,
    height: SCREEN_HEIGHT * 0.55,
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
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  dotActive: {
    width: 32,
    backgroundColor: '#FFFFFF',
  },
  nextBtn: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  nextText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#3B82F6',
  },
  star: {
    position: 'absolute',
    color: 'rgba(255, 255, 255, 0.6)',
    zIndex: 5,
  },
  star1: {
    top: '42%',
    left: '5%',
    fontSize: 18,
  },
  star2: {
    top: '32%',
    right: '6%',
    fontSize: 14,
  },
  star3: {
    bottom: '22%',
    right: '8%',
    fontSize: 16,
  },
});
