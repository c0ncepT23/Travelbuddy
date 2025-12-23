/**
 * ZenlyFlatMap - Clean Flat Map View
 * 
 * Native React Native implementation using:
 * - react-native-svg for country paths
 * - d3-geo for map projection
 * - Reanimated for smooth gestures
 * 
 * Features:
 * - All ~195 countries rendered
 * - Lighter colors for visibility
 * - Neon glow for saved countries (NO emojis)
 * - Hot pink selection highlight
 * - Pinch-to-zoom, drag-to-pan
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, StyleSheet, Dimensions, Text, ActivityIndicator } from 'react-native';
import Svg, { Path, G } from 'react-native-svg';
import { geoMercator, geoPath } from 'd3-geo';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import {
  GestureDetector,
  Gesture,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// LIGHTER COLOR PALETTE - Better visibility
const COLORS = {
  background: '#0f172a',         // Dark blue background
  ocean: '#1e293b',              // Ocean/empty areas
  unsavedCountry: '#334155',     // Gray for unsaved countries - LIGHTER
  unsavedBorder: '#475569',      // Border for unsaved - visible
  savedCountry: '#3b82f6',       // Bright blue for saved countries
  savedBorder: '#60a5fa',        // Lighter blue border
  selectedCountry: '#ec4899',    // Hot pink for selected
  selectedBorder: '#f472b6',     // Pink border
  white: '#ffffff',
  neonGlow: '#8B5CF6',           // Purple glow
};

// GeoJSON URL for world countries
const GEOJSON_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

// Country name mappings from GeoJSON names to our keys
const COUNTRY_NAME_MAP: Record<string, string> = {
  'Japan': 'japan',
  'South Korea': 'south korea',
  'Korea': 'south korea',
  'Thailand': 'thailand',
  'Vietnam': 'vietnam',
  'Viet Nam': 'vietnam',
  'Singapore': 'singapore',
  'Indonesia': 'indonesia',
  'Malaysia': 'malaysia',
  'Philippines': 'philippines',
  'India': 'india',
  'China': 'china',
  'Taiwan': 'taiwan',
  'Australia': 'australia',
  'United States of America': 'united states',
  'United States': 'united states',
  'USA': 'usa',
  'Canada': 'canada',
  'Mexico': 'mexico',
  'United Kingdom': 'united kingdom',
  'France': 'france',
  'Italy': 'italy',
  'Spain': 'spain',
  'Germany': 'germany',
  'Netherlands': 'netherlands',
  'Greece': 'greece',
  'Brazil': 'brazil',
  'Argentina': 'argentina',
  'Turkey': 'turkey',
  'Egypt': 'egypt',
  'South Africa': 'south africa',
  'Morocco': 'morocco',
  'Portugal': 'portugal',
  'Switzerland': 'switzerland',
  'Austria': 'austria',
  'New Zealand': 'new zealand',
  'Russia': 'russia',
  'Norway': 'norway',
  'Sweden': 'sweden',
  'Finland': 'finland',
  'Denmark': 'denmark',
  'Ireland': 'ireland',
  'Belgium': 'belgium',
  'Poland': 'poland',
  'Czech Republic': 'czech republic',
  'Czechia': 'czechia',
  'Hungary': 'hungary',
  'Croatia': 'croatia',
  'Iceland': 'iceland',
  'United Arab Emirates': 'uae',
  'Peru': 'peru',
};

interface ZenlyFlatMapProps {
  onCountryPress: (countryName: string, tripId: string) => void;
  countries: { destination: string; tripId: string }[];
  style?: any;
}

export default function ZenlyFlatMap({ onCountryPress, countries, style }: ZenlyFlatMapProps) {
  const [geoData, setGeoData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(true);
  
  // Map transform state
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedScale = useSharedValue(1);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  
  // Get set of saved country keys
  const savedCountryKeys = useMemo(() => {
    return new Set(countries.map(c => c.destination.toLowerCase()));
  }, [countries]);

  // Load GeoJSON data
  useEffect(() => {
    const loadGeoData = async () => {
      try {
        const response = await fetch(GEOJSON_URL);
        const topoJson = await response.json();
        
        // Convert TopoJSON to GeoJSON
        const topojsonClient = require('topojson-client');
        const geojson = topojsonClient.feature(topoJson, topoJson.objects.countries);
        
        setGeoData(geojson.features);
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to load geo data:', error);
        setIsLoading(false);
      }
    };
    
    loadGeoData();
  }, []);

  // Hide hint after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => setShowHint(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  // Create projection - centered better
  const projection = useMemo(() => {
    return geoMercator()
      .scale(SCREEN_WIDTH / 5.5)
      .translate([SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 80])
      .center([0, 25]);
  }, []);

  // Create path generator
  const pathGenerator = useMemo(() => {
    return geoPath().projection(projection);
  }, [projection]);

  // Check if country is saved
  const isCountrySaved = useCallback((countryName: string) => {
    const key = COUNTRY_NAME_MAP[countryName]?.toLowerCase();
    if (key && savedCountryKeys.has(key)) return true;
    
    // Also check direct name match
    if (savedCountryKeys.has(countryName.toLowerCase())) return true;
    
    return false;
  }, [savedCountryKeys]);

  // Get trip ID for country
  const getTripId = useCallback((countryName: string): string | null => {
    const key = COUNTRY_NAME_MAP[countryName]?.toLowerCase() || countryName.toLowerCase();
    const country = countries.find(c => c.destination.toLowerCase() === key);
    return country?.tripId || null;
  }, [countries]);

  // Handle country tap
  const handleCountryTap = useCallback((countryName: string) => {
    const key = COUNTRY_NAME_MAP[countryName]?.toLowerCase() || countryName.toLowerCase();
    const tripId = getTripId(countryName);
    
    if (!tripId) return; // Not a saved country
    
    setSelectedCountry(countryName);
    
    // Navigate after animation
    setTimeout(() => {
      onCountryPress(key, tripId);
      setSelectedCountry(null);
    }, 600);
  }, [getTripId, onCountryPress]);

  // Pinch gesture for zoom
  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      savedScale.value = scale.value;
    })
    .onUpdate((event) => {
      scale.value = Math.min(Math.max(savedScale.value * event.scale, 0.5), 5);
    });

  // Pan gesture for drag
  const panGesture = Gesture.Pan()
    .onStart(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((event) => {
      translateX.value = savedTranslateX.value + event.translationX;
      translateY.value = savedTranslateY.value + event.translationY;
    });

  // Compose gestures
  const composedGesture = Gesture.Simultaneous(pinchGesture, panGesture);

  // Animated style for transform
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
    };
  });

  // Render country path - NO EMOJIS, just country colors
  const renderCountry = useCallback((feature: any, index: number) => {
    const countryName = feature.properties?.name || '';
    const pathD = pathGenerator(feature);
    
    if (!pathD) return null;
    
    const isSaved = isCountrySaved(countryName);
    const isSelected = selectedCountry === countryName;
    
    // Color logic - saved countries are bright, others are dim
    let fillColor = COLORS.unsavedCountry;
    let strokeColor = COLORS.unsavedBorder;
    let strokeWidth = 0.5;
    let opacity = 0.7;
    
    if (isSaved) {
      fillColor = COLORS.savedCountry;
      strokeColor = COLORS.savedBorder;
      strokeWidth = 1.5;
      opacity = 1;
    }
    
    if (isSelected) {
      fillColor = COLORS.selectedCountry;
      strokeColor = COLORS.selectedBorder;
      strokeWidth = 2;
      opacity = 1;
    }
    
    return (
      <Path
        key={`country-${index}`}
        d={pathD}
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        opacity={opacity}
        onPress={() => isSaved && runOnJS(handleCountryTap)(countryName)}
      />
    );
  }, [pathGenerator, isCountrySaved, selectedCountry, handleCountryTap]);

  if (isLoading) {
    return (
      <View style={[styles.container, style]}>
        <LinearGradient
          colors={[COLORS.background, '#1e293b', COLORS.background]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.loadingContainer}>
          <MotiView
            from={{ rotate: '0deg' }}
            animate={{ rotate: '360deg' }}
            transition={{ type: 'timing', duration: 1500, loop: true }}
          >
            <ActivityIndicator size="large" color={COLORS.savedCountry} />
          </MotiView>
          <Text style={styles.loadingText}>Loading Map...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      {/* Gradient background */}
      <LinearGradient
        colors={[COLORS.background, '#1e3a5f', COLORS.background]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      
      {/* Map with gestures */}
      <GestureHandlerRootView style={styles.gestureContainer}>
        <GestureDetector gesture={composedGesture}>
          <Animated.View style={[styles.mapContainer, animatedStyle]}>
            {/* SVG Map */}
            <Svg 
              width={SCREEN_WIDTH} 
              height={SCREEN_HEIGHT}
              style={styles.svg}
            >
              <G>
                {geoData.map((feature, index) => renderCountry(feature, index))}
              </G>
            </Svg>
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
      
      {/* Selected Country Label */}
      {selectedCountry && (
        <MotiView
          from={{ opacity: 0, scale: 0.8, translateY: 20 }}
          animate={{ opacity: 1, scale: 1, translateY: 0 }}
          transition={{ type: 'spring', damping: 15 }}
          style={styles.selectedLabel}
        >
          <LinearGradient
            colors={[COLORS.selectedCountry + 'F0', COLORS.savedCountry + 'F0']}
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
            colors={[COLORS.neonGlow + '30', COLORS.savedCountry + '30']}
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
              colors={[COLORS.savedCountry + '30', COLORS.savedCountry + '20']}
              style={styles.hintCard}
            >
              <Text style={styles.hintText}>👆 Tap a blue country to explore</Text>
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
  gestureContainer: {
    flex: 1,
  },
  mapContainer: {
    flex: 1,
  },
  svg: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
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
    borderColor: COLORS.savedCountry + '50',
  },
  hintText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '600',
  },
});
