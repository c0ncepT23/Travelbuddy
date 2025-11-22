import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ItemCategory } from '../types';

interface CategoryClusterMarkerProps {
  category: ItemCategory;
  count: number;
  onPress: () => void;
}

const CATEGORY_CONFIG = {
  [ItemCategory.FOOD]: {
    emoji: '🍜',
    label: 'Food',
    color: '#FF6B6B',
    backgroundColor: '#FFE8E8',
  },
  [ItemCategory.SHOPPING]: {
    emoji: '🛍️',
    label: 'Shopping',
    color: '#4ECDC4',
    backgroundColor: '#E0F7F6',
  },
  [ItemCategory.ACTIVITY]: {
    emoji: '🎯',
    label: 'Activities',
    color: '#FFD93D',
    backgroundColor: '#FFF8E1',
  },
  [ItemCategory.PLACE]: {
    emoji: '📍',
    label: 'Places',
    color: '#6C5CE7',
    backgroundColor: '#F0EDFF',
  },
  [ItemCategory.ACCOMMODATION]: {
    emoji: '🏨',
    label: 'Hotels',
    color: '#A8E6CF',
    backgroundColor: '#E8F8F5',
  },
  [ItemCategory.TIP]: {
    emoji: '💡',
    label: 'Tips',
    color: '#FFA502',
    backgroundColor: '#FFF3E0',
  },
};

export const CategoryClusterMarker: React.FC<CategoryClusterMarkerProps> = ({
  category,
  count,
  onPress,
}) => {
  const config = CATEGORY_CONFIG[category];

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.container, { backgroundColor: config.backgroundColor, borderColor: config.color }]}>
        <Text style={styles.emoji}>{config.emoji}</Text>
        <Text style={[styles.label, { color: config.color }]}>
          {config.label} {count}
        </Text>
      </View>
      {/* Pointer triangle */}
      <View style={[styles.pointer, { borderTopColor: config.color }]} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  emoji: {
    fontSize: 18,
    marginRight: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
  },
  pointer: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    alignSelf: 'center',
    marginTop: -2,
  },
});

