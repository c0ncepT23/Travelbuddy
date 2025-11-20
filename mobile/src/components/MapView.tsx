import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { SavedItem } from '../types';
import { GOOGLE_MAPS_API_KEY, CATEGORY_COLORS } from '../config/maps';
import { createCustomMarkerIcon } from './CustomMarkers';
import DARK_NEON_MAP_STYLE from '../config/darkNeonMapStyle';

declare var google: any;

// Conditionally import CustomMapMarker only for mobile
const CustomMapMarker = Platform.OS !== 'web' 
  ? require('./CustomMarkers').CustomMapMarker 
  : null;

interface MapViewProps {
  items: SavedItem[];
  region: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
  onMarkerPress?: (item: SavedItem) => void;
}

export const MapView: React.FC<MapViewProps> = ({ items, region, onMarkerPress }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  useEffect(() => {
    if (Platform.OS === 'web' && mapRef.current) {
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
    if (!mapRef.current || googleMapRef.current) return;

    const google = (window as any).google;
    googleMapRef.current = new google.maps.Map(mapRef.current, {
      center: { lat: region.latitude, lng: region.longitude },
      zoom: 13,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      zoomControl: false,
      styles: DARK_NEON_MAP_STYLE,
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
    return <div ref={mapRef} style={{ width: '100%', height: '100%' }} />;
  }

  // For mobile, use react-native-maps with dark neon style
  const MapViewNative = require('react-native-maps').default;
  const { PROVIDER_GOOGLE } = require('react-native-maps');

  return (
    <MapViewNative
      provider={PROVIDER_GOOGLE}
      style={styles.map}
      initialRegion={region}
      showsUserLocation
      showsMyLocationButton={false}
      customMapStyle={DARK_NEON_MAP_STYLE}
    >
      {items.map((item) => {
        if (!item.location_lat || !item.location_lng) return null;

        return (
          <CustomMapMarker
            key={item.id}
            item={item}
            onPress={() => onMarkerPress && onMarkerPress(item)}
          />
        );
      })}
    </MapViewNative>
  );
};

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
});
