/**
 * ZenlyFlatMap - ZENLY STYLE Flat Map View
 * 
 * Native React Native implementation using:
 * - react-native-svg for country paths
 * - d3-geo for map projection
 * - moti for animations
 * - Gesture handler for pan/zoom
 * 
 * Features:
 * - All ~195 countries rendered
 * - Dark countries (not saved) vs Neon glow (saved)
 * - Hot pink selection with white border
 * - Pulsing emoji markers
 * - Pinch-to-zoom, drag-to-pan
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { View, StyleSheet, Dimensions, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import Svg, { Path, G } from 'react-native-svg';
import { geoMercator, geoPath, GeoProjection } from 'd3-geo';
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
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ZENLY COLOR PALETTE
const COLORS = {
  deepBackground: '#020617',
  darkCountry: '#1a1a2e',
  darkerBorder: '#2a2a3e',
  electricBlue: '#00d4ff',
  neonGreen: '#00ff88',
  hotPink: '#ff0080',
  white: '#ffffff',
  primaryGlow: '#8B5CF6',
};

// GeoJSON URL for world countries
const GEOJSON_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

// Country data with emojis
interface CountryMarkerData {
  name: string;
  key: string;
  coordinates: [number, number]; // [lng, lat]
  emoji: string;
  color: string;
}

const COUNTRY_MARKERS: Record<string, CountryMarkerData> = {
  'japan': { name: 'Japan', key: 'japan', coordinates: [138.2529, 36.2048], emoji: '🍜', color: COLORS.electricBlue },
  'korea': { name: 'South Korea', key: 'korea', coordinates: [127.7669, 35.9078], emoji: '🇰🇷', color: COLORS.hotPink },
  'south korea': { name: 'South Korea', key: 'south korea', coordinates: [127.7669, 35.9078], emoji: '🇰🇷', color: COLORS.hotPink },
  'thailand': { name: 'Thailand', key: 'thailand', coordinates: [100.9925, 15.87], emoji: '🏝️', color: COLORS.neonGreen },
  'vietnam': { name: 'Vietnam', key: 'vietnam', coordinates: [108.2772, 14.0583], emoji: '🍜', color: '#ffd700' },
  'singapore': { name: 'Singapore', key: 'singapore', coordinates: [103.8198, 1.3521], emoji: '🦁', color: COLORS.hotPink },
  'indonesia': { name: 'Indonesia', key: 'indonesia', coordinates: [113.9213, -0.7893], emoji: '🏝️', color: COLORS.neonGreen },
  'bali': { name: 'Bali', key: 'bali', coordinates: [115.0920, -8.3405], emoji: '🌴', color: COLORS.neonGreen },
  'malaysia': { name: 'Malaysia', key: 'malaysia', coordinates: [101.9758, 4.2105], emoji: '🇲🇾', color: COLORS.electricBlue },
  'philippines': { name: 'Philippines', key: 'philippines', coordinates: [121.7740, 12.8797], emoji: '🏝️', color: '#ffd700' },
  'india': { name: 'India', key: 'india', coordinates: [78.9629, 20.5937], emoji: '🇮🇳', color: '#ffd700' },
  'china': { name: 'China', key: 'china', coordinates: [104.1954, 35.8617], emoji: '🇨🇳', color: COLORS.hotPink },
  'taiwan': { name: 'Taiwan', key: 'taiwan', coordinates: [120.9605, 23.6978], emoji: '🧋', color: COLORS.neonGreen },
  'australia': { name: 'Australia', key: 'australia', coordinates: [133.7751, -25.2744], emoji: '🦘', color: '#ffd700' },
  'usa': { name: 'USA', key: 'usa', coordinates: [-95.7129, 37.0902], emoji: '🗽', color: COLORS.electricBlue },
  'united states': { name: 'USA', key: 'united states', coordinates: [-95.7129, 37.0902], emoji: '🗽', color: COLORS.electricBlue },
  'canada': { name: 'Canada', key: 'canada', coordinates: [-106.3468, 56.1304], emoji: '🍁', color: COLORS.hotPink },
  'mexico': { name: 'Mexico', key: 'mexico', coordinates: [-102.5528, 23.6345], emoji: '🌮', color: COLORS.neonGreen },
  'uk': { name: 'UK', key: 'uk', coordinates: [-3.4360, 55.3781], emoji: '🇬🇧', color: COLORS.electricBlue },
  'united kingdom': { name: 'UK', key: 'united kingdom', coordinates: [-3.4360, 55.3781], emoji: '🇬🇧', color: COLORS.electricBlue },
  'france': { name: 'France', key: 'france', coordinates: [2.2137, 46.2276], emoji: '🥐', color: COLORS.hotPink },
  'italy': { name: 'Italy', key: 'italy', coordinates: [12.5674, 41.8719], emoji: '🍕', color: COLORS.neonGreen },
  'spain': { name: 'Spain', key: 'spain', coordinates: [-3.7492, 40.4637], emoji: '💃', color: '#ffd700' },
  'germany': { name: 'Germany', key: 'germany', coordinates: [10.4515, 51.1657], emoji: '🍺', color: '#ffd700' },
  'netherlands': { name: 'Netherlands', key: 'netherlands', coordinates: [5.2913, 52.1326], emoji: '🌷', color: COLORS.hotPink },
  'greece': { name: 'Greece', key: 'greece', coordinates: [21.8243, 39.0742], emoji: '🏛️', color: COLORS.electricBlue },
  'brazil': { name: 'Brazil', key: 'brazil', coordinates: [-51.9253, -14.2350], emoji: '⚽', color: COLORS.neonGreen },
  'argentina': { name: 'Argentina', key: 'argentina', coordinates: [-63.6167, -38.4161], emoji: '🥩', color: COLORS.electricBlue },
};

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
};

interface ZenlyFlatMapProps {
  onCountryPress: (countryName: string, tripId: string) => void;
  countries: { destination: string; tripId: string }[];
  style?: any;
}

// Parse TopoJSON to GeoJSON features
function parseTopoJSON(topoJson: any): any[] {
  const { feature } = require('topojson-client');
  const countries = feature(topoJson, topoJson.objects.countries);
  return countries.features;
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

  // Create projection
  const projection = useMemo(() => {
    return geoMercator()
      .scale(SCREEN_WIDTH / 6)
      .translate([SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 50])
      .center([0, 20]);
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
    }, 800);
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

  // Get marker screen position
  const getMarkerPosition = useCallback((coordinates: [number, number]) => {
    const pos = projection(coordinates);
    return pos ? { x: pos[0], y: pos[1] } : null;
  }, [projection]);

  // Render country path
  const renderCountry = useCallback((feature: any, index: number) => {
    const countryName = feature.properties?.name || '';
    const pathD = pathGenerator(feature);
    
    if (!pathD) return null;
    
    const isSaved = isCountrySaved(countryName);
    const isSelected = selectedCountry === countryName;
    
    const fillColor = isSelected 
      ? COLORS.hotPink 
      : isSaved 
        ? COLORS.electricBlue 
        : COLORS.darkCountry;
    
    const strokeColor = isSaved ? COLORS.white : COLORS.darkerBorder;
    const strokeWidth = isSelected ? 2 : isSaved ? 1 : 0.3;
    
    return (
      <Path
        key={`country-${index}`}
        d={pathD}
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        opacity={isSelected ? 1 : isSaved ? 0.9 : 0.6}
        onPress={() => isSaved && handleCountryTap(countryName)}
      />
    );
  }, [pathGenerator, isCountrySaved, selectedCountry, handleCountryTap]);

  // Render emoji markers
  const renderMarkers = useMemo(() => {
    return countries.map((country, index) => {
      const key = country.destination.toLowerCase();
      const markerData = COUNTRY_MARKERS[key];
      
      if (!markerData) return null;
      
      const pos = getMarkerPosition(markerData.coordinates);
      if (!pos) return null;
      
      const isSelected = selectedCountry === markerData.name;
      
      return (
        <MotiView
          key={`marker-${key}-${index}`}
          from={{ scale: 0, opacity: 0 }}
          animate={{ 
            scale: isSelected ? 1.5 : 1, 
            opacity: 1 
          }}
          transition={{ 
            type: 'spring', 
            damping: 12,
            delay: index * 100,
          }}
          style={[
            styles.markerContainer,
            { 
              left: pos.x - 25,
              top: pos.y - 40,
            }
          ]}
        >
          <TouchableOpacity 
            onPress={() => handleCountryTap(markerData.name)}
            activeOpacity={0.8}
          >
            {/* Pulsing circle */}
            <MotiView
              from={{ scale: 1, opacity: 0.6 }}
              animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0.2, 0.6] }}
              transition={{ 
                type: 'timing', 
                duration: 2000,
                loop: true,
              }}
              style={[styles.pulsingCircle, { backgroundColor: markerData.color + '60' }]}
            />
            
            {/* Expanding ring on selection */}
            {isSelected && (
              <MotiView
                from={{ scale: 1, opacity: 1 }}
                animate={{ scale: 2, opacity: 0 }}
                transition={{ 
                  type: 'timing', 
                  duration: 800,
                  loop: true,
                }}
                style={[styles.expandingRing, { borderColor: markerData.color }]}
              />
            )}
            
            {/* Emoji */}
            <View style={[styles.emojiContainer, { shadowColor: markerData.color }]}>
              <Text style={styles.emojiText}>{markerData.emoji}</Text>
            </View>
          </TouchableOpacity>
        </MotiView>
      );
    });
  }, [countries, getMarkerPosition, selectedCountry, handleCountryTap]);

  if (isLoading) {
    return (
      <View style={[styles.container, style]}>
        <LinearGradient
          colors={[COLORS.deepBackground, '#0a1628', COLORS.deepBackground]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.loadingContainer}>
          <MotiView
            from={{ rotate: '0deg' }}
            animate={{ rotate: '360deg' }}
            transition={{ type: 'timing', duration: 1500, loop: true }}
          >
            <ActivityIndicator size="large" color={COLORS.electricBlue} />
          </MotiView>
          <Text style={styles.loadingText}>Loading Map...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      {/* Dark gradient background */}
      <LinearGradient
        colors={[COLORS.deepBackground, '#0a1628', COLORS.deepBackground]}
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
      
      {/* Emoji Markers Overlay */}
      <Animated.View style={[styles.markersOverlay, animatedStyle]} pointerEvents="box-none">
        {renderMarkers}
      </Animated.View>
      
      {/* Selected Country Label */}
      {selectedCountry && (
        <MotiView
          from={{ opacity: 0, scale: 0.8, translateY: 20 }}
          animate={{ opacity: 1, scale: 1, translateY: 0 }}
          transition={{ type: 'spring', damping: 15 }}
          style={styles.selectedLabel}
        >
          <LinearGradient
            colors={[COLORS.hotPink + 'F0', COLORS.neonGreen + 'F0']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.selectedLabelGradient}
          >
            <Text style={styles.selectedLabelText}>{selectedCountry}</Text>
            <Text style={styles.selectedLabelSubtext}>Loading... ✨</Text>
          </LinearGradient>
        </MotiView>
      )}
      
      {/* Country count badge */}
      {countries.length > 0 && (
        <MotiView
          from={{ opacity: 0, translateY: -20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'spring', delay: 300 }}
          style={styles.countBadge}
        >
          <LinearGradient
            colors={[COLORS.primaryGlow + '30', COLORS.electricBlue + '30']}
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
      {showHint && !selectedCountry && (
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
              colors={[COLORS.electricBlue + '30', COLORS.electricBlue + '20']}
              style={styles.hintCard}
            >
              <Text style={styles.hintText}>👆 Tap a country to explore</Text>
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
    backgroundColor: COLORS.deepBackground,
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
  markersOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
  },
  markerContainer: {
    position: 'absolute',
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulsingCircle: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    left: 5,
    top: 5,
  },
  expandingRing: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 3,
    backgroundColor: 'transparent',
  },
  emojiContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 15,
    elevation: 8,
  },
  emojiText: {
    fontSize: 22,
  },
  selectedLabel: {
    position: 'absolute',
    top: 100,
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
    top: 100,
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
    bottom: 100,
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
    borderColor: COLORS.electricBlue + '50',
  },
  hintText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '600',
  },
});

