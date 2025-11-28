import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ScrollView,
  Image,
  Animated,
  Alert,
  Modal,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import * as Location from 'expo-location';
import { SavedItem, ItemCategory, Trip } from '../types';
import { PlaceDetailCard } from './PlaceDetailCard';
import { StarRating } from './StarRating';
import theme from '../config/theme';

// Sort options
type SortOption = 'area' | 'rating' | 'distance' | 'date' | 'alphabetical' | 'must_visit';
const SORT_OPTIONS: { value: SortOption; label: string; icon: string }[] = [
  { value: 'area', label: 'By Area', icon: '📍' },
  { value: 'rating', label: 'Rating (High)', icon: '⭐' },
  { value: 'distance', label: 'Nearest First', icon: '📏' },
  { value: 'date', label: 'Recently Added', icon: '🕐' },
  { value: 'alphabetical', label: 'A-Z', icon: '🔤' },
  { value: 'must_visit', label: 'Must-Visit First', icon: '🎯' },
];

// Rating filter options
type RatingFilter = 'all' | '4' | '4.5';
const RATING_FILTERS: { value: RatingFilter; label: string }[] = [
  { value: 'all', label: 'All Ratings' },
  { value: '4', label: '4+ Stars' },
  { value: '4.5', label: '4.5+ Stars' },
];

// Budget filter options  
type BudgetFilter = 'all' | '1' | '2' | '3' | '4';
const BUDGET_FILTERS: { value: BudgetFilter; label: string }[] = [
  { value: 'all', label: 'All Prices' },
  { value: '1', label: '$ Budget' },
  { value: '2', label: '$$ Moderate' },
  { value: '3', label: '$$$ Premium' },
  { value: '4', label: '$$$$ Luxury' },
];

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const DRAWER_LIST_HEIGHT = SCREEN_HEIGHT * 0.7;
const DRAWER_DETAIL_HEIGHT = SCREEN_HEIGHT * 0.85;

interface PlaceListDrawerProps {
  items: SavedItem[];
  selectedCategory: 'all' | 'food' | 'accommodation' | 'place' | 'shopping' | 'activity' | 'tip';
  selectedPlace: SavedItem | null;
  onPlaceSelect: (item: SavedItem) => void;
  onBackToList: () => void;
  onClose: () => void;
  onCheckIn?: (place: SavedItem) => void;
  isPlaceCheckedIn?: (placeId: string) => boolean;
  getUserName?: (userId: string) => string;
  onToggleFavorite?: (place: SavedItem) => void;
  onToggleMustVisit?: (place: SavedItem) => void;
  onDeleteItem?: (itemId: string) => void;
  onUpdateNotes?: (place: SavedItem, notes: string) => void;
  userLocation?: { latitude: number; longitude: number } | null;
  // Day planner props
  trip?: Trip;
  onAssignToDay?: (place: SavedItem, day: number | null) => void;
}

const CATEGORY_EMOJIS: Record<ItemCategory, string> = {
  [ItemCategory.FOOD]: '🍽️',
  [ItemCategory.ACCOMMODATION]: '🏨',
  [ItemCategory.PLACE]: '📍',
  [ItemCategory.SHOPPING]: '🛍️',
  [ItemCategory.ACTIVITY]: '🎯',
  [ItemCategory.TIP]: '💡',
};

const CATEGORY_BG_COLORS: Record<ItemCategory, string> = {
  [ItemCategory.FOOD]: theme.categoryColors.food.bg,
  [ItemCategory.ACCOMMODATION]: theme.categoryColors.accommodation.bg,
  [ItemCategory.PLACE]: theme.categoryColors.place.bg,
  [ItemCategory.SHOPPING]: theme.categoryColors.shopping.bg,
  [ItemCategory.ACTIVITY]: theme.categoryColors.activity.bg,
  [ItemCategory.TIP]: theme.categoryColors.tip.bg,
};

export const PlaceListDrawer: React.FC<PlaceListDrawerProps> = ({
  items,
  selectedCategory,
  selectedPlace,
  onPlaceSelect,
  onBackToList,
  onClose,
  onCheckIn,
  isPlaceCheckedIn,
  getUserName,
  onToggleFavorite,
  onToggleMustVisit,
  onDeleteItem,
  onUpdateNotes,
  userLocation,
  trip,
  onAssignToDay,
}) => {
  const drawerHeight = selectedPlace ? DRAWER_DETAIL_HEIGHT : DRAWER_LIST_HEIGHT;
  const [nearMeFilter, setNearMeFilter] = useState(false);
  const [nearMeRadius, setNearMeRadius] = useState<500 | 1000 | 5000>(1000); // meters
  const [localLocation, setLocalLocation] = useState<{ latitude: number; longitude: number } | null>(userLocation || null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  
  // Sort, filter, and view mode state
  const [sortBy, setSortBy] = useState<SortOption>('area');
  const [showSortModal, setShowSortModal] = useState(false);
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>('all');
  const [budgetFilter, setBudgetFilter] = useState<BudgetFilter>('all');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  // Update local location when prop changes
  useEffect(() => {
    if (userLocation) {
      setLocalLocation(userLocation);
    }
  }, [userLocation]);

  // Request location permission and get current location
  const requestLocationAndEnable = async () => {
    setIsLoadingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Location Permission',
          'Please enable location access to use the Near Me filter.',
          [{ text: 'OK' }]
        );
        setIsLoadingLocation(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const newLocation = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      
      setLocalLocation(newLocation);
      setNearMeFilter(true);
      setIsLoadingLocation(false);
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Error', 'Unable to get your location. Please try again.');
      setIsLoadingLocation(false);
    }
  };

  const handleNearMePress = () => {
    if (nearMeFilter) {
      // Toggle off
      setNearMeFilter(false);
    } else if (localLocation) {
      // We have location, toggle on
      setNearMeFilter(true);
    } else {
      // Need to request location
      requestLocationAndEnable();
    }
  };

  // Calculate distance between two coordinates in meters
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371000; // Radius of Earth in meters
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Filter and sort items by distance if nearMe is active
  const getFilteredItems = (): SavedItem[] => {
    // Ensure items is always an array
    let safeItems = items || [];
    
    // Apply rating filter
    if (ratingFilter !== 'all') {
      const minRating = parseFloat(ratingFilter);
      safeItems = safeItems.filter(item => 
        item.rating && Number(item.rating) >= minRating
      );
    }
    
    // Apply budget filter
    if (budgetFilter !== 'all') {
      const priceLevel = parseInt(budgetFilter);
      safeItems = safeItems.filter(item => 
        item.price_level === priceLevel
      );
    }
    
    // Apply near me filter
    if (nearMeFilter && localLocation) {
      safeItems = safeItems
        .filter((item) => {
          if (!item.location_lat || !item.location_lng) return false;
          const distance = calculateDistance(
            localLocation.latitude,
            localLocation.longitude,
            item.location_lat,
            item.location_lng
          );
          return distance <= nearMeRadius;
        })
        .map((item) => ({
          ...item,
          distance: calculateDistance(
            localLocation.latitude,
            localLocation.longitude,
            item.location_lat!,
            item.location_lng!
          ),
        }));
    }
    
    // Apply sorting (except 'area' which is handled in grouping)
    if (sortBy !== 'area') {
      safeItems = [...safeItems].sort((a, b) => {
        switch (sortBy) {
          case 'rating':
            return (Number(b.rating) || 0) - (Number(a.rating) || 0);
          case 'distance':
            if (!localLocation) return 0;
            const distA = a.distance ?? (a.location_lat && a.location_lng ? 
              calculateDistance(localLocation.latitude, localLocation.longitude, a.location_lat, a.location_lng) : Infinity);
            const distB = b.distance ?? (b.location_lat && b.location_lng ? 
              calculateDistance(localLocation.latitude, localLocation.longitude, b.location_lat, b.location_lng) : Infinity);
            return distA - distB;
          case 'date':
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          case 'alphabetical':
            return a.name.localeCompare(b.name);
          case 'must_visit':
            if (a.is_must_visit && !b.is_must_visit) return -1;
            if (!a.is_must_visit && b.is_must_visit) return 1;
            if (a.is_favorite && !b.is_favorite) return -1;
            if (!a.is_favorite && b.is_favorite) return 1;
            return 0;
          default:
            return 0;
        }
      });
    }
    
    return safeItems;
  };

  const filteredItems = getFilteredItems();
  
  // Check if any filters are active
  const hasActiveFilters = ratingFilter !== 'all' || budgetFilter !== 'all';

  // Group items by area if available (use filtered items)
  const groupedByArea = (filteredItems || []).reduce((acc, item) => {
    // Only group by area if sortBy is 'area'
    const area = sortBy === 'area' 
      ? (nearMeFilter ? 'Near You' : (item.area_name || 'Other Areas'))
      : 'All Places';
    if (!acc[area]) acc[area] = [];
    acc[area].push(item);
    return acc;
  }, {} as Record<string, SavedItem[]>);

  const areas = sortBy === 'area' 
    ? (nearMeFilter ? ['Near You'] : Object.keys(groupedByArea).sort())
    : ['All Places'];
  
  // Render a single place card (used in both list and grid view)
  const renderPlaceItem = (item: SavedItem, isGrid: boolean = false) => {
    const photoUrl = getPlacePhoto(item);
    const bgColor = CATEGORY_BG_COLORS[item.category];

    const renderRightActions = (
      progress: Animated.AnimatedInterpolation<number>,
      dragX: Animated.AnimatedInterpolation<number>
    ) => {
      const translateX = dragX.interpolate({
        inputRange: [-80, 0],
        outputRange: [0, 80],
        extrapolate: 'clamp',
      });

      return (
        <Animated.View
          style={[
            styles.deleteAction,
            { transform: [{ translateX }] },
          ]}
        >
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => onDeleteItem && onDeleteItem(item.id)}
          >
            <Text style={styles.deleteIcon}>🗑️</Text>
            <Text style={styles.deleteText}>Delete</Text>
          </TouchableOpacity>
        </Animated.View>
      );
    };

    if (isGrid) {
      // Grid view card
      return (
        <TouchableOpacity
          key={item.id}
          style={styles.gridCard}
          onPress={() => onPlaceSelect(item)}
          activeOpacity={0.8}
        >
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={styles.gridPhoto} resizeMode="cover" />
          ) : (
            <View style={[styles.gridPhoto, styles.gridPhotoPlaceholder, { backgroundColor: bgColor }]}>
              <Text style={styles.gridPlaceholderEmoji}>{CATEGORY_EMOJIS[item.category]}</Text>
            </View>
          )}
          <View style={styles.gridInfo}>
            <Text style={styles.gridName} numberOfLines={1}>{item.name}</Text>
            {item.rating ? (
              <View style={styles.gridRatingRow}>
                <Text style={styles.gridRatingText}>⭐ {Number(item.rating).toFixed(1)}</Text>
              </View>
            ) : null}
            <View style={styles.gridBadges}>
              {item.is_favorite && <Text style={styles.gridBadge}>❤️</Text>}
              {item.is_must_visit && <Text style={styles.gridBadge}>🎯</Text>}
            </View>
          </View>
        </TouchableOpacity>
      );
    }

    // List view card (existing)
    return (
      <Swipeable
        key={item.id}
        renderRightActions={onDeleteItem ? renderRightActions : undefined}
        overshootRight={false}
        friction={2}
      >
        <TouchableOpacity
          style={[styles.placeCard, item.is_must_visit && styles.mustVisitCard]}
          onPress={() => onPlaceSelect(item)}
          activeOpacity={0.8}
        >
          <View style={styles.placeContent}>
            {/* Left: Emoji + Info */}
            <View style={styles.placeInfo}>
              <View style={[styles.placeEmojiContainer, { backgroundColor: bgColor }]}>
                <Text style={styles.placeEmoji}>{CATEGORY_EMOJIS[item.category]}</Text>
              </View>
              <View style={styles.placeTextContainer}>
                <View style={styles.nameWithBadges}>
                  <Text style={styles.placeName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {/* Favorite/Must-visit indicators */}
                  <View style={styles.badgeRow}>
                    {item.is_favorite && (
                      <Text style={styles.favoriteBadge}>❤️</Text>
                    )}
                    {item.is_must_visit && (
                      <Text style={styles.mustVisitBadge}>🎯</Text>
                    )}
                  </View>
                </View>
                <View style={styles.metaRow}>
                  {item.rating ? (
                    <View style={styles.ratingContainer}>
                      <StarRating
                        rating={Number(item.rating) || 0}
                        reviewCount={Number(item.user_ratings_total) || 0}
                        size="small"
                        showReviewCount={false}
                      />
                    </View>
                  ) : (
                    <Text style={styles.placeDescription} numberOfLines={1}>
                      {item.description}
                    </Text>
                  )}
                  {nearMeFilter && item.distance !== undefined && (
                    <Text style={styles.distanceText}>
                      {formatDistance(item.distance)}
                    </Text>
                  )}
                </View>
              </View>
            </View>

            {/* Right: Photo */}
            {photoUrl ? (
              <Image
                source={{ uri: photoUrl }}
                style={styles.placePhoto}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.placePhoto, styles.placeholderPhoto, { backgroundColor: bgColor }]}>
                <Text style={styles.placeholderEmoji}>{CATEGORY_EMOJIS[item.category]}</Text>
              </View>
            )}
          </View>

          {/* Arrow indicator */}
          <View style={styles.arrowContainer}>
            <Text style={styles.arrowText}>→</Text>
          </View>
        </TouchableOpacity>
      </Swipeable>
    );
  };

  // Format distance for display
  const formatDistance = (meters: number): string => {
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    }
    return `${(meters / 1000).toFixed(1)}km`;
  };

  const getPlacePhoto = (item: SavedItem): string | null => {
    if (!item.photos_json) return null;
    try {
      const photos = Array.isArray(item.photos_json)
        ? item.photos_json
        : JSON.parse(item.photos_json);
      
      if (photos.length > 0) {
        return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=200&photoreference=${photos[0].photo_reference}&key=AIzaSyAiWhzrvdNb2NKSyzWpvNrhImz72I395Qo`;
      }
    } catch {
      return null;
    }
    return null;
  };

  // If a place is selected, show detail card
  if (selectedPlace) {
    return (
      <View style={[styles.drawer, { height: drawerHeight }]}>
        <PlaceDetailCard
          place={selectedPlace}
          onClose={onBackToList}
          onCheckIn={onCheckIn}
          isCheckedIn={isPlaceCheckedIn ? isPlaceCheckedIn(selectedPlace.id) : false}
          addedByName={getUserName ? getUserName(selectedPlace.added_by) : 'Someone'}
          onToggleFavorite={onToggleFavorite}
          onToggleMustVisit={onToggleMustVisit}
          onUpdateNotes={onUpdateNotes}
          trip={trip}
          onAssignToDay={onAssignToDay}
        />
      </View>
    );
  }

  // Otherwise, show list of places
  return (
    <View style={[styles.drawer, { height: drawerHeight }]}>
      {/* Drag Handle */}
      <View style={styles.dragHandle} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Text style={styles.headerTitle}>
            {nearMeFilter 
              ? `${filteredItems.length} nearby` 
              : selectedCategory === 'all' 
                ? `${filteredItems.length} saved spots` 
                : `${filteredItems.length} ${selectedCategory} spots`}
          </Text>
          {nearMeFilter && (
            <Text style={styles.radiusText}>within {nearMeRadius >= 1000 ? `${nearMeRadius/1000}km` : `${nearMeRadius}m`}</Text>
          )}
          {hasActiveFilters && (
            <Text style={styles.filterActiveText}>Filtered</Text>
          )}
        </View>
        <View style={styles.headerActions}>
          {/* View Toggle */}
          <TouchableOpacity 
            style={styles.viewToggleButton}
            onPress={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
          >
            <Text style={styles.viewToggleIcon}>{viewMode === 'list' ? '▦' : '☰'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.closeButtonContainer} onPress={onClose}>
            <Text style={styles.closeButton}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Sort & Filter Row */}
      <View style={styles.sortFilterRow}>
        {/* Sort Button */}
        <TouchableOpacity 
          style={styles.sortButton}
          onPress={() => setShowSortModal(true)}
        >
          <Text style={styles.sortIcon}>{SORT_OPTIONS.find(s => s.value === sortBy)?.icon || '📍'}</Text>
          <Text style={styles.sortText}>{SORT_OPTIONS.find(s => s.value === sortBy)?.label || 'Sort'}</Text>
          <Text style={styles.sortArrow}>▼</Text>
        </TouchableOpacity>
        
        {/* Filter Button */}
        <TouchableOpacity 
          style={[styles.filterButton, hasActiveFilters && styles.filterButtonActive]}
          onPress={() => setShowFilterModal(true)}
        >
          <Text style={styles.filterIcon}>🔽</Text>
          <Text style={[styles.filterText, hasActiveFilters && styles.filterTextActive]}>
            {hasActiveFilters ? 'Filtered' : 'Filter'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Near Me Filter Row */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.nearMeButton, nearMeFilter && styles.nearMeButtonActive]}
          onPress={handleNearMePress}
          disabled={isLoadingLocation}
        >
          <Text style={styles.nearMeIcon}>{isLoadingLocation ? '⏳' : '📍'}</Text>
          <Text style={[styles.nearMeText, nearMeFilter && styles.nearMeTextActive]}>
            {isLoadingLocation ? 'Loading...' : 'Near Me'}
          </Text>
        </TouchableOpacity>

        {nearMeFilter && localLocation && (
          <View style={styles.radiusButtons}>
            {([500, 1000, 5000] as const).map((radius) => (
              <TouchableOpacity
                key={radius}
                style={[styles.radiusButton, nearMeRadius === radius && styles.radiusButtonActive]}
                onPress={() => setNearMeRadius(radius)}
              >
                <Text style={[styles.radiusButtonText, nearMeRadius === radius && styles.radiusButtonTextActive]}>
                  {radius >= 1000 ? `${radius/1000}km` : `${radius}m`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {!localLocation && !nearMeFilter && !isLoadingLocation && (
          <Text style={styles.noLocationText}>Tap to enable location</Text>
        )}
      </View>

      {/* List of Places by Area */}
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={viewMode === 'grid' ? styles.gridScrollContent : styles.scrollContent}
        showsVerticalScrollIndicator={true}
        nestedScrollEnabled={true}
        bounces={true}
      >
        {viewMode === 'grid' ? (
          // Grid View
          <View style={styles.gridContainer}>
            {filteredItems.map((item) => renderPlaceItem(item, true))}
          </View>
        ) : (
          // List View (grouped by area)
          areas.map((area) => (
            <View key={area}>
              {/* Area Header - only show if grouping by area */}
              {sortBy === 'area' && (
                <View style={styles.areaHeader}>
                  <View style={styles.areaIndicator} />
                  <Text style={styles.areaTitle}>{area}</Text>
                </View>
              )}

              {/* Places in this area */}
              {(groupedByArea[area] || []).map((item) => renderPlaceItem(item, false))}
            </View>
          ))
        )}
      </ScrollView>
      
      {/* Sort Modal */}
      <Modal
        visible={showSortModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSortModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowSortModal(false)}
        >
          <View style={styles.sortModal}>
            <View style={styles.sortModalHeader}>
              <Text style={styles.sortModalTitle}>📊 Sort By</Text>
              <TouchableOpacity onPress={() => setShowSortModal(false)}>
                <Text style={styles.sortModalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            {SORT_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[styles.sortOption, sortBy === option.value && styles.sortOptionActive]}
                onPress={() => {
                  setSortBy(option.value);
                  setShowSortModal(false);
                }}
              >
                <Text style={styles.sortOptionIcon}>{option.icon}</Text>
                <Text style={[styles.sortOptionText, sortBy === option.value && styles.sortOptionTextActive]}>
                  {option.label}
                </Text>
                {sortBy === option.value && (
                  <Text style={styles.sortOptionCheck}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
      
      {/* Filter Modal */}
      <Modal
        visible={showFilterModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFilterModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowFilterModal(false)}
        >
          <View style={styles.filterModal}>
            <View style={styles.filterModalHeader}>
              <Text style={styles.filterModalTitle}>🔽 Filters</Text>
              <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                <Text style={styles.filterModalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            
            {/* Rating Filter */}
            <Text style={styles.filterSectionTitle}>⭐ Rating</Text>
            <View style={styles.filterOptions}>
              {RATING_FILTERS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.filterChip, ratingFilter === option.value && styles.filterChipActive]}
                  onPress={() => setRatingFilter(option.value)}
                >
                  <Text style={[styles.filterChipText, ratingFilter === option.value && styles.filterChipTextActive]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            {/* Budget Filter */}
            <Text style={styles.filterSectionTitle}>💰 Budget</Text>
            <View style={styles.filterOptions}>
              {BUDGET_FILTERS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.filterChip, budgetFilter === option.value && styles.filterChipActive]}
                  onPress={() => setBudgetFilter(option.value)}
                >
                  <Text style={[styles.filterChipText, budgetFilter === option.value && styles.filterChipTextActive]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            {/* Clear Filters */}
            {hasActiveFilters && (
              <TouchableOpacity
                style={styles.clearFiltersButton}
                onPress={() => {
                  setRatingFilter('all');
                  setBudgetFilter('all');
                }}
              >
                <Text style={styles.clearFiltersText}>Clear All Filters</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity
              style={styles.applyFiltersButton}
              onPress={() => setShowFilterModal(false)}
            >
              <Text style={styles.applyFiltersText}>Apply Filters</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  drawer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderRightWidth: 3,
    borderColor: theme.colors.borderDark,
    zIndex: 5000,
  },
  dragHandle: {
    width: 48,
    height: 6,
    backgroundColor: theme.colors.borderMedium,
    borderRadius: 3,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.border,
  },
  headerTitleRow: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: theme.colors.textPrimary,
    letterSpacing: -0.5,
  },
  radiusText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    gap: 10,
  },
  nearMeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.backgroundAlt,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 2,
    borderColor: theme.colors.borderDark,
  },
  nearMeButtonActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primaryDark,
  },
  nearMeIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  nearMeText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  nearMeTextActive: {
    color: theme.colors.textInverse,
  },
  radiusButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  radiusButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 2,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  radiusButtonActive: {
    backgroundColor: theme.colors.secondary,
    borderColor: theme.colors.borderDark,
  },
  radiusButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  radiusButtonTextActive: {
    color: theme.colors.textPrimary,
  },
  noLocationText: {
    fontSize: 12,
    color: theme.colors.textTertiary,
    fontStyle: 'italic',
  },
  closeButtonContainer: {
    width: 36,
    height: 36,
    backgroundColor: theme.colors.backgroundAlt,
    borderWidth: 2,
    borderColor: theme.colors.borderDark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    fontSize: 18,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  areaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 4,
  },
  areaIndicator: {
    width: 4,
    height: 20,
    backgroundColor: theme.colors.primary,
    marginRight: 12,
  },
  areaTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    letterSpacing: -0.3,
  },
  placeCard: {
    backgroundColor: theme.colors.surface,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: theme.colors.borderDark,
    ...theme.shadows.neopop.sm,
  },
  mustVisitCard: {
    borderColor: theme.colors.success,
    borderLeftWidth: 4,
  },
  placeContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
  },
  placeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  placeEmojiContainer: {
    width: 48,
    height: 48,
    borderWidth: 2,
    borderColor: theme.colors.borderDark,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  placeEmoji: {
    fontSize: 24,
  },
  placeTextContainer: {
    flex: 1,
  },
  nameWithBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  placeName: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    flex: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    marginLeft: 6,
  },
  favoriteBadge: {
    fontSize: 14,
    marginRight: 4,
  },
  mustVisitBadge: {
    fontSize: 14,
  },
  placeDescription: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    lineHeight: 18,
    flex: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ratingContainer: {
    marginTop: 2,
    flex: 1,
  },
  distanceText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.primary,
    marginLeft: 8,
  },
  placePhoto: {
    width: 72,
    height: 72,
    borderWidth: 2,
    borderColor: theme.colors.borderDark,
  },
  placeholderPhoto: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderEmoji: {
    fontSize: 28,
    opacity: 0.4,
  },
  arrowContainer: {
    position: 'absolute',
    right: 14,
    bottom: 14,
    width: 28,
    height: 28,
    backgroundColor: theme.colors.primary,
    borderWidth: 2,
    borderColor: theme.colors.borderDark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrowText: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.textInverse,
  },
  // Swipe to delete styles
  deleteAction: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    marginBottom: 12,
  },
  deleteButton: {
    flex: 1,
    backgroundColor: theme.colors.error,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    borderWidth: 2,
    borderColor: theme.colors.errorDark,
  },
  deleteIcon: {
    fontSize: 22,
    marginBottom: 4,
  },
  deleteText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textInverse,
  },
  // Header actions
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  viewToggleButton: {
    width: 36,
    height: 36,
    backgroundColor: theme.colors.backgroundAlt,
    borderWidth: 2,
    borderColor: theme.colors.borderDark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewToggleIcon: {
    fontSize: 18,
    color: theme.colors.textPrimary,
  },
  filterActiveText: {
    fontSize: 12,
    color: theme.colors.primary,
    fontWeight: '700',
    marginTop: 2,
  },
  // Sort & Filter Row
  sortFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    gap: 10,
  },
  sortButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.backgroundAlt,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 2,
    borderColor: theme.colors.borderDark,
  },
  sortIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  sortText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  sortArrow: {
    fontSize: 10,
    color: theme.colors.textSecondary,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.backgroundAlt,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 2,
    borderColor: theme.colors.borderDark,
  },
  filterButtonActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primaryDark,
  },
  filterIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  filterTextActive: {
    color: theme.colors.textInverse,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sortModal: {
    width: '80%',
    backgroundColor: theme.colors.surface,
    borderWidth: 3,
    borderColor: theme.colors.borderDark,
    ...theme.shadows.neopop.lg,
  },
  sortModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.backgroundAlt,
  },
  sortModalTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: theme.colors.textPrimary,
  },
  sortModalClose: {
    fontSize: 20,
    color: theme.colors.textSecondary,
    fontWeight: '700',
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  sortOptionActive: {
    backgroundColor: theme.colors.primary + '15',
  },
  sortOptionIcon: {
    fontSize: 18,
    marginRight: 12,
  },
  sortOptionText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  sortOptionTextActive: {
    color: theme.colors.primary,
    fontWeight: '800',
  },
  sortOptionCheck: {
    fontSize: 16,
    color: theme.colors.success,
    fontWeight: '800',
  },
  // Filter Modal
  filterModal: {
    width: '85%',
    backgroundColor: theme.colors.surface,
    borderWidth: 3,
    borderColor: theme.colors.borderDark,
    ...theme.shadows.neopop.lg,
  },
  filterModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.backgroundAlt,
  },
  filterModalTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: theme.colors.textPrimary,
  },
  filterModalClose: {
    fontSize: 20,
    color: theme.colors.textSecondary,
    fontWeight: '700',
  },
  filterSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: theme.colors.backgroundAlt,
    borderWidth: 2,
    borderColor: theme.colors.borderDark,
    marginBottom: 4,
  },
  filterChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primaryDark,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  filterChipTextActive: {
    color: theme.colors.textInverse,
  },
  clearFiltersButton: {
    marginHorizontal: 16,
    marginTop: 16,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.error,
    borderStyle: 'dashed',
  },
  clearFiltersText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.error,
  },
  applyFiltersButton: {
    marginHorizontal: 16,
    marginVertical: 16,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    borderWidth: 2,
    borderColor: theme.colors.borderDark,
    ...theme.shadows.neopop.sm,
  },
  applyFiltersText: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.textInverse,
  },
  // Grid View Styles
  gridScrollContent: {
    paddingHorizontal: 12,
    paddingBottom: 100,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingTop: 12,
  },
  gridCard: {
    width: '48%',
    backgroundColor: theme.colors.surface,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: theme.colors.borderDark,
    ...theme.shadows.neopop.sm,
  },
  gridPhoto: {
    width: '100%',
    height: 100,
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.borderDark,
  },
  gridPhotoPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridPlaceholderEmoji: {
    fontSize: 36,
    opacity: 0.4,
  },
  gridInfo: {
    padding: 10,
  },
  gridName: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  gridRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gridRatingText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  gridBadges: {
    flexDirection: 'row',
    marginTop: 4,
    gap: 4,
  },
  gridBadge: {
    fontSize: 12,
  },
});
