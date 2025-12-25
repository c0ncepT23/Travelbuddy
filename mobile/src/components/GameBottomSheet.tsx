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
  COMPACT: SCREEN_HEIGHT * 0.15,    // 15% - Mini card view after place selection
  COLLAPSED: SCREEN_HEIGHT * 0.25,  // 25% - Default collapsed
  HALF: SCREEN_HEIGHT * 0.5,        // 50% - Browse mode
  EXPANDED: SCREEN_HEIGHT * 0.85,   // 85% - Full screen
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
  selectedPlace?: SavedItem | null;
  onDirections?: (item: SavedItem) => void;
  onCheckIn?: (item: SavedItem) => void;
  onOrbit?: () => void;  // 360° orbit trigger
  isOrbiting?: boolean;  // Show orbiting state
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
  selectedPlace,
  onDirections,
  onCheckIn,
  onOrbit,
  isOrbiting,
}, ref) => {
  const translateY = useSharedValue(SCREEN_HEIGHT);
  const currentSnapPoint = useSharedValue(SNAP_POINTS.HALF);
  const context = useSharedValue({ y: 0 });
  
  // Track if we're in HUD mode (COMPACT snap point)
  const [isHudMode, setIsHudMode] = useState(false);

  // Snap to a specific point - can be called from JS or worklet
  const snapTo = useCallback((point: number) => {
    translateY.value = withSpring(SCREEN_HEIGHT - point, {
      damping: 20,
      stiffness: 150,
    });
    currentSnapPoint.value = point;
    // Update HUD mode based on snap point
    setIsHudMode(point === SNAP_POINTS.COMPACT);
  }, []);

  // Expose methods to parent
  useImperativeHandle(ref, () => ({
    expand: () => snapTo(SNAP_POINTS.EXPANDED),
    collapse: () => snapTo(SNAP_POINTS.COLLAPSED),
    compact: () => snapTo(SNAP_POINTS.COMPACT),
    snapToIndex: (index: number) => {
      const points = [SNAP_POINTS.COMPACT, SNAP_POINTS.COLLAPSED, SNAP_POINTS.HALF, SNAP_POINTS.EXPANDED];
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

  // Stable close handler ref to avoid stale closure in gesture
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Safe close function for gesture callbacks
  const safeClose = useCallback(() => {
    if (onCloseRef.current) {
      onCloseRef.current();
    }
  }, []);

  // Pan gesture for dragging - ONLY works on the header handle area
  const panGesture = Gesture.Pan()
    .onStart(() => {
      'worklet';
      context.value = { y: translateY.value };
    })
    .onUpdate((event) => {
      'worklet';
      const newY = context.value.y + event.translationY;
      // Clamp between expanded and below compact (to allow close gesture)
      translateY.value = Math.max(
        SCREEN_HEIGHT - SNAP_POINTS.EXPANDED,
        Math.min(SCREEN_HEIGHT, newY) // Allow swiping down to close
      );
    })
    .onEnd((event) => {
      'worklet';
      const currentHeight = SCREEN_HEIGHT - translateY.value;
      const velocity = event.velocityY;

      // Determine snap point based on position and velocity
      let targetSnap = SNAP_POINTS.HALF;

      if (velocity > 500) {
        // Fast swipe down - step down through snap points (or close if at COMPACT)
        if (currentHeight > SNAP_POINTS.HALF) {
          targetSnap = SNAP_POINTS.HALF;
        } else if (currentHeight > SNAP_POINTS.COLLAPSED) {
          targetSnap = SNAP_POINTS.COLLAPSED;
        } else if (currentHeight > SNAP_POINTS.COMPACT) {
          targetSnap = SNAP_POINTS.COMPACT;
        } else {
          // Below COMPACT - close the drawer!
          translateY.value = withTiming(SCREEN_HEIGHT, { duration: 300 });
          runOnJS(safeClose)();
          return;
        }
      } else if (velocity < -500) {
        // Fast swipe up - step up through snap points
        if (currentHeight < SNAP_POINTS.COLLAPSED) {
          targetSnap = SNAP_POINTS.COLLAPSED;
        } else if (currentHeight < SNAP_POINTS.HALF) {
          targetSnap = SNAP_POINTS.HALF;
        } else {
          targetSnap = SNAP_POINTS.EXPANDED;
        }
      } else {
        // Slow drag - snap to nearest of main 3 points
        const distToCollapsed = Math.abs(currentHeight - SNAP_POINTS.COLLAPSED);
        const distToHalf = Math.abs(currentHeight - SNAP_POINTS.HALF);
        const distToExpanded = Math.abs(currentHeight - SNAP_POINTS.EXPANDED);

        if (distToCollapsed < distToHalf && distToCollapsed < distToExpanded) {
          targetSnap = SNAP_POINTS.COLLAPSED;
        } else if (distToExpanded < distToHalf) {
          targetSnap = SNAP_POINTS.EXPANDED;
        } else {
          targetSnap = SNAP_POINTS.HALF;
        }
      }

      // Animate to snap point
      translateY.value = withSpring(SCREEN_HEIGHT - targetSnap, {
        damping: 20,
        stiffness: 150,
      });
      currentSnapPoint.value = targetSnap;
      
      // If snapping to COMPACT and we have a selected place, switch to HUD mode
      if (targetSnap === SNAP_POINTS.COMPACT) {
        runOnJS(setIsHudMode)(true);
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  // Separate gesture for HUD mode - swipe up to expand to list, swipe down to close
  const hudPanGesture = Gesture.Pan()
    .onEnd((event) => {
      'worklet';
      const velocity = event.velocityY;
      
      if (velocity < -300) {
        // Swipe up - expand to list mode
        console.log('📤 HUD swipe up - expanding to list');
        runOnJS(setIsHudMode)(false);
        translateY.value = withSpring(SCREEN_HEIGHT - SNAP_POINTS.HALF, {
          damping: 20,
          stiffness: 150,
        });
        currentSnapPoint.value = SNAP_POINTS.HALF;
      } else if (velocity > 300) {
        // Swipe down - close
        console.log('📥 HUD swipe down - closing');
        runOnJS(safeClose)();
      }
    });

  const handlePlacePress = useCallback((item: SavedItem) => {
    console.log('👆 Place pressed:', item.name);
    // Snap to COMPACT (15%) so user can see the cinematic fly-to animation
    snapTo(SNAP_POINTS.COMPACT);
    console.log('📐 Snapped to COMPACT, isHudMode should be true now');
    onPlaceSelect(item);
    console.log('✅ onPlaceSelect called');
  }, [onPlaceSelect, snapTo]);

  // Disabled scroll sync for now - was causing crashes and interfering with fly-to
  // const handleViewableItemsChanged = useCallback(({ viewableItems }: any) => {
  //   if (viewableItems.length > 0 && onPlaceScroll) {
  //     const centerItem = viewableItems[Math.floor(viewableItems.length / 2)];
  //     if (centerItem?.item) {
  //       onPlaceScroll(centerItem.item);
  //     }
  //   }
  // }, [onPlaceScroll]);

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

  // Debug logging disabled to prevent console spam
  // console.log('🎮 GameBottomSheet render:', { isVisible, isHudMode, hasSelectedPlace: !!selectedPlace, selectedPlaceName: selectedPlace?.name });

  if (!isVisible) return null;

  // HUD MODE: No Modal, just absolute positioned View - allows map interaction!
  if (isHudMode && selectedPlace) {
    // console.log('🎯 Rendering HUD MODE for:', selectedPlace.name);
    return (
      <View style={styles.hudWrapper} pointerEvents="box-none">
        <GestureHandlerRootView style={styles.hudGestureContainer}>
          {/* Don't apply animatedStyle here - HUD should stay fixed at bottom */}
          <View style={styles.hudSheet}>
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
          
          {/* HUD Content - with separate gesture for expand/close */}
          <GestureDetector gesture={hudPanGesture}>
            <Animated.View style={styles.hudContainer}>
              <View style={styles.handleIndicator} />
              <View style={styles.hudContent}>
                {/* Close button on left */}
                <TouchableOpacity 
                  style={styles.hudCloseButton}
                  onPress={() => {
                    console.log('❌ HUD CLOSE BUTTON PRESSED');
                    onClose();
                  }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close-circle" size={28} color={COLORS.textSecondary} />
                </TouchableOpacity>
                
                <View style={styles.hudInfo}>
                  <Text style={styles.hudPlaceName} numberOfLines={1}>
                    {selectedPlace.name || 'Selected Place'}
                  </Text>
                  <View style={styles.hudMeta}>
                    {selectedPlace.rating && (
                      <View style={styles.hudRating}>
                        <Ionicons name="star" size={12} color="#FFD700" />
                        <Text style={styles.hudRatingText}>
                          {typeof selectedPlace.rating === 'number' 
                            ? selectedPlace.rating.toFixed(1) 
                            : selectedPlace.rating}
                        </Text>
                      </View>
                    )}
                    <Text style={styles.hudCategory}>
                      {selectedPlace.cuisine_type || selectedPlace.place_type || categoryLabel}
                    </Text>
                  </View>
                </View>
                
                <View style={styles.hudActions}>
                  {onOrbit && (
                    <TouchableOpacity 
                      style={[styles.hudOrbitButton, isOrbiting && styles.hudOrbitButtonActive]}
                      onPress={() => {
                        console.log('🔄 ORBIT BUTTON PRESSED in HUD!');
                        onOrbit();
                      }}
                      disabled={isOrbiting}
                    >
                      <Ionicons name="sync" size={22} color={isOrbiting ? '#FFCC00' : '#8B5CF6'} />
                    </TouchableOpacity>
                  )}
                  
                  {onDirections && (
                    <TouchableOpacity 
                      style={styles.hudGoButton}
                      onPress={() => {
                        console.log('🧭 GO BUTTON PRESSED in HUD!');
                        onDirections(selectedPlace);
                      }}
                    >
                      <LinearGradient colors={['#FF9900', '#FF6600']} style={styles.hudGoGradient}>
                        <Ionicons name="navigate" size={18} color="white" />
                        <Text style={styles.hudGoText}>GO</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
              
              <View style={styles.hudExpandHint}>
                <Ionicons name="chevron-up" size={14} color={COLORS.textSecondary} />
                <Text style={styles.hudExpandText}>Swipe up for details</Text>
              </View>
            </Animated.View>
          </GestureDetector>
          </View>
        </GestureHandlerRootView>
      </View>
    );
  }

  // LIST MODE: Use Modal with backdrop
  return (
    <Modal transparent visible={isVisible} animationType="none" statusBarTranslucent>
      <GestureHandlerRootView style={styles.modalContainer}>
        {/* Backdrop - tap to collapse */}
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

          {/* LIST MODE - Header with gesture handler */}
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
              ListEmptyComponent={renderEmpty}
              nestedScrollEnabled={true}
              removeClippedSubviews={false}
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
  // HUD wrapper - only covers BOTTOM of screen, NOT full screen!
  hudWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: SCREEN_HEIGHT * 0.20, // Only 20% height - just enough for HUD
    zIndex: 1000,
  },
  hudGestureContainer: {
    flex: 1,
  },
  hudSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: SCREEN_HEIGHT * 0.20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
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
  
  // HUD Mode Styles (15% Compact View)
  hudContainer: {
    paddingTop: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  hudContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  hudCloseButton: {
    marginRight: 12,
    opacity: 0.7,
  },
  hudInfo: {
    flex: 1,
    marginRight: 12,
  },
  hudPlaceName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  hudMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  hudRating: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  hudRatingText: {
    fontSize: 12,
    color: '#FFD700',
    fontWeight: '600',
    marginLeft: 3,
  },
  hudCategory: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
  },
  hudActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hudActionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  hudGoButton: {
    shadowColor: '#FF6600',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 5,
  },
  hudGoGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  hudGoText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 4,
  },
  hudOrbitButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    borderWidth: 2,
    borderColor: 'rgba(139, 92, 246, 0.5)',
  },
  hudOrbitButtonActive: {
    backgroundColor: 'rgba(255, 204, 0, 0.2)',
    borderColor: '#FFCC00',
  },
  hudExpandHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    opacity: 0.5,
  },
  hudExpandText: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginLeft: 4,
  },
});

export default GameBottomSheet;
