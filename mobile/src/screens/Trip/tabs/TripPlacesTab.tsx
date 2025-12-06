import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  TextInput,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { MotiView } from 'moti';
import { useItemStore } from '../../../stores/itemStore';
import { SavedItem, ItemCategory } from '../../../types';
import { HapticFeedback } from '../../../utils/haptics';
import theme from '../../../config/theme';

interface TripPlacesTabProps {
  tripId: string;
  navigation: any;
}

const CATEGORIES = [
  { key: 'all', label: 'All', icon: '📋' },
  { key: 'food', label: 'Food', icon: '🍽️' },
  { key: 'place', label: 'Places', icon: '📍' },
  { key: 'shopping', label: 'Shopping', icon: '🛍️' },
  { key: 'activity', label: 'Activities', icon: '🎯' },
  { key: 'accommodation', label: 'Hotels', icon: '🏨' },
];

const getCategoryColor = (category: string): string => {
  switch (category) {
    case 'food': return '#F472B6';
    case 'place': return '#60A5FA';
    case 'shopping': return '#FBBF24';
    case 'activity': return '#34D399';
    case 'accommodation': return '#A78BFA';
    default: return '#94A3B8';
  }
};

const getCategoryLabel = (category: string): string => {
  switch (category) {
    case 'food': return 'Restaurant';
    case 'place': return 'Attraction';
    case 'shopping': return 'Shopping';
    case 'activity': return 'Activity';
    case 'accommodation': return 'Hotel';
    default: return 'Other';
  }
};

const getPhotoUrl = (place: SavedItem): string | null => {
  if (!place.photos_json) return null;
  try {
    const photos = Array.isArray(place.photos_json) 
      ? place.photos_json 
      : JSON.parse(place.photos_json);
    if (photos.length > 0 && photos[0].photo_reference) {
      return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${photos[0].photo_reference}&key=AIzaSyAiWhzrvdNb2NKSyzWpvNrhImz72I395Qo`;
    }
  } catch {}
  return null;
};

export default function TripPlacesTab({ tripId, navigation }: TripPlacesTabProps) {
  const { items, fetchTripItems, toggleFavorite, toggleMustVisit, isLoading } = useItemStore();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchTripItems(tripId, {});
  }, [tripId]);

  // Filter items
  const filteredItems = useMemo(() => {
    let filtered = items;
    
    // Category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(item => item.category === selectedCategory);
    }
    
    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item => 
        item.name.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query) ||
        item.area_name?.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [items, selectedCategory, searchQuery]);

  // Refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchTripItems(tripId, {});
    setRefreshing(false);
  };

  // Render category filter
  const renderCategoryFilter = () => (
    <View style={styles.categoryContainer}>
      <FlatList
        horizontal
        data={CATEGORIES}
        keyExtractor={(item) => item.key}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryList}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.categoryChip,
              selectedCategory === item.key && styles.categoryChipActive,
            ]}
            onPress={() => {
              HapticFeedback.light();
              setSelectedCategory(item.key);
            }}
          >
            <Text style={styles.categoryIcon}>{item.icon}</Text>
            <Text style={[
              styles.categoryLabel,
              selectedCategory === item.key && styles.categoryLabelActive,
            ]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );

  // Render place card
  const renderPlaceCard = ({ item, index }: { item: SavedItem; index: number }) => {
    const photoUrl = getPhotoUrl(item);
    
    return (
      <MotiView
        from={{ opacity: 0, translateY: 20 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 300, delay: index * 50 }}
      >
        <TouchableOpacity
          style={styles.placeCard}
          activeOpacity={0.9}
          onPress={() => {
            HapticFeedback.light();
            // TODO: Open place detail modal
          }}
        >
          {/* Photo */}
          <View style={styles.photoContainer}>
            {photoUrl ? (
              <Image source={{ uri: photoUrl }} style={styles.photo} />
            ) : (
              <View style={[styles.photo, styles.photoPlaceholder]}>
                <Text style={styles.photoPlaceholderText}>
                  {CATEGORIES.find(c => c.key === item.category)?.icon || '📍'}
                </Text>
              </View>
            )}
            
            {/* Favorite Badge */}
            {item.is_favorite && (
              <View style={styles.favoriteBadge}>
                <Text style={styles.favoriteBadgeText}>❤️</Text>
              </View>
            )}
            
            {/* Must Visit Badge */}
            {item.is_must_visit && (
              <View style={styles.mustVisitBadge}>
                <Text style={styles.mustVisitBadgeText}>⭐</Text>
              </View>
            )}
          </View>

          {/* Info */}
          <View style={styles.placeInfo}>
            <Text style={styles.placeName} numberOfLines={1}>{item.name}</Text>
            
            <View style={styles.placeDetails}>
              <View style={[
                styles.categoryBadge,
                { backgroundColor: getCategoryColor(item.category) + '20' }
              ]}>
                <Text style={[styles.categoryText, { color: getCategoryColor(item.category) }]}>
                  {getCategoryLabel(item.category)}
                </Text>
              </View>
              
              {item.rating && (
                <Text style={styles.rating}>⭐ {Number(item.rating).toFixed(1)}</Text>
              )}
            </View>
            
            {item.area_name && (
              <Text style={styles.areaName} numberOfLines={1}>
                📍 {item.area_name}
              </Text>
            )}
            
            {/* Day Assignment */}
            {item.planned_day && (
              <View style={styles.dayBadge}>
                <Text style={styles.dayBadgeText}>Day {item.planned_day}</Text>
              </View>
            )}
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                HapticFeedback.medium();
                toggleFavorite(item.id);
              }}
            >
              <Text style={styles.actionIcon}>
                {item.is_favorite ? '❤️' : '🤍'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                HapticFeedback.medium();
                toggleMustVisit(item.id);
              }}
            >
              <Text style={styles.actionIcon}>
                {item.is_must_visit ? '⭐' : '☆'}
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </MotiView>
    );
  };

  if (isLoading && items.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading places...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search places..."
            placeholderTextColor="#94A3B8"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Text style={styles.clearIcon}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Category Filter */}
      {renderCategoryFilter()}

      {/* Stats */}
      <View style={styles.statsContainer}>
        <Text style={styles.statsText}>
          {filteredItems.length} {filteredItems.length === 1 ? 'place' : 'places'}
          {selectedCategory !== 'all' && ` in ${selectedCategory}`}
        </Text>
      </View>

      {/* Places List */}
      <FlatList
        data={filteredItems}
        renderItem={renderPlaceCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📍</Text>
            <Text style={styles.emptyTitle}>No places yet</Text>
            <Text style={styles.emptySubtitle}>
              Share links in chat to save places!
            </Text>
          </View>
        }
      />
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
    fontSize: 15,
    color: '#64748B',
  },

  // Search
  searchContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1E293B',
  },
  clearIcon: {
    fontSize: 16,
    color: '#94A3B8',
    padding: 4,
  },

  // Categories
  categoryContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  categoryList: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  categoryChipActive: {
    backgroundColor: theme.colors.primary,
  },
  categoryIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  categoryLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  categoryLabelActive: {
    color: '#FFFFFF',
  },

  // Stats
  statsContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  statsText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },

  // List
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },

  // Place Card
  placeCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  photoContainer: {
    position: 'relative',
  },
  photo: {
    width: 80,
    height: 80,
    borderRadius: 12,
  },
  photoPlaceholder: {
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoPlaceholderText: {
    fontSize: 32,
  },
  favoriteBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 2,
  },
  favoriteBadgeText: {
    fontSize: 12,
  },
  mustVisitBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 2,
  },
  mustVisitBadgeText: {
    fontSize: 12,
  },
  placeInfo: {
    flex: 1,
    marginLeft: 14,
    justifyContent: 'center',
  },
  placeName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 6,
  },
  placeDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '600',
  },
  rating: {
    fontSize: 12,
    color: '#64748B',
  },
  areaName: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  dayBadge: {
    backgroundColor: theme.colors.primary + '20',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  dayBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  actions: {
    justifyContent: 'center',
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionIcon: {
    fontSize: 16,
  },

  // Empty
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
  },
});

