import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SavedItem, ItemCategory } from '../types';

interface GoogleStyleMarkerProps {
  item: SavedItem;
  onPress?: () => void;
  isSelected?: boolean;
}

// Google Maps style category config
const CATEGORY_CONFIG: Record<string, { icon: string; color: string; bgColor: string }> = {
  food: {
    icon: '🍴',
    color: '#FFFFFF',
    bgColor: '#EA4335', // Google red
  },
  shopping: {
    icon: '🛍️',
    color: '#FFFFFF', 
    bgColor: '#EA4335', // Google red
  },
  place: {
    icon: '🏛️',
    color: '#FFFFFF',
    bgColor: '#4285F4', // Google blue
  },
  activity: {
    icon: '🎯',
    color: '#FFFFFF',
    bgColor: '#34A853', // Google green
  },
  accommodation: {
    icon: '🏨',
    color: '#FFFFFF',
    bgColor: '#4285F4', // Google blue
  },
  tip: {
    icon: '💡',
    color: '#FFFFFF',
    bgColor: '#FBBC04', // Google yellow
  },
};

export const GoogleStyleMarker: React.FC<GoogleStyleMarkerProps> = ({
  item,
  onPress,
  isSelected = false,
}) => {
  const config = CATEGORY_CONFIG[item.category] || CATEGORY_CONFIG.place;
  const hasRating = item.rating && item.rating > 0;
  const displayRating = hasRating ? Number(item.rating).toFixed(1) : null;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
      <View style={[
        styles.container, 
        { backgroundColor: config.bgColor },
        isSelected && styles.selectedContainer,
      ]}>
        <Text style={styles.icon}>{config.icon}</Text>
        {displayRating && (
          <Text style={[styles.rating, { color: config.color }]}>{displayRating}</Text>
        )}
      </View>
      {/* Pin pointer */}
      <View style={[styles.pointer, { borderTopColor: config.bgColor }]} />
    </TouchableOpacity>
  );
};

// Cluster marker (for zoomed out view showing count)
interface ClusterMarkerProps {
  category: ItemCategory;
  count: number;
  onPress?: () => void;
}

export const GoogleStyleClusterMarker: React.FC<ClusterMarkerProps> = ({
  category,
  count,
  onPress,
}) => {
  const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.place;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
      <View style={[styles.container, { backgroundColor: config.bgColor }]}>
        <Text style={styles.icon}>{config.icon}</Text>
        <Text style={[styles.count, { color: config.color }]}>{count}</Text>
      </View>
      <View style={[styles.pointer, { borderTopColor: config.bgColor }]} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    minWidth: 50,
    minHeight: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  selectedContainer: {
    transform: [{ scale: 1.15 }],
    shadowOpacity: 0.5,
    shadowRadius: 8,
  },
  icon: {
    fontSize: 14,
  },
  rating: {
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 4,
  },
  count: {
    fontSize: 14,
    fontWeight: '800',
    marginLeft: 4,
  },
  pointer: {
    alignSelf: 'center',
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -1,
  },
});

