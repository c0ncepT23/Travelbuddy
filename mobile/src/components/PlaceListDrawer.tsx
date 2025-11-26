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
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import * as Location from 'expo-location';
import { SavedItem, ItemCategory } from '../types';
import { PlaceDetailCard } from './PlaceDetailCard';
import { StarRating } from './StarRating';
import theme from '../config/theme';

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
  userLocation?: { latitude: number; longitude: number } | null;
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
  userLocation,
}) => {
  const drawerHeight = selectedPlace ? DRAWER_DETAIL_HEIGHT : DRAWER_LIST_HEIGHT;
  const [nearMeFilter, setNearMeFilter] = useState(false);
  const [nearMeRadius, setNearMeRadius] = useState<500 | 1000 | 5000>(1000); // meters
  const [localLocation, setLocalLocation] = useState<{ latitude: number; longitude: number } | null>(userLocation || null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);

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
    const safeItems = items || [];
    
    if (!nearMeFilter || !localLocation) return safeItems;
    
    return safeItems
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
      }))
      .sort((a, b) => (a.distance || 0) - (b.distance || 0));
  };

  const filteredItems = getFilteredItems();

  // Group items by area if available (use filtered items)
  const groupedByArea = (filteredItems || []).reduce((acc, item) => {
    const area = nearMeFilter ? 'Near You' : (item.area_name || 'Other Areas');
    if (!acc[area]) acc[area] = [];
    acc[area].push(item);
    return acc;
  }, {} as Record<string, SavedItem[]>);

  const areas = nearMeFilter ? ['Near You'] : Object.keys(groupedByArea).sort();

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
                ? `${items.length} saved spots` 
                : `${items.length} ${selectedCategory} spots`}
          </Text>
          {nearMeFilter && (
            <Text style={styles.radiusText}>within {nearMeRadius >= 1000 ? `${nearMeRadius/1000}km` : `${nearMeRadius}m`}</Text>
          )}
        </View>
        <TouchableOpacity style={styles.closeButtonContainer} onPress={onClose}>
          <Text style={styles.closeButton}>✕</Text>
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
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
        nestedScrollEnabled={true}
        bounces={true}
      >
        {areas.map((area) => (
          <View key={area}>
            {/* Area Header */}
            <View style={styles.areaHeader}>
              <View style={styles.areaIndicator} />
              <Text style={styles.areaTitle}>{area}</Text>
            </View>

            {/* Places in this area */}
            {(groupedByArea[area] || []).map((item) => {
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
            })}
          </View>
        ))}
      </ScrollView>
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
});
