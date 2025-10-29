import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { SavedItem } from '../types';
import { GOOGLE_MAPS_API_KEY, CATEGORY_COLORS } from '../config/maps';
import { createCustomMarkerIcon } from './CustomMarkers';

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
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);

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

  // Update map center when region changes
  useEffect(() => {
    if (googleMapRef.current && region) {
      const google = (window as any).google;
      googleMapRef.current.setCenter({ lat: region.latitude, lng: region.longitude });
      console.log('[MapView] Map center updated to:', region.latitude, region.longitude);
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
      styles: [
        {
          featureType: 'poi',
          elementType: 'labels',
          stylers: [{ visibility: 'off' }],
        },
      ],
    });

    updateMarkers();
  };

  const updateMarkers = () => {
    if (!googleMapRef.current) {
      console.log('[MapView] No google map ref, skipping marker update');
      return;
    }

    const google = (window as any).google;
    
    console.log('[MapView] Updating markers, items count:', items.length);
    
    // Clear existing markers
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];

    // Create new markers
    items.forEach((item, index) => {
      console.log(`[MapView] Item ${index}:`, {
        name: item.name,
        lat: item.location_lat,
        lng: item.location_lng,
        category: item.category
      });
      
      if (!item.location_lat || !item.location_lng) {
        console.log(`[MapView] Item ${index} skipped - missing location`);
        return;
      }

      const marker = new google.maps.Marker({
        position: { lat: item.location_lat, lng: item.location_lng },
        map: googleMapRef.current,
        title: item.name,
        icon: createCustomMarkerIcon(item.category),
      });

      console.log(`[MapView] Created marker ${index} at`, { lat: item.location_lat, lng: item.location_lng });

      marker.addListener('click', () => {
        if (onMarkerPress) {
          onMarkerPress(item);
        }
      });

      markersRef.current.push(marker);
    });
    
    console.log('[MapView] Total markers created:', markersRef.current.length);
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

  // For mobile, we'll use react-native-maps with custom markers
  const MapViewNative = require('react-native-maps').default;

  return (
    <MapViewNative
      style={styles.map}
      initialRegion={region}
      showsUserLocation
      showsMyLocationButton
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

