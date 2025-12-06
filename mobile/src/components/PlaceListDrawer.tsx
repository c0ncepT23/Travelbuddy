import React, { useRef, useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ScrollView,
  Image,
  TextInput,
  Alert,
} from 'react-native';
import { Swipeable, PanGestureHandler } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedGestureHandler,
  withSpring,
} from 'react-native-reanimated';
import * as Location from 'expo-location';
import { SavedItem, ItemCategory, Trip } from '../types';
import { PlaceDetailCard } from './PlaceDetailCard';
import { getPlacePhotoUrl } from '../config/maps';
import { useItemStore } from '../stores/itemStore';
import theme from '../config/theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const DRAWER_MIN_HEIGHT = SCREEN_HEIGHT * 0.5;
const DRAWER_MAX_HEIGHT = SCREEN_HEIGHT * 0.85;

// Category options for filter chips
const CATEGORY_OPTIONS = [
  { key: 'all', label: 'All', icon: '📍' },
  { key: 'food', label: 'Food', icon: '🍽️' },
  { key: 'place', label: 'Places', icon: '🏛️' },
  { key: 'shopping', label: 'Shopping', icon: '🛍️' },
  { key: 'activity', label: 'Activities', icon: '🎯' },
  { key: 'accommodation', label: 'Hotels', icon: '🏨' },
];

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
  trip?: Trip;
  onAssignToDay?: (place: SavedItem, day: number | null) => void;
}

const CATEGORY_EMOJIS: Record<ItemCategory, string> = {
  [ItemCategory.FOOD]: '🍽️',
  [ItemCategory.ACCOMMODATION]: '🏨',
  [ItemCategory.PLACE]: '🏛️',
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
  onToggleFavorite,
  onToggleMustVisit,
  onDeleteItem,
  onUpdateNotes,
  userLocation,
  trip,
  onAssignToDay,
}) => {
  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [collapsedAreas, setCollapsedAreas] = useState<Set<string>>(new Set());
  
  // Animated drawer height
  const drawerHeight = useSharedValue(selectedPlace ? DRAWER_MIN_HEIGHT : DRAWER_MIN_HEIGHT);
  
  useEffect(() => {
    drawerHeight.value = withSpring(DRAWER_MIN_HEIGHT, { damping: 20 });
  }, [selectedPlace]);

  const gestureHandler = useAnimatedGestureHandler({
    onStart: (_, ctx: any) => {
      ctx.startHeight = drawerHeight.value;
    },
    onActive: (event, ctx: any) => {
      const newHeight = ctx.startHeight - event.translationY;
      if (newHeight >= DRAWER_MIN_HEIGHT && newHeight <= DRAWER_MAX_HEIGHT) {
        drawerHeight.value = newHeight;
      }
    },
    onEnd: (event) => {
      if (event.velocityY > 500 || drawerHeight.value < (DRAWER_MIN_HEIGHT + DRAWER_MAX_HEIGHT) / 2) {
        drawerHeight.value = withSpring(DRAWER_MIN_HEIGHT, { damping: 20 });
      } else {
        drawerHeight.value = withSpring(DRAWER_MAX_HEIGHT, { damping: 20 });
      }
    },
  });

  const animatedDrawerStyle = useAnimatedStyle(() => ({
    height: drawerHeight.value,
  }));

  // Get enrichment function from store
  const { enrichItemWithGoogle } = useItemStore();

  // Fuzzy search helper - checks if query characters appear in order in text
  const fuzzyMatch = (text: string, query: string): { matches: boolean; score: number } => {
    if (!text || !query) return { matches: false, score: 0 };
    
    const textLower = text.toLowerCase();
    const queryLower = query.toLowerCase();
    
    // Exact match or contains - highest score
    if (textLower.includes(queryLower)) {
      return { matches: true, score: 100 - textLower.indexOf(queryLower) };
    }
    
    // Fuzzy match - characters appear in order
    let queryIndex = 0;
    let consecutiveMatches = 0;
    let maxConsecutive = 0;
    let lastMatchIndex = -2;
    
    for (let i = 0; i < textLower.length && queryIndex < queryLower.length; i++) {
      if (textLower[i] === queryLower[queryIndex]) {
        if (i === lastMatchIndex + 1) {
          consecutiveMatches++;
          maxConsecutive = Math.max(maxConsecutive, consecutiveMatches);
        } else {
          consecutiveMatches = 1;
        }
        lastMatchIndex = i;
        queryIndex++;
      }
    }
    
    if (queryIndex === queryLower.length) {
      // All query characters found in order
      const score = 50 + (maxConsecutive * 10) - (lastMatchIndex - queryLower.length);
      return { matches: true, score };
    }
    
    return { matches: false, score: 0 };
  };

  // Filter items by search and category with fuzzy matching
  const filteredItems = useMemo(() => {
    let result = items || [];
    
    // Filter by search with fuzzy matching
    if (searchQuery.trim()) {
      const query = searchQuery.trim();
      
      const scoredItems = result.map(item => {
        const nameMatch = fuzzyMatch(item.name, query);
        const areaMatch = fuzzyMatch(item.area_name || '', query);
        const descMatch = fuzzyMatch(item.description || '', query);
        const locationMatch = fuzzyMatch(item.location_name || '', query);
        
        const bestScore = Math.max(
          nameMatch.score * 2, // Name matches weighted higher
          areaMatch.score,
          descMatch.score,
          locationMatch.score
        );
        
        const matches = nameMatch.matches || areaMatch.matches || descMatch.matches || locationMatch.matches;
        
        return { item, score: bestScore, matches };
      });
      
      // Filter to matching items and sort by score
      result = scoredItems
        .filter(({ matches }) => matches)
        .sort((a, b) => b.score - a.score)
        .map(({ item }) => item);
    }
    
    // Filter by category
    if (activeCategory !== 'all') {
      result = result.filter(item => item.category === activeCategory);
    }
    
    return result;
  }, [items, searchQuery, activeCategory]);

  // Track which items we've tried to enrich
  const enrichedRef = useRef<Set<string>>(new Set());

  // Auto-enrich items without photos (runs once when items change)
  useEffect(() => {
    const enrichItems = async () => {
      // Only enrich first 5 items to avoid too many API calls
      const itemsNeedingEnrichment = filteredItems.filter(
        item => !item.photos_json && !enrichedRef.current.has(item.id)
      ).slice(0, 5);
      
      for (const item of itemsNeedingEnrichment) {
        enrichedRef.current.add(item.id);
        try {
          await enrichItemWithGoogle(item.id);
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          // Silently fail - item just won't have photo
        }
      }
    };
    
    if (filteredItems.some(item => !item.photos_json && !enrichedRef.current.has(item.id))) {
      enrichItems();
    }
  }, [filteredItems.length]);

  // Extract city from formatted address
  const extractCity = (address: string | undefined): string => {
    if (!address) return '';
    // Common patterns: "..., Minato City, Tokyo ...", "..., Shibuya, Tokyo ..."
    const parts = address.split(',').map(p => p.trim());
    // Look for city/prefecture (usually 2nd or 3rd from end before country)
    if (parts.length >= 3) {
      // Get the part before "Japan" which is usually prefecture/city
      const cityPart = parts[parts.length - 2]; // e.g., "Tokyo 107-0061"
      // Remove postal code
      const cityClean = cityPart.replace(/\d{3}-\d{4}/, '').trim();
      if (cityClean && cityClean !== 'Japan') {
        return cityClean;
      }
    }
    return '';
  };

  // Group items by area with city context
  const groupedByArea = useMemo(() => {
    const groups: Record<string, { items: SavedItem[], city: string }> = {};
    
    filteredItems.forEach(item => {
      const area = item.area_name || 'Other Locations';
      const city = extractCity(item.formatted_address || item.location_name);
      const groupKey = area;
      
      if (!groups[groupKey]) {
        groups[groupKey] = { items: [], city };
      }
      groups[groupKey].items.push(item);
      // Keep the most common city for the group
      if (city && !groups[groupKey].city) {
        groups[groupKey].city = city;
      }
    });
    
    // Sort areas alphabetically, but put "Other Locations" at the end
    const sortedAreas = Object.keys(groups).sort((a, b) => {
      if (a === 'Other Locations') return 1;
      if (b === 'Other Locations') return -1;
      return a.localeCompare(b);
    });
    
    return { groups, sortedAreas };
  }, [filteredItems]);

  const toggleAreaCollapse = (area: string) => {
    setCollapsedAreas(prev => {
      const newSet = new Set(prev);
      if (newSet.has(area)) {
        newSet.delete(area);
      } else {
        newSet.add(area);
      }
      return newSet;
    });
  };

  // Get photo URL using helper from config/maps
  const getPlacePhoto = (item: SavedItem): string | null => {
    return getPlacePhotoUrl(item.photos_json, 200);
  };

  // Render a place card with photo support
  const renderPlaceCard = (item: SavedItem) => {
    const photoUrl = getPlacePhoto(item);
    const emoji = CATEGORY_EMOJIS[item.category] || '📍';

    const renderRightActions = () => (
      <TouchableOpacity
        style={styles.deleteAction}
        onPress={() => onDeleteItem && onDeleteItem(item.id)}
      >
        <Text style={styles.deleteIcon}>🗑️</Text>
      </TouchableOpacity>
    );

    return (
      <Swipeable
        key={item.id}
        renderRightActions={onDeleteItem ? renderRightActions : undefined}
        overshootRight={false}
      >
        <TouchableOpacity
          style={styles.placeCard}
          onPress={() => onPlaceSelect(item)}
          activeOpacity={0.7}
        >
          <View style={styles.placeCardLeft}>
            {/* Show photo as icon if available, otherwise emoji */}
            {photoUrl ? (
              <Image source={{ uri: photoUrl }} style={styles.placeIconPhoto} />
            ) : (
              <View style={styles.placeIconContainer}>
                <Text style={styles.placeIcon}>{emoji}</Text>
              </View>
            )}
            <View style={styles.placeInfo}>
              <Text style={styles.placeName} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.placeDescription} numberOfLines={2}>
                {item.description || `A ${item.category} spot to visit`}
              </Text>
              {item.rating && (
                <View style={styles.ratingRow}>
                  <Text style={styles.ratingStar}>★</Text>
                  <Text style={styles.ratingText}>{Number(item.rating).toFixed(1)}</Text>
                  {item.user_ratings_total && (
                    <Text style={styles.ratingCount}>({item.user_ratings_total})</Text>
                  )}
                </View>
              )}
            </View>
          </View>
          
          {/* Large photo on right side */}
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={styles.placePhoto} />
          ) : (
            <View style={[styles.placePhoto, styles.placePhotoPlaceholder]}>
              <Text style={styles.placePhotoEmoji}>{emoji}</Text>
            </View>
          )}
        </TouchableOpacity>
      </Swipeable>
    );
  };

  // If place is selected, show detail view
  if (selectedPlace) {
    return (
      <Animated.View style={[styles.drawer, animatedDrawerStyle]}>
        <PanGestureHandler onGestureEvent={gestureHandler}>
          <Animated.View style={styles.dragHandleArea}>
            <View style={styles.dragHandle} />
          </Animated.View>
        </PanGestureHandler>
        
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
      </Animated.View>
    );
  }

  // Main list view
  return (
    <Animated.View style={[styles.drawer, animatedDrawerStyle]}>
      {/* Drag Handle */}
      <PanGestureHandler onGestureEvent={gestureHandler}>
        <Animated.View style={styles.dragHandleArea}>
          <View style={styles.dragHandle} />
        </Animated.View>
      </PanGestureHandler>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{trip?.destination || 'Saved Places'}</Text>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search places..."
          placeholderTextColor="#9CA3AF"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Text style={styles.clearSearch}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Category Filter Chips */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.categoryScroll}
        contentContainerStyle={styles.categoryContainer}
      >
        {CATEGORY_OPTIONS.map(cat => {
          const count = cat.key === 'all' 
            ? items.length 
            : items.filter(i => i.category === cat.key).length;
          
          if (count === 0 && cat.key !== 'all') return null;
          
          return (
            <TouchableOpacity
              key={cat.key}
              style={[
                styles.categoryChip,
                activeCategory === cat.key && styles.categoryChipActive
              ]}
              onPress={() => setActiveCategory(cat.key)}
            >
              <Text style={[
                styles.categoryChipText,
                activeCategory === cat.key && styles.categoryChipTextActive
              ]}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Places List - Grouped by Area */}
      <ScrollView 
        style={styles.placesScroll}
        contentContainerStyle={styles.placesContainer}
        showsVerticalScrollIndicator={false}
      >
        {groupedByArea.sortedAreas.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateEmoji}>🔍</Text>
            <Text style={styles.emptyStateText}>No places found</Text>
            <Text style={styles.emptyStateSubtext}>Try a different search or category</Text>
          </View>
        ) : (
          groupedByArea.sortedAreas.map(area => {
            const areaData = groupedByArea.groups[area];
            const areaItems = areaData.items;
            const city = areaData.city;
            const isCollapsed = collapsedAreas.has(area);
            const displayName = city && area !== 'Other Locations' 
              ? `${area}, ${city}` 
              : area;
            
            return (
              <View key={area} style={styles.areaSection}>
                {/* Area Header */}
                <TouchableOpacity 
                  style={styles.areaHeader}
                  onPress={() => toggleAreaCollapse(area)}
                  activeOpacity={0.7}
                >
                  <View style={styles.areaHeaderLeft}>
                    <Text style={styles.areaTitle}>{displayName}</Text>
                    <Text style={styles.areaCount}>{areaItems.length} {areaItems.length === 1 ? 'place' : 'places'}</Text>
                  </View>
                  <Text style={styles.areaChevron}>
                    {isCollapsed ? '›' : '⌄'}
                  </Text>
                </TouchableOpacity>

                {/* Area Places */}
                {!isCollapsed && (
                  <View style={styles.areaPlaces}>
                    {areaItems.map(item => renderPlaceCard(item))}
                  </View>
                )}
              </View>
            );
          })
        )}
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
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 20,
    zIndex: 5000,
  },
  dragHandleArea: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
  },
  
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    letterSpacing: -0.5,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '600',
  },

  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
    padding: 0,
  },
  clearSearch: {
    fontSize: 14,
    color: '#9CA3AF',
    padding: 4,
  },

  // Category Chips
  categoryScroll: {
    maxHeight: 44,
    marginBottom: 8,
  },
  categoryContainer: {
    paddingHorizontal: 20,
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    marginRight: 8,
  },
  categoryChipActive: {
    backgroundColor: '#1F2937',
  },
  categoryChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  categoryChipTextActive: {
    color: '#FFFFFF',
  },

  // Places List
  placesScroll: {
    flex: 1,
  },
  placesContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  // Area Section
  areaSection: {
    marginBottom: 8,
  },
  areaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  areaHeaderLeft: {
    flex: 1,
  },
  areaTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 2,
  },
  areaCount: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  areaChevron: {
    fontSize: 20,
    color: '#9CA3AF',
    fontWeight: '300',
  },
  areaPlaces: {
    paddingTop: 12,
  },

  // Place Card
  placeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
  },
  placeCardLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  placeIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  placeIcon: {
    fontSize: 22,
  },
  placeInfo: {
    flex: 1,
    marginRight: 12,
  },
  placeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  placeDescription: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  ratingStar: {
    fontSize: 12,
    color: '#FBBF24',
    marginRight: 3,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  ratingCount: {
    fontSize: 11,
    color: '#9CA3AF',
    marginLeft: 4,
  },
  placeIconPhoto: {
    width: 44,
    height: 44,
    borderRadius: 12,
    marginRight: 12,
  },
  placePhoto: {
    width: 72,
    height: 72,
    borderRadius: 12,
  },
  placePhotoPlaceholder: {
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placePhotoEmoji: {
    fontSize: 28,
    opacity: 0.5,
  },

  // Delete Action
  deleteAction: {
    width: 70,
    height: '100%',
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    marginLeft: 8,
  },
  deleteIcon: {
    fontSize: 22,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateEmoji: {
    fontSize: 48,
    marginBottom: 16,
    opacity: 0.5,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 4,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#9CA3AF',
  },
});
