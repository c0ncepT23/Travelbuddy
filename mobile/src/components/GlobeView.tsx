/**
 * GlobeView - ZENLY STYLE 3D Globe
 * 
 * Features:
 * - Dark cosmic background with gradient
 * - Neon wireframe globe with grid lines
 * - Pulsing neon ring markers for saved countries
 * - Silky smooth 1:1 drag rotation with lerp
 * - Floating emoji pins above markers
 * - Glassmorphic UI elements
 */

import React, { useRef, useState, useEffect, useMemo, Suspense } from 'react';
import { View, StyleSheet, Dimensions, Text } from 'react-native';
import { Canvas, useFrame, useThree } from '@react-three/fiber/native';
import * as THREE from 'three';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ZENLY COLOR PALETTE
const COLORS = {
  neonPink: '#ff0080',
  electricBlue: '#00d4ff',
  neonGreen: '#00ff88',
  brightYellow: '#ffff00',
  gold: '#ffd700',
  cosmicBlack: '#0a0a1f',
  deepPurple: '#1a0a2e',
  darkNavy: '#1a1a2e',
};

// Country data with neon colors
interface CountryData {
  lat: number;
  lng: number;
  name: string;
  flag: string;
  color: string;
}

const COUNTRY_POSITIONS: Record<string, CountryData> = {
  'japan': { lat: 36.2048, lng: 138.2529, name: 'Japan', flag: '🍜', color: COLORS.electricBlue },
  'korea': { lat: 35.9078, lng: 127.7669, name: 'South Korea', flag: '🇰🇷', color: COLORS.neonPink },
  'south korea': { lat: 35.9078, lng: 127.7669, name: 'South Korea', flag: '🇰🇷', color: COLORS.neonPink },
  'thailand': { lat: 15.8700, lng: 100.9925, name: 'Thailand', flag: '🏝️', color: COLORS.neonGreen },
  'vietnam': { lat: 14.0583, lng: 108.2772, name: 'Vietnam', flag: '🍜', color: COLORS.brightYellow },
  'singapore': { lat: 1.3521, lng: 103.8198, name: 'Singapore', flag: '🦁', color: COLORS.neonPink },
  'indonesia': { lat: -0.7893, lng: 113.9213, name: 'Indonesia', flag: '🏝️', color: COLORS.neonGreen },
  'bali': { lat: -8.3405, lng: 115.0920, name: 'Bali', flag: '🌴', color: COLORS.neonGreen },
  'malaysia': { lat: 4.2105, lng: 101.9758, name: 'Malaysia', flag: '🇲🇾', color: COLORS.electricBlue },
  'philippines': { lat: 12.8797, lng: 121.7740, name: 'Philippines', flag: '🏝️', color: COLORS.brightYellow },
  'india': { lat: 20.5937, lng: 78.9629, name: 'India', flag: '🇮🇳', color: COLORS.gold },
  'china': { lat: 35.8617, lng: 104.1954, name: 'China', flag: '🇨🇳', color: COLORS.neonPink },
  'taiwan': { lat: 23.6978, lng: 120.9605, name: 'Taiwan', flag: '🧋', color: COLORS.neonGreen },
  'hong kong': { lat: 22.3193, lng: 114.1694, name: 'Hong Kong', flag: '🏙️', color: COLORS.neonPink },
  'australia': { lat: -25.2744, lng: 133.7751, name: 'Australia', flag: '🦘', color: COLORS.gold },
  'new zealand': { lat: -40.9006, lng: 174.8860, name: 'New Zealand', flag: '🥝', color: COLORS.neonGreen },
  'usa': { lat: 37.0902, lng: -95.7129, name: 'USA', flag: '🗽', color: COLORS.electricBlue },
  'united states': { lat: 37.0902, lng: -95.7129, name: 'USA', flag: '🗽', color: COLORS.electricBlue },
  'canada': { lat: 56.1304, lng: -106.3468, name: 'Canada', flag: '🍁', color: COLORS.neonPink },
  'mexico': { lat: 23.6345, lng: -102.5528, name: 'Mexico', flag: '🌮', color: COLORS.neonGreen },
  'uk': { lat: 55.3781, lng: -3.4360, name: 'UK', flag: '🇬🇧', color: COLORS.electricBlue },
  'united kingdom': { lat: 55.3781, lng: -3.4360, name: 'UK', flag: '🇬🇧', color: COLORS.electricBlue },
  'france': { lat: 46.2276, lng: 2.2137, name: 'France', flag: '🥐', color: COLORS.neonPink },
  'italy': { lat: 41.8719, lng: 12.5674, name: 'Italy', flag: '🍕', color: COLORS.neonGreen },
  'spain': { lat: 40.4637, lng: -3.7492, name: 'Spain', flag: '💃', color: COLORS.gold },
  'germany': { lat: 51.1657, lng: 10.4515, name: 'Germany', flag: '🍺', color: COLORS.brightYellow },
  'netherlands': { lat: 52.1326, lng: 5.2913, name: 'Netherlands', flag: '🌷', color: COLORS.neonPink },
  'greece': { lat: 39.0742, lng: 21.8243, name: 'Greece', flag: '🏛️', color: COLORS.electricBlue },
  'turkey': { lat: 38.9637, lng: 35.2433, name: 'Turkey', flag: '🧿', color: COLORS.neonPink },
  'uae': { lat: 23.4241, lng: 53.8478, name: 'UAE', flag: '🏜️', color: COLORS.gold },
  'dubai': { lat: 25.2048, lng: 55.2708, name: 'Dubai', flag: '🌃', color: COLORS.gold },
  'brazil': { lat: -14.2350, lng: -51.9253, name: 'Brazil', flag: '⚽', color: COLORS.neonGreen },
  'argentina': { lat: -38.4161, lng: -63.6167, name: 'Argentina', flag: '🥩', color: COLORS.electricBlue },
  'peru': { lat: -9.1900, lng: -75.0152, name: 'Peru', flag: '🦙', color: COLORS.gold },
  'egypt': { lat: 26.8206, lng: 30.8025, name: 'Egypt', flag: '🏛️', color: COLORS.gold },
  'south africa': { lat: -30.5595, lng: 22.9375, name: 'South Africa', flag: '🦁', color: COLORS.neonGreen },
  'morocco': { lat: 31.7917, lng: -7.0926, name: 'Morocco', flag: '🏜️', color: COLORS.neonPink },
  'portugal': { lat: 39.3999, lng: -8.2245, name: 'Portugal', flag: '🏄', color: COLORS.electricBlue },
  'switzerland': { lat: 46.8182, lng: 8.2275, name: 'Switzerland', flag: '⛷️', color: COLORS.neonPink },
  'austria': { lat: 47.5162, lng: 14.5501, name: 'Austria', flag: '🎿', color: COLORS.neonGreen },
  'croatia': { lat: 45.1, lng: 15.2, name: 'Croatia', flag: '🏖️', color: COLORS.electricBlue },
  'iceland': { lat: 64.9631, lng: -19.0208, name: 'Iceland', flag: '🌋', color: COLORS.electricBlue },
  'norway': { lat: 60.4720, lng: 8.4689, name: 'Norway', flag: '🎿', color: COLORS.electricBlue },
  'sweden': { lat: 60.1282, lng: 18.6435, name: 'Sweden', flag: '🇸🇪', color: COLORS.brightYellow },
  'finland': { lat: 61.9241, lng: 25.7482, name: 'Finland', flag: '🎅', color: COLORS.electricBlue },
  'denmark': { lat: 56.2639, lng: 9.5018, name: 'Denmark', flag: '🇩🇰', color: COLORS.neonPink },
  'ireland': { lat: 53.4129, lng: -8.2439, name: 'Ireland', flag: '☘️', color: COLORS.neonGreen },
  'belgium': { lat: 50.5039, lng: 4.4699, name: 'Belgium', flag: '🍫', color: COLORS.gold },
  'czech republic': { lat: 49.8175, lng: 15.4730, name: 'Czechia', flag: '🍺', color: COLORS.gold },
  'czechia': { lat: 49.8175, lng: 15.4730, name: 'Czechia', flag: '🍺', color: COLORS.gold },
  'poland': { lat: 51.9194, lng: 19.1451, name: 'Poland', flag: '🇵🇱', color: COLORS.neonPink },
  'hungary': { lat: 47.1625, lng: 19.5033, name: 'Hungary', flag: '🇭🇺', color: COLORS.neonGreen },
  'russia': { lat: 61.5240, lng: 105.3188, name: 'Russia', flag: '🇷🇺', color: COLORS.electricBlue },
};

// Convert lat/lng to 3D position on sphere
function latLngToVector3(lat: number, lng: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const y = radius * Math.cos(phi);
  const z = radius * Math.sin(phi) * Math.sin(theta);
  
  return new THREE.Vector3(x, y, z);
}

// Simple lerp for silky smooth rotation
function lerp(start: number, end: number, factor: number): number {
  return start + (end - start) * factor;
}

// Neon Ring Marker - Zenly style pulsing rings
interface NeonMarkerProps {
  position: THREE.Vector3;
  color: string;
  onClick: () => void;
}

function NeonRingMarker({ position, color, onClick }: NeonMarkerProps) {
  const groupRef = useRef<THREE.Group>(null);
  const ring1Ref = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);
  const ring3Ref = useRef<THREE.Mesh>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    const time = state.clock.elapsedTime;
    
    // Pulsing core
    if (coreRef.current) {
      const scale = 1.0 + Math.sin(time * 4) * 0.3;
      coreRef.current.scale.setScalar(scale);
    }
    
    // Expanding rings (staggered)
    if (ring1Ref.current) {
      const scale1 = 1.0 + (time * 0.5 % 2);
      const opacity1 = Math.max(0, 1 - (time * 0.5 % 2) / 2);
      ring1Ref.current.scale.setScalar(scale1);
      (ring1Ref.current.material as THREE.MeshBasicMaterial).opacity = opacity1;
    }
    if (ring2Ref.current) {
      const scale2 = 1.0 + ((time * 0.5 + 0.66) % 2);
      const opacity2 = Math.max(0, 1 - ((time * 0.5 + 0.66) % 2) / 2);
      ring2Ref.current.scale.setScalar(scale2);
      (ring2Ref.current.material as THREE.MeshBasicMaterial).opacity = opacity2;
    }
    if (ring3Ref.current) {
      const scale3 = 1.0 + ((time * 0.5 + 1.33) % 2);
      const opacity3 = Math.max(0, 1 - ((time * 0.5 + 1.33) % 2) / 2);
      ring3Ref.current.scale.setScalar(scale3);
      (ring3Ref.current.material as THREE.MeshBasicMaterial).opacity = opacity3;
    }
  });

  const ringColor = new THREE.Color(color);

  return (
    <group 
      ref={groupRef} 
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {/* Expanding ring 1 */}
      <mesh ref={ring1Ref} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.03, 0.035, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.8} side={THREE.DoubleSide} />
      </mesh>
      
      {/* Expanding ring 2 */}
      <mesh ref={ring2Ref} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.03, 0.035, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>
      
      {/* Expanding ring 3 */}
      <mesh ref={ring3Ref} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.03, 0.035, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.4} side={THREE.DoubleSide} />
      </mesh>
      
      {/* Glowing core */}
      <mesh ref={coreRef}>
        <sphereGeometry args={[0.02, 16, 16]} />
        <meshBasicMaterial color={color} />
      </mesh>
      
      {/* Outer glow */}
      <mesh>
        <sphereGeometry args={[0.04, 16, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.2} />
      </mesh>
      
      {/* Point light for glow */}
      <pointLight color={color} intensity={0.8} distance={0.4} />
    </group>
  );
}

// Neon Wireframe Globe - Zenly style
function NeonGlobe() {
  const wireframeRef = useRef<THREE.LineSegments>(null);
  const innerGlobeRef = useRef<THREE.Mesh>(null);
  
  // Create wireframe geometry
  const wireframeGeometry = useMemo(() => {
    const geo = new THREE.IcosahedronGeometry(1, 2);
    const wireGeo = new THREE.WireframeGeometry(geo);
    return wireGeo;
  }, []);
  
  useFrame((state) => {
    // Subtle pulse on the inner globe
    if (innerGlobeRef.current) {
      const scale = 0.98 + Math.sin(state.clock.elapsedTime * 0.5) * 0.01;
      innerGlobeRef.current.scale.setScalar(scale);
    }
  });

  return (
    <group>
      {/* Dark inner sphere */}
      <mesh ref={innerGlobeRef}>
        <sphereGeometry args={[0.97, 64, 64]} />
        <meshBasicMaterial color="#0a0a1f" />
      </mesh>
      
      {/* Neon wireframe - Electric Blue */}
      <lineSegments geometry={wireframeGeometry}>
        <lineBasicMaterial color={COLORS.electricBlue} transparent opacity={0.4} />
      </lineSegments>
      
      {/* Latitude lines */}
      {[-60, -30, 0, 30, 60].map((lat, i) => (
        <mesh key={`lat-${i}`} rotation={[Math.PI / 2, 0, 0]} position={[0, Math.sin(lat * Math.PI / 180), 0]}>
          <ringGeometry args={[Math.cos(lat * Math.PI / 180) * 0.99, Math.cos(lat * Math.PI / 180) * 0.995, 64]} />
          <meshBasicMaterial color={COLORS.neonPink} transparent opacity={0.3} side={THREE.DoubleSide} />
        </mesh>
      ))}
      
      {/* Equator - brighter */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.99, 1.0, 64]} />
        <meshBasicMaterial color={COLORS.neonPink} transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>
      
      {/* Outer glow atmosphere */}
      <mesh>
        <sphereGeometry args={[1.05, 64, 64]} />
        <meshBasicMaterial color={COLORS.electricBlue} transparent opacity={0.05} side={THREE.BackSide} />
      </mesh>
    </group>
  );
}

// Earth Component with Zenly style
interface EarthProps {
  onCountryClick?: (country: string, tripId: string) => void;
  highlightedCountries: { destination: string; tripId: string }[];
}

function Earth({ onCountryClick, highlightedCountries }: EarthProps) {
  const earthRef = useRef<THREE.Group>(null);
  const targetRotation = useRef({ x: 0, y: 0 });
  const currentRotation = useRef({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const lastPointer = useRef({ x: 0, y: 0 });
  
  // SILKY SMOOTH rotation with lerp
  useFrame(() => {
    if (earthRef.current) {
      // Auto-rotate when not dragging
      if (!isDragging.current) {
        targetRotation.current.y += 0.003;
      }
      
      // Smooth lerp to target rotation
      currentRotation.current.x = lerp(currentRotation.current.x, targetRotation.current.x, 0.08);
      currentRotation.current.y = lerp(currentRotation.current.y, targetRotation.current.y, 0.08);
      
      earthRef.current.rotation.x = currentRotation.current.x;
      earthRef.current.rotation.y = currentRotation.current.y;
    }
  });

  const handlePointerDown = (e: any) => {
    e.stopPropagation();
    isDragging.current = true;
    lastPointer.current = { x: e.clientX || 0, y: e.clientY || 0 };
  };

  const handlePointerUp = () => {
    isDragging.current = false;
  };

  const handlePointerMove = (e: any) => {
    if (isDragging.current) {
      const x = e.clientX || 0;
      const y = e.clientY || 0;
      
      const deltaX = (x - lastPointer.current.x) * 0.01;
      const deltaY = (y - lastPointer.current.y) * 0.01;
      
      targetRotation.current.y += deltaX;
      targetRotation.current.x += deltaY;
      
      // Clamp vertical rotation
      targetRotation.current.x = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, targetRotation.current.x));
      
      lastPointer.current = { x, y };
    }
  };

  // Get marker data for highlighted countries
  const markers = useMemo(() => {
    return highlightedCountries.map(({ destination, tripId }) => {
      const key = destination.toLowerCase();
      const data = COUNTRY_POSITIONS[key];
      if (data) {
        return {
          position: latLngToVector3(data.lat, data.lng, 1.02),
          destination,
          tripId,
          name: data.name,
          flag: data.flag,
          color: data.color,
        };
      }
      return null;
    }).filter(Boolean);
  }, [highlightedCountries]);

  return (
    <group 
      ref={earthRef}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerUp}
    >
      {/* Neon wireframe globe */}
      <NeonGlobe />
      
      {/* Country markers with neon rings */}
      {markers.map((marker, index) => marker && (
        <NeonRingMarker
          key={`${marker.destination}-${index}`}
          position={marker.position}
          color={marker.color}
          onClick={() => onCountryClick?.(marker.destination, marker.tripId)}
        />
      ))}
    </group>
  );
}

// Camera controller
function CameraController() {
  const { camera } = useThree();
  
  useEffect(() => {
    camera.position.set(0, 0, 2.8);
    camera.lookAt(0, 0, 0);
  }, [camera]);
  
  return null;
}

// Loading fallback - Zenly style spinner
function LoadingFallback() {
  const ringRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (ringRef.current) {
      ringRef.current.rotation.z = state.clock.elapsedTime * 2;
    }
  });
  
  return (
    <mesh ref={ringRef}>
      <torusGeometry args={[0.5, 0.05, 16, 32, Math.PI * 1.5]} />
      <meshBasicMaterial color={COLORS.electricBlue} />
    </mesh>
  );
}

// Main GlobeView component
interface GlobeViewProps {
  onCountryPress: (countryName: string, tripId: string) => void;
  countries: { destination: string; tripId: string }[];
  style?: any;
}

export default function GlobeView({ onCountryPress, countries, style }: GlobeViewProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [showHint, setShowHint] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowHint(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={[styles.container, style]}>
      {/* Dark cosmic gradient background */}
      <LinearGradient
        colors={[COLORS.cosmicBlack, COLORS.deepPurple, COLORS.cosmicBlack]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      
      {/* Loading overlay - Zenly glassmorphic style */}
      {isLoading && (
        <MotiView
          from={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          style={styles.loadingContainer}
        >
          <MotiView
            from={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 15 }}
            style={styles.loadingCard}
          >
            <MotiView
              from={{ rotate: '0deg' }}
              animate={{ rotate: '360deg' }}
              transition={{ type: 'timing', duration: 2000, loop: true }}
              style={styles.loadingSpinner}
            >
              <View style={[styles.spinnerArc, { borderTopColor: COLORS.neonPink }]} />
              <View style={[styles.spinnerArc, styles.spinnerArc2, { borderTopColor: COLORS.electricBlue }]} />
            </MotiView>
            <Text style={styles.loadingText}>Loading Globe...</Text>
          </MotiView>
        </MotiView>
      )}
      
      {/* 3D Canvas */}
      <Canvas
        style={styles.canvas}
        gl={{ antialias: true }}
        onCreated={() => setIsLoading(false)}
      >
        <CameraController />
        
        {/* Minimal ambient lighting */}
        <ambientLight intensity={0.5} />
        
        {/* Earth */}
        <Suspense fallback={<LoadingFallback />}>
          <Earth 
            onCountryClick={onCountryPress}
            highlightedCountries={countries}
          />
        </Suspense>
      </Canvas>
      
      {/* Country count badge - Zenly glassmorphic */}
      {countries.length > 0 && (
        <MotiView
          from={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', delay: 500 }}
          style={styles.countBadge}
        >
          <Text style={styles.countText}>
            ✨ {countries.length} {countries.length === 1 ? 'country' : 'countries'} saved
          </Text>
        </MotiView>
      )}
      
      {/* Hint overlay - Zenly style with pulsing glow */}
      {showHint && (
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'spring', damping: 20 }}
          style={styles.hintOverlay}
        >
          <MotiView
            from={{ scale: 1 }}
            animate={{ scale: [1, 1.02, 1] }}
            transition={{ type: 'timing', duration: 2000, loop: true }}
          >
            <LinearGradient
              colors={['rgba(255, 0, 128, 0.2)', 'rgba(0, 212, 255, 0.2)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.hintBadge}
            >
              <Text style={styles.hintTitle}>🌍 Explore the World</Text>
              <Text style={styles.hintText}>Drag to rotate • Tap markers to explore</Text>
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
    backgroundColor: COLORS.cosmicBlack,
  },
  canvas: {
    flex: 1,
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loadingCard: {
    backgroundColor: 'rgba(26, 10, 46, 0.8)',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(0, 212, 255, 0.3)',
  },
  loadingSpinner: {
    width: 60,
    height: 60,
    marginBottom: 16,
  },
  spinnerArc: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 4,
    borderColor: 'transparent',
  },
  spinnerArc2: {
    transform: [{ rotate: '90deg' }],
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  countBadge: {
    position: 'absolute',
    top: 110,
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 212, 255, 0.15)',
    borderWidth: 2,
    borderColor: 'rgba(0, 212, 255, 0.4)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
  },
  countText: {
    color: COLORS.electricBlue,
    fontSize: 14,
    fontWeight: '700',
  },
  hintOverlay: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  hintBadge: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'rgba(255, 0, 128, 0.4)',
    alignItems: 'center',
  },
  hintTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 4,
  },
  hintText: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.9)',
  },
});
