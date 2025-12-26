/**
 * World Map Screen - V2 Home
 * 
 * Interactive flat world map showing saved countries
 * - Highlights countries with saved places in neon glow
 * - Tap country → CountryBubbleScreen
 * - Clean, minimal design
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
import MapboxFlatMap from '../../components/MapboxFlatMap';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { SkeletonLoader } from '../../components/SkeletonLoader';

// COLOR PALETTE - Lighter for visibility
const COLORS = {
  background: '#0F1115',      // Deep Slate
  primaryGlow: '#06B6D4',     // Electric Cyan
  zenlyGreen: '#22C55E',      // Success/Nature
  surfaceCard: '#17191F',     // Card background
  electricBlue: '#06B6D4',
  neonGreen: '#00ff88',
  white: '#ffffff',
};

import { useTripStore } from '../../stores/tripStore';
import { useAuthStore } from '../../stores/authStore';
import { useLocationStore } from '../../stores/locationStore';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Country coordinates
const COUNTRY_COORDINATES: Record<string, { lat: number; lng: number; zoom: number }> = {
  'japan': { lat: 36.2048, lng: 138.2529, zoom: 5 },
  'korea': { lat: 35.9078, lng: 127.7669, zoom: 6 },
  'south korea': { lat: 35.9078, lng: 127.7669, zoom: 6 },
  'thailand': { lat: 15.8700, lng: 100.9925, zoom: 5 },
  'vietnam': { lat: 14.0583, lng: 108.2772, zoom: 5 },
  'singapore': { lat: 1.3521, lng: 103.8198, zoom: 10 },
  'indonesia': { lat: -0.7893, lng: 113.9213, zoom: 4 },
  'bali': { lat: -8.3405, lng: 115.0920, zoom: 8 },
  'malaysia': { lat: 4.2105, lng: 101.9758, zoom: 5 },
  'philippines': { lat: 12.8797, lng: 121.7740, zoom: 5 },
  'india': { lat: 20.5937, lng: 78.9629, zoom: 4 },
  'china': { lat: 35.8617, lng: 104.1954, zoom: 4 },
  'taiwan': { lat: 23.6978, lng: 120.9605, zoom: 7 },
  'hong kong': { lat: 22.3193, lng: 114.1694, zoom: 10 },
  'australia': { lat: -25.2744, lng: 133.7751, zoom: 4 },
  'new zealand': { lat: -40.9006, lng: 174.8860, zoom: 5 },
  'usa': { lat: 37.0902, lng: -95.7129, zoom: 3 },
  'united states': { lat: 37.0902, lng: -95.7129, zoom: 3 },
  'canada': { lat: 56.1304, lng: -106.3468, zoom: 3 },
  'mexico': { lat: 23.6345, lng: -102.5528, zoom: 5 },
  'uk': { lat: 55.3781, lng: -3.4360, zoom: 5 },
  'united kingdom': { lat: 55.3781, lng: -3.4360, zoom: 5 },
  'france': { lat: 46.2276, lng: 2.2137, zoom: 5 },
  'italy': { lat: 41.8719, lng: 12.5674, zoom: 5 },
  'spain': { lat: 40.4637, lng: -3.7492, zoom: 5 },
  'germany': { lat: 51.1657, lng: 10.4515, zoom: 5 },
  'netherlands': { lat: 52.1326, lng: 5.2913, zoom: 7 },
  'greece': { lat: 39.0742, lng: 21.8243, zoom: 6 },
  'turkey': { lat: 38.9637, lng: 35.2433, zoom: 5 },
  'uae': { lat: 23.4241, lng: 53.8478, zoom: 6 },
  'dubai': { lat: 25.2048, lng: 55.2708, zoom: 9 },
  'brazil': { lat: -14.2350, lng: -51.9253, zoom: 4 },
  'argentina': { lat: -38.4161, lng: -63.6167, zoom: 4 },
  'peru': { lat: -9.1900, lng: -75.0152, zoom: 5 },
  'egypt': { lat: 26.8206, lng: 30.8025, zoom: 5 },
  'south africa': { lat: -30.5595, lng: 22.9375, zoom: 5 },
  'morocco': { lat: 31.7917, lng: -7.0926, zoom: 5 },
  'portugal': { lat: 39.3999, lng: -8.2245, zoom: 6 },
  'switzerland': { lat: 46.8182, lng: 8.2275, zoom: 7 },
  'austria': { lat: 47.5162, lng: 14.5501, zoom: 6 },
  'croatia': { lat: 45.1, lng: 15.2, zoom: 6 },
  'iceland': { lat: 64.9631, lng: -19.0208, zoom: 5 },
  'norway': { lat: 60.4720, lng: 8.4689, zoom: 4 },
  'sweden': { lat: 60.1282, lng: 18.6435, zoom: 4 },
  'finland': { lat: 61.9241, lng: 25.7482, zoom: 5 },
  'denmark': { lat: 56.2639, lng: 9.5018, zoom: 6 },
  'ireland': { lat: 53.4129, lng: -8.2439, zoom: 6 },
  'scotland': { lat: 56.4907, lng: -4.2026, zoom: 6 },
  'belgium': { lat: 50.5039, lng: 4.4699, zoom: 7 },
  'czech republic': { lat: 49.8175, lng: 15.4730, zoom: 7 },
  'czechia': { lat: 49.8175, lng: 15.4730, zoom: 7 },
  'poland': { lat: 51.9194, lng: 19.1451, zoom: 5 },
  'hungary': { lat: 47.1625, lng: 19.5033, zoom: 7 },
  'russia': { lat: 61.5240, lng: 105.3188, zoom: 3 },
};

interface CountryMarkerData {
  tripId: string;
  name: string;
  destination: string;
  coordinate: { latitude: number; longitude: number };
}

export default function WorldMapScreen() {
  const navigation = useNavigation<any>();
  
  const { trips, fetchTrips, isLoading } = useTripStore();
  const { user } = useAuthStore();
  const { requestPermission, startTracking } = useLocationStore();
  
  const [countryMarkers, setCountryMarkers] = useState<CountryMarkerData[]>([]);

  // Fetch trips on focus
  useFocusEffect(
    useCallback(() => {
      fetchTrips();
    }, [])
  );

  // Initialize location
  useEffect(() => {
    const initLocation = async () => {
      const hasPermission = await requestPermission();
      if (hasPermission) {
        startTracking();
      }
    };
    initLocation();
  }, []);

  // Convert trips to country markers
  useEffect(() => {
    if (trips.length > 0) {
      const markers: CountryMarkerData[] = [];
      
      trips.forEach((trip) => {
        const destination = trip.destination?.toLowerCase().trim() || '';
        const coords = COUNTRY_COORDINATES[destination];
        
        if (coords) {
          markers.push({
            tripId: trip.id,
            name: trip.name,
            destination: trip.destination,
            coordinate: { latitude: coords.lat, longitude: coords.lng },
          });
        } else {
          // Try partial match
          const matchedKey = Object.keys(COUNTRY_COORDINATES).find(key => 
            destination.includes(key) || key.includes(destination)
          );
          if (matchedKey) {
            const matchedCoords = COUNTRY_COORDINATES[matchedKey];
            markers.push({
              tripId: trip.id,
              name: trip.name,
              destination: trip.destination,
              coordinate: { latitude: matchedCoords.lat, longitude: matchedCoords.lng },
            });
          }
        }
      });
      
      setCountryMarkers(markers);
    }
  }, [trips]);

  // Handle country press from flat map
  const handleCountryPress = (countryName: string, tripId: string) => {
    navigation.navigate('CountryBubbles', { 
      tripId,
      countryName,
    });
  };

  const handleProfilePress = () => {
    navigation.navigate('Profile');
  };

  // Get countries for flat map
  const flatMapCountries = trips.map(trip => ({
    destination: trip.destination,
    tripId: trip.id,
  }));

  // Calculate total places saved
  const totalPlacesSaved = useMemo(() => {
    return trips.reduce((sum, trip) => {
      // Ensure we have a number (handle potential string from DB)
      const count = Number(trip.places_count) || 0;
      return sum + count;
    }, 0);
  }, [trips]);

  return (
    <View style={styles.container}>
      <StatusBar 
        barStyle="light-content"
        backgroundColor="transparent"
        translucent={true}
      />
      
      {/* Mapbox Vector Map */}
      <MapboxFlatMap
        onCountryPress={handleCountryPress}
        countries={flatMapCountries}
        style={styles.map}
      />

      {/* Header overlay */}
      <View style={styles.header}>
        <MotiView
          from={{ opacity: 0, translateY: -20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 400 }}
        >
          <Text style={styles.logo}>yori</Text>
          <Text style={styles.tagline}>
            your saved places, everywhere
          </Text>
        </MotiView>
        
        <View style={styles.headerRight}>
          {/* Profile button */}
          <TouchableOpacity 
            style={styles.profileButton}
            onPress={handleProfilePress}
          >
            {user?.avatar_url ? (
              <View style={styles.avatarContainer}>
                <Text style={styles.avatarText}>
                  {user.name?.charAt(0).toUpperCase() || '?'}
                </Text>
              </View>
            ) : (
              <Ionicons 
                name="person-circle-outline" 
                size={32} 
                color="#ffffff"
              />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Empty state */}
      {!isLoading && countryMarkers.length === 0 && (
        <MotiView
          from={{ opacity: 0, translateY: 30 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'spring', delay: 300 }}
          style={styles.emptyState}
        >
          <LinearGradient
            colors={[COLORS.surfaceCard + 'F0', COLORS.surfaceCard + 'D0']}
            style={styles.emptyCard}
          >
            <Text style={styles.emptyEmoji}>🌍</Text>
            <Text style={styles.emptyTitle}>No places yet</Text>
            <Text style={styles.emptySubtitle}>
              Share a YouTube or Instagram travel video{'\n'}
              and we'll extract the places for you
            </Text>
            <View style={styles.shareHint}>
              <Ionicons name="share-outline" size={20} color={COLORS.electricBlue} />
              <Text style={styles.shareHintText}>
                Share to Yori from any app
              </Text>
            </View>
          </LinearGradient>
        </MotiView>
      )}

      {/* Stats bar at bottom */}
      {countryMarkers.length > 0 && (
        <MotiView
          from={{ opacity: 0, translateY: 50 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'spring', delay: 200 }}
          style={styles.statsBar}
        >
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              {countryMarkers.length}
            </Text>
            <Text style={styles.statLabel}>
              {countryMarkers.length === 1 ? 'Country' : 'Countries'}
            </Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              {totalPlacesSaved}
            </Text>
            <Text style={styles.statLabel}>
              Places Saved
            </Text>
          </View>
        </MotiView>
      )}

      {/* Skeleton Loading State */}
      {isLoading && (
        <View style={styles.skeletonOverlay}>
          {/* Header Skeleton */}
          <View style={styles.header}>
            <View>
              <SkeletonLoader width={80} height={32} borderRadius={8} />
              <SkeletonLoader width={160} height={16} borderRadius={4} style={{ marginTop: 8 }} />
            </View>
            <SkeletonLoader width={44} height={44} borderRadius={22} />
          </View>

          {/* Stats Bar Skeleton */}
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
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  map: {
    flex: 1,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
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
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logo: {
    fontSize: 32,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  profileButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  avatarContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primaryGlow,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  emptyState: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
  },
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
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
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
  shareHintText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.electricBlue,
    marginLeft: 8,
  },
  statsBar: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    backgroundColor: COLORS.surfaceCard + 'F0',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.primaryGlow + '30',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 5,
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.white,
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 17, 21, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  skeletonOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0F1115',
    zIndex: 100,
  },
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
  statItemSkeleton: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
});
