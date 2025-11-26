import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
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
}

export interface MapViewRef {
  animateToRegion: (latitude: number, longitude: number, zoom?: number) => void;
}

export const MapView = forwardRef<MapViewRef, MapViewProps>(({ 
  items, 
  region, 
  selectedPlace = null,
  onMarkerPress,
  onClusterPress,
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

  return (
    <MapViewNative
      ref={nativeMapRef}
      style={styles.map}
      initialRegion={region}
      showsUserLocation
      showsMyLocationButton={false}
    >
      {/* Always show category cluster markers */}
      {clusters.map((cluster) => (
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

      {/* Show selected place marker on top of clusters */}
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
});
