import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Dimensions,
  Platform,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  useAnimatedGestureHandler,
  runOnJS,
} from 'react-native-reanimated';
import { PanGestureHandler } from 'react-native-gesture-handler';
import { useItemStore } from '../../../stores/itemStore';
import { useLocationStore } from '../../../stores/locationStore';
import { useTripStore } from '../../../stores/tripStore';
import { useCheckInStore } from '../../../stores/checkInStore';
import { MapView, MapViewRef } from '../../../components/MapView';
import { SavedItem, ItemCategory } from '../../../types';
import { HapticFeedback } from '../../../utils/haptics';
import { getPlacePhotoUrl } from '../../../config/maps';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const BOTTOM_TAB_HEIGHT = 80;
const HEADER_HEIGHT = 56;

// Snap points for the bottom sheet
const SNAP_POINTS = {
  PEEKING: SCREEN_HEIGHT * 0.15,   // 15% - Just search bar visible
  ANCHORED: SCREEN_HEIGHT * 0.45,  // 45% - Half screen
  EXPANDED: SCREEN_HEIGHT * 0.85,  // 85% - Full screen (under header)
};

// Category filters
const CATEGORY_FILTERS = [
  { key: 'all', label: 'All', icon: '📍' },
  { key: 'food', label: 'Food', icon: '🍽️' },
  { key: 'place', label: 'Sightseeing', icon: '🏛️' },
  { key: 'shopping', label: 'Shopping', icon: '🛍️' },
  { key: 'activity', label: 'Activities', icon: '🎯' },
];

interface TripMapTabProps {
  tripId: string;
  navigation: any;
}

export default function TripMapTab({ tripId, navigation }: TripMapTabProps) {
  const { items, fetchTripItems, isLoading } = useItemStore();
  const { location } = useLocationStore();
  const { currentTrip } = useTripStore();
  const { isPlaceCheckedIn, createCheckIn, fetchCheckIns } = useCheckInStore();
  
  const [selectedPlace, setSelectedPlace] = useState<SavedItem | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sheetState, setSheetState] = useState<'peeking' | 'anchored' | 'expanded'>('peeking');
  
  const mapRef = useRef<MapViewRef>(null);
  const sheetHeight = useSharedValue(SNAP_POINTS.PEEKING);

  // Filter items
  const filteredItems = useMemo(() => {
    if (!items) return [];
    
    let filtered = items;
    
    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(item => item.category === selectedCategory);
    }
    
    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item => 
        item.name.toLowerCase().includes(query) ||
        item.area_name?.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [items, selectedCategory, searchQuery]);

  // Get initial map region
  const getInitialRegion = () => {
    const itemsWithLocation = items?.filter(item => item.location_lat && item.location_lng) || [];
    if (itemsWithLocation.length > 0) {
      const lats = itemsWithLocation.map(item => item.location_lat!);
      const lngs = itemsWithLocation.map(item => item.location_lng!);
      return {
        latitude: (Math.min(...lats) + Math.max(...lats)) / 2,
        longitude: (Math.min(...lngs) + Math.max(...lngs)) / 2,
        latitudeDelta: Math.max(0.08, (Math.max(...lats) - Math.min(...lats)) * 1.5),
        longitudeDelta: Math.max(0.08, (Math.max(...lngs) - Math.min(...lngs)) * 1.5),
      };
    }
    return {
      latitude: 19.0760,
      longitude: 72.8777,
      latitudeDelta: 0.15,
      longitudeDelta: 0.15,
    };
  };

  useEffect(() => {
    fetchTripItems(tripId, {});
    fetchCheckIns(tripId);
  }, [tripId]);

  // Snap to point
  const snapTo = (point: number) => {
    sheetHeight.value = withSpring(point, {
      damping: 20,
      stiffness: 150,
    });
    
    if (point === SNAP_POINTS.PEEKING) setSheetState('peeking');
    else if (point === SNAP_POINTS.ANCHORED) setSheetState('anchored');
    else setSheetState('expanded');
  };

  // Handle marker press - snap to anchored and scroll to item
  const handleMarkerPress = (item: SavedItem) => {
    HapticFeedback.medium();
    setSelectedPlace(item);
    snapTo(SNAP_POINTS.ANCHORED);
  };

  // Handle place select from list
  const handlePlaceSelect = (item: SavedItem) => {
    HapticFeedback.light();
    setSelectedPlace(item);
    
    if (item.location_lat && item.location_lng && mapRef.current) {
      mapRef.current.animateToRegion(item.location_lat, item.location_lng, 15);
    }
  };

  // Handle check-in
  const handleCheckIn = async (place: SavedItem) => {
    HapticFeedback.success();
    try {
      await createCheckIn(tripId, { savedItemId: place.id });
      await fetchCheckIns(tripId);
    } catch (error) {
      console.error('Check-in error:', error);
    }
  };

  // Gesture handler for drag
  const gestureHandler = useAnimatedGestureHandler({
    onStart: (_, ctx: any) => {
      ctx.startY = sheetHeight.value;
    },
    onActive: (event, ctx) => {
      const newHeight = ctx.startY - event.translationY;
      sheetHeight.value = Math.min(SNAP_POINTS.EXPANDED, Math.max(SNAP_POINTS.PEEKING, newHeight));
    },
    onEnd: (event) => {
      const velocity = event.velocityY;
      const currentHeight = sheetHeight.value;
      
      // Determine which snap point to go to
      if (velocity > 500) {
        // Swiping down fast
        if (currentHeight > SNAP_POINTS.ANCHORED) {
          runOnJS(snapTo)(SNAP_POINTS.ANCHORED);
        } else {
          runOnJS(snapTo)(SNAP_POINTS.PEEKING);
        }
      } else if (velocity < -500) {
        // Swiping up fast
        if (currentHeight < SNAP_POINTS.ANCHORED) {
          runOnJS(snapTo)(SNAP_POINTS.ANCHORED);
        } else {
          runOnJS(snapTo)(SNAP_POINTS.EXPANDED);
        }
      } else {
        // Find closest snap point
        const distances = [
          { point: SNAP_POINTS.PEEKING, dist: Math.abs(currentHeight - SNAP_POINTS.PEEKING) },
          { point: SNAP_POINTS.ANCHORED, dist: Math.abs(currentHeight - SNAP_POINTS.ANCHORED) },
          { point: SNAP_POINTS.EXPANDED, dist: Math.abs(currentHeight - SNAP_POINTS.EXPANDED) },
        ];
        const closest = distances.reduce((a, b) => a.dist < b.dist ? a : b);
        runOnJS(snapTo)(closest.point);
      }
    },
  });

  // Animated style for sheet
  const animatedSheetStyle = useAnimatedStyle(() => ({
    height: sheetHeight.value,
  }));

  // Render place card
  const renderPlaceCard = (item: SavedItem, isHighlighted: boolean = false) => {
    const photoUrl = getPlacePhotoUrl(item);
    const isCheckedIn = isPlaceCheckedIn(tripId, item.id);

    return (
      <TouchableOpacity
        key={item.id}
        style={[styles.placeCard, isHighlighted && styles.placeCardHighlighted]}
        onPress={() => handlePlaceSelect(item)}
        activeOpacity={0.7}
      >
        {/* Photo */}
        <View style={styles.placeCardImage}>
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={styles.placeImage} />
          ) : (
            <View style={styles.placeImagePlaceholder}>
              <Text style={styles.placeImageEmoji}>
                {item.category === 'food' ? '🍽️' : 
                 item.category === 'shopping' ? '🛍️' : '📍'}
              </Text>
            </View>
          )}
        </View>

        {/* Info */}
        <View style={styles.placeCardInfo}>
          <Text style={styles.placeCardName} numberOfLines={1}>{item.name}</Text>
          
          {item.rating && (
            <View style={styles.placeCardRating}>
              <Ionicons name="star" size={12} color="#F59E0B" />
              <Text style={styles.placeCardRatingText}>
                {Number(item.rating).toFixed(1)}
              </Text>
              {item.user_ratings_total && (
                <Text style={styles.placeCardReviews}>
                  ({item.user_ratings_total})
                </Text>
              )}
            </View>
          )}
          
          {item.area_name && (
            <Text style={styles.placeCardArea} numberOfLines={1}>{item.area_name}</Text>
          )}
        </View>

        {/* Check-in Status */}
        {isCheckedIn ? (
          <View style={styles.checkedInBadge}>
            <Ionicons name="checkmark" size={14} color="#10B981" />
          </View>
        ) : (
          <TouchableOpacity 
            style={styles.checkInButton}
            onPress={() => handleCheckIn(item)}
          >
            <Ionicons name="location" size={16} color="#3B82F6" />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  if (isLoading && (!items || items.length === 0)) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Loading map...</Text>
      </View>
    );
  }

  // Navigate to Timeline
  const handleTimelinePress = () => {
    HapticFeedback.light();
    navigation.navigate('Timeline', { tripId });
  };

  return (
    <View style={styles.container}>
      {/* Full Screen Map */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          items={filteredItems}
          region={getInitialRegion()}
          selectedPlace={selectedPlace}
          onMarkerPress={handleMarkerPress}
        />
        
        {/* Timeline Button - Top Right Corner */}
        <TouchableOpacity 
          style={styles.timelineButton}
          onPress={handleTimelinePress}
        >
          <Ionicons name="time" size={22} color="#3B82F6" />
          <Text style={styles.timelineButtonText}>Timeline</Text>
        </TouchableOpacity>
      </View>

      {/* Bottom Sheet */}
      <Animated.View style={[styles.bottomSheet, animatedSheetStyle]}>
        {/* Draggable Handle Area - Only handle and search */}
        <PanGestureHandler onGestureEvent={gestureHandler}>
          <Animated.View style={styles.sheetHandleArea}>
            <View style={styles.sheetHandle}>
              <View style={styles.sheetHandleBar} />
            </View>

            {/* Search Bar - Part of draggable area */}
            <View style={styles.searchContainer}>
              <View style={styles.searchBar}>
                <Ionicons name="search" size={18} color="#94A3B8" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search places..."
                  placeholderTextColor="#94A3B8"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  onFocus={() => snapTo(SNAP_POINTS.ANCHORED)}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Ionicons name="close-circle" size={18} color="#94A3B8" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </Animated.View>
        </PanGestureHandler>
        
        {/* Category Filters - OUTSIDE PanGestureHandler for horizontal scroll */}
        <View style={styles.filtersWrapper}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filtersContainer}
          >
            {CATEGORY_FILTERS.map((filter) => (
              <TouchableOpacity
                key={filter.key}
                style={[
                  styles.filterChip,
                  selectedCategory === filter.key && styles.filterChipActive,
                ]}
                onPress={() => {
                  HapticFeedback.light();
                  setSelectedCategory(filter.key);
                }}
              >
                <Text style={styles.filterIcon}>{filter.icon}</Text>
                <Text style={[
                  styles.filterLabel,
                  selectedCategory === filter.key && styles.filterLabelActive,
                ]}>
                  {filter.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Scrollable Places List - Independent from drag gesture */}
        <ScrollView 
          style={styles.placesList}
          contentContainerStyle={styles.placesListContent}
          showsVerticalScrollIndicator={true}
          nestedScrollEnabled={true}
          bounces={true}
        >
          {filteredItems.length > 0 ? (
            filteredItems.map((item) => renderPlaceCard(item, selectedPlace?.id === item.id))
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📍</Text>
              <Text style={styles.emptyTitle}>No places found</Text>
              <Text style={styles.emptyText}>
                {searchQuery ? 'Try a different search term' : 'Add places via chat to see them here'}
              </Text>
            </View>
          )}
          <View style={{ height: BOTTOM_TAB_HEIGHT + 20 }} />
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
  },

  // Map
  mapContainer: {
    flex: 1,
  },
  timelineButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  timelineButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
    marginLeft: 6,
  },

  // Bottom Sheet
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  sheetHandleArea: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  sheetHandle: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  sheetHandleBar: {
    width: 48,
    height: 5,
    backgroundColor: '#CBD5E1',
    borderRadius: 3,
  },

  // Search
  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1F2937',
    marginLeft: 8,
  },

  // Filters
  filtersWrapper: {
    height: 44,
    marginBottom: 8,
  },
  filtersContainer: {
    paddingHorizontal: 16,
    alignItems: 'center',
    height: 44,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 22,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    height: 40,
  },
  filterChipActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#3B82F6',
  },
  filterIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748B',
  },
  filterLabelActive: {
    color: '#3B82F6',
    fontWeight: '600',
  },

  // Places List
  placesList: {
    flex: 1,
  },
  placesListContent: {
    paddingHorizontal: 16,
  },

  // Place Card
  placeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  placeCardHighlighted: {
    borderColor: '#3B82F6',
    backgroundColor: '#F8FAFF',
  },
  placeCardImage: {
    width: 56,
    height: 56,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F1F5F9',
  },
  placeImage: {
    width: '100%',
    height: '100%',
  },
  placeImagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeImageEmoji: {
    fontSize: 24,
  },
  placeCardInfo: {
    flex: 1,
    marginLeft: 12,
  },
  placeCardName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  placeCardRating: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  placeCardRatingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F59E0B',
    marginLeft: 4,
  },
  placeCardReviews: {
    fontSize: 11,
    color: '#94A3B8',
    marginLeft: 4,
  },
  placeCardArea: {
    fontSize: 12,
    color: '#64748B',
  },
  checkedInBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#D1FAE5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkInButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
  },
});
