/**
 * World Map Screen - V2 Home
 * 
 * Replaces TripListScreen with interactive world map
 * - Toggle between 3D Globe view and Flat Map view
 * - Highlights countries with saved places in green
 * - Tap country → CountryBubbleScreen
 * - Minimalist design with premium aesthetics
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  StatusBar,
  Animated,
} from 'react-native';
import MapView, { Marker, Geojson, PROVIDER_GOOGLE } from 'react-native-maps';
import GlobeView from '../../components/GlobeView';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { useTripStore } from '../../stores/tripStore';
import { useAuthStore } from '../../stores/authStore';
import { useLocationStore } from '../../stores/locationStore';
import { Trip } from '../../types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Country coordinates (center points for highlighting)
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

// Colors
const colors = {
  bg: '#FAFAFA',
  surface: '#FFFFFF',
  text: '#1A1A1A',
  textMuted: '#6B7280',
  highlight: '#10B981', // Green for countries with places
  highlightDark: '#059669',
  primary: '#2563EB',
  border: '#E5E7EB',
};

interface CountryMarkerData {
  tripId: string;
  name: string;
  destination: string;
  coordinate: { latitude: number; longitude: number };
  placesCount?: number;
}

export default function WorldMapScreen() {
  const navigation = useNavigation<any>();
  const mapRef = useRef<MapView>(null);
  
  const { trips, fetchTrips, isLoading } = useTripStore();
  const { user, logout } = useAuthStore();
  const { location, requestPermission, startTracking } = useLocationStore();
  
  const [countryMarkers, setCountryMarkers] = useState<CountryMarkerData[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'globe' | 'flat'>('globe'); // Default to globe view
  const toggleAnim = useRef(new Animated.Value(1)).current; // 1 = globe, 0 = flat

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

  const handleCountryPress = (marker: CountryMarkerData) => {
    setSelectedCountry(marker.destination);
    
    // Navigate to country bubble screen
    navigation.navigate('CountryBubbles', { 
      tripId: marker.tripId,
      countryName: marker.destination,
    });
  };

  const handleProfilePress = () => {
    navigation.navigate('Profile');
  };

  const handleMyLocationPress = () => {
    if (location && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 5,
        longitudeDelta: 5,
      }, 500);
    }
  };

  // Handle globe country press
  const handleGlobeCountryPress = (countryName: string, tripId: string) => {
    navigation.navigate('CountryBubbles', { 
      tripId,
      countryName,
    });
  };

  // Toggle between globe and flat map
  const toggleViewMode = () => {
    const newMode = viewMode === 'globe' ? 'flat' : 'globe';
    setViewMode(newMode);
    
    Animated.spring(toggleAnim, {
      toValue: newMode === 'globe' ? 1 : 0,
      useNativeDriver: true,
      tension: 50,
      friction: 7,
    }).start();
  };

  // Get countries for globe view
  const globeCountries = trips.map(trip => ({
    destination: trip.destination,
    tripId: trip.id,
  }));

  // Initial map region - world view
  const initialRegion = {
    latitude: 20,
    longitude: 0,
    latitudeDelta: 100,
    longitudeDelta: 100,
  };

  return (
    <View style={styles.container}>
      <StatusBar 
        barStyle={viewMode === 'globe' ? 'light-content' : 'dark-content'} 
        backgroundColor={viewMode === 'globe' ? '#0a0a1a' : colors.bg} 
      />
      
      {/* Globe View */}
      {viewMode === 'globe' && (
        <GlobeView
          onCountryPress={handleGlobeCountryPress}
          countries={globeCountries}
          style={styles.map}
        />
      )}
      
      {/* Flat Map View */}
      {viewMode === 'flat' && (
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          initialRegion={initialRegion}
          showsUserLocation={true}
          showsMyLocationButton={false}
          mapType="standard"
          rotateEnabled={false}
          pitchEnabled={false}
        >
          {/* Country markers */}
          {countryMarkers.map((marker, index) => (
            <Marker
              key={`${marker.tripId}-${index}`}
              coordinate={marker.coordinate}
              onPress={() => handleCountryPress(marker)}
            >
              <MotiView
                from={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ 
                  type: 'spring', 
                  delay: index * 100,
                  damping: 15,
                }}
              >
                <View style={styles.markerContainer}>
                  <View style={styles.markerDot}>
                    <Text style={styles.markerFlag}>
                      {getCountryFlag(marker.destination)}
                    </Text>
                  </View>
                  <View style={styles.markerLabel}>
                    <Text style={styles.markerText} numberOfLines={1}>
                      {marker.destination}
                    </Text>
                  </View>
                </View>
              </MotiView>
            </Marker>
          ))}
        </MapView>
      )}

      {/* Header overlay */}
      <View style={[styles.header, viewMode === 'globe' && styles.headerDark]}>
        <MotiView
          from={{ opacity: 0, translateY: -20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 400 }}
        >
          <Text style={[styles.logo, viewMode === 'globe' && styles.logoDark]}>yori</Text>
          <Text style={[styles.tagline, viewMode === 'globe' && styles.taglineDark]}>
            your saved places, everywhere
          </Text>
        </MotiView>
        
        <View style={styles.headerRight}>
          {/* View Mode Toggle */}
          <TouchableOpacity 
            style={[styles.toggleButton, viewMode === 'globe' && styles.toggleButtonDark]}
            onPress={toggleViewMode}
          >
            <Ionicons 
              name={viewMode === 'globe' ? 'map-outline' : 'globe-outline'} 
              size={20} 
              color={viewMode === 'globe' ? '#ffffff' : colors.text} 
            />
            <Text style={[styles.toggleText, viewMode === 'globe' && styles.toggleTextDark]}>
              {viewMode === 'globe' ? 'Flat' : 'Globe'}
            </Text>
          </TouchableOpacity>
          
          {/* Profile button */}
          <TouchableOpacity 
            style={[styles.profileButton, viewMode === 'globe' && styles.profileButtonDark]}
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
                color={viewMode === 'globe' ? '#ffffff' : colors.text} 
              />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* My location button - only show in flat map */}
      {viewMode === 'flat' && (
        <TouchableOpacity 
          style={styles.myLocationButton}
          onPress={handleMyLocationPress}
        >
          <Ionicons name="locate" size={22} color={colors.text} />
        </TouchableOpacity>
      )}

      {/* Empty state */}
      {!isLoading && countryMarkers.length === 0 && (
        <MotiView
          from={{ opacity: 0, translateY: 30 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'spring', delay: 300 }}
          style={styles.emptyState}
        >
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>🌍</Text>
            <Text style={styles.emptyTitle}>No places yet</Text>
            <Text style={styles.emptySubtitle}>
              Share a YouTube or Instagram travel video{'\n'}
              and we'll extract the places for you
            </Text>
            <View style={styles.shareHint}>
              <Ionicons name="share-outline" size={20} color={colors.primary} />
              <Text style={styles.shareHintText}>
                Share to Yori from any app
              </Text>
            </View>
          </View>
        </MotiView>
      )}

      {/* Stats bar at bottom */}
      {trips.length > 0 && (
        <MotiView
          from={{ opacity: 0, translateY: 50 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'spring', delay: 200 }}
          style={[styles.statsBar, viewMode === 'globe' && styles.statsBarDark]}
        >
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, viewMode === 'globe' && styles.statNumberDark]}>
              {trips.length}
            </Text>
            <Text style={[styles.statLabel, viewMode === 'globe' && styles.statLabelDark]}>
              {trips.length === 1 ? 'Country' : 'Countries'}
            </Text>
          </View>
          <View style={[styles.statDivider, viewMode === 'globe' && styles.statDividerDark]} />
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, viewMode === 'globe' && styles.statNumberDark]}>
              {trips.length}
            </Text>
            <Text style={[styles.statLabel, viewMode === 'globe' && styles.statLabelDark]}>
              Collections
            </Text>
          </View>
        </MotiView>
      )}

      {/* Loading overlay */}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}
    </View>
  );
}

// Helper function to get country flag emoji
function getCountryFlag(country: string): string {
  const flags: Record<string, string> = {
    'japan': '🇯🇵',
    'korea': '🇰🇷',
    'south korea': '🇰🇷',
    'thailand': '🇹🇭',
    'vietnam': '🇻🇳',
    'singapore': '🇸🇬',
    'indonesia': '🇮🇩',
    'bali': '🇮🇩',
    'malaysia': '🇲🇾',
    'philippines': '🇵🇭',
    'india': '🇮🇳',
    'china': '🇨🇳',
    'taiwan': '🇹🇼',
    'hong kong': '🇭🇰',
    'australia': '🇦🇺',
    'new zealand': '🇳🇿',
    'usa': '🇺🇸',
    'united states': '🇺🇸',
    'canada': '🇨🇦',
    'mexico': '🇲🇽',
    'uk': '🇬🇧',
    'united kingdom': '🇬🇧',
    'france': '🇫🇷',
    'italy': '🇮🇹',
    'spain': '🇪🇸',
    'germany': '🇩🇪',
    'netherlands': '🇳🇱',
    'greece': '🇬🇷',
    'turkey': '🇹🇷',
    'uae': '🇦🇪',
    'dubai': '🇦🇪',
    'brazil': '🇧🇷',
    'argentina': '🇦🇷',
    'peru': '🇵🇪',
    'egypt': '🇪🇬',
    'south africa': '🇿🇦',
    'morocco': '🇲🇦',
    'portugal': '🇵🇹',
    'switzerland': '🇨🇭',
    'austria': '🇦🇹',
    'croatia': '🇭🇷',
    'iceland': '🇮🇸',
    'norway': '🇳🇴',
    'sweden': '🇸🇪',
    'finland': '🇫🇮',
    'denmark': '🇩🇰',
    'ireland': '🇮🇪',
    'scotland': '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
    'belgium': '🇧🇪',
    'czech republic': '🇨🇿',
    'czechia': '🇨🇿',
    'poland': '🇵🇱',
    'hungary': '🇭🇺',
    'russia': '🇷🇺',
  };
  
  return flags[country.toLowerCase()] || '📍';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
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
  headerDark: {
    // No background change needed, just text colors
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logo: {
    fontSize: 32,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -1,
  },
  logoDark: {
    color: '#ffffff',
  },
  tagline: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  taglineDark: {
    color: 'rgba(255,255,255,0.7)',
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    gap: 6,
  },
  toggleButtonDark: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  toggleTextDark: {
    color: '#ffffff',
  },
  profileButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  profileButtonDark: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  avatarContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.highlight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  myLocationButton: {
    position: 'absolute',
    right: 20,
    bottom: 140,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  markerContainer: {
    alignItems: 'center',
  },
  markerDot: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.highlight,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.highlightDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 3,
    borderColor: '#fff',
  },
  markerFlag: {
    fontSize: 24,
  },
  markerLabel: {
    marginTop: 4,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  markerText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
    textTransform: 'capitalize',
  },
  emptyState: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 5,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  shareHint: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  shareHintText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
    marginLeft: 8,
  },
  statsBar: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 5,
  },
  statsBarDark: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
  },
  statNumberDark: {
    color: '#ffffff',
  },
  statLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  statLabelDark: {
    color: 'rgba(255,255,255,0.7)',
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.border,
  },
  statDividerDark: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

