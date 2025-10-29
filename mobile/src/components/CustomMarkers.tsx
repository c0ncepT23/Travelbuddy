import React from 'react';
import { View, Text, StyleSheet, Image, Platform } from 'react-native';
import { SavedItem } from '../types';

// Custom marker icons as SVG strings (for web) or images (for mobile)
const MARKER_ICONS = {
  food: {
    emoji: '🍽️',
    color: '#FF6B6B',
    backgroundColor: '#FFF5F5',
  },
  shopping: {
    emoji: '🛍️',
    color: '#FFD93D',
    backgroundColor: '#FFFEF5',
  },
  place: {
    emoji: '📍',
    color: '#4ECDC4',
    backgroundColor: '#F0FFFE',
  },
  activity: {
    emoji: '🎯',
    color: '#95E1D3',
    backgroundColor: '#F5FFFC',
  },
  accommodation: {
    emoji: '🏨',
    color: '#A8E6CF',
    backgroundColor: '#F5FFF9',
  },
  tip: {
    emoji: '💡',
    color: '#C7CEEA',
    backgroundColor: '#F8F9FF',
  },
};

interface CustomMarkerProps {
  item: SavedItem;
  onPress?: () => void;
}

// For React Native Maps (mobile only)
export const CustomMapMarker: React.FC<CustomMarkerProps> = ({ item, onPress }) => {
  // Only import Marker on mobile platforms
  if (Platform.OS === 'web') {
    return null; // This component should never be used on web
  }
  
  const Marker = require('react-native-maps').Marker;
  const icon = MARKER_ICONS[item.category] || MARKER_ICONS.place;
  
  return (
    <Marker
      coordinate={{
        latitude: item.location_lat!,
        longitude: item.location_lng!,
      }}
      onPress={onPress}
    >
      <View style={[styles.markerContainer, { backgroundColor: icon.backgroundColor }]}>
        <View style={[styles.markerInner, { backgroundColor: icon.color }]}>
          <Text style={styles.markerEmoji}>{icon.emoji}</Text>
        </View>
        <View style={[styles.markerPointer, { borderTopColor: icon.backgroundColor }]} />
      </View>
    </Marker>
  );
};

// For Google Maps Web
export const createCustomMarkerIcon = (category: string) => {
  const icon = MARKER_ICONS[category] || MARKER_ICONS.place;
  
  // Create an SVG icon for Google Maps
  const svgIcon = `
    <svg width="40" height="50" viewBox="0 0 40 50" xmlns="http://www.w3.org/2000/svg">
      <g>
        <!-- Shadow -->
        <ellipse cx="20" cy="48" rx="8" ry="2" fill="#000" opacity="0.2"/>
        
        <!-- Pin shape -->
        <path d="M20 0 C8.954 0 0 8.954 0 20 C0 25 2 29 4 32 L20 48 L36 32 C38 29 40 25 40 20 C40 8.954 31.046 0 20 0 Z" 
              fill="${icon.backgroundColor}" 
              stroke="${icon.color}" 
              stroke-width="2"/>
        
        <!-- Inner circle -->
        <circle cx="20" cy="20" r="14" fill="${icon.color}"/>
        
        <!-- Emoji placeholder (will use actual emoji in implementation) -->
        <text x="20" y="26" font-size="18" text-anchor="middle" fill="white">${icon.emoji}</text>
      </g>
    </svg>
  `;
  
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svgIcon)}`,
    scaledSize: { width: 40, height: 50 },
    anchor: { x: 20, y: 48 },
  };
};

const styles = StyleSheet.create({
  markerContainer: {
    alignItems: 'center',
    width: 44,
    height: 54,
  },
  markerInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 5,
  },
  markerEmoji: {
    fontSize: 20,
  },
  markerPointer: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 12,
    borderStyle: 'solid',
    backgroundColor: 'transparent',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -2,
  },
});
