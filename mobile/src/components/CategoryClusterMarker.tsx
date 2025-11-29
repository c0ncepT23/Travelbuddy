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
    emoji: '🍽️',
    label: 'Food',
    color: '#FFFFFF',
    backgroundColor: '#EF4444',
  },
  [ItemCategory.SHOPPING]: {
    emoji: '🛍️',
    label: 'Shopping',
    color: '#FFFFFF',
    backgroundColor: '#10B981',
  },
  [ItemCategory.ACTIVITY]: {
    emoji: '🎯',
    label: 'Activities',
    color: '#FFFFFF',
    backgroundColor: '#F59E0B',
  },
  [ItemCategory.PLACE]: {
    emoji: '🏛️',
    label: 'Places',
    color: '#FFFFFF',
    backgroundColor: '#6366F1',
  },
  [ItemCategory.ACCOMMODATION]: {
    emoji: '🏨',
    label: 'Hotels',
    color: '#FFFFFF',
    backgroundColor: '#8B5CF6',
  },
  [ItemCategory.TIP]: {
    emoji: '💡',
    label: 'Tips',
    color: '#FFFFFF',
    backgroundColor: '#EC4899',
  },
};

export const CategoryClusterMarker: React.FC<CategoryClusterMarkerProps> = ({
  category,
  count,
  onPress,
}) => {
  const config = CATEGORY_CONFIG[category];

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
      <View style={[styles.container, { backgroundColor: config.backgroundColor }]}>
        <Text style={styles.emoji}>{config.emoji}</Text>
        <Text style={[styles.count, { color: config.color }]}>{count}</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 24,
    minWidth: 60,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  emoji: {
    fontSize: 18,
    marginRight: 6,
  },
  count: {
    fontSize: 16,
    fontWeight: '800',
  },
});
