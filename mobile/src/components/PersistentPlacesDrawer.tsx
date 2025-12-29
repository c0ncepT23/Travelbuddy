/**
 * PersistentPlacesDrawer - Airbnb-style always-visible bottom drawer
 * 
 * Features:
 * - Always visible on map screen (not modal)
 * - Snap points: Peek (15%), Half (50%), Full (85%)
 * - Collapsed: Count + horizontal card scroll
 * - Half/Full: Vertical FlatList
 * - Syncs with category filter + map bounds
 * - Tap card → cinematic fly-to animation
 */

import React, { useCallback, useMemo, useRef, forwardRef, useImperativeHandle, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { FlatList } from 'react-native-gesture-handler';
import FastImage from 'react-native-fast-image';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { SavedItem } from '../types';
import * as Haptics from 'expo-haptics';
import { getPlacePhotoUrl } from '../config/maps';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Tab bar height to account for bottom navigation
const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 60 : 50;

// Effective height for drawer calculations
const DRAWER_HEIGHT = SCREEN_HEIGHT - TAB_BAR_HEIGHT;

// Snap points as percentages of drawer height
const SNAP_POINTS = {
  PEEK: DRAWER_HEIGHT * 0.22,       // 22% - Ensures full card (image + name + rating) is visible
  HALF: DRAWER_HEIGHT * 0.45,       // 45% - Browse mode
  FULL: DRAWER_HEIGHT * 0.85,       // 85% - Full list
};

// Colors matching the Midnight Discovery palette
const COLORS = {
  background: 'rgba(15, 17, 21, 0.98)',
  surface: 'rgba(23, 25, 31, 0.95)',
  surfaceLight: 'rgba(39, 41, 47, 0.8)',
  primaryGlow: '#06B6D4', // Electric Cyan
  secondaryGlow: '#22D3EE',
  accent: '#22C55E',
  text: '#FFFFFF',
  textSecondary: '#94A3B8',
  border: 'rgba(6, 182, 212, 0.2)',
};

// Compact horizontal card for peek mode
interface CompactCardProps {
  item: SavedItem;
  onPress: (item: SavedItem) => void;
  isSelected: boolean;
}

const CompactCard: React.FC<CompactCardProps> = ({ item, onPress, isSelected }) => {
  // Use the helper that converts photo_reference to Google Photo URL
  const photoUrl = useMemo(() => {
    return getPlacePhotoUrl(item?.photos_json, 200); // 200px width for compact cards
  }, [item?.photos_json]);

  const categoryEmoji = useMemo(() => {
    const cat = item.category?.toLowerCase();
    switch (cat) {
      case 'food': return '🍔';
      case 'activity': return '🎯';
      case 'shopping': return '🛍️';
      case 'nightlife': return '🎉';
      case 'accommodation': return '🏨';
      default: return '📍';
    }
  }, [item.category]);

  return (
    <TouchableOpacity
      style={[styles.compactCard, isSelected && styles.compactCardSelected]}
      onPress={() => onPress(item)}
      activeOpacity={0.85}
    >
      <View style={styles.compactImageContainer}>
        {photoUrl ? (
          <FastImage 
            source={{ uri: photoUrl, priority: FastImage.priority.normal, cache: FastImage.cacheControl.immutable }}
            style={styles.compactImage}
            resizeMode={FastImage.resizeMode.cover}
          />
        ) : (
          <View style={styles.compactPlaceholder}>
            <Text style={styles.compactPlaceholderEmoji}>{categoryEmoji}</Text>
          </View>
        )}
        {/* Category badge - top right corner */}
        <View style={styles.compactCategoryBadge}>
          <Text style={styles.compactCategoryEmoji}>{categoryEmoji}</Text>
        </View>
      </View>
      <Text style={styles.compactName} numberOfLines={1}>{item.name}</Text>
      {item.rating && (
        <View style={styles.compactRating}>
          <Ionicons name="star" size={10} color="#FFD700" />
          <Text style={styles.compactRatingText}>
            {typeof item.rating === 'number' ? item.rating.toFixed(1) : item.rating}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

// Full vertical card for half/full mode
interface FullCardProps {
  item: SavedItem;
  onPress: (item: SavedItem) => void;
  isSelected: boolean;
}

const FullCard: React.FC<FullCardProps> = ({ item, onPress, isSelected }) => {
  // Use the helper that converts photo_reference to Google Photo URL
  const photoUrl = useMemo(() => {
    return getPlacePhotoUrl(item?.photos_json, 300); // 300px width for full cards
  }, [item?.photos_json]);

  const categoryEmoji = useMemo(() => {
    const cat = item.category?.toLowerCase();
    switch (cat) {
      case 'food': return '🍔';
      case 'activity': return '🎯';
      case 'shopping': return '🛍️';
      case 'nightlife': return '🎉';
      case 'accommodation': return '🏨';
      default: return '📍';
    }
  }, [item.category]);

  return (
    <TouchableOpacity
      style={[styles.fullCard, isSelected && styles.fullCardSelected]}
      onPress={() => onPress(item)}
      activeOpacity={0.85}
    >
      {/* Left: Image */}
      <View style={styles.fullCardImageContainer}>
        {photoUrl ? (
          <FastImage 
            source={{ uri: photoUrl, priority: FastImage.priority.normal, cache: FastImage.cacheControl.immutable }}
            style={styles.fullCardImage}
            resizeMode={FastImage.resizeMode.cover}
          />
        ) : (
          <View style={styles.fullCardPlaceholder}>
            <Text style={styles.fullCardPlaceholderEmoji}>{categoryEmoji}</Text>
          </View>
        )}
      </View>
      
      {/* Right: Info */}
      <View style={styles.fullCardInfo}>
        <Text style={styles.fullCardName} numberOfLines={1}>{item.name}</Text>
        <View style={styles.fullCardMeta}>
          {item.rating && (
            <View style={styles.fullCardRating}>
              <Ionicons name="star" size={12} color="#FFD700" />
              <Text style={styles.fullCardRatingText}>
                {typeof item.rating === 'number' ? item.rating.toFixed(1) : item.rating}
              </Text>
            </View>
          )}
          <Text style={styles.fullCardLocation} numberOfLines={1}>
            {item.area_name || item.location_name || ''}
          </Text>
        </View>
        {item.cuisine_type && (
          <View style={styles.fullCardTag}>
            <Text style={styles.fullCardTagText}>{item.cuisine_type}</Text>
          </View>
        )}
      </View>
      
      {/* Arrow */}
      <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
    </TouchableOpacity>
  );
};

export interface PersistentPlacesDrawerRef {
  expand: () => void;
  collapse: () => void;
  peek: () => void;
}

interface PersistentPlacesDrawerProps {
  items: SavedItem[];
  selectedCategory: string;
  categoryLabel: string;
  categoryEmoji: string;
  categoryColor: string;
  onPlaceSelect: (item: SavedItem) => void;
  selectedPlaceId?: string | null;
}

export const PersistentPlacesDrawer = forwardRef<PersistentPlacesDrawerRef, PersistentPlacesDrawerProps>(({
  items,
  selectedCategory,
  categoryLabel,
  categoryEmoji,
  categoryColor,
  onPlaceSelect,
  selectedPlaceId,
}, ref) => {
  const translateY = useSharedValue(DRAWER_HEIGHT - SNAP_POINTS.PEEK);
  const currentSnapPoint = useSharedValue(SNAP_POINTS.PEEK);
  const context = useSharedValue({ y: 0 });
  
  // Track current mode for conditional rendering
  const [isPeekMode, setIsPeekMode] = useState(true);

  // Snap to a specific point
  const snapTo = useCallback((point: number) => {
    translateY.value = withSpring(DRAWER_HEIGHT - point, {
      damping: 20,
      stiffness: 150,
    });
    currentSnapPoint.value = point;
    setIsPeekMode(point <= SNAP_POINTS.PEEK);
  }, []);

  // Expose methods to parent
  useImperativeHandle(ref, () => ({
    expand: () => snapTo(SNAP_POINTS.FULL),
    collapse: () => snapTo(SNAP_POINTS.HALF),
    peek: () => snapTo(SNAP_POINTS.PEEK),
  }), [snapTo]);

  // Handle place tap
  const handlePlacePress = useCallback((item: SavedItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPlaceSelect(item);
    // Auto-collapse to peek when selecting a place (to see the map animation)
    snapTo(SNAP_POINTS.PEEK);
  }, [onPlaceSelect, snapTo]);

  // Pan gesture for dragging
  const panGesture = Gesture.Pan()
    .activeOffsetY([-10, 10]) // Only trigger if vertical movement > 10px
    .failOffsetX([-20, 20])   // Fail if horizontal movement > 20px (let horizontal list work)
    .onStart(() => {
      'worklet';
      context.value = { y: translateY.value };
    })
    .onUpdate((event) => {
      'worklet';
      const newY = context.value.y + event.translationY;
      // Clamp between full and peek
      translateY.value = Math.max(
        DRAWER_HEIGHT - SNAP_POINTS.FULL,
        Math.min(DRAWER_HEIGHT - SNAP_POINTS.PEEK + 20, newY) // Small overscroll allowed
      );
    })
    .onEnd((event) => {
      'worklet';
      const currentHeight = DRAWER_HEIGHT - translateY.value;
      const velocity = event.velocityY;

      let targetSnap: number;

      if (velocity > 500) {
        // Fast swipe down
        if (currentHeight > SNAP_POINTS.HALF) {
          targetSnap = SNAP_POINTS.HALF;
        } else {
          targetSnap = SNAP_POINTS.PEEK;
        }
      } else if (velocity < -500) {
        // Fast swipe up
        if (currentHeight < SNAP_POINTS.HALF) {
          targetSnap = SNAP_POINTS.HALF;
        } else {
          targetSnap = SNAP_POINTS.FULL;
        }
      } else {
        // Slow drag - snap to nearest
        const distToPeek = Math.abs(currentHeight - SNAP_POINTS.PEEK);
        const distToHalf = Math.abs(currentHeight - SNAP_POINTS.HALF);
        const distToFull = Math.abs(currentHeight - SNAP_POINTS.FULL);

        if (distToPeek < distToHalf && distToPeek < distToFull) {
          targetSnap = SNAP_POINTS.PEEK;
        } else if (distToFull < distToHalf) {
          targetSnap = SNAP_POINTS.FULL;
        } else {
          targetSnap = SNAP_POINTS.HALF;
        }
      }

      translateY.value = withSpring(DRAWER_HEIGHT - targetSnap, {
        damping: 20,
        stiffness: 150,
      });
      currentSnapPoint.value = targetSnap;
      runOnJS(setIsPeekMode)(targetSnap <= SNAP_POINTS.PEEK);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  // Animated opacity for content switching
  const peekContentOpacity = useAnimatedStyle(() => {
    const height = DRAWER_HEIGHT - translateY.value;
    return {
      opacity: interpolate(
        height,
        [SNAP_POINTS.PEEK, SNAP_POINTS.HALF * 0.7],
        [1, 0],
        Extrapolation.CLAMP
      ),
    };
  });

  const listContentOpacity = useAnimatedStyle(() => {
    const height = DRAWER_HEIGHT - translateY.value;
    return {
      opacity: interpolate(
        height,
        [SNAP_POINTS.PEEK * 1.5, SNAP_POINTS.HALF * 0.8],
        [0, 1],
        Extrapolation.CLAMP
      ),
    };
  });

  // Render horizontal compact cards for peek mode
  const renderCompactItem = useCallback(({ item }: { item: SavedItem }) => (
    <CompactCard
      item={item}
      onPress={handlePlacePress}
      isSelected={selectedPlaceId === item.id}
    />
  ), [handlePlacePress, selectedPlaceId]);

  // Render full cards for half/full mode
  const renderFullItem = useCallback(({ item }: { item: SavedItem }) => (
    <FullCard
      item={item}
      onPress={handlePlacePress}
      isSelected={selectedPlaceId === item.id}
    />
  ), [handlePlacePress, selectedPlaceId]);

  const renderEmpty = useCallback(() => (
    <View style={styles.emptyContainer}>
      <Ionicons name="map-outline" size={36} color={COLORS.textSecondary} />
      <Text style={styles.emptyText}>No places in this area</Text>
      <Text style={styles.emptyHint}>Zoom out to see more places</Text>
    </View>
  ), []);

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      {/* Glassmorphism background */}
      <View style={styles.glassContainer}>
        {Platform.OS === 'ios' ? (
          <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.androidBlur]} />
        )}
        <LinearGradient
          colors={[categoryColor + '40', 'transparent']}
          style={styles.topGlow}
        />
      </View>

      {/* Draggable Header */}
      <GestureDetector gesture={panGesture}>
        <Animated.View style={styles.header}>
          <View style={styles.handleIndicator} />
          <View style={styles.headerContent}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerEmoji}>{categoryEmoji}</Text>
              <View>
                <Text style={styles.headerTitle}>{categoryLabel}</Text>
                <Text style={styles.headerSubtitle}>
                  {items.length} {items.length === 1 ? 'place' : 'places'} in view
                </Text>
              </View>
            </View>
            <View style={[styles.countBadge, { backgroundColor: categoryColor }]}>
              <Text style={styles.countBadgeText}>{items.length}</Text>
            </View>
          </View>
        </Animated.View>
      </GestureDetector>

      {/* PEEK MODE: Horizontal scroll of compact cards */}
      <Animated.View style={[styles.peekContent, peekContentOpacity]} pointerEvents={isPeekMode ? 'auto' : 'none'}>
        {items.length > 0 ? (
          <FlatList
            data={items.slice(0, 10)} // Limit to 10 for peek mode
            keyExtractor={(item) => item.id}
            renderItem={renderCompactItem}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.peekList}
            snapToInterval={88}
            decelerationRate="fast"
            nestedScrollEnabled={true}
            scrollEnabled={true}
          />
        ) : (
          <View style={styles.peekEmptyContainer}>
            <Text style={styles.peekEmptyText}>🗺️ Pan or zoom out to discover places</Text>
          </View>
        )}
      </Animated.View>

      {/* HALF/FULL MODE: Vertical list */}
      <Animated.View style={[styles.listContent, listContentOpacity]} pointerEvents={isPeekMode ? 'none' : 'auto'}>
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderFullItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.fullList}
          ListEmptyComponent={renderEmpty}
        />
      </Animated.View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: TAB_BAR_HEIGHT,
    height: SCREEN_HEIGHT - TAB_BAR_HEIGHT,
    zIndex: 100,
  },
  glassContainer: {
    ...StyleSheet.absoluteFillObject,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  androidBlur: {
    backgroundColor: COLORS.background,
  },
  topGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 60,
  },
  gestureRoot: {
    flex: 1,
  },
  
  // Header
  header: {
    paddingTop: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  handleIndicator: {
    width: 36,
    height: 4,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 10,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerEmoji: {
    fontSize: 24,
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  headerSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  countBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  countBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  
  // Peek mode (horizontal scroll)
  peekContent: {
    position: 'absolute',
    top: 70,
    left: 0,
    right: 0,
    height: 140,
  },
  peekList: {
    paddingHorizontal: 16,
    height: 120, // Explicit height for peek mode scroll
  },
  
  // Compact card (peek mode)
  compactCard: {
    width: 110,
    marginRight: 12,
  },
  compactCardSelected: {
    transform: [{ scale: 1.05 }],
  },
  compactImageContainer: {
    width: 110,
    height: 80,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: COLORS.surface,
  },
  compactImage: {
    width: '100%',
    height: '100%',
  },
  compactPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceLight,
  },
  compactPlaceholderEmoji: {
    fontSize: 24,
  },
  compactCategoryBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  compactCategoryEmoji: {
    fontSize: 10,
  },
  compactName: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 4,
  },
  compactRating: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  compactRatingText: {
    fontSize: 10,
    color: '#FFD700',
    marginLeft: 2,
  },
  
  // List mode (vertical scroll)
  listContent: {
    position: 'absolute',
    top: 70,
    left: 0,
    right: 0,
    bottom: 0,
  },
  fullList: {
    paddingHorizontal: 12,
    paddingBottom: 100,
  },
  
  // Full card (list mode)
  fullCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  fullCardSelected: {
    borderColor: COLORS.primaryGlow,
    borderWidth: 2,
  },
  fullCardImageContainer: {
    width: 56,
    height: 56,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: COLORS.surfaceLight,
  },
  fullCardImage: {
    width: '100%',
    height: '100%',
  },
  fullCardPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullCardPlaceholderEmoji: {
    fontSize: 24,
  },
  fullCardInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  fullCardName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  fullCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  fullCardRating: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  fullCardRatingText: {
    fontSize: 12,
    color: '#FFD700',
    marginLeft: 3,
  },
  fullCardLocation: {
    fontSize: 12,
    color: COLORS.textSecondary,
    flex: 1,
  },
  fullCardTag: {
    marginTop: 4,
    alignSelf: 'flex-start',
    backgroundColor: COLORS.surfaceLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  fullCardTagText: {
    fontSize: 10,
    color: COLORS.primaryGlow,
    fontWeight: '600',
  },
  
  // Empty state
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 8,
  },
  emptyHint: {
    fontSize: 12,
    color: COLORS.primaryGlow,
    marginTop: 4,
    opacity: 0.7,
  },
  peekEmptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  peekEmptyText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
});

export default PersistentPlacesDrawer;

