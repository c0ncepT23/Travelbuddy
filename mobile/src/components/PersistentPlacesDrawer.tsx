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
import { BouncyPressable } from './BouncyPressable';
import theme from '../config/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Tab bar height to account for bottom navigation
const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 60 : 50;

// Effective height for drawer calculations
const DRAWER_HEIGHT = SCREEN_HEIGHT - TAB_BAR_HEIGHT;

// Snap points as percentages of drawer height
const SNAP_POINTS = {
  PEEK: DRAWER_HEIGHT * 0.22,
  HALF: DRAWER_HEIGHT * 0.45,
  FULL: DRAWER_HEIGHT - 200, // Leaves room for category chips at the top
};

// Compact horizontal card for peek mode
interface CompactCardProps {
  item: SavedItem;
  onPress: (item: SavedItem) => void;
  isSelected: boolean;
}

const CompactCard: React.FC<CompactCardProps> = ({ item, onPress, isSelected }) => {
  const photoUrl = useMemo(() => {
    return getPlacePhotoUrl(item?.photos_json, 200); 
  }, [item?.photos_json]);

  const categoryEmoji = useMemo(() => {
    const cat = item.category?.toLowerCase();
    switch (cat) {
      case 'food': return '🍜';
      case 'activity': return '🎯';
      case 'shopping': return '🛍️';
      case 'nightlife': return '🎉';
      case 'accommodation': return '🏨';
      default: return '📍';
    }
  }, [item.category]);

  const categoryColor = useMemo(() => {
    const cat = item.category?.toLowerCase();
    return (theme.categoryColors[cat] || theme.categoryColors.place).accent;
  }, [item.category]);

  return (
    <BouncyPressable
      style={[styles.compactCard, isSelected && { borderColor: categoryColor, borderWidth: 2 }]}
      onPress={() => onPress(item)}
      hapticType={Haptics.ImpactFeedbackStyle.Light}
    >
      <View style={styles.compactImageContainer}>
        {photoUrl ? (
          <FastImage 
            source={{ uri: photoUrl, priority: FastImage.priority.normal, cache: FastImage.cacheControl.immutable }}
            style={styles.compactImage}
            resizeMode={FastImage.resizeMode.cover}
          />
        ) : (
          <View style={[styles.compactPlaceholder, { backgroundColor: categoryColor + '15' }]}>
            <Text style={styles.compactPlaceholderEmoji}>{categoryEmoji}</Text>
          </View>
        )}
        <View style={[styles.compactCategoryBadge, { backgroundColor: categoryColor }]}>
          <Text style={[styles.compactCategoryEmoji, { color: '#FFFFFF' }]}>{categoryEmoji}</Text>
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
    </BouncyPressable>
  );
};

// Full vertical card for half/full mode
interface FullCardProps {
  item: SavedItem;
  onPress: (item: SavedItem) => void;
  isSelected: boolean;
}

const FullCard: React.FC<FullCardProps> = ({ item, onPress, isSelected }) => {
  const photoUrl = useMemo(() => {
    return getPlacePhotoUrl(item?.photos_json, 300);
  }, [item?.photos_json]);

  const categoryEmoji = useMemo(() => {
    const cat = item.category?.toLowerCase();
    switch (cat) {
      case 'food': return '🍜';
      case 'activity': return '🎯';
      case 'shopping': return '🛍️';
      case 'nightlife': return '🎉';
      case 'accommodation': return '🏨';
      default: return '📍';
    }
  }, [item.category]);

  return (
    <BouncyPressable
      style={[styles.fullCard, isSelected && styles.fullCardSelected]}
      onPress={() => onPress(item)}
      hapticType={Haptics.ImpactFeedbackStyle.Light}
    >
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
      <Ionicons name="chevron-forward" size={18} color={theme.colors.textSecondary} />
    </BouncyPressable>
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
  isHidden?: boolean;
}

export const PersistentPlacesDrawer = forwardRef<PersistentPlacesDrawerRef, PersistentPlacesDrawerProps>(({
  items,
  selectedCategory,
  categoryLabel,
  categoryEmoji,
  categoryColor,
  onPlaceSelect,
  selectedPlaceId,
  isHidden = false,
}, ref) => {
  const translateY = useSharedValue(DRAWER_HEIGHT - SNAP_POINTS.PEEK);
  const hideTranslateY = useSharedValue(0);
  const currentSnapPoint = useSharedValue(SNAP_POINTS.PEEK);
  const context = useSharedValue({ y: 0 });
  
  const [isPeekMode, setIsPeekMode] = useState(true);

  // Handle hidden state animation
  useEffect(() => {
    hideTranslateY.value = withSpring(isHidden ? DRAWER_HEIGHT : 0, {
      damping: 20,
      stiffness: 120,
    });
  }, [isHidden]);

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
    .activeOffsetY([-10, 10])
    .failOffsetX([-20, 20])
    .onStart(() => {
      'worklet';
      context.value = { y: translateY.value };
    })
    .onUpdate((event) => {
      'worklet';
      const newY = context.value.y + event.translationY;
      translateY.value = Math.max(
        DRAWER_HEIGHT - SNAP_POINTS.FULL,
        Math.min(DRAWER_HEIGHT - SNAP_POINTS.PEEK + 20, newY)
      );
    })
    .onEnd((event) => {
      'worklet';
      const currentHeight = DRAWER_HEIGHT - translateY.value;
      const velocity = event.velocityY;

      let targetSnap: number;

      if (velocity > 500) {
        if (currentHeight > SNAP_POINTS.HALF) {
          targetSnap = SNAP_POINTS.HALF;
        } else {
          targetSnap = SNAP_POINTS.PEEK;
        }
      } else if (velocity < -500) {
        if (currentHeight < SNAP_POINTS.HALF) {
          targetSnap = SNAP_POINTS.HALF;
        } else {
          targetSnap = SNAP_POINTS.FULL;
        }
      } else {
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
    transform: [{ translateY: translateY.value + hideTranslateY.value }],
  }));

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

  const renderCompactItem = useCallback(({ item }: { item: SavedItem }) => (
    <CompactCard
      item={item}
      onPress={handlePlacePress}
      isSelected={selectedPlaceId === item.id}
    />
  ), [handlePlacePress, selectedPlaceId]);

  const renderFullItem = useCallback(({ item }: { item: SavedItem }) => (
    <FullCard
      item={item}
      onPress={handlePlacePress}
      isSelected={selectedPlaceId === item.id}
    />
  ), [handlePlacePress, selectedPlaceId]);

  const renderEmpty = useCallback(() => (
    <View style={styles.emptyContainer}>
      <Ionicons name="map-outline" size={36} color={theme.colors.textSecondary} />
      <Text style={styles.emptyText}>No places in this area</Text>
      <Text style={styles.emptyHint}>Zoom out to see more places</Text>
    </View>
  ), []);

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill}>
        {/* Top Gradient Glow - For premium depth */}
        <LinearGradient
          colors={['rgba(255, 255, 255, 0.1)', 'transparent']}
          style={styles.topGlow}
        />

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

      <Animated.View style={[styles.peekContent, peekContentOpacity]} pointerEvents={isPeekMode ? 'auto' : 'none'}>
        {items.length > 0 ? (
          <FlatList
            data={items.slice(0, 10)}
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
      </BlurView>
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
    backgroundColor: 'transparent', // Handled by BlurView
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    elevation: 25,
    shadowColor: '#000000',
    overflow: 'hidden',
  },
  glassContainer: {
    ...StyleSheet.absoluteFillObject,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: 'hidden',
  },
  topGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 60,
  },
  header: {
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  handleIndicator: {
    width: 40,
    height: 5,
    backgroundColor: theme.colors.border,
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 16,
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
    fontSize: 28,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontWeight: '600',
    marginTop: 2,
  },
  countBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    ...theme.shadows.soft.sm,
  },
  countBadgeText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  peekContent: {
    position: 'absolute',
    top: 85,
    left: 0,
    right: 0,
    height: 160,
  },
  peekList: {
    paddingHorizontal: 20,
    height: 140, 
  },
  compactCard: {
    width: 130,
    marginRight: 16,
    backgroundColor: theme.colors.surface,
    borderRadius: 24,
    padding: 10,
    ...theme.shadows.soft.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  compactImageContainer: {
    width: '100%',
    height: 90,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: theme.colors.backgroundAlt,
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
    backgroundColor: theme.colors.backgroundAlt,
  },
  compactPlaceholderEmoji: {
    fontSize: 28,
  },
  compactCategoryBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    borderRadius: 10,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.soft.sm,
  },
  compactCategoryEmoji: {
    fontSize: 12,
  },
  compactName: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textInverse, // Dark on white card
    marginTop: 6,
  },
  compactRating: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    gap: 3,
  },
  compactRatingText: {
    fontSize: 11,
    color: '#64748B', // Hardcoded Slate-500 for rating
    fontWeight: '700',
  },
  listContent: {
    position: 'absolute',
    top: 85,
    left: 0,
    right: 0,
    bottom: 0,
  },
  fullList: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  fullCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 28,
    padding: 14,
    marginBottom: 14,
    ...theme.shadows.soft.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  fullCardSelected: {
    borderColor: theme.colors.primary,
    borderWidth: 2,
  },
  fullCardImageContainer: {
    width: 72,
    height: 72,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: theme.colors.backgroundAlt,
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
    backgroundColor: theme.colors.backgroundAlt,
  },
  fullCardPlaceholderEmoji: {
    fontSize: 32,
  },
  fullCardInfo: {
    flex: 1,
    marginLeft: 16,
    marginRight: 8,
  },
  fullCardName: {
    fontSize: 17,
    fontWeight: '800',
    color: theme.colors.textInverse, // Dark on white card
  },
  fullCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
  },
  fullCardRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  fullCardRatingText: {
    fontSize: 14,
    color: theme.colors.textInverse, // Dark on white card
    fontWeight: '700',
  },
  fullCardLocation: {
    fontSize: 14,
    color: '#64748B', // Hardcoded Slate-500
    fontWeight: '500',
    flex: 1,
  },
  fullCardTag: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.backgroundAlt,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
  },
  fullCardTagText: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    fontWeight: '600',
    marginTop: 12,
  },
  emptyHint: {
    fontSize: 14,
    color: theme.colors.primary,
    fontWeight: '700',
    marginTop: 6,
    opacity: 0.8,
  },
  peekEmptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  peekEmptyText: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 22,
  },
});

export default PersistentPlacesDrawer;
