/**
 * GlobeView - 3D Interactive Globe Component
 * 
 * Uses react-three-fiber + expo-gl for native 3D rendering
 * Features:
 * - Realistic Earth with procedural textures
 * - Smooth rotation and drag interaction
 * - Country markers with saved places (green glowing pins)
 * - Tap country to navigate to CountryBubbleScreen
 * - Stars background and atmosphere glow
 */

import React, { useRef, useState, useEffect, useMemo, Suspense } from 'react';
import { View, StyleSheet, Dimensions, Text, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Canvas, useFrame, useThree } from '@react-three/fiber/native';
import * as THREE from 'three';
import { MotiView } from 'moti';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Earth texture URLs (NASA Blue Marble)
const EARTH_TEXTURE_URL = 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_atmos_2048.jpg';
const EARTH_BUMP_URL = 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_normal_2048.jpg';
const EARTH_SPECULAR_URL = 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_specular_2048.jpg';
const CLOUD_TEXTURE_URL = 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_clouds_1024.png';

// Country coordinates (lat/lng to 3D position on sphere)
interface CountryPosition {
  lat: number;
  lng: number;
  name: string;
  flag: string;
}

const COUNTRY_POSITIONS: Record<string, CountryPosition> = {
  'japan': { lat: 36.2048, lng: 138.2529, name: 'Japan', flag: '🇯🇵' },
  'korea': { lat: 35.9078, lng: 127.7669, name: 'South Korea', flag: '🇰🇷' },
  'south korea': { lat: 35.9078, lng: 127.7669, name: 'South Korea', flag: '🇰🇷' },
  'thailand': { lat: 15.8700, lng: 100.9925, name: 'Thailand', flag: '🇹🇭' },
  'vietnam': { lat: 14.0583, lng: 108.2772, name: 'Vietnam', flag: '🇻🇳' },
  'singapore': { lat: 1.3521, lng: 103.8198, name: 'Singapore', flag: '🇸🇬' },
  'indonesia': { lat: -0.7893, lng: 113.9213, name: 'Indonesia', flag: '🇮🇩' },
  'bali': { lat: -8.3405, lng: 115.0920, name: 'Bali', flag: '🇮🇩' },
  'malaysia': { lat: 4.2105, lng: 101.9758, name: 'Malaysia', flag: '🇲🇾' },
  'philippines': { lat: 12.8797, lng: 121.7740, name: 'Philippines', flag: '🇵🇭' },
  'india': { lat: 20.5937, lng: 78.9629, name: 'India', flag: '🇮🇳' },
  'china': { lat: 35.8617, lng: 104.1954, name: 'China', flag: '🇨🇳' },
  'taiwan': { lat: 23.6978, lng: 120.9605, name: 'Taiwan', flag: '🇹🇼' },
  'hong kong': { lat: 22.3193, lng: 114.1694, name: 'Hong Kong', flag: '🇭🇰' },
  'australia': { lat: -25.2744, lng: 133.7751, name: 'Australia', flag: '🇦🇺' },
  'new zealand': { lat: -40.9006, lng: 174.8860, name: 'New Zealand', flag: '🇳🇿' },
  'usa': { lat: 37.0902, lng: -95.7129, name: 'USA', flag: '🇺🇸' },
  'united states': { lat: 37.0902, lng: -95.7129, name: 'USA', flag: '🇺🇸' },
  'canada': { lat: 56.1304, lng: -106.3468, name: 'Canada', flag: '🇨🇦' },
  'mexico': { lat: 23.6345, lng: -102.5528, name: 'Mexico', flag: '🇲🇽' },
  'uk': { lat: 55.3781, lng: -3.4360, name: 'United Kingdom', flag: '🇬🇧' },
  'united kingdom': { lat: 55.3781, lng: -3.4360, name: 'United Kingdom', flag: '🇬🇧' },
  'france': { lat: 46.2276, lng: 2.2137, name: 'France', flag: '🇫🇷' },
  'italy': { lat: 41.8719, lng: 12.5674, name: 'Italy', flag: '🇮🇹' },
  'spain': { lat: 40.4637, lng: -3.7492, name: 'Spain', flag: '🇪🇸' },
  'germany': { lat: 51.1657, lng: 10.4515, name: 'Germany', flag: '🇩🇪' },
  'netherlands': { lat: 52.1326, lng: 5.2913, name: 'Netherlands', flag: '🇳🇱' },
  'greece': { lat: 39.0742, lng: 21.8243, name: 'Greece', flag: '🇬🇷' },
  'turkey': { lat: 38.9637, lng: 35.2433, name: 'Turkey', flag: '🇹🇷' },
  'uae': { lat: 23.4241, lng: 53.8478, name: 'UAE', flag: '🇦🇪' },
  'dubai': { lat: 25.2048, lng: 55.2708, name: 'Dubai', flag: '🇦🇪' },
  'brazil': { lat: -14.2350, lng: -51.9253, name: 'Brazil', flag: '🇧🇷' },
  'argentina': { lat: -38.4161, lng: -63.6167, name: 'Argentina', flag: '🇦🇷' },
  'peru': { lat: -9.1900, lng: -75.0152, name: 'Peru', flag: '🇵🇪' },
  'egypt': { lat: 26.8206, lng: 30.8025, name: 'Egypt', flag: '🇪🇬' },
  'south africa': { lat: -30.5595, lng: 22.9375, name: 'South Africa', flag: '🇿🇦' },
  'morocco': { lat: 31.7917, lng: -7.0926, name: 'Morocco', flag: '🇲🇦' },
  'portugal': { lat: 39.3999, lng: -8.2245, name: 'Portugal', flag: '🇵🇹' },
  'switzerland': { lat: 46.8182, lng: 8.2275, name: 'Switzerland', flag: '🇨🇭' },
  'austria': { lat: 47.5162, lng: 14.5501, name: 'Austria', flag: '🇦🇹' },
  'croatia': { lat: 45.1, lng: 15.2, name: 'Croatia', flag: '🇭🇷' },
  'iceland': { lat: 64.9631, lng: -19.0208, name: 'Iceland', flag: '🇮🇸' },
  'norway': { lat: 60.4720, lng: 8.4689, name: 'Norway', flag: '🇳🇴' },
  'sweden': { lat: 60.1282, lng: 18.6435, name: 'Sweden', flag: '🇸🇪' },
  'finland': { lat: 61.9241, lng: 25.7482, name: 'Finland', flag: '🇫🇮' },
  'denmark': { lat: 56.2639, lng: 9.5018, name: 'Denmark', flag: '🇩🇰' },
  'ireland': { lat: 53.4129, lng: -8.2439, name: 'Ireland', flag: '🇮🇪' },
  'belgium': { lat: 50.5039, lng: 4.4699, name: 'Belgium', flag: '🇧🇪' },
  'czech republic': { lat: 49.8175, lng: 15.4730, name: 'Czech Republic', flag: '🇨🇿' },
  'czechia': { lat: 49.8175, lng: 15.4730, name: 'Czechia', flag: '🇨🇿' },
  'poland': { lat: 51.9194, lng: 19.1451, name: 'Poland', flag: '🇵🇱' },
  'hungary': { lat: 47.1625, lng: 19.5033, name: 'Hungary', flag: '🇭🇺' },
  'russia': { lat: 61.5240, lng: 105.3188, name: 'Russia', flag: '🇷🇺' },
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

// Country Marker Component (3D glowing pin on globe)
interface MarkerProps {
  position: THREE.Vector3;
  color: string;
  onClick: () => void;
  isActive?: boolean;
}

function CountryMarker({ position, color, onClick, isActive }: MarkerProps) {
  const groupRef = useRef<THREE.Group>(null);
  const innerRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  
  useFrame((state) => {
    if (innerRef.current) {
      // Pulse animation for active markers
      const scale = 1.0 + Math.sin(state.clock.elapsedTime * 3) * 0.2;
      innerRef.current.scale.setScalar(scale);
    }
    if (glowRef.current) {
      // Glow pulse
      const glowScale = 1.5 + Math.sin(state.clock.elapsedTime * 2) * 0.3;
      glowRef.current.scale.setScalar(glowScale);
    }
  });

  return (
    <group 
      ref={groupRef} 
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      {/* Outer glow */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[0.04, 16, 16]} />
        <meshBasicMaterial 
          color="#10B981"
          transparent
          opacity={0.3}
        />
      </mesh>
      
      {/* Inner solid marker */}
      <mesh ref={innerRef}>
        <sphereGeometry args={[0.025, 16, 16]} />
        <meshStandardMaterial 
          color={hovered ? '#34d399' : '#10B981'}
          emissive="#10B981"
          emissiveIntensity={hovered ? 1.0 : 0.6}
        />
      </mesh>
      
      {/* Point light for extra glow effect */}
      <pointLight color="#10B981" intensity={0.5} distance={0.3} />
    </group>
  );
}

// Atmosphere glow effect
function Atmosphere() {
  const atmosphereRef = useRef<THREE.Mesh>(null);
  
  const shaderMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        void main() {
          float intensity = pow(0.7 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
          gl_FragColor = vec4(0.3, 0.6, 1.0, 1.0) * intensity;
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
    });
  }, []);

  return (
    <mesh ref={atmosphereRef} scale={[1.15, 1.15, 1.15]}>
      <sphereGeometry args={[1, 64, 64]} />
      <primitive object={shaderMaterial} attach="material" />
    </mesh>
  );
}

// Texture loader with error handling
function useTextureLoader(url: string): THREE.Texture | null {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  
  useEffect(() => {
    const loader = new THREE.TextureLoader();
    loader.load(
      url,
      (loadedTexture) => {
        loadedTexture.colorSpace = THREE.SRGBColorSpace;
        setTexture(loadedTexture);
      },
      undefined,
      () => {
        // Silently handle errors - fallback to procedural
        setTexture(null);
      }
    );
  }, [url]);
  
  return texture;
}

// Cloud layer that slowly rotates
function CloudLayer() {
  const cloudRef = useRef<THREE.Mesh>(null);
  const cloudTexture = useTextureLoader(CLOUD_TEXTURE_URL);
  
  useFrame(() => {
    if (cloudRef.current) {
      cloudRef.current.rotation.y += 0.0002;
    }
  });
  
  if (!cloudTexture) return null;
  
  return (
    <mesh ref={cloudRef}>
      <sphereGeometry args={[1.01, 64, 64]} />
      <meshStandardMaterial
        map={cloudTexture}
        transparent
        opacity={0.3}
        depthWrite={false}
      />
    </mesh>
  );
}

// Earth Component with realistic textures
interface EarthProps {
  onCountryClick?: (country: string, tripId: string) => void;
  highlightedCountries: { destination: string; tripId: string }[];
  autoRotate?: boolean;
}

function Earth({ onCountryClick, highlightedCountries, autoRotate = true }: EarthProps) {
  const earthRef = useRef<THREE.Group>(null);
  const globeRef = useRef<THREE.Mesh>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [rotationSpeed, setRotationSpeed] = useState(0.002);
  const previousTouch = useRef({ x: 0, y: 0 });
  const velocity = useRef({ x: 0, y: 0 });
  
  // Load Earth textures
  const earthTexture = useTextureLoader(EARTH_TEXTURE_URL);
  const bumpTexture = useTextureLoader(EARTH_BUMP_URL);
  const specularTexture = useTextureLoader(EARTH_SPECULAR_URL);

  useFrame((state, delta) => {
    if (earthRef.current) {
      if (autoRotate && !isDragging) {
        // Apply momentum decay
        velocity.current.x *= 0.95;
        velocity.current.y *= 0.95;
        
        // Apply velocity + base rotation
        earthRef.current.rotation.y += rotationSpeed + velocity.current.x;
        earthRef.current.rotation.x += velocity.current.y;
        
        // Clamp vertical rotation
        earthRef.current.rotation.x = Math.max(
          -Math.PI / 3,
          Math.min(Math.PI / 3, earthRef.current.rotation.x)
        );
      }
    }
  });

  const handlePointerDown = (e: any) => {
    e.stopPropagation();
    setIsDragging(true);
    previousTouch.current = {
      x: e.point?.x || e.clientX || 0,
      y: e.point?.y || e.clientY || 0,
    };
    velocity.current = { x: 0, y: 0 };
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  const handlePointerMove = (e: any) => {
    if (isDragging && earthRef.current) {
      const currentX = e.point?.x || e.clientX || 0;
      const currentY = e.point?.y || e.clientY || 0;
      
      const deltaX = (currentX - previousTouch.current.x) * 2;
      const deltaY = (currentY - previousTouch.current.y) * 2;
      
      velocity.current = { x: deltaX * 0.1, y: deltaY * 0.1 };
      
      earthRef.current.rotation.y += deltaX;
      earthRef.current.rotation.x += deltaY;
      
      // Clamp vertical rotation
      earthRef.current.rotation.x = Math.max(
        -Math.PI / 3,
        Math.min(Math.PI / 3, earthRef.current.rotation.x)
      );
      
      previousTouch.current = { x: currentX, y: currentY };
    }
  };

  // Get marker positions for highlighted countries
  const markers = useMemo(() => {
    return highlightedCountries.map(({ destination, tripId }) => {
      const key = destination.toLowerCase();
      const pos = COUNTRY_POSITIONS[key];
      if (pos) {
        return {
          position: latLngToVector3(pos.lat, pos.lng, 1.03),
          destination,
          tripId,
          name: pos.name,
          flag: pos.flag,
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
      {/* Earth sphere - with texture or fallback */}
      <mesh ref={globeRef}>
        <sphereGeometry args={[1, 64, 64]} />
        {earthTexture ? (
          <meshStandardMaterial 
            map={earthTexture}
            bumpMap={bumpTexture || undefined}
            bumpScale={0.05}
            roughness={0.7}
            metalness={0.1}
          />
        ) : (
          <meshStandardMaterial 
            color="#1e40af"
            roughness={0.8}
            metalness={0.1}
          />
        )}
      </mesh>
      
      {/* Cloud layer */}
      <CloudLayer />
      
      {/* Country markers */}
      {markers.map((marker, index) => marker && (
        <CountryMarker
          key={`${marker.destination}-${index}`}
          position={marker.position}
          color="#10B981"
          onClick={() => onCountryClick?.(marker.destination, marker.tripId)}
          isActive={true}
        />
      ))}
      
      {/* Atmosphere glow */}
      <Atmosphere />
    </group>
  );
}

// Stars background
function Stars() {
  const starsRef = useRef<THREE.Points>(null);
  
  const [positions] = useMemo(() => {
    const positions = new Float32Array(3000);
    for (let i = 0; i < 1000; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 100;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 100;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 100;
    }
    return [positions];
  }, []);
  
  useFrame(() => {
    if (starsRef.current) {
      starsRef.current.rotation.y += 0.0001;
    }
  });

  return (
    <points ref={starsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={1000}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial size={0.1} color="#ffffff" sizeAttenuation />
    </points>
  );
}

// Camera controller
function CameraController() {
  const { camera } = useThree();
  
  useEffect(() => {
    camera.position.set(0, 0, 2.5);
    camera.lookAt(0, 0, 0);
  }, [camera]);
  
  return null;
}

// Loading fallback
function LoadingFallback() {
  return (
    <mesh>
      <sphereGeometry args={[1, 32, 32]} />
      <meshBasicMaterial color="#1a365d" wireframe />
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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Hide hint after 5 seconds
    const timer = setTimeout(() => setShowHint(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  const handleCreated = () => {
    setIsLoading(false);
  };

  const handleError = (e: any) => {
    console.error('Globe error:', e);
    setError('Could not load 3D globe');
    setIsLoading(false);
  };

  if (error) {
    return (
      <View style={[styles.container, style, styles.errorContainer]}>
        <Text style={styles.errorText}>🌍</Text>
        <Text style={styles.errorMessage}>{error}</Text>
        <Text style={styles.errorHint}>Try switching to Flat Map view</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      {isLoading && (
        <View style={styles.loadingContainer}>
          <MotiView
            from={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring' }}
          >
            <Text style={styles.loadingEmoji}>🌍</Text>
          </MotiView>
          <Text style={styles.loadingText}>Loading Globe...</Text>
        </View>
      )}
      
      <Canvas
        style={styles.canvas}
        gl={{ antialias: true }}
        onCreated={handleCreated}
      >
        <CameraController />
        
        {/* Lighting - Simulating sunlight */}
        <ambientLight intensity={0.2} />
        <directionalLight 
          position={[5, 3, 5]} 
          intensity={1.2} 
          color="#fffaf0" 
          castShadow
        />
        <directionalLight 
          position={[-3, 1, -3]} 
          intensity={0.2} 
          color="#6366f1"
        />
        <hemisphereLight 
          args={['#87ceeb', '#1e3a5f', 0.3]} 
        />
        
        {/* Stars background */}
        <Stars />
        
        {/* Earth */}
        <Suspense fallback={<LoadingFallback />}>
          <Earth 
            onCountryClick={onCountryPress}
            highlightedCountries={countries}
            autoRotate={true}
          />
        </Suspense>
      </Canvas>
      
      {/* Country count badge */}
      {countries.length > 0 && (
        <View style={styles.countBadge}>
          <Text style={styles.countText}>
            {countries.length} {countries.length === 1 ? 'country' : 'countries'} saved
          </Text>
        </View>
      )}
      
      {/* Hint overlay */}
      {showHint && (
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          exit={{ opacity: 0 }}
          transition={{ type: 'timing', duration: 500 }}
          style={styles.hintOverlay}
          pointerEvents="none"
        >
          <View style={styles.hintBadge}>
            <Text style={styles.hintText}>🌍 Drag to rotate • Tap green dot to explore</Text>
          </View>
        </MotiView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050510',
  },
  canvas: {
    flex: 1,
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#050510',
    zIndex: 10,
  },
  loadingEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  loadingText: {
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: '500',
  },
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 64,
    marginBottom: 16,
  },
  errorMessage: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  errorHint: {
    color: '#64748b',
    fontSize: 14,
  },
  countBadge: {
    position: 'absolute',
    top: 100,
    alignSelf: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  countText: {
    color: '#10B981',
    fontSize: 13,
    fontWeight: '600',
  },
  hintOverlay: {
    position: 'absolute',
    bottom: 120,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  hintBadge: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
  },
  hintText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
});

