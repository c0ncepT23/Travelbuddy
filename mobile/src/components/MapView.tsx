import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { View, StyleSheet, Platform, Image, Text } from 'react-native';
import { SavedItem, ItemCategory } from '../types';
import { GOOGLE_MAPS_API_KEY, CATEGORY_COLORS } from '../config/maps';
import { createCustomMarkerIcon } from './CustomMarkers';
import { CategoryClusterMarker } from './CategoryClusterMarker';
import { clusterByCategory, CategoryCluster } from '../utils/mapClustering';
import NEOPOP_MAP_STYLE from '../config/neopopMapStyle';

declare var google: any;

// Conditionally import CustomMapMarker only for mobile
const CustomMapMarker = Platform.OS !== 'web' 
  ? require('./CustomMarkers').CustomMapMarker 
  : null;

const Marker = Platform.OS !== 'web'
  ? require('react-native-maps').Marker
  : null;

const Heatmap = Platform.OS !== 'web'
  ? require('react-native-maps').Heatmap
  : null;

const Circle = Platform.OS !== 'web'
  ? require('react-native-maps').Circle
  : null;

// Map display mode options
export type MapDisplayMode = 'markers' | 'heatmap' | 'photos';

interface MapViewProps {
  items: SavedItem[];
  region: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
  selectedPlace?: SavedItem | null;
  onMarkerPress?: (item: SavedItem) => void;
  onClusterPress?: (category: ItemCategory, items: SavedItem[]) => void;
  displayMode?: MapDisplayMode;
}

export interface MapViewRef {
  animateToRegion: (latitude: number, longitude: number, zoom?: number) => void;
}

// Helper to get photo URL from place
const getPlacePhotoUrl = (item: SavedItem): string | null => {
  if (!item.photos_json) return null;
  try {
    const photos = Array.isArray(item.photos_json) 
      ? item.photos_json 
      : JSON.parse(item.photos_json);
    if (photos.length > 0 && photos[0].photo_reference) {
      return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=80&photoreference=${photos[0].photo_reference}&key=${GOOGLE_MAPS_API_KEY}`;
    }
  } catch {}
  return null;
};

// Generate heat map data with weights based on concentration
const generateHeatMapData = (items: SavedItem[]) => {
  return items
    .filter(item => item.location_lat && item.location_lng)
    .map(item => ({
      latitude: item.location_lat!,
      longitude: item.location_lng!,
      weight: 1,
    }));
};

export const MapView = forwardRef<MapViewRef, MapViewProps>(({ 
  items, 
  region, 
  selectedPlace = null,
  onMarkerPress,
  onClusterPress,
  displayMode = 'markers',
}, ref) => {
  const webMapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<any>(null);
  const nativeMapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  // Expose animateToRegion method to parent
  useImperativeHandle(ref, () => ({
    animateToRegion: (latitude: number, longitude: number, zoom = 0.01) => {
      if (Platform.OS === 'web' && googleMapRef.current) {
        googleMapRef.current.panTo({ lat: latitude, lng: longitude });
        googleMapRef.current.setZoom(15);
      } else if (nativeMapRef.current) {
        nativeMapRef.current.animateToRegion({
          latitude,
          longitude,
          latitudeDelta: zoom,
          longitudeDelta: zoom,
        }, 500);
      }
    },
  }));

  useEffect(() => {
    if (Platform.OS === 'web' && webMapRef.current) {
      loadGoogleMapsScript();
    }
  }, []);

  useEffect(() => {
    if (googleMapRef.current && items.length > 0) {
      updateMarkers();
      centerMap();
    }
  }, [items]);

  useEffect(() => {
    if (googleMapRef.current && region) {
      const google = (window as any).google;
      googleMapRef.current.setCenter({ lat: region.latitude, lng: region.longitude });
    }
  }, [region.latitude, region.longitude]);

  const loadGoogleMapsScript = () => {
    if (typeof window !== 'undefined' && !(window as any).google) {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}`;
      script.async = true;
      script.onload = initializeMap;
      document.head.appendChild(script);
    } else if ((window as any).google) {
      initializeMap();
    }
  };

  const initializeMap = () => {
    if (!webMapRef.current || googleMapRef.current) return;

    const google = (window as any).google;
    googleMapRef.current = new google.maps.Map(webMapRef.current, {
      center: { lat: region.latitude, lng: region.longitude },
      zoom: 13,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      zoomControl: false,
      styles: NEOPOP_MAP_STYLE,
    });

    updateMarkers();
  };

  const updateMarkers = () => {
    if (!googleMapRef.current) return;

    const google = (window as any).google;
    
    // Clear existing markers
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];

    // Create new markers
    items.forEach((item) => {
      if (!item.location_lat || !item.location_lng) return;

      const marker = new google.maps.Marker({
        position: { lat: item.location_lat, lng: item.location_lng },
        map: googleMapRef.current,
        title: item.name,
        icon: createCustomMarkerIcon(item.category),
        animation: google.maps.Animation.DROP,
      });

      marker.addListener('click', () => {
        if (onMarkerPress) {
          onMarkerPress(item);
        }
      });

      markersRef.current.push(marker);
    });
  };

  const centerMap = () => {
    if (!googleMapRef.current || items.length === 0) return;

    const google = (window as any).google;
    const bounds = new google.maps.LatLngBounds();

    items.forEach((item) => {
      if (item.location_lat && item.location_lng) {
        bounds.extend({ lat: item.location_lat, lng: item.location_lng });
      }
    });

    googleMapRef.current.fitBounds(bounds);
  };

  if (Platform.OS === 'web') {
    return <div ref={webMapRef} style={{ width: '100%', height: '100%' }} />;
  }

  // For mobile, use react-native-maps
  const MapViewNative = require('react-native-maps').default;

  // Always show category clusters
  const clusters = clusterByCategory(items);
  
  // Heat map data
  const heatMapData = generateHeatMapData(items);

  return (
    <MapViewNative
      ref={nativeMapRef}
      style={styles.map}
      initialRegion={region}
      showsUserLocation
      showsMyLocationButton={false}
    >
      {/* Heat Map Mode */}
      {displayMode === 'heatmap' && heatMapData.length > 0 && Heatmap && (
        <Heatmap
          points={heatMapData}
          radius={40}
          opacity={0.7}
          gradient={{
            colors: ['#FFEB3B', '#FF9800', '#F44336', '#9C27B0'],
            startPoints: [0.1, 0.3, 0.6, 1],
            colorMapSize: 256,
          }}
        />
      )}
      
      {/* Heat Map Mode - Show circles as fallback/visual enhancement */}
      {displayMode === 'heatmap' && Circle && items.map((item) => {
        if (!item.location_lat || !item.location_lng) return null;
        return (
          <Circle
            key={`heat-${item.id}`}
            center={{
              latitude: item.location_lat,
              longitude: item.location_lng,
            }}
            radius={150}
            strokeColor="rgba(244, 67, 54, 0.5)"
            fillColor="rgba(244, 67, 54, 0.3)"
          />
        );
      })}

      {/* Photo Overlay Mode - Show photos as markers */}
      {displayMode === 'photos' && items.map((item) => {
        if (!item.location_lat || !item.location_lng) return null;
        const photoUrl = getPlacePhotoUrl(item);
        
        return (
          <Marker
            key={`photo-${item.id}`}
            coordinate={{
              latitude: item.location_lat,
              longitude: item.location_lng,
            }}
            onPress={() => onMarkerPress && onMarkerPress(item)}
          >
            <View style={styles.photoMarker}>
              {photoUrl ? (
                <Image source={{ uri: photoUrl }} style={styles.photoMarkerImage} />
              ) : (
                <View style={styles.photoMarkerPlaceholder}>
                  <Text style={styles.photoMarkerEmoji}>
                    {item.category === 'food' ? '🍽️' : 
                     item.category === 'place' ? '📍' : 
                     item.category === 'shopping' ? '🛍️' : '✨'}
                  </Text>
                </View>
              )}
            </View>
          </Marker>
        );
      })}

      {/* Standard Marker Mode - Show category cluster markers */}
      {displayMode === 'markers' && clusters.map((cluster) => (
        <Marker
          key={`cluster-${cluster.category}`}
          coordinate={{
            latitude: cluster.centerLat,
            longitude: cluster.centerLng,
          }}
          onPress={() => onClusterPress && onClusterPress(cluster.category, cluster.items)}
        >
          <CategoryClusterMarker
            category={cluster.category}
            count={cluster.count}
            onPress={() => onClusterPress && onClusterPress(cluster.category, cluster.items)}
          />
        </Marker>
      ))}

      {/* Show selected place marker on top of clusters (all modes) */}
      {selectedPlace && selectedPlace.location_lat && selectedPlace.location_lng && (
        <CustomMapMarker
          key={`selected-${selectedPlace.id}`}
          item={selectedPlace}
          onPress={() => onMarkerPress && onMarkerPress(selectedPlace)}
        />
      )}
    </MapViewNative>
  );
});

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
  // Photo marker styles
  photoMarker: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  photoMarkerImage: {
    width: '100%',
    height: '100%',
    borderRadius: 25,
  },
  photoMarkerPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E5E7EB',
  },
  photoMarkerEmoji: {
    fontSize: 24,
  },
});
