import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Image,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { PanGestureHandler } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedGestureHandler,
  withSpring,
} from 'react-native-reanimated';
import { HapticFeedback } from '../utils/haptics';
import { GuideWithPlaces, GuidePlace, GuideDayGroup } from '../types';
import { useGuideStore, getSourceTypeIcon } from '../stores/guideStore';
import { getPlacePhotoUrl } from '../config/maps';
import theme from '../config/theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const DRAWER_COLLAPSED = 60;
const DRAWER_EXPANDED = SCREEN_HEIGHT * 0.75;

interface GuideDrawerProps {
  tripId: string;
  selectedUserDay: number | null;
  onAddToDay: (savedItemId: string, day: number) => void;
  isVisible: boolean;
  onToggle: () => void;
}

const CATEGORY_EMOJIS: Record<string, string> = {
  food: '🍽️',
  place: '📍',
  shopping: '🛍️',
  activity: '🎯',
  accommodation: '🏨',
  tip: '💡',
};

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

export const GuideDrawer: React.FC<GuideDrawerProps> = ({
  tripId,
  selectedUserDay,
  onAddToDay,
  isVisible,
  onToggle,
}) => {
  const { 
    guidesWithPlaces, 
    fetchGuidesWithPlaces, 
    isLoading,
    addPlaceToDay,
  } = useGuideStore();
  
  const [selectedGuideIndex, setSelectedGuideIndex] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);
  const [placeToAdd, setPlaceToAdd] = useState<GuidePlace | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedDays, setExpandedDays] = useState<Set<number | null>>(new Set([1]));
  
  const drawerHeight = useSharedValue(isVisible ? DRAWER_EXPANDED : DRAWER_COLLAPSED);

  useEffect(() => {
    drawerHeight.value = withSpring(isVisible ? DRAWER_EXPANDED : DRAWER_COLLAPSED, { damping: 20 });
  }, [isVisible]);

  useEffect(() => {
    console.log('[GuideDrawer] Fetching guides for trip:', tripId);
    fetchGuidesWithPlaces(tripId);
  }, [tripId]);

  const gestureHandler = useAnimatedGestureHandler({
    onStart: (_, ctx: any) => {
      ctx.startHeight = drawerHeight.value;
    },
    onActive: (event, ctx: any) => {
      const newHeight = ctx.startHeight - event.translationY;
      if (newHeight >= DRAWER_COLLAPSED && newHeight <= DRAWER_EXPANDED) {
        drawerHeight.value = newHeight;
      }
    },
    onEnd: (event) => {
      if (event.velocityY > 500 || drawerHeight.value < (DRAWER_COLLAPSED + DRAWER_EXPANDED) / 2) {
        drawerHeight.value = withSpring(DRAWER_COLLAPSED, { damping: 20 });
      } else {
        drawerHeight.value = withSpring(DRAWER_EXPANDED, { damping: 20 });
      }
    },
  });

  const animatedDrawerStyle = useAnimatedStyle(() => ({
    height: drawerHeight.value,
  }));

  const currentGuide = guidesWithPlaces[selectedGuideIndex];

  // Group places by day
  const getPlacesByDay = (guide: GuideWithPlaces): GuideDayGroup[] => {
    const dayMap = new Map<number | null, GuidePlace[]>();
    
    for (const place of guide.places) {
      const day = place.guide_day_number;
      if (!dayMap.has(day)) {
        dayMap.set(day, []);
      }
      dayMap.get(day)!.push(place);
    }
    
    const groups: GuideDayGroup[] = [];
    const sortedDays = Array.from(dayMap.keys()).sort((a, b) => {
      if (a === null) return 1;
      if (b === null) return -1;
      return a - b;
    });
    
    for (const day of sortedDays) {
      groups.push({
        day,
        places: dayMap.get(day)!,
      });
    }
    
    return groups;
  };

  // Filter places by search
  const filterPlaces = (places: GuidePlace[]): GuidePlace[] => {
    if (!searchQuery.trim()) return places;
    const query = searchQuery.toLowerCase();
    return places.filter(p => 
      p.name.toLowerCase().includes(query) ||
      p.category.toLowerCase().includes(query)
    );
  };

  const toggleDayExpanded = (day: number | null) => {
    HapticFeedback.light();
    const newExpanded = new Set(expandedDays);
    if (newExpanded.has(day)) {
      newExpanded.delete(day);
    } else {
      newExpanded.add(day);
    }
    setExpandedDays(newExpanded);
  };

  const handleAddPress = (place: GuidePlace) => {
    HapticFeedback.medium();
    setPlaceToAdd(place);
    setShowAddModal(true);
  };

  const handleConfirmAdd = async (day: number) => {
    if (!placeToAdd || !currentGuide) return;
    
    HapticFeedback.medium();
    setShowAddModal(false);
    
    const result = await addPlaceToDay(tripId, currentGuide.id, placeToAdd.saved_item_id, day);
    
    if (result) {
      onAddToDay(placeToAdd.saved_item_id, day);
    }
    
    setPlaceToAdd(null);
  };

  const getPlacePhoto = (place: GuidePlace): string | null => {
    // Try to get photo from the place's saved item data
    return getPlacePhotoUrl(place.photos_json, 200);
  };

  // Render place card (matching PlaceListDrawer style)
  const renderPlaceCard = (place: GuidePlace, index: number) => {
    const photoUrl = getPlacePhoto(place);
    const emoji = CATEGORY_EMOJIS[place.category] || '📍';
    const isAdded = place.planned_day !== null;

    return (
      <View key={place.saved_item_id} style={styles.placeCard}>
        <View style={styles.placeCardLeft}>
          {/* Photo or emoji icon */}
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={styles.placeIconPhoto} />
          ) : (
            <View style={[styles.placeIconContainer, { backgroundColor: getCategoryColor(place.category) + '20' }]}>
              <Text style={styles.placeIcon}>{emoji}</Text>
            </View>
          )}
          
          <View style={styles.placeInfo}>
            <Text style={[styles.placeName, isAdded && styles.placeNameAdded]} numberOfLines={1}>
              {place.name}
            </Text>
            <Text style={styles.placeCategory} numberOfLines={1}>
              {emoji} {place.category} {place.location_name ? `• ${place.location_name}` : ''}
            </Text>
            {place.rating && (
              <View style={styles.ratingRow}>
                <Text style={styles.ratingStar}>★</Text>
                <Text style={styles.ratingText}>{Number(place.rating).toFixed(1)}</Text>
              </View>
            )}
          </View>
        </View>
        
        {/* Add button or Added badge */}
        {isAdded ? (
          <View style={styles.addedBadge}>
            <Text style={styles.addedText}>✓ Day {place.planned_day}</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => handleAddPress(place)}
          >
            <Text style={styles.addButtonText}>+ Add</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // Collapsed bar
  if (!isVisible) {
    return (
      <TouchableOpacity 
        style={styles.collapsedBar} 
        onPress={onToggle}
        activeOpacity={0.8}
      >
        <Text style={styles.collapsedIcon}>📺</Text>
        <Text style={styles.collapsedText}>
          GUIDE SOURCES {guidesWithPlaces.length > 0 ? `(${guidesWithPlaces.length})` : ''}
        </Text>
        <Text style={styles.collapsedArrow}>▲</Text>
      </TouchableOpacity>
    );
  }

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
        <Text style={styles.headerTitle}>Guide Sources</Text>
        <TouchableOpacity style={styles.closeButton} onPress={onToggle}>
          <Text style={styles.closeButtonText}>▼</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading guides...</Text>
        </View>
      ) : guidesWithPlaces.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📺</Text>
          <Text style={styles.emptyTitle}>No guides yet</Text>
          <Text style={styles.emptyText}>
            Share YouTube travel videos in chat to import guides!
          </Text>
        </View>
      ) : (
        <>
          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search places in guides..."
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

          {/* Guide Tabs (like category chips) */}
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.guideTabsScroll}
            contentContainerStyle={styles.guideTabsContainer}
          >
            {guidesWithPlaces.map((guide, index) => (
              <TouchableOpacity
                key={guide.id}
                style={[
                  styles.guideChip,
                  selectedGuideIndex === index && styles.guideChipActive
                ]}
                onPress={() => {
                  HapticFeedback.light();
                  setSelectedGuideIndex(index);
                }}
              >
                <Text style={styles.guideChipIcon}>
                  {getSourceTypeIcon(guide.source_type)}
                </Text>
                <Text 
                  style={[
                    styles.guideChipText,
                    selectedGuideIndex === index && styles.guideChipTextActive
                  ]}
                  numberOfLines={1}
                >
                  {guide.creator_name || 'Guide'}
                </Text>
                <View style={[
                  styles.guideChipBadge,
                  selectedGuideIndex === index && styles.guideChipBadgeActive
                ]}>
                  <Text style={[
                    styles.guideChipCount,
                    selectedGuideIndex === index && styles.guideChipCountActive
                  ]}>
                    {guide.total_places}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Guide Content */}
          {currentGuide && (
            <ScrollView 
              style={styles.placesScroll}
              contentContainerStyle={styles.placesContainer}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled={true}
            >
              {/* Guide Info Card */}
              <View style={styles.guideInfoCard}>
                <Text style={styles.guideTitle} numberOfLines={2}>
                  {currentGuide.title}
                </Text>
                {currentGuide.has_day_structure && (
                  <Text style={styles.guideDays}>
                    {currentGuide.total_days} day itinerary
                  </Text>
                )}
              </View>

              {/* Day Sections (like area sections) */}
              {getPlacesByDay(currentGuide).map((dayGroup) => {
                const filteredPlaces = filterPlaces(dayGroup.places);
                if (filteredPlaces.length === 0) return null;
                
                const isExpanded = expandedDays.has(dayGroup.day);
                
                return (
                  <View key={dayGroup.day ?? 'all'} style={styles.daySection}>
                    {/* Day Header */}
                    <TouchableOpacity 
                      style={styles.dayHeader}
                      onPress={() => toggleDayExpanded(dayGroup.day)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.dayHeaderLeft}>
                        <Text style={styles.dayTitle}>
                          {dayGroup.day ? `Day ${dayGroup.day}` : 'All Places'}
                        </Text>
                        <Text style={styles.dayCount}>
                          {filteredPlaces.length} {filteredPlaces.length === 1 ? 'place' : 'places'}
                        </Text>
                      </View>
                      <Text style={styles.dayChevron}>
                        {isExpanded ? '▼' : '▶'}
                      </Text>
                    </TouchableOpacity>

                    {/* Places */}
                    {isExpanded && (
                      <View style={styles.dayPlaces}>
                        {filteredPlaces.map((place, idx) => renderPlaceCard(place, idx))}
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          )}
        </>
      )}

      {/* Add to Day Modal */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.addModal}>
            <Text style={styles.addModalTitle}>Add to Day Plan</Text>
            
            {placeToAdd && (
              <View style={styles.addModalPlace}>
                <Text style={styles.addModalPlaceEmoji}>
                  {CATEGORY_EMOJIS[placeToAdd.category] || '📍'}
                </Text>
                <Text style={styles.addModalPlaceName} numberOfLines={1}>
                  {placeToAdd.name}
                </Text>
              </View>
            )}

            <Text style={styles.addModalLabel}>Select day:</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.dayPicker}
              contentContainerStyle={styles.dayPickerContent}
            >
              {[1, 2, 3, 4, 5, 6, 7].map(day => (
                <TouchableOpacity
                  key={day}
                  style={[
                    styles.dayPickerItem,
                    selectedUserDay === day && styles.dayPickerItemSelected
                  ]}
                  onPress={() => handleConfirmAdd(day)}
                >
                  <Text style={[
                    styles.dayPickerText,
                    selectedUserDay === day && styles.dayPickerTextSelected
                  ]}>
                    Day {day}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity 
              style={styles.cancelButton}
              onPress={() => setShowAddModal(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  // Drawer container (matching PlaceListDrawer)
  drawer: {
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

  // Drag Handle
  dragHandleArea: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
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
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
  },

  // Collapsed bar
  collapsedBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 56,
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  collapsedIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  collapsedText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  collapsedArrow: {
    fontSize: 12,
    color: '#94A3B8',
    marginLeft: 10,
  },

  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 12,
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

  // Guide Tabs (like category chips)
  guideTabsScroll: {
    maxHeight: 50,
    marginBottom: 12,
  },
  guideTabsContainer: {
    paddingHorizontal: 20,
    gap: 8,
  },
  guideChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    marginRight: 8,
  },
  guideChipActive: {
    backgroundColor: theme.colors.primary,
  },
  guideChipIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  guideChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    maxWidth: 100,
  },
  guideChipTextActive: {
    color: '#FFFFFF',
  },
  guideChipBadge: {
    backgroundColor: '#E5E7EB',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
    paddingHorizontal: 6,
  },
  guideChipBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  guideChipCount: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
  },
  guideChipCountActive: {
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

  // Guide Info Card
  guideInfoCard: {
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  guideTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    lineHeight: 20,
  },
  guideDays: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
  },

  // Day Section (like area section)
  daySection: {
    marginBottom: 8,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  dayHeaderLeft: {
    flex: 1,
  },
  dayTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 2,
  },
  dayCount: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  dayChevron: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '300',
  },
  dayPlaces: {
    paddingTop: 8,
  },

  // Place Card (matching PlaceListDrawer)
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
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  placeIconPhoto: {
    width: 44,
    height: 44,
    borderRadius: 12,
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
    marginBottom: 2,
  },
  placeNameAdded: {
    color: '#9CA3AF',
  },
  placeCategory: {
    fontSize: 13,
    color: '#6B7280',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
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

  // Add Button
  addButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  addedBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#16A34A',
  },

  // Loading & Empty States
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
    opacity: 0.5,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingHorizontal: 40,
  },

  // Add Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  addModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 340,
  },
  addModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 20,
  },
  addModalPlace: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    padding: 14,
    borderRadius: 12,
    marginBottom: 20,
  },
  addModalPlaceEmoji: {
    fontSize: 24,
    marginRight: 12,
  },
  addModalPlaceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
  },
  addModalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 12,
  },
  dayPicker: {
    maxHeight: 50,
    marginBottom: 20,
  },
  dayPickerContent: {
    gap: 8,
  },
  dayPickerItem: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    marginRight: 8,
  },
  dayPickerItemSelected: {
    backgroundColor: theme.colors.primary,
  },
  dayPickerText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  dayPickerTextSelected: {
    color: '#FFFFFF',
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 14,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
});

export default GuideDrawer;
