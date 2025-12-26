/**
 * MapboxFlatMap - Premium Vector Map View
 * 
 * Using @rnmapbox/maps for:
 * - Crisp vector tiles at any zoom
 * - Custom vibrant theme styling
 * - Country highlighting with glow effects
 * - Smooth 60fps native rendering
 * 
 * Features:
 * - Vibrant colorful world map
 * - Pulsing glow on saved countries
 * - Neon border strokes
 * - Pinch/zoom/pan gestures built-in
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, Dimensions, Text, Platform, TouchableOpacity } from 'react-native';
import Mapbox, { 
  MapView, 
  Camera, 
  ShapeSource,
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

// VIBRANT COLOR PALETTE - Matching Midnight Discovery theme
const COLORS = {
  // Base colors
  background: '#0F1115',        // Deep Midnight Slate
  oceanDark: '#0B0D11',         // Darker Ocean
  oceanLight: '#17191F',        // Lighter Ocean / Surface
  
  // Land colors
  landBase: '#1E293B',          // Muted land
  landHighlight: '#334155',     // Lighter land on hover
  
  // Accent colors (Matching Cyan/Discovery theme)
  primaryGlow: '#06B6D4',       // Electric Cyan
  secondaryGlow: '#22D3EE',     // Lighter Cyan
  accentPink: '#ec4899',        // Hot pink
  accentGreen: '#22c55e',       // Neon green
  
  // Saved country colors
  savedFill: '#06B6D4',         // Cyan fill for saved
  savedBorder: '#22D3EE',       // Lighter Cyan border
  savedGlow: '#06B6D4',         // Cyan Glow
  
  // Selected state
  selectedFill: '#ec4899',      // Pink when selected
  selectedBorder: '#f472b6',    // Lighter pink border
  
  // Text
  white: '#ffffff',
  textMuted: 'rgba(255,255,255,0.7)',
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

// Country name to ISO code mapping for Mapbox filtering
const COUNTRY_ISO_CODES: Record<string, string> = {
  'japan': 'JP',
  'south korea': 'KR',
  'korea': 'KR',
  'thailand': 'TH',
  'vietnam': 'VN',
  'singapore': 'SG',
  'indonesia': 'ID',
  'bali': 'ID',
  'malaysia': 'MY',
  'philippines': 'PH',
  'india': 'IN',
  'china': 'CN',
  'taiwan': 'TW',
  'hong kong': 'HK',
  'australia': 'AU',
  'new zealand': 'NZ',
  'usa': 'US',
  'united states': 'US',
  'canada': 'CA',
  'mexico': 'MX',
  'uk': 'GB',
  'united kingdom': 'GB',
  'france': 'FR',
  'italy': 'IT',
  'spain': 'ES',
  'germany': 'DE',
  'netherlands': 'NL',
  'greece': 'GR',
  'turkey': 'TR',
  'uae': 'AE',
  'dubai': 'AE',
  'brazil': 'BR',
  'argentina': 'AR',
  'peru': 'PE',
  'egypt': 'EG',
  'south africa': 'ZA',
  'morocco': 'MA',
  'portugal': 'PT',
  'switzerland': 'CH',
  'austria': 'AT',
  'croatia': 'HR',
  'iceland': 'IS',
  'norway': 'NO',
  'sweden': 'SE',
  'finland': 'FI',
  'denmark': 'DK',
  'ireland': 'IE',
  'belgium': 'BE',
  'poland': 'PL',
  'czech republic': 'CZ',
  'czechia': 'CZ',
  'hungary': 'HU',
  'russia': 'RU',
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
  const [pulseOpacity, setPulseOpacity] = useState(0.6);
  const [hasInitialCentered, setHasInitialCentered] = useState(false);

  // Smart Initial Centering
  useEffect(() => {
    if (mapReady && countries.length > 0 && !hasInitialCentered && cameraRef.current) {
      // Calculate weighted average center (where MOST places are)
      let totalLng = 0;
      let totalLat = 0;
      let count = 0;
      const uniqueCountryNames = new Set<string>();

      countries.forEach(c => {
        const destination = c.destination.toLowerCase();
        const coords = COUNTRY_CENTERS[destination];
        if (coords) {
          totalLng += coords[0];
          totalLat += coords[1];
          count++;
          uniqueCountryNames.add(destination);
        }
      });

      if (count > 0) {
        const center: [number, number] = [totalLng / count, totalLat / count];
        
        // Determine zoom: 
        // - If only 1 unique country: Zoom in quite a bit (zoom 4)
        // - If 2-3 unique countries: Zoom in moderately (zoom 2.5)
        // - If many unique countries: Keep it wide (zoom 1.5)
        let targetZoom = 1.5;
        if (uniqueCountryNames.size === 1) targetZoom = 4;
        else if (uniqueCountryNames.size <= 3) targetZoom = 2.5;

        // Fly to the weighted center
        cameraRef.current.setCamera({
          centerCoordinate: center,
          zoomLevel: targetZoom,
          animationDuration: 2000, // Smooth 2s fly-in for "Premium" feel
        });
        
        setHasInitialCentered(true);
      }
    }
  }, [mapReady, countries, hasInitialCentered]);

  // Hide hint after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => setShowHint(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  // Pulsing animation for saved countries
  useEffect(() => {
    const pulseInterval = setInterval(() => {
      setPulseOpacity(prev => prev === 0.6 ? 0.8 : 0.6);
    }, 1500);
    return () => clearInterval(pulseInterval);
  }, []);

  // Create GeoJSON for country markers
  const markersGeoJSON = useMemo(() => {
    const features = countries
      .filter(c => COUNTRY_CENTERS[c.destination.toLowerCase()])
      .map((c, index) => ({
        type: 'Feature' as const,
        id: index,
        geometry: {
          type: 'Point' as const,
          coordinates: COUNTRY_CENTERS[c.destination.toLowerCase()],
        },
        properties: {
          destination: c.destination,
          tripId: c.tripId,
          index: index,
        },
      }));
    
    return {
      type: 'FeatureCollection' as const,
      features,
    };
  }, [countries]);

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

  // Handle shape source press
  const handleShapePress = useCallback((event: any) => {
    if (event.features && event.features.length > 0) {
      const feature = event.features[0];
      const { destination, tripId } = feature.properties;
      handleMarkerPress(destination, tripId);
    }
  }, [handleMarkerPress]);

  // Use navigation-night style for more colorful appearance
  // Options: dark-v11, navigation-night-v1, satellite-streets-v12
  const mapStyle = 'mapbox://styles/mapbox/navigation-night-v1';

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
      {/* Gradient overlay at top for depth */}
      <LinearGradient
        colors={['rgba(6, 182, 212, 0.15)', 'transparent']}
        style={styles.topGradient}
        pointerEvents="none"
      />
      
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
            centerCoordinate: [0, 0],
            zoomLevel: 1,
          }}
          minZoomLevel={1}
          maxZoomLevel={15}
        />
        
        {/* Glowing circle markers for saved countries */}
        {mapReady && countries.length > 0 && (
          <ShapeSource
            id="markers-source"
            shape={markersGeoJSON as any}
            onPress={handleShapePress}
          >
            {/* Outer glow - largest, most transparent */}
            <CircleLayer
              id="marker-glow-outer"
              style={{
                circleRadius: 35,
                circleColor: COLORS.primaryGlow,
                circleOpacity: pulseOpacity * 0.15,
                circleBlur: 1,
              }}
            />
            
            {/* Middle glow */}
            <CircleLayer
              id="marker-glow-middle"
              style={{
                circleRadius: 25,
                circleColor: COLORS.primaryGlow,
                circleOpacity: pulseOpacity * 0.3,
                circleBlur: 0.5,
              }}
            />
            
            {/* Inner glow */}
            <CircleLayer
              id="marker-glow-inner"
              style={{
                circleRadius: 18,
                circleColor: COLORS.savedFill,
                circleOpacity: pulseOpacity * 0.6,
              }}
            />
            
            {/* Core circle - solid */}
            <CircleLayer
              id="marker-core"
              style={{
                circleRadius: 12,
                circleColor: COLORS.primaryGlow,
                circleOpacity: 1,
                circleStrokeWidth: 2,
                circleStrokeColor: COLORS.savedGlow,
              }}
            />
            
            {/* Center dot */}
            <CircleLayer
              id="marker-center"
              style={{
                circleRadius: 4,
                circleColor: COLORS.white,
                circleOpacity: 1,
              }}
            />
          </ShapeSource>
        )}
      </MapView>
      
      {/* Bottom gradient for depth */}
      <LinearGradient
        colors={['transparent', 'rgba(15, 17, 21, 0.8)']}
        style={styles.bottomGradient}
        pointerEvents="none"
      />
      
      {/* Selected Country Label */}
      {selectedCountry && (
        <MotiView
          from={{ opacity: 0, scale: 0.8, translateY: 20 }}
          animate={{ opacity: 1, scale: 1, translateY: 0 }}
          transition={{ type: 'spring', damping: 15 }}
          style={styles.selectedLabel}
        >
          <LinearGradient
            colors={[COLORS.selectedFill + 'F0', COLORS.primaryGlow + 'F0']}
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
            colors={[COLORS.primaryGlow + '30', COLORS.secondaryGlow + '30']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.countBadgeGradient}
          >
            <Text style={styles.countText}>
              ✨ {countries.length} {countries.length === 1 ? 'destination' : 'destinations'} saved
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
              colors={[COLORS.primaryGlow + '40', COLORS.primaryGlow + '20']}
              style={styles.hintCard}
            >
              <Text style={styles.hintText}>👆 Tap a glowing marker to explore</Text>
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
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 150,
    zIndex: 5,
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 200,
    zIndex: 5,
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
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 22,
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
    borderColor: COLORS.primaryGlow + '50',
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
    borderColor: COLORS.primaryGlow + '50',
  },
  hintText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '600',
  },
});

