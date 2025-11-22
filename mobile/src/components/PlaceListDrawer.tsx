import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ScrollView,
  Image,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { SavedItem, ItemCategory } from '../types';
import { PlaceDetailCard } from './PlaceDetailCard';
import { StarRating } from './StarRating';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const DRAWER_MIN_HEIGHT = 140;
const DRAWER_MAX_HEIGHT = SCREEN_HEIGHT * 0.75;

interface PlaceListDrawerProps {
  items: SavedItem[];
  selectedCategory: ItemCategory | 'all';
  selectedPlace: SavedItem | null;
  onPlaceSelect: (item: SavedItem) => void;
  onBackToList: () => void;  // Go back from detail to list
  onClose: () => void;  // Close drawer completely
  onCheckIn?: (place: SavedItem) => void;
  isPlaceCheckedIn?: (placeId: string) => boolean;
  getUserName?: (userId: string) => string;
}

const CATEGORY_EMOJIS: Record<ItemCategory, string> = {
  [ItemCategory.FOOD]: '🍽️',
  [ItemCategory.ACCOMMODATION]: '🏨',
  [ItemCategory.PLACE]: '📍',
  [ItemCategory.SHOPPING]: '🛍️',
  [ItemCategory.ACTIVITY]: '🎯',
  [ItemCategory.TIP]: '💡',
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
}) => {
  const drawerHeight = useSharedValue(DRAWER_MIN_HEIGHT);

  const animatedStyle = useAnimatedStyle(() => ({
    height: drawerHeight.value,
  }));

  // Group items by area if available
  const groupedByArea = items.reduce((acc, item) => {
    const area = item.area_name || 'Other Areas';
    if (!acc[area]) acc[area] = [];
    acc[area].push(item);
    return acc;
  }, {} as Record<string, SavedItem[]>);

  const areas = Object.keys(groupedByArea).sort();

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
      <Animated.View style={[styles.drawer, { height: DRAWER_MAX_HEIGHT }]}>
        <PlaceDetailCard
          place={selectedPlace}
          onClose={onBackToList}
          onCheckIn={onCheckIn}
          isCheckedIn={isPlaceCheckedIn ? isPlaceCheckedIn(selectedPlace.id) : false}
          addedByName={getUserName ? getUserName(selectedPlace.added_by) : 'Someone'}
        />
      </Animated.View>
    );
  }

  // Otherwise, show list of places
  return (
    <Animated.View style={[styles.drawer, animatedStyle]}>
      {/* Drag Handle */}
      <View style={styles.dragHandle} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {selectedCategory === 'all' 
            ? `${items.length} saved spots` 
            : `${items.length} ${selectedCategory} spots`}
        </Text>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.closeButton}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* List of Places by Area */}
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {areas.map((area) => (
          <View key={area}>
            {/* Area Header */}
            <View style={styles.areaHeader}>
              <Text style={styles.areaTitle}>{area}</Text>
              <TouchableOpacity>
                <Text style={styles.areaExpand}>›</Text>
              </TouchableOpacity>
            </View>

            {/* Places in this area */}
            {groupedByArea[area].map((item) => {
              const photoUrl = getPlacePhoto(item);

              return (
                <TouchableOpacity
                  key={item.id}
                  style={styles.placeCard}
                  onPress={() => onPlaceSelect(item)}
                  activeOpacity={0.7}
                >
                  <View style={styles.placeContent}>
                    {/* Left: Emoji + Info */}
                    <View style={styles.placeInfo}>
                      <Text style={styles.placeEmoji}>{CATEGORY_EMOJIS[item.category]}</Text>
                      <View style={styles.placeTextContainer}>
                        <Text style={styles.placeName} numberOfLines={1}>
                          {item.name}
                        </Text>
                        {item.rating && item.rating > 0 ? (
                          <View style={styles.ratingContainer}>
                            <StarRating
                              rating={item.rating}
                              reviewCount={item.user_ratings_total}
                              size="small"
                              showReviewCount={false}
                            />
                          </View>
                        ) : (
                          <Text style={styles.placeDescription} numberOfLines={1}>
                            {item.description}
                          </Text>
                        )}
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
                      <View style={[styles.placePhoto, styles.placeholderPhoto]}>
                        <Text style={styles.placeholderEmoji}>{CATEGORY_EMOJIS[item.category]}</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </ScrollView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  drawer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 20,
    zIndex: 5000,
  },
  dragHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#E5E5EA',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
  },
  closeButton: {
    fontSize: 24,
    color: '#8E8E93',
    fontWeight: '300',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  areaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 4,
  },
  areaTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
  },
  areaExpand: {
    fontSize: 24,
    color: '#8E8E93',
    fontWeight: '300',
  },
  placeCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#E5E5EA',
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
  placeEmoji: {
    fontSize: 32,
    marginRight: 12,
  },
  placeTextContainer: {
    flex: 1,
  },
  placeName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  placeDescription: {
    fontSize: 13,
    color: '#8E8E93',
    lineHeight: 18,
  },
  ratingContainer: {
    marginTop: 2,
  },
  placePhoto: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  placeholderPhoto: {
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderEmoji: {
    fontSize: 28,
    opacity: 0.3,
  },
});

