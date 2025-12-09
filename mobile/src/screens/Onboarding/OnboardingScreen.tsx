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

  // ============================================
  // SLIDE 1: YouTube + Landmarks + Robot
  // ============================================
  const renderYouTubeSlide = () => (
    <View style={styles.slideIllustration}>
      {/* Floating landmark icons around the phone */}
      <View style={[styles.landmarkIcon, { top: 10, left: 15 }]}>
        <Text style={styles.landmarkText}>🗼</Text>
      </View>
      <View style={[styles.landmarkIcon, { top: 60, right: 20 }]}>
        <Text style={styles.landmarkText}>🏛️</Text>
      </View>
      <View style={[styles.landmarkIcon, { top: 140, left: 5 }]}>
        <Text style={styles.landmarkText}>🗽</Text>
      </View>
      <View style={[styles.landmarkIcon, { top: 200, right: 10 }]}>
        <Text style={styles.landmarkText}>🕌</Text>
      </View>
      
      {/* Phone Mockup */}
      <View style={styles.phoneFrame}>
        <View style={styles.phoneInner}>
          <View style={styles.ytHeader}>
            <View style={styles.ytLogoRow}>
              <Ionicons name="logo-youtube" size={16} color="red" />
              <Text style={styles.ytLogoText}>YouTube</Text>
            </View>
          </View>
          
          <View style={styles.ytVideoContainer}>
            <LinearGradient colors={['#6366F1', '#8B5CF6']} style={styles.ytVideoPlaceholder}>
              <Ionicons name="play-circle" size={32} color="white" />
            </LinearGradient>
          </View>
          
          <View style={styles.ytContent}>
            <Text style={styles.ytTitle}>Top 10 Hidden Gems in Paris</Text>
            <View style={styles.ytChannelRow}>
              <View style={styles.ytAvatar} />
              <Text style={styles.ytChannelName}>Travel Guide</Text>
              <View style={styles.ytSubBtn}>
                <Text style={styles.ytSubText}>Subscribe</Text>
              </View>
            </View>
            <View style={styles.ytCommentBar} />
            <View style={styles.ytCommentBarShort} />
          </View>
        </View>
      </View>

      <View style={styles.robotYoutube}>
        <Text style={styles.robotEmoji}>🤖</Text>
      </View>
    </View>
  );

  // ============================================
  // SLIDE 2: Funnel (Accurate to Design)
  // ============================================
  const renderFunnelSlide = () => (
    <View style={styles.slideIllustration}>
      {/* Robot on LEFT */}
      <View style={styles.robotFunnel}>
        <Text style={styles.robotEmoji}>🤖</Text>
      </View>

      <View style={styles.funnelCenter}>
        {/* 1. Floating Icons entering top */}
        <View style={styles.floatingLinksContainer}>
            <View style={[styles.floatIcon, { left: 10, top: 20, transform: [{rotate: '-10deg'}] }]}>
                <Ionicons name="link" size={16} color="#3B82F6" />
            </View>
            <View style={[styles.floatIcon, { right: 20, top: 10, transform: [{rotate: '15deg'}] }]}>
                <Ionicons name="logo-youtube" size={20} color="#EF4444" />
            </View>
            <View style={[styles.floatIcon, { left: 60, top: 0 }]}>
                <Ionicons name="play-circle" size={18} color="#3B82F6" />
            </View>
            <View style={[styles.floatIcon, { right: 50, top: 35, transform: [{rotate: '-5deg'}] }]}>
                <Ionicons name="videocam" size={14} color="#8B5CF6" />
            </View>
        </View>

        {/* 2. Glassy Funnel Shape */}
        <View style={styles.funnelContainer}>
            {/* Cone body */}
            <View style={styles.funnelCone}>
                <LinearGradient
                    colors={['rgba(59, 130, 246, 0.1)', 'rgba(59, 130, 246, 0.25)']}
                    style={styles.funnelConeInner}
                />
            </View>
            {/* Spout */}
            <View style={styles.funnelSpout}>
                 <LinearGradient
                    colors={['rgba(59, 130, 246, 0.25)', 'rgba(59, 130, 246, 0.3)']}
                    style={styles.funnelSpoutInner}
                />
            </View>
            {/* Rim at top */}
            <View style={styles.funnelRim} />
        </View>

        {/* 3. Falling Items (Inside/Below Funnel) */}
        <View style={styles.fallingItems}>
             <View style={[styles.placeChip, { transform: [{rotate: '-5deg'}] }]}>
                <View style={styles.chipDot} />
                <Text style={styles.chipText}>Paris</Text>
            </View>
        </View>

        {/* 4. Folded Map at Bottom */}
        <View style={styles.foldedMapContainer}>
            {/* Left Fold */}
            <View style={[styles.mapFold, styles.mapFoldLeft]}>
                 <View style={styles.mapGridLines} />
                 <View style={[styles.mapPinSmall, { bottom: 20, right: 10 }]}>
                    <View style={styles.mapPinDot} />
                    <Text style={styles.mapPinText}>Paris</Text>
                 </View>
            </View>
            {/* Center Fold */}
            <View style={[styles.mapFold, styles.mapFoldCenter]}>
                 <View style={styles.mapGridLines} />
                 <View style={styles.mapPathLine} />
            </View>
            {/* Right Fold */}
            <View style={[styles.mapFold, styles.mapFoldRight]}>
                 <View style={styles.mapGridLines} />
                 <View style={[styles.mapPinSmall, { top: 20, left: 10 }]}>
                    <View style={styles.mapPinDot} />
                    <Text style={styles.mapPinText}>Tokyo</Text>
                 </View>
            </View>
        </View>
      </View>
    </View>
  );

  // ============================================
  // SLIDE 3: Planner (Overlap Design)
  // ============================================
  const renderPlannerSlide = () => (
    <View style={styles.slideIllustration}>
      <View style={styles.robotPlanner}>
        <Text style={styles.robotEmoji}>🤖</Text>
      </View>

      <View style={styles.plannerContainer}>
        {/* Phone Device */}
        <View style={styles.phoneDevice}>
            <View style={styles.phoneScreenContent}>
                <View style={styles.phoneHeader}>
                    <View style={styles.notch} />
                </View>
                {/* Map Background */}
                <View style={styles.mapBackgroundSimple}>
                    <View style={[styles.roadLine, { top: '30%', transform: [{rotate: '10deg'}] }]} />
                    <View style={[styles.roadLine, { top: '60%', transform: [{rotate: '-5deg'}] }]} />
                    <View style={[styles.roadLineVertical, { left: '40%' }]} />
                    
                    {/* Map Markers */}
                    <View style={[styles.markerBubble, { top: 50, left: 20 }]}>
                        <View style={styles.markerDot} />
                        <Text style={styles.markerText}>Eiffel Tower</Text>
                    </View>
                    <View style={[styles.markerBubble, { top: 100, right: 20 }]}>
                        <View style={styles.markerDot} />
                        <Text style={styles.markerText}>Louvre</Text>
                    </View>
                     <View style={[styles.markerBubble, { bottom: 80, left: 40 }]}>
                        <View style={styles.markerDot} />
                        <Text style={styles.markerText}>Tokyo</Text>
                    </View>
                </View>
            </View>
        </View>

        {/* Floating Day Card - OVERLAPPING */}
        <View style={styles.floatingDayCard}>
            <Text style={styles.cardHeader}>Day 1</Text>
            <View style={styles.timelineList}>
                <View style={styles.timelineItem}>
                    <View style={styles.timelinePoint} />
                    <Text style={styles.timelineLabel}>Eiffel Tower</Text>
                </View>
                <View style={styles.timelineConnector} />
                <View style={styles.timelineItem}>
                    <View style={styles.timelinePoint} />
                    <Text style={styles.timelineLabel}>Louvre</Text>
                </View>
                <View style={styles.timelineConnector} />
                <View style={styles.timelineItem}>
                    <View style={styles.timelinePoint} />
                    <Text style={styles.timelineLabel}>Tokyo</Text>
                </View>
            </View>
        </View>
      </View>

      <View style={styles.travelersCouple}>
        <Text style={{fontSize: 40}}>👫</Text>
      </View>
    </View>
  );

  const renderSlide = ({ item }: { item: OnboardingSlide }) => (
    <LinearGradient
      colors={['#F0F9FF', '#E0F2FE', '#BAE6FD']}
      style={styles.slide}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <View style={styles.slideInner}>
        {/* Title area */}
        <View style={styles.titleArea}>
          <Text style={styles.title}>{item.title}</Text>
          {item.subtitle && <Text style={styles.subtitle}>{item.subtitle}</Text>}
        </View>

        {/* Illustration */}
        {item.type === 'youtube' && renderYouTubeSlide()}
        {item.type === 'funnel' && renderFunnelSlide()}
        {item.type === 'planner' && renderPlannerSlide()}
      </View>
    </LinearGradient>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Skip */}
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
    backgroundColor: '#FFF',
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
  },
  slideInner: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 80 : 60,
  },
  titleArea: {
    paddingHorizontal: 32,
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 40,
  },
  subtitle: {
    fontSize: 18,
    color: '#475569',
    marginTop: 12,
    lineHeight: 26,
  },
  slideIllustration: {
    flex: 1,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 100,
  },
  
  // SHARED ELEMENTS
  landmarkIcon: {
    position: 'absolute',
    width: 44,
    height: 44,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  landmarkText: { fontSize: 24 },
  
  // SLIDE 1: YOUTUBE
  phoneFrame: {
    width: SCREEN_WIDTH * 0.55,
    height: SCREEN_WIDTH * 1.0,
    backgroundColor: '#1E293B',
    borderRadius: 32,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 10,
    transform: [{ rotate: '-2deg' }],
  },
  phoneInner: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 24,
    overflow: 'hidden',
  },
  ytHeader: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  ytLogoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ytLogoText: { fontWeight: 'bold', fontSize: 14, color: '#0F172A' },
  ytVideoContainer: { padding: 12 },
  ytVideoPlaceholder: {
    height: 110,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ytContent: { paddingHorizontal: 12 },
  ytTitle: { fontSize: 13, fontWeight: '700', color: '#0F172A', marginBottom: 8 },
  ytChannelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  ytAvatar: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#CBD5E1', marginRight: 8 },
  ytChannelName: { fontSize: 10, color: '#64748B', flex: 1 },
  ytSubBtn: { backgroundColor: '#0F172A', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  ytSubText: { color: '#FFF', fontSize: 9, fontWeight: '600' },
  ytCommentBar: { height: 8, backgroundColor: '#F1F5F9', borderRadius: 4, marginBottom: 6, width: '100%' },
  ytCommentBarShort: { height: 8, backgroundColor: '#F1F5F9', borderRadius: 4, width: '60%' },
  robotYoutube: {
    position: 'absolute',
    left: 20,
    bottom: 120,
    width: 64,
    height: 64,
    backgroundColor: '#FFF',
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  robotEmoji: { fontSize: 36 },

  // SLIDE 2: FUNNEL (Updated)
  robotFunnel: {
    position: 'absolute',
    left: 20,
    top: '25%',
    width: 60,
    height: 60,
    backgroundColor: '#FFF',
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
    zIndex: 10,
  },
  funnelCenter: {
    alignItems: 'center',
    width: '100%',
    height: 400,
    marginTop: 10,
  },
  floatingLinksContainer: {
    height: 80,
    width: 200,
    position: 'relative',
    marginBottom: -10,
    zIndex: 5,
  },
  floatIcon: {
    position: 'absolute',
    width: 40,
    height: 40,
    backgroundColor: '#FFF',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  funnelContainer: {
    alignItems: 'center',
    zIndex: 4,
  },
  funnelRim: {
    width: 140,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.4)',
    position: 'absolute',
    top: 0,
    zIndex: 2,
  },
  funnelCone: {
    width: 140,
    height: 100,
    overflow: 'hidden',
    alignItems: 'center',
  },
  funnelConeInner: {
    width: 200,
    height: 200,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderLeftWidth: 50,
    borderRightWidth: 50,
    borderTopWidth: 0,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
    transform: [{ scaleX: 0.7 }], // Taper effect
  },
  funnelSpout: {
    width: 24,
    height: 40,
    marginTop: -5,
  },
  funnelSpoutInner: {
    flex: 1,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
  },
  fallingItems: {
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 3,
  },
  foldedMapContainer: {
    flexDirection: 'row',
    marginTop: 10,
    height: 100,
    width: SCREEN_WIDTH * 0.8,
    alignItems: 'flex-end',
  },
  mapFold: {
    flex: 1,
    height: 90,
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  mapFoldLeft: {
    transform: [{ skewY: '5deg' }],
    backgroundColor: '#F1F5F9',
    borderRightWidth: 0,
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
  },
  mapFoldCenter: {
    height: 86,
    marginBottom: 2,
    backgroundColor: '#FFFFFF',
    zIndex: 2,
  },
  mapFoldRight: {
    transform: [{ skewY: '-5deg' }],
    backgroundColor: '#F1F5F9',
    borderLeftWidth: 0,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  mapGridLines: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    opacity: 0.5,
    borderStyle: 'dashed',
  },
  mapPathLine: {
    position: 'absolute',
    top: '40%',
    left: -20,
    right: -20,
    height: 2,
    backgroundColor: '#CBD5E1',
    transform: [{ rotate: '15deg' }],
  },
  mapPinSmall: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 4,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  mapPinDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#3B82F6',
    marginRight: 4,
  },
  mapPinText: { fontSize: 8, fontWeight: '700', color: '#1E293B' },
  placeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  chipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#3B82F6',
    marginRight: 6,
  },
  chipText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#334155',
  },

  // SLIDE 3: PLANNER
  robotPlanner: {
    position: 'absolute',
    left: 20,
    top: '15%',
    width: 64,
    height: 64,
    backgroundColor: '#FFF',
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
    zIndex: 10,
  },
  plannerContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  phoneDevice: {
    width: SCREEN_WIDTH * 0.55,
    height: SCREEN_WIDTH * 1.0,
    backgroundColor: '#1E293B',
    borderRadius: 36,
    padding: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.25,
    shadowRadius: 30,
    elevation: 12,
  },
  phoneScreenContent: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 30,
    overflow: 'hidden',
    position: 'relative',
  },
  phoneHeader: { height: 30, alignItems: 'center', paddingTop: 8 },
  notch: { width: 60, height: 16, backgroundColor: '#1E293B', borderRadius: 8 },
  mapBackgroundSimple: { flex: 1, position: 'relative', backgroundColor: '#E2E8F0' },
  roadLine: { position: 'absolute', left: -20, right: -20, height: 4, backgroundColor: '#FFF' },
  roadLineVertical: { position: 'absolute', top: 0, bottom: 0, width: 4, backgroundColor: '#FFF' },
  markerBubble: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  markerDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#3B82F6', marginRight: 6 },
  markerText: { fontSize: 9, fontWeight: '700', color: '#334155' },
  
  floatingDayCard: {
    position: 'absolute',
    bottom: -60,
    width: SCREEN_WIDTH * 0.65,
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  cardHeader: { fontSize: 16, fontWeight: '800', color: '#0F172A', marginBottom: 12 },
  timelineList: { gap: 12 },
  timelineItem: { flexDirection: 'row', alignItems: 'center' },
  timelinePoint: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#3B82F6', marginRight: 12 },
  timelineLabel: { fontSize: 13, fontWeight: '600', color: '#334155' },
  timelineConnector: {
    position: 'absolute',
    left: 4,
    top: 10,
    bottom: -14,
    width: 2,
    backgroundColor: '#E2E8F0',
    zIndex: -1,
  },
  travelersCouple: {
    position: 'absolute',
    right: 20,
    top: '30%',
    transform: [{ scale: 1.2 }],
  },

  // BOTTOM NAVIGATION
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
    backgroundColor: '#CBD5E1',
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
