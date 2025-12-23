/**
 * MapboxFlatMap - Premium Vector Map View
 * 
 * Using @rnmapbox/maps for:
 * - Crisp vector tiles at any zoom
 * - Custom dark theme styling
 * - Country highlighting with glow effects
 * - Smooth 60fps native rendering
 * 
 * Features:
 * - Dark theme world map
 * - Highlighted saved countries with neon glow
 * - Pulsing markers for saved places
 * - Pinch/zoom/pan gestures built-in
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, Dimensions, Text, Platform } from 'react-native';
import Mapbox, { 
  MapView, 
  Camera, 
  PointAnnotation,
  ShapeSource,
  FillLayer,
  LineLayer,
  CircleLayer,
  SymbolLayer,
} from '@rnmapbox/maps';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import Constants from 'expo-constants';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Initialize Mapbox with access token
const MAPBOX_TOKEN = Constants.expoConfig?.extra?.mapboxAccessToken || 
                     process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || 
                     '';

// Set access token
Mapbox.setAccessToken(MAPBOX_TOKEN);

// COLOR PALETTE
const COLORS = {
  background: '#0f172a',
  savedGlow: '#3b82f6',       // Bright blue
  selectedGlow: '#ec4899',    // Hot pink
  markerBg: '#1e293b',
  white: '#ffffff',
  neonGlow: '#8B5CF6',
};

// Country center coordinates
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

// Get country emoji
const getCountryEmoji = (country: string): string => {
  const emojis: Record<string, string> = {
    'japan': '🇯🇵',
    'south korea': '🇰🇷',
    'korea': '🇰🇷',
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
    'belgium': '🇧🇪',
    'poland': '🇵🇱',
    'czech republic': '🇨🇿',
    'czechia': '🇨🇿',
    'hungary': '🇭🇺',
    'russia': '🇷🇺',
  };
  return emojis[country.toLowerCase()] || '📍';
};

interface MapboxFlatMapProps {
  onCountryPress: (countryName: string, tripId: string) => void;
  countries: { destination: string; tripId: string }[];
  style?: any;
}

export default function MapboxFlatMap({ onCountryPress, countries, style }: MapboxFlatMapProps) {
  const mapRef = useRef<MapView>(null);
  const cameraRef = useRef<Camera>(null);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(true);
  const [mapReady, setMapReady] = useState(false);

  // Hide hint after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => setShowHint(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  // Handle marker press
  const handleMarkerPress = useCallback((destination: string, tripId: string) => {
    setSelectedCountry(destination);
    
    // Zoom to country
    const coords = COUNTRY_CENTERS[destination.toLowerCase()];
    if (coords && cameraRef.current) {
      cameraRef.current.setCamera({
        centerCoordinate: coords,
        zoomLevel: 5,
        animationDuration: 500,
      });
    }
    
    // Navigate after animation
    setTimeout(() => {
      onCountryPress(destination.toLowerCase(), tripId);
      setSelectedCountry(null);
    }, 600);
  }, [onCountryPress]);

  // Create GeoJSON for markers
  const markersGeoJSON = useMemo(() => {
    const features = countries
      .filter(c => COUNTRY_CENTERS[c.destination.toLowerCase()])
      .map(c => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: COUNTRY_CENTERS[c.destination.toLowerCase()],
        },
        properties: {
          destination: c.destination,
          tripId: c.tripId,
          emoji: getCountryEmoji(c.destination),
        },
      }));
    
    return {
      type: 'FeatureCollection' as const,
      features,
    };
  }, [countries]);

  // Custom dark map style URL
  const mapStyle = 'mapbox://styles/mapbox/dark-v11';

  if (!MAPBOX_TOKEN) {
    return (
      <View style={[styles.container, style]}>
        <LinearGradient
          colors={[COLORS.background, '#1e293b', COLORS.background]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.errorContainer}>
          <Text style={styles.errorEmoji}>🗺️</Text>
          <Text style={styles.errorTitle}>Mapbox Token Required</Text>
          <Text style={styles.errorText}>
            Add MAPBOX_ACCESS_TOKEN to your .env file{'\n'}
            Get a free token at mapbox.com
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <MapView
        ref={mapRef}
        style={styles.map}
        styleURL={mapStyle}
        logoEnabled={false}
        attributionEnabled={false}
        compassEnabled={false}
        scaleBarEnabled={false}
        onDidFinishLoadingMap={() => setMapReady(true)}
      >
        <Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: [0, 20],
            zoomLevel: 1.5,
          }}
          minZoomLevel={1}
          maxZoomLevel={15}
        />
        
        {/* Country markers */}
        {mapReady && countries.map((country, index) => {
          const coords = COUNTRY_CENTERS[country.destination.toLowerCase()];
          if (!coords) return null;
          
          const isSelected = selectedCountry === country.destination;
          
          return (
            <PointAnnotation
              key={`marker-${country.tripId}-${index}`}
              id={`marker-${country.tripId}`}
              coordinate={coords}
              onSelected={() => handleMarkerPress(country.destination, country.tripId)}
            >
              <View style={[
                styles.markerOuter,
                isSelected && styles.markerOuterSelected
              ]}>
                <View style={[
                  styles.markerInner,
                  isSelected && styles.markerInnerSelected
                ]}>
                  <Text style={styles.markerEmoji}>
                    {getCountryEmoji(country.destination)}
                  </Text>
                </View>
              </View>
            </PointAnnotation>
          );
        })}
      </MapView>
      
      {/* Selected Country Label */}
      {selectedCountry && (
        <MotiView
          from={{ opacity: 0, scale: 0.8, translateY: 20 }}
          animate={{ opacity: 1, scale: 1, translateY: 0 }}
          transition={{ type: 'spring', damping: 15 }}
          style={styles.selectedLabel}
        >
          <LinearGradient
            colors={[COLORS.selectedGlow + 'F0', COLORS.savedGlow + 'F0']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.selectedLabelGradient}
          >
            <Text style={styles.selectedLabelText}>{selectedCountry}</Text>
            <Text style={styles.selectedLabelSubtext}>Opening... ✨</Text>
          </LinearGradient>
        </MotiView>
      )}
      
      {/* Country count badge */}
      {countries.length > 0 && !selectedCountry && (
        <MotiView
          from={{ opacity: 0, translateY: -20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'spring', delay: 300 }}
          style={styles.countBadge}
        >
          <LinearGradient
            colors={[COLORS.neonGlow + '30', COLORS.savedGlow + '30']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.countBadgeGradient}
          >
            <Text style={styles.countText}>
              ✨ {countries.length} {countries.length === 1 ? 'country' : 'countries'} saved
            </Text>
          </LinearGradient>
        </MotiView>
      )}
      
      {/* Tap instruction hint */}
      {showHint && !selectedCountry && countries.length > 0 && (
        <MotiView
          from={{ opacity: 0, translateY: 30 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'spring', damping: 15 }}
          style={styles.hintOverlay}
        >
          <MotiView
            from={{ translateY: 0 }}
            animate={{ translateY: [-5, 5, -5] }}
            transition={{ type: 'timing', duration: 2000, loop: true }}
          >
            <LinearGradient
              colors={[COLORS.savedGlow + '30', COLORS.savedGlow + '20']}
              style={styles.hintCard}
            >
              <Text style={styles.hintText}>👆 Tap a flag to explore</Text>
            </LinearGradient>
          </MotiView>
        </MotiView>
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
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorEmoji: {
    fontSize: 64,
    marginBottom: 20,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.white,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    lineHeight: 22,
  },
  markerOuter: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.savedGlow + '40',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.savedGlow,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 15,
    elevation: 8,
  },
  markerOuterSelected: {
    backgroundColor: COLORS.selectedGlow + '60',
    shadowColor: COLORS.selectedGlow,
    transform: [{ scale: 1.2 }],
  },
  markerInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.markerBg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.savedGlow,
  },
  markerInnerSelected: {
    borderColor: COLORS.selectedGlow,
    backgroundColor: COLORS.selectedGlow + '30',
  },
  markerEmoji: {
    fontSize: 22,
  },
  selectedLabel: {
    position: 'absolute',
    top: 120,
    alignSelf: 'center',
    zIndex: 20,
  },
  selectedLabelGradient: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: COLORS.white + '80',
    alignItems: 'center',
  },
  selectedLabelText: {
    color: COLORS.white,
    fontSize: 24,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  selectedLabelSubtext: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  countBadge: {
    position: 'absolute',
    top: 120,
    alignSelf: 'center',
    zIndex: 15,
  },
  countBadgeGradient: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.neonGlow + '50',
  },
  countText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '700',
  },
  hintOverlay: {
    position: 'absolute',
    bottom: 120,
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 15,
  },
  hintCard: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: COLORS.savedGlow + '50',
  },
  hintText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '600',
  },
});

