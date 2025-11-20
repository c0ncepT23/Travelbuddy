import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { SavedItem } from '../types';

// 3D Neon-style marker icons
const MARKER_ICONS_NEON = {
  food: {
    emoji: '🍜',
    color: '#F472B6',
    glowColor: '#F472B6',
  },
  shopping: {
    emoji: '🛍️',
    color: '#FBBF24',
    glowColor: '#FBBF24',
  },
  place: {
    emoji: '📍',
    color: '#06B6D4',
    glowColor: '#06B6D4',
  },
  activity: {
    emoji: '🎯',
    color: '#84CC16',
    glowColor: '#84CC16',
  },
  accommodation: {
    emoji: '🏨',
    color: '#A78BFA',
    glowColor: '#A78BFA',
  },
  tip: {
    emoji: '💡',
    color: '#FCD34D',
    glowColor: '#FCD34D',
  },
};

type MarkerCategory = keyof typeof MARKER_ICONS_NEON;

interface CustomMarkerProps {
  item: SavedItem;
  onPress?: () => void;
}

// For React Native Maps (mobile only)
export const CustomMapMarker: React.FC<CustomMarkerProps> = ({ item, onPress }) => {
  if (Platform.OS === 'web') {
    return null;
  }
  
  const Marker = require('react-native-maps').Marker;
  const icon = MARKER_ICONS_NEON[item.category as MarkerCategory] || MARKER_ICONS_NEON.place;
  
  return (
    <Marker
      coordinate={{
        latitude: item.location_lat!,
        longitude: item.location_lng!,
      }}
      onPress={onPress}
    >
      <View style={styles.markerContainer}>
        {/* Outer glow ring */}
        <View style={[styles.glowRing, { backgroundColor: icon.glowColor, opacity: 0.3 }]} />
        
        {/* Main marker body */}
        <View style={[styles.markerBody, { backgroundColor: icon.color }]}>
          <Text style={styles.markerEmoji}>{icon.emoji}</Text>
        </View>
        
        {/* Bottom shadow */}
        <View style={styles.markerShadow} />
      </View>
    </Marker>
  );
};

// For Google Maps Web - Create 3D Neon SVG
export const createCustomMarkerIcon = (category: string) => {
  const icon = MARKER_ICONS_NEON[category as MarkerCategory] || MARKER_ICONS_NEON.place;
  
  const svgIcon = `
    <svg width="50" height="60" viewBox="0 0 50 60" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      
      <!-- Glow ring -->
      <circle cx="25" cy="25" r="22" fill="${icon.glowColor}" opacity="0.3" filter="url(#glow)"/>
      
      <!-- Main circle -->
      <circle cx="25" cy="25" r="18" fill="${icon.color}" stroke="white" stroke-width="3" filter="url(#glow)"/>
      
      <!-- Emoji -->
      <text x="25" y="32" font-size="22" text-anchor="middle" fill="white">${icon.emoji}</text>
      
      <!-- Pin drop shadow -->
      <ellipse cx="25" cy="57" rx="6" ry="2" fill="#000" opacity="0.4"/>
    </svg>
  `;
  
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svgIcon)}`,
    scaledSize: { width: 50, height: 60 },
    anchor: { x: 25, y: 55 },
  };
};

const styles = StyleSheet.create({
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 50,
    height: 60,
  },
  glowRing: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    top: 3,
  },
  markerBody: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 8,
  },
  markerEmoji: {
    fontSize: 20,
  },
  markerShadow: {
    position: 'absolute',
    bottom: 0,
    width: 12,
    height: 4,
    borderRadius: 6,
    backgroundColor: '#000',
    opacity: 0.4,
  },
});
