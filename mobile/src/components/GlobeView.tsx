/**
 * GlobeView - ZENLY STYLE 3D Globe (Option B: Enhanced R3F)
 * 
 * Based on expert recommendations:
 * - 4K Night Earth texture with city lights glow
 * - Native RN View overlays for emoji markers (not 3D)
 * - Zoom-to-country animation on tap
 * - OLED-optimized dark color palette
 * - Silky smooth drag with lerp
 * - Moti pop animations for markers
 */

import React, { useRef, useState, useEffect, useMemo, Suspense, useCallback } from 'react';
import { View, StyleSheet, Dimensions, Text, TouchableOpacity, Image } from 'react-native';
import { Canvas, useFrame, useThree } from '@react-three/fiber/native';
import * as THREE from 'three';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// OLED-OPTIMIZED COLOR PALETTE (Android friendly)
const COLORS = {
  deepBackground: '#020617',    // True black/blue for OLED
  primaryGlow: '#8B5CF6',       // Electric purple
  zenlyGreen: '#22C55E',        // Success/Nature
  surfaceCard: '#1E293B',       // Glassmorphism base
  electricBlue: '#00d4ff',
  neonPink: '#ff0080',
  neonGreen: '#00ff88',
  gold: '#ffd700',
  white: '#ffffff',
};

// 4K Night Earth Texture URL
const EARTH_NIGHT_TEXTURE = 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_lights_2048.png';
const EARTH_SURFACE_TEXTURE = 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_atmos_2048.jpg';

// Country data with emojis and neon colors
interface CountryData {
  lat: number;
  lng: number;
  name: string;
  emoji: string;
  color: string;
}

const COUNTRY_DATA: Record<string, CountryData> = {
  'japan': { lat: 36.2048, lng: 138.2529, name: 'Japan', emoji: '🍜', color: COLORS.electricBlue },
  'korea': { lat: 35.9078, lng: 127.7669, name: 'Korea', emoji: '🇰🇷', color: COLORS.neonPink },
  'south korea': { lat: 35.9078, lng: 127.7669, name: 'Korea', emoji: '🇰🇷', color: COLORS.neonPink },
  'thailand': { lat: 15.8700, lng: 100.9925, name: 'Thailand', emoji: '🏝️', color: COLORS.neonGreen },
  'vietnam': { lat: 14.0583, lng: 108.2772, name: 'Vietnam', emoji: '🍜', color: COLORS.gold },
  'singapore': { lat: 1.3521, lng: 103.8198, name: 'Singapore', emoji: '🦁', color: COLORS.neonPink },
  'indonesia': { lat: -0.7893, lng: 113.9213, name: 'Indonesia', emoji: '🏝️', color: COLORS.neonGreen },
  'bali': { lat: -8.3405, lng: 115.0920, name: 'Bali', emoji: '🌴', color: COLORS.neonGreen },
  'malaysia': { lat: 4.2105, lng: 101.9758, name: 'Malaysia', emoji: '🇲🇾', color: COLORS.electricBlue },
  'philippines': { lat: 12.8797, lng: 121.7740, name: 'Philippines', emoji: '🏝️', color: COLORS.gold },
  'india': { lat: 20.5937, lng: 78.9629, name: 'India', emoji: '🇮🇳', color: COLORS.gold },
  'china': { lat: 35.8617, lng: 104.1954, name: 'China', emoji: '🇨🇳', color: COLORS.neonPink },
  'taiwan': { lat: 23.6978, lng: 120.9605, name: 'Taiwan', emoji: '🧋', color: COLORS.neonGreen },
  'hong kong': { lat: 22.3193, lng: 114.1694, name: 'Hong Kong', emoji: '🏙️', color: COLORS.neonPink },
  'australia': { lat: -25.2744, lng: 133.7751, name: 'Australia', emoji: '🦘', color: COLORS.gold },
  'new zealand': { lat: -40.9006, lng: 174.8860, name: 'New Zealand', emoji: '🥝', color: COLORS.neonGreen },
  'usa': { lat: 37.0902, lng: -95.7129, name: 'USA', emoji: '🗽', color: COLORS.electricBlue },
  'united states': { lat: 37.0902, lng: -95.7129, name: 'USA', emoji: '🗽', color: COLORS.electricBlue },
  'canada': { lat: 56.1304, lng: -106.3468, name: 'Canada', emoji: '🍁', color: COLORS.neonPink },
  'mexico': { lat: 23.6345, lng: -102.5528, name: 'Mexico', emoji: '🌮', color: COLORS.neonGreen },
  'uk': { lat: 55.3781, lng: -3.4360, name: 'UK', emoji: '🇬🇧', color: COLORS.electricBlue },
  'united kingdom': { lat: 55.3781, lng: -3.4360, name: 'UK', emoji: '🇬🇧', color: COLORS.electricBlue },
  'france': { lat: 46.2276, lng: 2.2137, name: 'France', emoji: '🥐', color: COLORS.neonPink },
  'italy': { lat: 41.8719, lng: 12.5674, name: 'Italy', emoji: '🍕', color: COLORS.neonGreen },
  'spain': { lat: 40.4637, lng: -3.7492, name: 'Spain', emoji: '💃', color: COLORS.gold },
  'germany': { lat: 51.1657, lng: 10.4515, name: 'Germany', emoji: '🍺', color: COLORS.gold },
  'netherlands': { lat: 52.1326, lng: 5.2913, name: 'Netherlands', emoji: '🌷', color: COLORS.neonPink },
  'greece': { lat: 39.0742, lng: 21.8243, name: 'Greece', emoji: '🏛️', color: COLORS.electricBlue },
  'turkey': { lat: 38.9637, lng: 35.2433, name: 'Turkey', emoji: '🧿', color: COLORS.neonPink },
  'uae': { lat: 23.4241, lng: 53.8478, name: 'UAE', emoji: '🏜️', color: COLORS.gold },
  'dubai': { lat: 25.2048, lng: 55.2708, name: 'Dubai', emoji: '🌃', color: COLORS.gold },
  'brazil': { lat: -14.2350, lng: -51.9253, name: 'Brazil', emoji: '⚽', color: COLORS.neonGreen },
  'argentina': { lat: -38.4161, lng: -63.6167, name: 'Argentina', emoji: '🥩', color: COLORS.electricBlue },
  'peru': { lat: -9.1900, lng: -75.0152, name: 'Peru', emoji: '🦙', color: COLORS.gold },
  'egypt': { lat: 26.8206, lng: 30.8025, name: 'Egypt', emoji: '🏛️', color: COLORS.gold },
  'south africa': { lat: -30.5595, lng: 22.9375, name: 'South Africa', emoji: '🦁', color: COLORS.neonGreen },
  'morocco': { lat: 31.7917, lng: -7.0926, name: 'Morocco', emoji: '🏜️', color: COLORS.neonPink },
  'portugal': { lat: 39.3999, lng: -8.2245, name: 'Portugal', emoji: '🏄', color: COLORS.electricBlue },
  'switzerland': { lat: 46.8182, lng: 8.2275, name: 'Switzerland', emoji: '⛷️', color: COLORS.neonPink },
  'austria': { lat: 47.5162, lng: 14.5501, name: 'Austria', emoji: '🎿', color: COLORS.neonGreen },
  'croatia': { lat: 45.1, lng: 15.2, name: 'Croatia', emoji: '🏖️', color: COLORS.electricBlue },
  'iceland': { lat: 64.9631, lng: -19.0208, name: 'Iceland', emoji: '🌋', color: COLORS.electricBlue },
  'norway': { lat: 60.4720, lng: 8.4689, name: 'Norway', emoji: '🎿', color: COLORS.electricBlue },
  'sweden': { lat: 60.1282, lng: 18.6435, name: 'Sweden', emoji: '🇸🇪', color: COLORS.gold },
  'finland': { lat: 61.9241, lng: 25.7482, name: 'Finland', emoji: '🎅', color: COLORS.electricBlue },
  'denmark': { lat: 56.2639, lng: 9.5018, name: 'Denmark', emoji: '🇩🇰', color: COLORS.neonPink },
  'ireland': { lat: 53.4129, lng: -8.2439, name: 'Ireland', emoji: '☘️', color: COLORS.neonGreen },
  'belgium': { lat: 50.5039, lng: 4.4699, name: 'Belgium', emoji: '🍫', color: COLORS.gold },
  'czech republic': { lat: 49.8175, lng: 15.4730, name: 'Czechia', emoji: '🍺', color: COLORS.gold },
  'czechia': { lat: 49.8175, lng: 15.4730, name: 'Czechia', emoji: '🍺', color: COLORS.gold },
  'poland': { lat: 51.9194, lng: 19.1451, name: 'Poland', emoji: '🇵🇱', color: COLORS.neonPink },
  'hungary': { lat: 47.1625, lng: 19.5033, name: 'Hungary', emoji: '🇭🇺', color: COLORS.neonGreen },
  'russia': { lat: 61.5240, lng: 105.3188, name: 'Russia', emoji: '🇷🇺', color: COLORS.electricBlue },
};

// Simple lerp for silky smooth rotation
function lerp(start: number, end: number, factor: number): number {
  return start + (end - start) * factor;
}

// Convert lat/lng to 3D position
function latLngToVector3(lat: number, lng: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const y = radius * Math.cos(phi);
  const z = radius * Math.sin(phi) * Math.sin(theta);
  return new THREE.Vector3(x, y, z);
}

// Convert 3D position to screen coordinates
function worldToScreen(
  position: THREE.Vector3,
  camera: THREE.Camera,
  width: number,
  height: number
): { x: number; y: number; visible: boolean } {
  const vector = position.clone();
  vector.project(camera);
  
  const x = (vector.x * 0.5 + 0.5) * width;
  const y = (-(vector.y * 0.5) + 0.5) * height;
  const visible = vector.z < 1; // Behind camera check
  
  return { x, y, visible };
}

// Texture loader hook
function useTexture(url: string): THREE.Texture | null {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  
  useEffect(() => {
    const loader = new THREE.TextureLoader();
    loader.load(
      url,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        setTexture(tex);
      },
      undefined,
      () => setTexture(null)
    );
  }, [url]);
  
  return texture;
}

// Glowing point on globe (3D)
interface GlowPointProps {
  position: THREE.Vector3;
  color: string;
}

function GlowPoint({ position, color }: GlowPointProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    const time = state.clock.elapsedTime;
    if (meshRef.current) {
      const scale = 1 + Math.sin(time * 3) * 0.3;
      meshRef.current.scale.setScalar(scale);
    }
    if (glowRef.current) {
      const glowScale = 1.5 + Math.sin(time * 2) * 0.5;
      glowRef.current.scale.setScalar(glowScale);
    }
  });

  return (
    <group position={position}>
      {/* Outer glow */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[0.03, 16, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.3} />
      </mesh>
      {/* Inner core */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.015, 16, 16]} />
        <meshBasicMaterial color={color} />
      </mesh>
      {/* Point light */}
      <pointLight color={color} intensity={0.5} distance={0.3} />
    </group>
  );
}

// Night Earth Globe with city lights
interface EarthGlobeProps {
  rotation: { x: number; y: number };
  markers: Array<{ position: THREE.Vector3; color: string }>;
}

function EarthGlobe({ rotation, markers }: EarthGlobeProps) {
  const globeRef = useRef<THREE.Group>(null);
  const earthRef = useRef<THREE.Mesh>(null);
  
  // Load textures
  const nightTexture = useTexture(EARTH_NIGHT_TEXTURE);
  const surfaceTexture = useTexture(EARTH_SURFACE_TEXTURE);
  
  // Apply rotation from parent
  useFrame(() => {
    if (globeRef.current) {
      globeRef.current.rotation.x = lerp(globeRef.current.rotation.x, rotation.x, 0.1);
      globeRef.current.rotation.y = lerp(globeRef.current.rotation.y, rotation.y, 0.1);
    }
  });

  return (
    <group ref={globeRef}>
      {/* Earth sphere with night texture */}
      <mesh ref={earthRef}>
        <sphereGeometry args={[1, 64, 64]} />
        {nightTexture ? (
          <meshBasicMaterial map={nightTexture} />
        ) : surfaceTexture ? (
          <meshStandardMaterial 
            map={surfaceTexture}
            emissive="#111122"
            emissiveIntensity={0.1}
          />
        ) : (
          <meshBasicMaterial color="#0a1628" />
        )}
      </mesh>
      
      {/* Atmosphere glow */}
      <mesh>
        <sphereGeometry args={[1.02, 64, 64]} />
        <meshBasicMaterial 
          color={COLORS.primaryGlow}
          transparent 
          opacity={0.08}
          side={THREE.BackSide}
        />
      </mesh>
      
      {/* Outer atmosphere */}
      <mesh>
        <sphereGeometry args={[1.08, 64, 64]} />
        <meshBasicMaterial 
          color={COLORS.electricBlue}
          transparent 
          opacity={0.03}
          side={THREE.BackSide}
        />
      </mesh>
      
      {/* Glow points for markers */}
      {markers.map((marker, i) => (
        <GlowPoint 
          key={i} 
          position={marker.position} 
          color={marker.color} 
        />
      ))}
    </group>
  );
}

// Camera that can be controlled
interface CameraControllerProps {
  onCameraUpdate: (camera: THREE.Camera) => void;
}

function CameraController({ onCameraUpdate }: CameraControllerProps) {
  const { camera } = useThree();
  
  useEffect(() => {
    camera.position.set(0, 0, 2.5);
    camera.lookAt(0, 0, 0);
  }, [camera]);
  
  useFrame(() => {
    onCameraUpdate(camera);
  });
  
  return null;
}

// Floating Emoji Marker (Native RN View) - Moti animated
interface EmojiMarkerProps {
  emoji: string;
  name: string;
  color: string;
  x: number;
  y: number;
  visible: boolean;
  onPress: () => void;
  index: number;
}

function EmojiMarker({ emoji, name, color, x, y, visible, onPress, index }: EmojiMarkerProps) {
  if (!visible) return null;
  
  return (
    <MotiView
      from={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ 
        type: 'spring', 
        damping: 12,
        delay: index * 100,
      }}
      style={[
        styles.emojiMarker,
        { 
          left: x - 25,
          top: y - 50,
        }
      ]}
    >
      <TouchableOpacity 
        onPress={onPress}
        activeOpacity={0.8}
        style={styles.emojiTouchable}
      >
        {/* Glow ring */}
        <MotiView
          from={{ scale: 1, opacity: 0.8 }}
          animate={{ scale: [1, 1.4, 1], opacity: [0.8, 0, 0.8] }}
          transition={{ 
            type: 'timing', 
            duration: 2000,
            loop: true,
          }}
          style={[styles.glowRing, { borderColor: color }]}
        />
        
        {/* Emoji */}
        <View style={[styles.emojiContainer, { shadowColor: color }]}>
          <Text style={styles.emojiText}>{emoji}</Text>
        </View>
        
        {/* Name label */}
        <View style={[styles.nameLabel, { backgroundColor: color + '40' }]}>
          <Text style={styles.nameLabelText}>{name}</Text>
        </View>
      </TouchableOpacity>
    </MotiView>
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
  const [camera, setCamera] = useState<THREE.Camera | null>(null);
  const [screenMarkers, setScreenMarkers] = useState<Array<{
    x: number;
    y: number;
    visible: boolean;
    emoji: string;
    name: string;
    color: string;
    destination: string;
    tripId: string;
  }>>([]);
  
  // Rotation state
  const targetRotation = useRef({ x: 0, y: 0 });
  const [rotation, setRotation] = useState({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const lastTouch = useRef({ x: 0, y: 0 });
  
  // Auto-rotate
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isDragging.current) {
        targetRotation.current.y += 0.003;
        setRotation({ ...targetRotation.current });
      }
    }, 16);
    return () => clearInterval(interval);
  }, []);

  // Hide hint after 5s
  useEffect(() => {
    const timer = setTimeout(() => setShowHint(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  // Get 3D marker positions
  const markers3D = useMemo(() => {
    return countries.map(({ destination, tripId }) => {
      const key = destination.toLowerCase();
      const data = COUNTRY_DATA[key];
      if (data) {
        return {
          position: latLngToVector3(data.lat, data.lng, 1.02),
          color: data.color,
          emoji: data.emoji,
          name: data.name,
          destination,
          tripId,
          lat: data.lat,
          lng: data.lng,
        };
      }
      return null;
    }).filter(Boolean) as Array<{
      position: THREE.Vector3;
      color: string;
      emoji: string;
      name: string;
      destination: string;
      tripId: string;
      lat: number;
      lng: number;
    }>;
  }, [countries]);

  // Update screen positions when camera updates
  const handleCameraUpdate = useCallback((cam: THREE.Camera) => {
    if (!camera) setCamera(cam);
    
    // Calculate screen positions for emoji overlays
    const newMarkers = markers3D.map((marker) => {
      // Apply current rotation to position
      const rotatedPos = marker.position.clone();
      const euler = new THREE.Euler(rotation.x, rotation.y, 0);
      rotatedPos.applyEuler(euler);
      
      const screen = worldToScreen(rotatedPos, cam, SCREEN_WIDTH, SCREEN_HEIGHT);
      
      // Check if point is on front of globe (dot product with camera direction)
      const cameraDir = new THREE.Vector3(0, 0, -1);
      const pointDir = rotatedPos.clone().normalize();
      const dot = pointDir.dot(cameraDir);
      
      return {
        ...marker,
        x: screen.x,
        y: screen.y,
        visible: screen.visible && dot < 0.3, // Only show if facing camera
      };
    });
    
    setScreenMarkers(newMarkers);
  }, [markers3D, rotation, camera]);

  // Touch handlers
  const handleTouchStart = (e: any) => {
    isDragging.current = true;
    const touch = e.nativeEvent.touches[0];
    lastTouch.current = { x: touch.pageX, y: touch.pageY };
  };

  const handleTouchMove = (e: any) => {
    if (!isDragging.current) return;
    const touch = e.nativeEvent.touches[0];
    const deltaX = (touch.pageX - lastTouch.current.x) * 0.005;
    const deltaY = (touch.pageY - lastTouch.current.y) * 0.005;
    
    targetRotation.current.y += deltaX;
    targetRotation.current.x += deltaY;
    targetRotation.current.x = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, targetRotation.current.x));
    
    setRotation({ ...targetRotation.current });
    lastTouch.current = { x: touch.pageX, y: touch.pageY };
  };

  const handleTouchEnd = () => {
    isDragging.current = false;
  };

  // Handle country tap with zoom animation
  const handleCountryTap = (destination: string, tripId: string, lat: number, lng: number) => {
    // Rotate globe to show the country
    const targetLng = -lng * (Math.PI / 180) + Math.PI;
    const targetLat = lat * (Math.PI / 180) * 0.5;
    
    // Animate rotation
    const startRotation = { ...targetRotation.current };
    const duration = 800;
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // Ease out cubic
      
      targetRotation.current = {
        x: startRotation.x + (targetLat - startRotation.x) * eased,
        y: startRotation.y + (targetLng - startRotation.y) * eased,
      };
      setRotation({ ...targetRotation.current });
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Navigate after animation
        setTimeout(() => {
          onCountryPress(destination, tripId);
        }, 200);
      }
    };
    
    animate();
  };

  return (
    <View 
      style={[styles.container, style]}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* OLED-optimized dark gradient background */}
      <LinearGradient
        colors={[COLORS.deepBackground, '#0a1628', COLORS.deepBackground]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      
      {/* Loading state */}
      {isLoading && (
        <MotiView
          from={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          style={styles.loadingContainer}
        >
          <MotiView
            from={{ rotate: '0deg' }}
            animate={{ rotate: '360deg' }}
            transition={{ type: 'timing', duration: 1500, loop: true }}
            style={styles.loadingSpinner}
          >
            <LinearGradient
              colors={[COLORS.primaryGlow, COLORS.electricBlue]}
              style={styles.spinnerGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
          </MotiView>
          <Text style={styles.loadingText}>Loading Globe...</Text>
        </MotiView>
      )}
      
      {/* 3D Canvas - Z-Index 0 */}
      <Canvas
        style={styles.canvas}
        gl={{ antialias: true }}
        onCreated={() => setIsLoading(false)}
      >
        <CameraController onCameraUpdate={handleCameraUpdate} />
        <ambientLight intensity={0.3} />
        
        <Suspense fallback={null}>
          <EarthGlobe 
            rotation={rotation}
            markers={markers3D.map(m => ({ position: m.position, color: m.color }))}
          />
        </Suspense>
      </Canvas>
      
      {/* Emoji Markers Overlay - Z-Index 10 */}
      <View style={styles.markersOverlay} pointerEvents="box-none">
        {screenMarkers.map((marker, index) => (
          <EmojiMarker
            key={`${marker.destination}-${index}`}
            emoji={marker.emoji}
            name={marker.name}
            color={marker.color}
            x={marker.x}
            y={marker.y}
            visible={marker.visible}
            index={index}
            onPress={() => {
              const data = markers3D.find(m => m.destination === marker.destination);
              if (data) {
                handleCountryTap(marker.destination, marker.tripId, data.lat, data.lng);
              }
            }}
          />
        ))}
      </View>
      
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
      
      {/* Hint overlay */}
      {showHint && (
        <MotiView
          from={{ opacity: 0, translateY: 30 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'spring', damping: 15 }}
          style={styles.hintOverlay}
        >
          <LinearGradient
            colors={[COLORS.surfaceCard + 'E0', COLORS.surfaceCard + 'C0']}
            style={styles.hintCard}
          >
            <Text style={styles.hintTitle}>🌍 Explore the World</Text>
            <Text style={styles.hintText}>Drag to rotate • Tap emoji to explore</Text>
          </LinearGradient>
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
  canvas: {
    flex: 1,
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  loadingSpinner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 16,
    overflow: 'hidden',
  },
  spinnerGradient: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  loadingText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  markersOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
  },
  emojiMarker: {
    position: 'absolute',
    alignItems: 'center',
    width: 50,
  },
  emojiTouchable: {
    alignItems: 'center',
  },
  glowRing: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    top: 0,
  },
  emojiContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.surfaceCard,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 8,
  },
  emojiText: {
    fontSize: 24,
  },
  nameLabel: {
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  nameLabelText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: '700',
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
    paddingVertical: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.primaryGlow + '30',
    alignItems: 'center',
  },
  hintTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.white,
    marginBottom: 4,
  },
  hintText: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.8)',
  },
});
