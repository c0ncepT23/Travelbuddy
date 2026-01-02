/**
 * World Map Screen - V2 Home
 * 
 * Interactive 3D globe showing saved countries
 * - Highlights countries with 3D landmarks (Statue of Liberty, Mt. Fuji, etc.)
 * - Tap landmark → CountryBubbleScreen
 * - Clean, minimal "Zenly" style design
 */

import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Mapbox, { Camera } from '@rnmapbox/maps';
import MapboxFlatMap from '../../components/MapboxFlatMap';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { SkeletonLoader } from '../../components/SkeletonLoader';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';

// Components
import { FloatingAIOrb } from '../../components/FloatingAIOrb';
import { CompactAIChat } from '../../components/CompactAIChat';
import api from '../../config/api';

// STORES
import { useTripStore } from '../../stores/tripStore';
import { useAuthStore } from '../../stores/authStore';
import { useLocationStore } from '../../stores/locationStore';
import { useTripDataStore } from '../../stores/tripDataStore';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// COLOR PALETTE
const COLORS = {
  background: '#0F1115',      // Deep Slate
  primaryGlow: '#06B6D4',     // Electric Cyan
  zenlyGreen: '#22C55E',      // Success/Nature
  surfaceCard: '#17191F',     // Card background
  electricBlue: '#06B6D4',
  neonGreen: '#00ff88',
  white: '#ffffff',
};

// Country center coordinates (matching MapboxFlatMap)
const COUNTRY_CENTERS: Record<string, [number, number]> = {
  'japan': [138.2529, 36.2048],
  'south korea': [127.7669, 35.9078],
  'korea': [127.7669, 35.9078],
  'thailand': [100.9925, 15.87],
  'vietnam': [108.2772, 14.0583],
  'singapore': [103.8198, 1.3521],
  'indonesia': [113.9213, -0.7893],
  'bali': [115.0920, -8.3405],
  'malaysia': [101.9758, 4.2105],
  'philippines': [121.7740, 12.8797],
  'india': [78.9629, 20.5937],
  'china': [104.1954, 35.8617],
  'taiwan': [120.9605, 23.6978],
  'hong kong': [114.1694, 22.3193],
  'australia': [133.7751, -25.2744],
  'new zealand': [174.8860, -40.9006],
  'usa': [-95.7129, 37.0902],
  'united states': [-95.7129, 37.0902],
  'canada': [-106.3468, 56.1304],
  'mexico': [-102.5528, 23.6345],
  'uk': [-3.4360, 55.3781],
  'united kingdom': [-3.4360, 55.3781],
  'france': [2.2137, 46.2276],
  'italy': [12.5674, 41.8719],
  'spain': [-3.7492, 40.4637],
  'germany': [10.4515, 51.1657],
  'netherlands': [5.2913, 52.1326],
  'greece': [21.8243, 39.0742],
  'turkey': [35.2433, 38.9637],
  'uae': [53.8478, 23.4241],
  'dubai': [55.2708, 25.2048],
  'brazil': [-51.9253, -14.2350],
  'argentina': [-63.6167, -38.4161],
  'peru': [-75.0152, -9.1900],
  'egypt': [30.8025, 26.8206],
  'south africa': [22.9375, -30.5595],
  'morocco': [-7.0926, 31.7917],
  'portugal': [-8.2245, 39.3999],
  'switzerland': [8.2275, 46.8182],
  'austria': [14.5501, 47.5162],
  'croatia': [15.2, 45.1],
  'iceland': [-19.0208, 64.9631],
  'norway': [8.4689, 60.4720],
  'sweden': [18.6435, 60.1282],
  'finland': [25.7482, 61.9241],
  'denmark': [9.5018, 56.2639],
  'ireland': [-8.2439, 53.4129],
  'belgium': [4.4699, 50.5039],
  'poland': [19.1451, 51.9194],
  'czech republic': [15.4730, 49.8175],
  'czechia': [15.4730, 49.8175],
  'hungary': [19.5033, 47.1625],
  'russia': [105.3188, 61.5240],
};

interface CountryMarkerData {
  tripId: string;
  name: string;
  destination: string;
  coordinate: { latitude: number; longitude: number };
}

// Country coordinates for markers mapping
const COUNTRY_MARKER_COORDS: Record<string, { lat: number; lng: number }> = {
  'japan': { lat: 36.2048, lng: 138.2529 },
  'korea': { lat: 35.9078, lng: 127.7669 },
  'south korea': { lat: 35.9078, lng: 127.7669 },
  'thailand': { lat: 15.8700, lng: 100.9925 },
  'vietnam': { lat: 14.0583, lng: 108.2772 },
  'singapore': { lat: 1.3521, lng: 103.8198 },
  'indonesia': { lat: -0.7893, lng: 113.9213 },
  'bali': { lat: -8.3405, lng: 115.0920 },
  'malaysia': { lat: 4.2105, lng: 101.9758 },
  'philippines': { lat: 12.8797, lng: 121.7740 },
  'india': { lat: 20.5937, lng: 78.9629 },
  'china': { lat: 35.8617, lng: 104.1954 },
  'taiwan': { lat: 23.6978, lng: 120.9605 },
  'hong kong': { lat: 22.3193, lng: 114.1694 },
  'australia': { lat: -25.2744, lng: 133.7751 },
  'new zealand': { lat: -40.9006, lng: 174.8860 },
  'usa': { lat: 37.0902, lng: -95.7129 },
  'united states': { lat: 37.0902, lng: -95.7129 },
  'canada': { lat: 56.1304, lng: -106.3468 },
  'mexico': { lat: 23.6345, lng: -102.5528 },
  'uk': { lat: 55.3781, lng: -3.4360 },
  'united kingdom': { lat: 55.3781, lng: -3.4360 },
  'france': { lat: 46.2276, lng: 2.2137 },
  'italy': { lat: 41.8719, lng: 12.5674 },
  'spain': { lat: 40.4637, lng: -3.7492 },
  'germany': { lat: 51.1657, lng: 10.4515 },
  'netherlands': { lat: 52.1326, lng: 5.2913 },
  'greece': { lat: 39.0742, lng: 21.8243 },
  'turkey': { lat: 38.9637, lng: 35.2433 },
  'uae': { lat: 23.4241, lng: 53.8478 },
  'dubai': { lat: 25.2048, lng: 55.2708 },
  'brazil': { lat: -14.2350, lng: -51.9253 },
  'argentina': { lat: -38.4161, lng: -63.6167 },
  'peru': { lat: -9.1900, lng: -75.0152 },
  'egypt': { lat: 26.8206, lng: 30.8025 },
  'south africa': { lat: -30.5595, lng: 22.9375 },
  'morocco': { lat: 31.7917, lng: -7.0926 },
  'portugal': { lat: 39.3999, lng: -8.2245 },
  'switzerland': { lat: 46.8182, lng: 8.2275 },
  'austria': { lat: 47.5162, lng: 14.5501 },
  'croatia': { lat: 45.1, lng: 15.2 },
  'iceland': { lat: 64.9631, lng: -19.0208 },
  'norway': { lat: 60.4720, lng: 8.4689 },
  'sweden': { lat: 60.1282, lng: 18.6435 },
  'finland': { lat: 61.9241, lng: 25.7482 },
  'denmark': { lat: 56.2639, lng: 9.5018 },
  'ireland': { lat: 53.4129, lng: -8.2439 },
  'scotland': { lat: 56.4907, lng: -4.2026 },
  'belgium': { lat: 50.5039, lng: 4.4699 },
  'czech republic': { lat: 49.8175, lng: 15.4730 },
  'czechia': { lat: 49.8175, lng: 15.4730 },
  'poland': { lat: 51.9194, lng: 19.1451 },
  'hungary': { lat: 47.1625, lng: 19.5033 },
  'russia': { lat: 61.5240, lng: 105.3188 },
};

export default function WorldMapScreen() {
  const navigation = useNavigation<any>();
  const cameraRef = useRef<Camera>(null);
  
  const { trips, fetchTrips, isLoading } = useTripStore();
  const { user } = useAuthStore();
  const { requestPermission, startTracking } = useLocationStore();
  const { fetchSavedPlaces } = useTripDataStore();
  
  const [countryMarkers, setCountryMarkers] = useState<CountryMarkerData[]>([]);
  const [selectedCountryName, setSelectedCountryName] = useState<string | null>(null);

  // AI Chat state
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [isAITyping, setIsAITyping] = useState(false);

  // Initial welcome message
  useEffect(() => {
    setChatMessages([{
      id: 'welcome',
      type: 'ai',
      content: "👋 Paste a link from YouTube, Instagram, or TikTok to add it to your travel map!",
      timestamp: new Date(),
    }]);
  }, []);

  const handleSendMessage = async (message: string) => {
    const urlPattern = /(https?:\/\/[^\s]+)/g;
    const urls = message.match(urlPattern);

    if (!urls || urls.length === 0) {
      setChatMessages(prev => [...prev, 
        { id: `user-${Date.now()}`, type: 'user', content: message, timestamp: new Date() },
        { id: `ai-${Date.now()}`, type: 'ai', content: "I'm looking for links to travel spots! 🌍 Try pasting a YouTube or Instagram link.", timestamp: new Date() }
      ]);
      return;
    }

    const url = urls[0];
    setChatMessages(prev => [...prev, { id: `user-${Date.now()}`, type: 'user', content: message, timestamp: new Date() }]);
    setIsAITyping(true);

    try {
      const response = await api.post('/share/process', { url });
      
      if (response.data && response.data.success) {
        const { trip, places } = response.data;
        const countryName = trip.destination;
        const placeCount = places?.length || 0;

        setChatMessages(prev => [...prev, {
          id: `ai-${Date.now()}`,
          type: 'ai',
          content: `✅ Success! Found ${placeCount > 0 ? `${placeCount} spots` : 'your spot'} and added it to your ${countryName} map. 🌏`,
          timestamp: new Date(),
        }]);

        fetchTrips();
        if (trip.id) fetchSavedPlaces(trip.id, true);

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        const countryKey = countryName.toLowerCase();
        const center = COUNTRY_CENTERS[countryKey];
        
        if (center && cameraRef.current) {
          cameraRef.current.setCamera({
            centerCoordinate: center,
            zoomLevel: 4.5,
            animationDuration: 3500,
            animationMode: 'flyTo',
          });
          setSelectedCountryName(countryName);
        }

        setTimeout(() => setIsChatOpen(false), 3000);
      } else {
        throw new Error('Failed to process link');
      }
    } catch (error) {
      console.error('Smart paste error:', error);
      setChatMessages(prev => [...prev, {
        id: `ai-${Date.now()}`,
        type: 'ai',
        content: "Sorry, I couldn't extract the location from that link. 😅 Try another one?",
        timestamp: new Date(),
      }]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsAITyping(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchTrips();
    }, [])
  );

  useEffect(() => {
    const initLocation = async () => {
      const hasPermission = await requestPermission();
      if (hasPermission) {
        startTracking();
      }
    };
    initLocation();
  }, []);

  useEffect(() => {
    if (trips.length > 0) {
      const markers: CountryMarkerData[] = [];
      trips.forEach((trip) => {
        const destination = trip.destination?.toLowerCase().trim() || '';
        const coords = COUNTRY_MARKER_COORDS[destination];
        if (coords) {
          markers.push({
            tripId: trip.id,
            name: trip.name,
            destination: trip.destination,
            coordinate: { latitude: coords.lat, longitude: coords.lng },
          });
        }
      });
      setCountryMarkers(markers);
    }
  }, [trips]);

  const handleCountryPress = (countryName: string, tripId: string) => {
    navigation.navigate('CountryBubbles', { tripId, countryName });
  };

  const handleProfilePress = () => {
    navigation.navigate('Profile');
  };

  const flatMapCountries = trips.map(trip => ({
    destination: trip.destination,
    tripId: trip.id,
  }));

  const totalPlacesSaved = useMemo(() => {
    return trips.reduce((sum, trip) => sum + (Number(trip.places_count) || 0), 0);
  }, [trips]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />
      
      {/* Mapbox Vector Map */}
      <MapboxFlatMap
        onCountryPress={handleCountryPress}
        countries={flatMapCountries}
        style={styles.map}
        cameraRef={cameraRef}
        selectedCountry={selectedCountryName}
        onSelectedCountryChange={setSelectedCountryName}
      />

      {/* Header overlay */}
      <View style={styles.header}>
        <MotiView from={{ opacity: 0, translateY: -20 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 400 }}>
          <Text style={styles.logo}>yori</Text>
          <Text style={styles.tagline}>your world, visualized</Text>
        </MotiView>
        
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={handleProfilePress} activeOpacity={0.8}>
            <BlurView intensity={40} tint="light" style={styles.profileButton}>
              {user?.avatar_url ? (
                <View style={styles.avatarContainer}>
                  <Text style={styles.avatarText}>{user.name?.charAt(0).toUpperCase() || '?'}</Text>
                </View>
              ) : (
                <Ionicons name="person" size={22} color="#ffffff" />
              )}
            </BlurView>
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats bar at bottom */}
      {countryMarkers.length > 0 && !isLoading && (
        <MotiView from={{ opacity: 0, translateY: 50 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'spring', delay: 200 }} style={styles.statsBarContainer}>
          <BlurView intensity={60} tint="dark" style={styles.statsBarBlur}>
            <LinearGradient colors={['rgba(99, 102, 241, 0.15)', 'rgba(6, 182, 212, 0.1)']} style={styles.statsGradient}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{countryMarkers.length}</Text>
                <Text style={styles.statLabel}>{countryMarkers.length === 1 ? 'Country' : 'Countries'}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{totalPlacesSaved}</Text>
                <Text style={styles.statLabel}>Places Saved</Text>
              </View>
            </LinearGradient>
          </BlurView>
        </MotiView>
      )}

      {/* Empty state */}
      {!isLoading && countryMarkers.length === 0 && (
        <MotiView from={{ opacity: 0, translateY: 30 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'spring', delay: 300 }} style={styles.emptyState}>
          <LinearGradient colors={[COLORS.surfaceCard + 'F0', COLORS.surfaceCard + 'D0']} style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>🌍</Text>
            <Text style={styles.emptyTitle}>No places yet</Text>
            <Text style={styles.emptySubtitle}>Share a YouTube or Instagram travel video{"\n"}and we'll extract the places for you</Text>
            <View style={styles.shareHint}>
              <Ionicons name="share-outline" size={20} color={COLORS.electricBlue} />
              <Text style={styles.shareHintText}>Share to Yori from any app</Text>
            </View>
          </LinearGradient>
        </MotiView>
      )}

      {/* 🚀 GLOBAL AI AGENT - Always on Top */}
      <View style={[styles.aiAgentContainer, { zIndex: 9999 }]}>
        <FloatingAIOrb onPress={() => setIsChatOpen(true)} visible={!isChatOpen} />
        <CompactAIChat
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          onOpenFullChat={() => setIsChatOpen(false)}
          messages={chatMessages}
          onSendMessage={handleSendMessage}
          isTyping={isAITyping}
          placeholder="Paste a link to add it to your map..."
        />
      </View>

      {/* Skeleton Loading State */}
      {isLoading && (
        <View style={styles.skeletonOverlay}>
          <View style={styles.header}>
            <View>
              <SkeletonLoader width={80} height={32} borderRadius={8} />
              <SkeletonLoader width={160} height={16} borderRadius={4} style={{ marginTop: 8 }} />
            </View>
            <SkeletonLoader width={44} height={44} borderRadius={22} />
          </View>
          <View style={styles.statsBarSkeleton}>
            <View style={styles.statItemSkeleton}>
              <SkeletonLoader width={40} height={24} borderRadius={6} />
              <SkeletonLoader width={60} height={12} borderRadius={4} style={{ marginTop: 6 }} />
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItemSkeleton}>
              <SkeletonLoader width={40} height={24} borderRadius={6} />
              <SkeletonLoader width={80} height={12} borderRadius={4} style={{ marginTop: 6 }} />
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  map: { flex: 1, width: SCREEN_WIDTH, height: SCREEN_HEIGHT },
  header: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    zIndex: 10,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { fontSize: 32, fontWeight: '900', color: '#ffffff', letterSpacing: -1 },
  tagline: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  profileButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    overflow: 'hidden',
  },
  avatarContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primaryGlow,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  emptyState: { position: 'absolute', bottom: 100, left: 20, right: 20 },
  emptyCard: {
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 5,
    borderWidth: 1,
    borderColor: COLORS.primaryGlow + '30',
  },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#ffffff', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.7)', textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  shareHint: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.electricBlue + '20',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.electricBlue + '40',
  },
  shareHintText: { fontSize: 14, fontWeight: '600', color: COLORS.electricBlue, marginLeft: 8 },
  statsBarContainer: { position: 'absolute', bottom: 40, left: 20, right: 20, zIndex: 20 },
  aiAgentContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 9999 },
  statsBarBlur: { borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.2)' },
  statsGradient: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 20 },
  statItem: { alignItems: 'center', paddingHorizontal: 24 },
  statNumber: { fontSize: 24, fontWeight: '800', color: COLORS.white },
  statLabel: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  statDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.1)' },
  skeletonOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: '#0F1115', zIndex: 100 },
  statsBarSkeleton: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    backgroundColor: '#17191F',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.1)',
  },
  statItemSkeleton: { alignItems: 'center', paddingHorizontal: 24 },
});
