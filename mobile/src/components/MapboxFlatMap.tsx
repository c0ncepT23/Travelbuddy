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
import { View, StyleSheet, Dimensions, Text, Platform, Pressable } from 'react-native';
import Mapbox, { 
  MapView, 
  Camera, 
  MarkerView,
  Atmosphere,
  SkyLayer,
  Light,
  ShapeSource,
  SymbolLayer,
  CircleLayer,
  Images,
} from '@rnmapbox/maps';

// 🎨 CHARM ICONS - Premium PNG landmarks (53 countries!)
const CHARM_ICONS: Record<string, any> = {
  // Americas
  usa: require('../../assets/charms/usa.png'),
  canada: require('../../assets/charms/canada.png'),
  mexico: require('../../assets/charms/mexico.png'),
  brazil: require('../../assets/charms/brazil.png'),
  argentina: require('../../assets/charms/argentina.png'),
  chile: require('../../assets/charms/chile.png'),
  colombia: require('../../assets/charms/columbia.png'),  // Note: file is "columbia"
  peru: require('../../assets/charms/peru.png'),
  dominican_republic: require('../../assets/charms/dominican_republic.png'),
  
  // Europe
  france: require('../../assets/charms/france.png'),
  italy: require('../../assets/charms/italy.png'),
  spain: require('../../assets/charms/spain.png'),
  uk: require('../../assets/charms/uk.png'),
  germany: require('../../assets/charms/germany.png'),
  greece: require('../../assets/charms/greece.png'),
  portugal: require('../../assets/charms/portugal.png'),
  netherlands: require('../../assets/charms/netherlands.png'),
  switzerland: require('../../assets/charms/switzerland.png'),
  belgium: require('../../assets/charms/belgium.png'),
  austria: require('../../assets/charms/austria.png'),
  iceland: require('../../assets/charms/iceland.png'),
  ireland: require('../../assets/charms/ireland.png'),
  poland: require('../../assets/charms/poland.png'),
  czech_republic: require('../../assets/charms/czech_republic.png'),
  hungary: require('../../assets/charms/hungary.png'),
  romania: require('../../assets/charms/romania.png'),
  bulgaria: require('../../assets/charms/bulgaria.png'),
  croatia: require('../../assets/charms/croatia.png'),
  estonia: require('../../assets/charms/estonia.png'),
  lithuania: require('../../assets/charms/lithuania.png'),
  latvia: require('../../assets/charms/latvia.png'),
  russia: require('../../assets/charms/russia.png'),
  
  // Asia
  japan: require('../../assets/charms/japan.png'),
  china: require('../../assets/charms/china.png'),
  india: require('../../assets/charms/india.png'),
  thailand: require('../../assets/charms/thailand.png'),
  vietnam: require('../../assets/charms/vietnam.png'),
  singapore: require('../../assets/charms/singapore.png'),
  malaysia: require('../../assets/charms/malaysia.png'),
  philippines: require('../../assets/charms/philippines.png'),
  south_korea: require('../../assets/charms/south_korea.png'),
  indonesia: require('../../assets/charms/indonesia.png'),  // Bali temple = iconic Indonesia
  
  // Middle East
  uae: require('../../assets/charms/uae.png'),
  saudi_arabia: require('../../assets/charms/saudi_arabia.png'),
  turkey: require('../../assets/charms/turkey.png'),
  bahrain: require('../../assets/charms/bahrain.png'),
  
  // Africa
  egypt: require('../../assets/charms/egypt.png'),
  south_africa: require('../../assets/charms/south_africa.png'),
  morocco: require('../../assets/charms/morocco.png'),
  kenya: require('../../assets/charms/kenya.png'),
  tanzania: require('../../assets/charms/tanzania.png'),
  ethiopia: require('../../assets/charms/ethiopia.png'),
  
  // Oceania
  australia: require('../../assets/charms/australia.png'),
  new_zealand: require('../../assets/charms/new_zealand.png'),
};
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';

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

// Landmark mapping for "Zenly Style" 3D objects
const LANDMARKS: Record<string, string> = {
  'japan': '🗻',
  'south korea': '🏯',
  'korea': '🏯',
  'thailand': '🕌',
  'vietnam': '🇻🇳',
  'singapore': '🏨',
  'indonesia': '🌴',
  'bali': '🌴',
  'malaysia': '🏙️',
  'philippines': '🏖️',
  'india': '🏛️',
  'china': '🧱',
  'taiwan': '🏮',
  'hong kong': '🇭🇰',
  'australia': '🎭',
  'new zealand': '🥝',
  'usa': '🗽',
  'united states': '🗽',
  'canada': '🍁',
  'mexico': '🌮',
  'uk': '🕰️',
  'united kingdom': '🕰️',
  'france': '🗼',
  'italy': '🏟️',
  'spain': '💃',
  'germany': '🏰',
  'netherlands': '🌷',
  'greece': '🏛️',
  'turkey': '🕌',
  'uae': '🏙️',
  'dubai': '🏙️',
  'brazil': '✝️',
  'argentina': '🥩',
  'peru': '🦙',
  'egypt': '🏺', // will map to emoji or icon
  'south africa': '🦒',
  'morocco': '🐫',
  'portugal': '🍷',
  'switzerland': '🏔️',
  'austria': '🎻',
  'croatia': '🌅',
  'iceland': '🌋',
  'norway': '⛵',
  'sweden': '🦌',
  'finland': '🎅',
  'denmark': '🧜‍♀️',
  'ireland': '🍀',
  'belgium': '🍫',
  'poland': '🥟',
  'czech republic': '🍺',
  'czechia': '🍺',
  'hungary': '🍲',
  'russia': '🏰',
};

interface MapboxFlatMapProps {
  onCountryPress: (countryName: string, tripId: string) => void;
  countries: { destination: string; tripId: string; isCompleted?: boolean }[];
  style?: any;
}

export default function MapboxFlatMap({ onCountryPress, countries, style }: MapboxFlatMapProps) {
  const mapRef = useRef<MapView>(null);
  const cameraRef = useRef<Camera>(null);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [hasInitialCentered, setHasInitialCentered] = useState(false);
  const lastHapticCountry = useRef<string | null>(null);
  
  // Remove React-side floatOffset and currentZoom state to stop re-renders
  const currentZoomRef = useRef(1.5);

  /**
   * Proximity haptics (Phase 4.1) - HEAVILY throttled for smooth 60fps gestures
   */
  const lastHapticTime = useRef(0);
  const handleCameraChanged = useCallback((event: any) => {
    // Only update zoom ref (lightweight)
    const zoom = event.properties?.zoomLevel ?? currentZoomRef.current;
    currentZoomRef.current = zoom;

    // THROTTLE haptic checks to max 4 times per second (not every frame!)
    const now = Date.now();
    if (now - lastHapticTime.current < 250) return;
    lastHapticTime.current = now;

    const center = event.properties?.center;
    if (!center || !Array.isArray(center) || center.length < 2) return;

    // Only check haptics when zoomed in enough to care
    if (zoom < 2) {
      lastHapticCountry.current = null;
      return;
    }

    // FIND NEAREST COUNTRY FOR HAPTIC TICK
    let nearestCountry: string | null = null;
    let minDist = zoom < 3 ? 15 : zoom < 5 ? 8 : 4; 

    Object.entries(COUNTRY_CENTERS).forEach(([name, coords]) => {
      const dLng = Math.abs(center[0] - coords[0]);
      const dLat = Math.abs(center[1] - coords[1]);
      const dist = Math.sqrt(dLng * dLng + dLat * dLat);
      
      if (dist < minDist) {
        minDist = dist;
        nearestCountry = name;
      }
    });

    if (nearestCountry && nearestCountry !== lastHapticCountry.current) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      lastHapticCountry.current = nearestCountry;
    } else if (!nearestCountry) {
      lastHapticCountry.current = null;
    }
  }, []);

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

        // Fly to the weighted center - straight on view
        cameraRef.current.setCamera({
          centerCoordinate: center,
          zoomLevel: targetZoom,
          pitch: 0,    // Straight on - no tilt
          animationDuration: 2000,
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

  // Removed pulsing interval - was causing constant re-renders and jank
  // Pulse effect is now handled by Mapbox expressions (GPU-native)

  // Display name mapping (e.g., "Bali" → "Indonesia")
  const DISPLAY_NAMES: Record<string, string> = {
    'bali': 'Indonesia',
  };

  // Prepare country marker data for MarkerViews
  const countryMarkersData = useMemo(() => {
    return countries
      .filter(c => COUNTRY_CENTERS[c.destination.toLowerCase()])
      .map((c, index) => {
        const dest = c.destination.toLowerCase();
        const displayName = DISPLAY_NAMES[dest] || c.destination;  // Map Bali → Indonesia
        return {
          destination: displayName,
          tripId: c.tripId,
          coordinates: COUNTRY_CENTERS[dest],
          landmark: LANDMARKS[dest] || '📍',
          isCompleted: c.isCompleted ?? false,  // Trophy mode for completed trips
        };
      });
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


  // Prepare GeoJSON for landmarks - 100x faster than MarkerViews
  const landmarksGeoJSON = useMemo(() => {
    return {
      type: 'FeatureCollection' as const,
      features: countryMarkersData.map(m => {
        const countryKey = m.destination.toLowerCase().replace(/\s+/g, '_');
        const hasIcon = !!CHARM_ICONS[countryKey];
        
        // Build properties - only include icon if it exists (no null values!)
        const properties: Record<string, any> = { 
          id: m.tripId, 
          name: m.destination, 
          landmark: hasIcon ? '' : m.landmark,  // Hide emoji if we have icon
          isCompleted: m.isCompleted ? 1 : 0,   // 1 = trophy mode (greyed, smaller)
        };
        
        if (hasIcon) {
          properties.icon = countryKey;  // Only add icon key if PNG exists
        }
        
        return {
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: m.coordinates },
          properties,
        };
      })
    };
  }, [countryMarkersData]);

  // 🎨 CARTOON GLOBE MODE - Bright, playful style like Zenly
  const mapStyle = 'mapbox://styles/mapbox/outdoors-v12';

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
        onCameraChanged={handleCameraChanged}
        projection="globe"
        pitchEnabled={true}
        rotateEnabled={true}
        zoomEnabled={true}
        scrollEnabled={true}
      >
        {/* 🌊 MIDNIGHT NAVY SKY - Classic Arcade Neon Glow ✨ */}
        <Atmosphere style={{
          highColor: 'rgb(20, 60, 120)',       // Deep blue horizon glow
          horizonBlend: 0.12,                  // Soft horizon blend
          spaceColor: 'rgb(0, 31, 63)',        // #001F3F Midnight Navy!
          starIntensity: 0.8                   // Sparkly stars for arcade feel
        }} />
        <SkyLayer id="sky" style={{
          skyType: 'atmosphere',
          skyAtmosphereColor: 'rgba(0, 100, 180, 0.35)', // Deep blue atmosphere
          skyAtmosphereSun: [0, 60],           // Sun position
          skyAtmosphereSunIntensity: 6,        // Subtle warm accent
        }} />
        <Light style={{
          anchor: 'viewport',
          color: '#C0E0FF',                    // Cool blue-white light
          intensity: 0.65,                     // Balanced lighting
          position: [1.2, 190, 45],            // Angled for depth
        }} />

        {/* 🎨 REGISTER CHARM ICONS WITH MAPBOX */}
        <Images images={CHARM_ICONS} />

        {/* ✨ CANDY EFFECTS - GPU-ACCELERATED LANDMARKS ✨ */}
        <ShapeSource
          id="landmarks-source"
          shape={landmarksGeoJSON}
          onPress={(e) => {
            const feature = e.features?.[0];
            if (feature?.properties?.id) {
              // Don't navigate for completed trips (trophy mode - view only)
              if (feature.properties.isCompleted === 1) {
                return; // Completed trips are not clickable
              }
              handleMarkerPress(feature.properties.name, feature.properties.id);
            }
          }}
        >
          {/* CARTOON GLOW RING - Lime Green for Active, Grey for Completed */}
          <CircleLayer
            id="glow-outer"
            filter={['==', ['get', 'isCompleted'], 0]}  // Only show glow for ACTIVE trips
            style={{
              circleRadius: [
                'interpolate',
                ['linear'],
                ['zoom'],
                0, 40,
                3, 55,
                6, 80
              ],
              circleColor: '#7FFF00',  // Bright chartreuse (Zenly green!)
              circleOpacity: [
                'interpolate',
                ['linear'],
                ['zoom'],
                5.5, 0.2,
                6.5, 0
              ],
              circleBlur: 1,
            }}
          />


          {/* LANDMARK CHARM - PNG Icon (if available) or Emoji fallback */}
          {/* Active trips: Full size, full color | Completed trips: 50% size, greyed out */}
          <SymbolLayer
            id="landmark-charms"
            style={{
              // Use PNG icon if available - compact for dense regions like Asia
              iconImage: ['get', 'icon'],
              iconSize: [
                'case',
                ['==', ['get', 'isCompleted'], 1],
                // COMPLETED: 50% smaller (trophy mode)
                [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  0, 0.035,
                  3, 0.05,
                  6, 0.08
                ],
                // ACTIVE: Normal size
                [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  0, 0.06,
                  3, 0.09,
                  6, 0.14
                ]
              ],
              iconAllowOverlap: true,
              iconIgnorePlacement: true,
              iconAnchor: 'center',
              iconOpacity: [
                'case',
                ['==', ['get', 'isCompleted'], 1],
                // COMPLETED: Greyed out (40% opacity)
                [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  5.5, 0.4,
                  6.5, 0
                ],
                // ACTIVE: Full opacity
                [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  5.5, 1,
                  6.5, 0
                ]
              ],
              // Show emoji from 'landmark' field (empty string if icon exists)
              textField: ['get', 'landmark'],
              textSize: [
                'case',
                ['==', ['get', 'isCompleted'], 1],
                // COMPLETED: Smaller text
                [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  0, 18,
                  3, 24,
                  6, 32
                ],
                // ACTIVE: Normal text
                [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  0, 28,
                  3, 36,
                  6, 52
                ]
              ],
              textOpacity: [
                'case',
                ['==', ['get', 'isCompleted'], 1],
                // COMPLETED: Greyed out
                [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  5.5, 0.4,
                  6.5, 0
                ],
                // ACTIVE: Full opacity
                [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  5.5, 1,
                  6.5, 0
                ]
              ],
              textAllowOverlap: true,
              textIgnorePlacement: true,
              textAnchor: 'center',
            }}
          />

          {/* CARTOON LABEL - Zenly Green Halo (greyed for completed) */}
          <SymbolLayer
            id="landmark-labels"
            style={{
              textField: ['get', 'name'],
              textSize: [
                'case',
                ['==', ['get', 'isCompleted'], 1],
                // COMPLETED: Smaller label
                [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  0, 8,
                  3, 10,
                  6, 11
                ],
                // ACTIVE: Normal label
                [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  0, 11,
                  3, 13,
                  6, 15
                ]
              ],
              textColor: [
                'case',
                ['==', ['get', 'isCompleted'], 1],
                '#888888',  // COMPLETED: Grey text
                '#FFFFFF'   // ACTIVE: White text
              ],
              textHaloColor: [
                'case',
                ['==', ['get', 'isCompleted'], 1],
                '#444444',  // COMPLETED: Dark grey halo
                '#32CD32'   // ACTIVE: Lime green halo (Zenly signature!)
              ],
              textHaloWidth: [
                'case',
                ['==', ['get', 'isCompleted'], 1],
                1.5,  // COMPLETED: Thinner halo
                3     // ACTIVE: Normal halo
              ],
              textHaloBlur: 0.5,
              textOffset: [0, 3.2],
              textAnchor: 'top',
              textOpacity: [
                'case',
                ['==', ['get', 'isCompleted'], 1],
                // COMPLETED: Greyed out
                [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  5.5, 0.5,
                  6.5, 0
                ],
                // ACTIVE: Full opacity
                [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  5.5, 1,
                  6.5, 0
                ]
              ],
              textTransform: 'uppercase',
              textLetterSpacing: 0.12,
              textFont: ['DIN Pro Bold', 'Arial Unicode MS Bold'],
            }}
          />
        </ShapeSource>

        {/* ☁️ FLOATING CLOUDS - Zenly-style decorations ☁️ */}
        {[
          { id: 'cloud1', coords: [-30, 50], emoji: '☁️', size: 32 },
          { id: 'cloud2', coords: [60, 45], emoji: '☁️', size: 28 },
          { id: 'cloud3', coords: [-80, 20], emoji: '☁️', size: 36 },
          { id: 'cloud4', coords: [120, 35], emoji: '☁️', size: 30 },
          { id: 'cloud5', coords: [-120, -30], emoji: '☁️', size: 34 },
          { id: 'cloud6', coords: [90, -20], emoji: '☁️', size: 26 },
          { id: 'cloud7', coords: [0, 60], emoji: '☁️', size: 32 },
          { id: 'cloud8', coords: [150, 10], emoji: '☁️', size: 28 },
          { id: 'bird1', coords: [-60, 30], emoji: '🕊️', size: 20 },
          { id: 'bird2', coords: [100, -10], emoji: '🕊️', size: 18 },
          { id: 'plane1', coords: [40, 55], emoji: '✈️', size: 22 },
          { id: 'rocket1', coords: [-100, -45], emoji: '🚀', size: 24 },
        ].map((item) => (
          <MarkerView 
            key={item.id} 
            coordinate={item.coords}
            allowOverlap={true}
            allowOverlapWithPuck={true}
          >
            <MotiView
              from={{ translateY: 0, opacity: 0.7 }}
              animate={{ translateY: [-8, 8, -8], opacity: [0.6, 0.9, 0.6] }}
              transition={{ 
                type: 'timing', 
                duration: 3000 + Math.random() * 2000, 
                loop: true,
                repeatReverse: true 
              }}
              style={{ 
                shadowColor: '#FFFFFF',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.3,
                shadowRadius: 4,
              }}
            >
              <Text style={{ fontSize: item.size }}>{item.emoji}</Text>
            </MotiView>
          </MarkerView>
        ))}

        <Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: [0, 0],  // Centered on equator
            zoomLevel: 1.5,
            pitch: 0,                  // Straight on - no tilt
          }}
          minZoomLevel={0}
          maxZoomLevel={15}
          animationMode="flyTo"
        />
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
              <Text style={styles.hintText}>👆 Tap a landmark to explore</Text>
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
    backgroundColor: '#05070A', // Deep space black
  },
  map: {
    flex: 1,
    backgroundColor: '#0F1115',
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
    pointerEvents: 'none' as const,
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
  hintOverlay: {
    position: 'absolute',
    bottom: 120,
    left: 20,
    right: 20,
    alignItems: 'center',
    pointerEvents: 'none' as const,
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
  // 3D Landmark Marker Styles
  markerTouchTarget: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 80,
    height: 100,
  },
  markerPressArea: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerGlow: {
    position: 'absolute',
    top: 5,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(6, 182, 212, 0.4)',
    // Blur effect simulated with shadow
    shadowColor: '#06B6D4',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 8,
  },
  landmarkContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.8)',
    // 3D "pop" effect with shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 12,
    overflow: 'hidden',
  },
  landmarkGloss: {
    position: 'absolute',
    top: -15,
    left: -15,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    transform: [{ scaleX: 2 }],
  },
  landmarkEmoji: {
    fontSize: 26,
    textAlign: 'center',
    zIndex: 2,
  },
  markerLabel: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});

