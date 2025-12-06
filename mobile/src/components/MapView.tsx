import React, { useEffect, useRef, forwardRef, useImperativeHandle, useMemo } from 'react';
import { StyleSheet, Platform } from 'react-native';
import { SavedItem, ItemCategory } from '../types';
import { GOOGLE_MAPS_API_KEY } from '../config/maps';
import { createCustomMarkerIcon } from './CustomMarkers';
import { CategoryClusterMarker } from './CategoryClusterMarker';
import { clusterByCategory } from '../utils/mapClustering';

declare var google: any;

// Conditionally import CustomMapMarker only for mobile
const CustomMapMarker = Platform.OS !== 'web' 
  ? require('./CustomMarkers').CustomMapMarker 
  : null;

const Marker = Platform.OS !== 'web'
  ? require('react-native-maps').Marker
  : null;

// Modern dark map style - clean and minimal
const DARK_MAP_STYLE = [
  { "elementType": "geometry", "stylers": [{ "color": "#1d2c4d" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#8ec3b9" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#1a3646" }] },
  { "featureType": "administrative.country", "elementType": "geometry.stroke", "stylers": [{ "color": "#4b6878" }] },
  { "featureType": "administrative.land_parcel", "elementType": "labels.text.fill", "stylers": [{ "color": "#64779e" }] },
  { "featureType": "administrative.province", "elementType": "geometry.stroke", "stylers": [{ "color": "#4b6878" }] },
  { "featureType": "landscape.man_made", "elementType": "geometry.stroke", "stylers": [{ "color": "#334e87" }] },
  { "featureType": "landscape.natural", "elementType": "geometry", "stylers": [{ "color": "#023e58" }] },
  { "featureType": "poi", "elementType": "geometry", "stylers": [{ "color": "#283d6a" }] },
  { "featureType": "poi", "elementType": "labels.text.fill", "stylers": [{ "color": "#6f9ba5" }] },
  { "featureType": "poi", "elementType": "labels.text.stroke", "stylers": [{ "color": "#1d2c4d" }] },
  { "featureType": "poi.business", "stylers": [{ "visibility": "off" }] },
  { "featureType": "poi.park", "elementType": "geometry.fill", "stylers": [{ "color": "#023e58" }] },
  { "featureType": "poi.park", "elementType": "labels.text.fill", "stylers": [{ "color": "#3C7680" }] },
  { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#304a7d" }] },
  { "featureType": "road", "elementType": "labels.text.fill", "stylers": [{ "color": "#98a5be" }] },
  { "featureType": "road", "elementType": "labels.text.stroke", "stylers": [{ "color": "#1d2c4d" }] },
  { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#2c6675" }] },
  { "featureType": "road.highway", "elementType": "geometry.stroke", "stylers": [{ "color": "#255763" }] },
  { "featureType": "road.highway", "elementType": "labels.text.fill", "stylers": [{ "color": "#b0d5ce" }] },
  { "featureType": "road.highway", "elementType": "labels.text.stroke", "stylers": [{ "color": "#023e58" }] },
  { "featureType": "transit", "elementType": "labels.text.fill", "stylers": [{ "color": "#98a5be" }] },
  { "featureType": "transit", "elementType": "labels.text.stroke", "stylers": [{ "color": "#1d2c4d" }] },
  { "featureType": "transit.line", "elementType": "geometry.fill", "stylers": [{ "color": "#283d6a" }] },
  { "featureType": "transit.station", "elementType": "geometry", "stylers": [{ "color": "#3a4762" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#0e1626" }] },
  { "featureType": "water", "elementType": "labels.text.fill", "stylers": [{ "color": "#4e6d70" }] },
];

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
      styles: DARK_MAP_STYLE,
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
      // Validate coordinates are present and reasonable
      if (!item.location_lat || !item.location_lng) return;
      if (item.location_lat === 0 && item.location_lng === 0) return; // Skip null island
      if (Math.abs(item.location_lat) > 90 || Math.abs(item.location_lng) > 180) return; // Out of range

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
  const { PROVIDER_GOOGLE } = require('react-native-maps');

  // Memoize clusters to prevent recalculation on every render
  const clusters = useMemo(() => clusterByCategory(items), [items]);

  return (
    <MapViewNative
      ref={nativeMapRef}
      style={styles.map}
      provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
      initialRegion={region}
      mapType="standard"
      showsUserLocation={false}
      showsMyLocationButton={false}
      customMapStyle={DARK_MAP_STYLE}
    >
      {/* Category cluster markers */}
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

      {/* Show selected place marker on top of clusters - with coordinate validation */}
      {selectedPlace && 
       selectedPlace.location_lat && 
       selectedPlace.location_lng &&
       // Validate coordinates are reasonable (not 0,0 or out of range)
       !(selectedPlace.location_lat === 0 && selectedPlace.location_lng === 0) &&
       Math.abs(selectedPlace.location_lat) <= 90 &&
       Math.abs(selectedPlace.location_lng) <= 180 && (
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
