import React, { useEffect, useRef, forwardRef, useImperativeHandle, useMemo, useState } from 'react';
import { StyleSheet, Platform } from 'react-native';
import { SavedItem, ItemCategory } from '../types';
import { GOOGLE_MAPS_API_KEY } from '../config/maps';
import { GoogleStyleMarker, GoogleStyleClusterMarker } from './GoogleStyleMarker';
import { clusterByCategory } from '../utils/mapClustering';

declare var google: any;

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

// Threshold for showing individual markers vs clusters
const CLUSTER_THRESHOLD = 15; // Show individual markers if total items <= 15
const ZOOM_THRESHOLD = 0.05; // Show individual markers if zoomed in enough

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
  const [currentZoom, setCurrentZoom] = useState(region.latitudeDelta);

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

  // Create Google Maps style marker SVG
  const createGoogleStyleMarkerSVG = (item: SavedItem) => {
    const categoryColors: Record<string, string> = {
      food: '#EA4335',
      shopping: '#EA4335',
      place: '#4285F4',
      activity: '#34A853',
      accommodation: '#4285F4',
      tip: '#FBBC04',
    };
    
    const categoryIcons: Record<string, string> = {
      food: '🍴',
      shopping: '🛍️',
      place: '🏛️',
      activity: '🎯',
      accommodation: '🏨',
      tip: '💡',
    };

    const bgColor = categoryColors[item.category] || '#4285F4';
    const icon = categoryIcons[item.category] || '📍';
    const rating = item.rating ? Number(item.rating).toFixed(1) : '';
    const width = rating ? 70 : 40;

    const svgIcon = `
      <svg width="${width}" height="50" viewBox="0 0 ${width} 50" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.3"/>
          </filter>
        </defs>
        
        <!-- Pill shape -->
        <rect x="2" y="2" width="${width - 4}" height="32" rx="16" ry="16" fill="${bgColor}" filter="url(#shadow)"/>
        
        <!-- Icon -->
        <text x="${rating ? 14 : width / 2}" y="24" font-size="14" text-anchor="middle">${icon}</text>
        
        ${rating ? `<text x="${width - 18}" y="24" font-size="13" font-weight="bold" fill="white" text-anchor="middle">${rating}</text>` : ''}
        
        <!-- Pointer -->
        <polygon points="${width / 2 - 6},34 ${width / 2 + 6},34 ${width / 2},44" fill="${bgColor}"/>
      </svg>
    `;

    return {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svgIcon)}`,
      scaledSize: { width, height: 50 },
      anchor: { x: width / 2, y: 44 },
    };
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
      if (item.location_lat === 0 && item.location_lng === 0) return;
      if (Math.abs(item.location_lat) > 90 || Math.abs(item.location_lng) > 180) return;

      const marker = new google.maps.Marker({
        position: { lat: item.location_lat, lng: item.location_lng },
        map: googleMapRef.current,
        title: item.name,
        icon: createGoogleStyleMarkerSVG(item),
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

  // Determine if we should show individual markers or clusters
  const validItems = useMemo(() => {
    return (items || []).filter(item => 
      item && 
      item.id && 
      item.location_lat && 
      item.location_lng &&
      !(item.location_lat === 0 && item.location_lng === 0) &&
      Math.abs(item.location_lat) <= 90 &&
      Math.abs(item.location_lng) <= 180
    );
  }, [items]);

  // Show individual markers if few items or zoomed in
  const showIndividualMarkers = validItems.length <= CLUSTER_THRESHOLD || currentZoom < ZOOM_THRESHOLD;

  // Get clusters for zoomed out view
  const clusters = useMemo(() => {
    if (showIndividualMarkers) return [];
    return clusterByCategory(validItems);
  }, [validItems, showIndividualMarkers]);

  const handleRegionChange = (newRegion: any) => {
    setCurrentZoom(newRegion.latitudeDelta);
  };

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
      onRegionChangeComplete={handleRegionChange}
    >
      {showIndividualMarkers ? (
        // Show individual Google-style markers with ratings
        validItems.map((item) => (
          <Marker
            key={`item-${item.id}`}
            coordinate={{
              latitude: item.location_lat!,
              longitude: item.location_lng!,
            }}
            onPress={() => onMarkerPress && onMarkerPress(item)}
            tracksViewChanges={false}
          >
            <GoogleStyleMarker
              item={item}
              isSelected={selectedPlace?.id === item.id}
            />
          </Marker>
        ))
      ) : (
        // Show cluster markers when zoomed out
        clusters.map((cluster) => (
          <Marker
            key={`cluster-${cluster.category}`}
            coordinate={{
              latitude: cluster.centerLat,
              longitude: cluster.centerLng,
            }}
            onPress={() => onClusterPress && onClusterPress(cluster.category, cluster.items)}
            tracksViewChanges={false}
          >
            <GoogleStyleClusterMarker
              category={cluster.category}
              count={cluster.count}
            />
          </Marker>
        ))
      )}
    </MapViewNative>
  );
});

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
});
