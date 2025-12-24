/**
 * GameBottomSheet - RPG-style glassmorphism bottom sheet
 * 
 * Features:
 * - Glassmorphism (frosted glass HUD effect)
 * - Snap points: 12% (peek), 50% (browse), 85% (full)
 * - Large image cards for places
 * - Interactive scroll syncs with map camera
 * - Auto-snap down on place selection for fly-to animation
 * - Drag handle only on header (FlatList scrolls independently)
 * 
 * Uses react-native-reanimated for smooth animations
 */

import React, { useCallback, useMemo, useRef, forwardRef, useImperativeHandle, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Image,
  FlatList,
  Platform,
  Modal,
  Pressable,
  ScrollView,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import { SavedItem } from '../types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Snap points as percentages of screen height
const SNAP_POINTS = {
  COLLAPSED: SCREEN_HEIGHT * 0.12,  // 12%
  HALF: SCREEN_HEIGHT * 0.5,        // 50%
  EXPANDED: SCREEN_HEIGHT * 0.85,   // 85%
};

// Zenly-style colors
const COLORS = {
  background: 'rgba(15, 23, 42, 0.95)',
  surface: 'rgba(30, 41, 59, 0.9)',
  surfaceLight: 'rgba(51, 65, 85, 0.8)',
  primaryGlow: '#8B5CF6',
  secondaryGlow: '#06B6D4',
  accent: '#22C55E',
  text: '#FFFFFF',
  textSecondary: '#94A3B8',
  border: 'rgba(139, 92, 246, 0.3)',
  cardGlow: 'rgba(139, 92, 246, 0.2)',
};

interface PlaceCardProps {
  item: SavedItem;
  index: number;
  onPress: (item: SavedItem) => void;
  isSelected: boolean;
}

const PlaceCard: React.FC<PlaceCardProps> = ({ item, index, onPress, isSelected }) => {
  // Safely get photo URL
  const photoUrl = useMemo(() => {
    try {
      if (!item?.photos_json) return null;
      const photos = typeof item.photos_json === 'string' 
        ? JSON.parse(item.photos_json) 
        : item.photos_json;
      if (Array.isArray(photos) && photos.length > 0) {
        return photos[0]?.url || (typeof photos[0] === 'string' ? photos[0] : null);
      }
      return null;
    } catch {
      return null;
    }
  }, [item?.photos_json]);

  // Safely format rating
  const ratingDisplay = useMemo(() => {
    if (!item?.rating) return null;
    const rating = typeof item.rating === 'number' ? item.rating : parseFloat(item.rating);
    if (isNaN(rating)) return null;
    return rating.toFixed(1);
  }, [item?.rating]);

  if (!item) return null;
  
  return (
    <View style={{ marginBottom: 16 }}>
      <TouchableOpacity
        style={[styles.placeCard, isSelected && styles.placeCardSelected]}
        onPress={() => onPress(item)}
        activeOpacity={0.85}
      >
        {/* Hero Image */}
        <View style={styles.imageContainer}>
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={styles.placeImage} resizeMode="cover" />
          ) : (
            <LinearGradient
              colors={[COLORS.surfaceLight, COLORS.surface]}
              style={styles.placeholderImage}
            >
              <Ionicons name="image-outline" size={40} color={COLORS.textSecondary} />
            </LinearGradient>
          )}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.7)']}
            style={styles.imageGradient}
          />
          {ratingDisplay && (
            <View style={styles.ratingBadge}>
              <Ionicons name="star" size={12} color="#FFD700" />
              <Text style={styles.ratingText}>{ratingDisplay}</Text>
            </View>
          )}
        </View>

        {/* Content */}
        <View style={styles.cardContent}>
          <Text style={styles.placeName} numberOfLines={1}>{item.name || 'Unknown'}</Text>
          <View style={styles.placeInfo}>
            <Ionicons name="location-outline" size={14} color={COLORS.secondaryGlow} />
            <Text style={styles.placeLocation} numberOfLines={1}>
              {item.area_name || item.location_name || 'Unknown location'}
            </Text>
          </View>
          {item.cuisine_type && (
            <View style={styles.tagContainer}>
              <View style={styles.tag}>
                <Text style={styles.tagText}>{item.cuisine_type}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Action buttons */}
        <View style={styles.cardActions}>
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="navigate" size={18} color={COLORS.primaryGlow} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="checkmark-circle-outline" size={18} color={COLORS.accent} />
          </TouchableOpacity>
        </View>

        {isSelected && (
          <View style={styles.selectionGlow} />
        )}
      </TouchableOpacity>
    </View>
  );
};

export interface GameBottomSheetRef {
  expand: () => void;
  collapse: () => void;
  snapToIndex: (index: number) => void;
  close: () => void;
}

interface GameBottomSheetProps {
  items: SavedItem[];
  categoryLabel: string;
  categoryEmoji?: string;
  isVisible: boolean;
  onClose: () => void;
  onPlaceSelect: (item: SavedItem) => void;
  onPlaceScroll?: (item: SavedItem) => void;
  selectedPlaceId?: string;
}

export const GameBottomSheet = forwardRef<GameBottomSheetRef, GameBottomSheetProps>(({
  items,
  categoryLabel,
  categoryEmoji = '📍',
  isVisible,
  onClose,
  onPlaceSelect,
  onPlaceScroll,
  selectedPlaceId,
}, ref) => {
  const translateY = useSharedValue(SCREEN_HEIGHT);
  const currentSnapPoint = useSharedValue(SNAP_POINTS.HALF);
  const context = useSharedValue({ y: 0 });

  // Snap to a specific point - can be called from JS or worklet
  const snapTo = useCallback((point: number) => {
    translateY.value = withSpring(SCREEN_HEIGHT - point, {
      damping: 20,
      stiffness: 150,
    });
    currentSnapPoint.value = point;
  }, []);

  // Expose methods to parent
  useImperativeHandle(ref, () => ({
    expand: () => snapTo(SNAP_POINTS.EXPANDED),
    collapse: () => snapTo(SNAP_POINTS.COLLAPSED),
    snapToIndex: (index: number) => {
      const points = [SNAP_POINTS.COLLAPSED, SNAP_POINTS.HALF, SNAP_POINTS.EXPANDED];
      snapTo(points[index] || SNAP_POINTS.HALF);
    },
    close: () => {
      translateY.value = withTiming(SCREEN_HEIGHT, { duration: 300 });
      setTimeout(onClose, 300);
    },
  }), [snapTo, onClose]);

  // Open animation when visible
  useEffect(() => {
    if (isVisible) {
      translateY.value = withSpring(SCREEN_HEIGHT - SNAP_POINTS.HALF, {
        damping: 20,
        stiffness: 150,
      });
      currentSnapPoint.value = SNAP_POINTS.HALF;
    } else {
      translateY.value = withTiming(SCREEN_HEIGHT, { duration: 300 });
    }
  }, [isVisible]);

  // Track if we're at collapsed state (to allow close on further drag down)
  const [isAtCollapsed, setIsAtCollapsed] = useState(false);

  // Update collapsed state when snap point changes
  useEffect(() => {
    const checkCollapsed = currentSnapPoint.value === SNAP_POINTS.COLLAPSED;
    setIsAtCollapsed(checkCollapsed);
  }, [currentSnapPoint.value]);

  // Pan gesture for dragging - ONLY works on the header handle area
  const panGesture = Gesture.Pan()
    .onStart(() => {
      context.value = { y: translateY.value };
    })
    .onUpdate((event) => {
      const newY = context.value.y + event.translationY;
      // Clamp between expanded and slightly below collapsed (for close gesture)
      translateY.value = Math.max(
        SCREEN_HEIGHT - SNAP_POINTS.EXPANDED,
        Math.min(SCREEN_HEIGHT + 50, newY)
      );
    })
    .onEnd((event) => {
      const currentHeight = SCREEN_HEIGHT - translateY.value;
      const velocity = event.velocityY;

      // Determine snap point based on position and velocity
      let targetSnap = SNAP_POINTS.HALF;

      if (velocity > 500) {
        // Fast swipe down
        if (currentHeight > SNAP_POINTS.HALF) {
          targetSnap = SNAP_POINTS.HALF;
        } else if (currentHeight > SNAP_POINTS.COLLAPSED * 0.5) {
          targetSnap = SNAP_POINTS.COLLAPSED;
        } else {
          // Swiped past collapsed - close the sheet
          runOnJS(onClose)();
          return;
        }
      } else if (velocity < -500) {
        // Fast swipe up
        if (currentHeight < SNAP_POINTS.HALF) {
          targetSnap = SNAP_POINTS.HALF;
        } else {
          targetSnap = SNAP_POINTS.EXPANDED;
        }
      } else {
        // Slow drag - snap to nearest
        const distToCollapsed = Math.abs(currentHeight - SNAP_POINTS.COLLAPSED);
        const distToHalf = Math.abs(currentHeight - SNAP_POINTS.HALF);
        const distToExpanded = Math.abs(currentHeight - SNAP_POINTS.EXPANDED);

        if (currentHeight < SNAP_POINTS.COLLAPSED * 0.5) {
          // Below half of collapsed - close
          runOnJS(onClose)();
          return;
        } else if (distToCollapsed < distToHalf && distToCollapsed < distToExpanded) {
          targetSnap = SNAP_POINTS.COLLAPSED;
        } else if (distToExpanded < distToHalf) {
          targetSnap = SNAP_POINTS.EXPANDED;
        } else {
          targetSnap = SNAP_POINTS.HALF;
        }
      }

      snapTo(targetSnap);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const handlePlacePress = useCallback((item: SavedItem) => {
    snapTo(SNAP_POINTS.COLLAPSED);
    onPlaceSelect(item);
  }, [onPlaceSelect, snapTo]);

  const handleViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    if (viewableItems.length > 0 && onPlaceScroll) {
      const centerItem = viewableItems[Math.floor(viewableItems.length / 2)];
      if (centerItem?.item) {
        onPlaceScroll(centerItem.item);
      }
    }
  }, [onPlaceScroll]);

  const viewabilityConfig = useMemo(() => ({
    itemVisiblePercentThreshold: 50,
  }), []);

  const renderItem = useCallback(({ item, index }: { item: SavedItem; index: number }) => (
    <PlaceCard
      item={item}
      index={index}
      onPress={handlePlacePress}
      isSelected={selectedPlaceId === item.id}
    />
  ), [handlePlacePress, selectedPlaceId]);

  const renderEmpty = useCallback(() => (
    <View style={styles.emptyContainer}>
      <Ionicons name="map-outline" size={48} color={COLORS.textSecondary} />
      <Text style={styles.emptyText}>No places in this category</Text>
    </View>
  ), []);

  if (!isVisible) return null;

  return (
    <Modal transparent visible={isVisible} animationType="none" statusBarTranslucent>
      <GestureHandlerRootView style={styles.modalContainer}>
        {/* Backdrop - tap to collapse (not close) */}
        <Pressable style={styles.backdrop} onPress={() => snapTo(SNAP_POINTS.COLLAPSED)}>
          <View style={StyleSheet.absoluteFill} />
        </Pressable>

        {/* Sheet */}
        <Animated.View style={[styles.sheet, animatedStyle]}>
          {/* Glassmorphism background */}
          <View style={styles.glassContainer}>
            {Platform.OS === 'ios' ? (
              <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
            ) : (
              <View style={[StyleSheet.absoluteFill, styles.androidBlur]} />
            )}
            
            <LinearGradient
              colors={[COLORS.primaryGlow + '40', 'transparent', COLORS.secondaryGlow + '20']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.glowBorder}
            />
          </View>

          {/* Header with gesture handler - ONLY this area is draggable */}
          <GestureDetector gesture={panGesture}>
            <Animated.View style={styles.sheetHeader}>
              <View style={styles.handleIndicator} />
              <View style={styles.headerContent}>
                <View style={styles.headerLeft}>
                  <Text style={styles.headerEmoji}>{categoryEmoji}</Text>
                  <View>
                    <Text style={styles.headerTitle}>{categoryLabel}</Text>
                    <Text style={styles.headerSubtitle}>{items.length} places</Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                  <Ionicons name="close" size={20} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>
              {/* Expand/Collapse hint */}
              <View style={styles.dragHint}>
                <Ionicons name="chevron-up" size={16} color={COLORS.textSecondary} />
                <Text style={styles.dragHintText}>Drag to expand</Text>
              </View>
            </Animated.View>
          </GestureDetector>

          {/* List - scrolls independently */}
          <FlatList
            data={items}
            keyExtractor={(item: SavedItem) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            onViewableItemsChanged={handleViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            ListEmptyComponent={renderEmpty}
            nestedScrollEnabled={true}
          />
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
});

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT,
    backgroundColor: 'transparent',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    shadowColor: COLORS.primaryGlow,
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
  },
  glassContainer: {
    ...StyleSheet.absoluteFillObject,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  androidBlur: {
    backgroundColor: COLORS.background,
  },
  glowBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
  },
  
  sheetHeader: {
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    // Make header taller for easier drag target
    minHeight: 100,
  },
  dragHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    opacity: 0.6,
  },
  dragHintText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginLeft: 4,
  },
  handleIndicator: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
  },
  headerSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },

  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  
  placeCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  placeCardSelected: {
    borderColor: COLORS.primaryGlow,
    borderWidth: 2,
  },
  selectionGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.cardGlow,
    borderRadius: 16,
  },
  imageContainer: {
    width: '100%',
    height: 160,
    position: 'relative',
  },
  placeImage: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageGradient: {
    ...StyleSheet.absoluteFillObject,
    top: '50%',
  },
  ratingBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  ratingText: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  cardContent: {
    padding: 14,
  },
  placeName: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 6,
  },
  placeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  placeLocation: {
    fontSize: 13,
    color: COLORS.textSecondary,
    flex: 1,
    marginLeft: 4,
  },
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
  },
  tag: {
    backgroundColor: COLORS.surfaceLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tagText: {
    fontSize: 11,
    color: COLORS.primaryGlow,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  cardActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 15,
    color: COLORS.textSecondary,
    marginTop: 12,
  },
});

export default GameBottomSheet;
