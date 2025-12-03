import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Alert,
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  FlatList,
} from 'react-native';
import { MotiView } from 'moti';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import DraggableFlatList, {
  ScaleDecorator,
  RenderItemParams,
} from 'react-native-draggable-flatlist';
import { HapticFeedback } from '../utils/haptics';
import { SavedItem, DayGroup, Trip } from '../types';
import { useItemStore } from '../stores/itemStore';
import { GuideDrawer } from './GuideDrawer';
import theme from '../config/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface DayPlannerViewProps {
  trip: Trip;
  tripId: string;
  onPlaceSelect: (item: SavedItem) => void;
  onClose: () => void;
}

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

// Calculate walking time and distance between two coordinates
const getWalkingInfo = (
  lat1?: number, lng1?: number,
  lat2?: number, lng2?: number
): { time: string; distance: string } | null => {
  if (!lat1 || !lng1 || !lat2 || !lng2) return null;
  
  // Haversine formula for distance
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;
  
  // Walking speed ~5 km/h
  const timeMinutes = Math.round((distance / 5) * 60);
  
  if (distance < 1) {
    return { 
      time: `${timeMinutes} min`, 
      distance: `${Math.round(distance * 1000)} m` 
    };
  }
  return { 
    time: `${timeMinutes} min`, 
    distance: `${distance.toFixed(1)} km` 
  };
};

// Get first photo URL from place
const getPhotoUrl = (place: SavedItem): string | null => {
  if (!place.photos_json) return null;
  try {
    const photos = Array.isArray(place.photos_json) 
      ? place.photos_json 
      : JSON.parse(place.photos_json);
    if (photos.length > 0 && photos[0].photo_reference) {
      return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=200&photoreference=${photos[0].photo_reference}&key=AIzaSyAiWhzrvdNb2NKSyzWpvNrhImz72I395Qo`;
    }
  } catch {}
  return null;
};

// Generate trip days from start_date to end_date
const generateTripDays = (trip: Trip): { dayNumber: number; date: Date }[] => {
  const days: { dayNumber: number; date: Date }[] = [];
  
  if (trip.start_date && trip.end_date) {
    const startDate = new Date(trip.start_date);
    const endDate = new Date(trip.end_date);
    let currentDate = new Date(startDate);
    let dayNumber = 1;
    
    while (currentDate <= endDate) {
      days.push({ dayNumber, date: new Date(currentDate) });
      currentDate.setDate(currentDate.getDate() + 1);
      dayNumber++;
    }
  } else {
    // Default 7 days if no dates set
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      days.push({ dayNumber: i + 1, date });
    }
  }
  
  return days;
};

const formatDate = (date: Date): string => {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export const DayPlannerView: React.FC<DayPlannerViewProps> = ({
  trip,
  tripId,
  onPlaceSelect,
  onClose,
}) => {
  const { dayGroups, fetchItemsByDay, reorderItemsInDay, assignItemToDay, isLoading } = useItemStore();
  const [selectedDay, setSelectedDay] = useState<number | null>(1);
  const [localDayGroups, setLocalDayGroups] = useState<DayGroup[]>([]);
  const [showAddPlaceModal, setShowAddPlaceModal] = useState(false);
  const [isGuideDrawerVisible, setIsGuideDrawerVisible] = useState(false);

  const tripDays = generateTripDays(trip);

  useEffect(() => {
    fetchItemsByDay(tripId);
  }, [tripId]);

  useEffect(() => {
    setLocalDayGroups(dayGroups);
  }, [dayGroups]);

  const getItemsForDay = (day: number | null): SavedItem[] => {
    const group = localDayGroups.find((g) => g.day === day);
    return group?.items || [];
  };

  const currentDayItems = getItemsForDay(selectedDay);
  const unassignedItems = getItemsForDay(null);

  const handleDragEnd = async (items: SavedItem[]) => {
    HapticFeedback.medium();
    
    setLocalDayGroups((prev) =>
      prev.map((group) =>
        group.day === selectedDay ? { ...group, items } : group
      )
    );

    try {
      const itemIds = items.map((item) => item.id);
      await reorderItemsInDay(tripId, selectedDay, itemIds);
    } catch (error) {
      console.error('Failed to reorder items:', error);
      setLocalDayGroups(dayGroups);
    }
  };

  const openDirections = (place: SavedItem) => {
    if (place.location_lat && place.location_lng) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${place.location_lat},${place.location_lng}&travelmode=walking`;
      Linking.openURL(url);
    }
  };

  const handleAddPlaceToDay = async (place: SavedItem) => {
    if (selectedDay === null) return; // Can't add to unassigned
    
    HapticFeedback.medium();
    setShowAddPlaceModal(false);
    
    try {
      await assignItemToDay(place.id, selectedDay);
      await fetchItemsByDay(tripId);
    } catch (error) {
      console.error('Failed to add place:', error);
      Alert.alert('Error', 'Failed to add place to day');
    }
  };

  // Handle place added from guide drawer
  const handleGuideAddToDay = async (savedItemId: string, day: number) => {
    // Refresh the day groups to show the newly added place
    await fetchItemsByDay(tripId);
  };

  const renderPlaceCard = ({ item, drag, isActive, getIndex }: RenderItemParams<SavedItem>) => {
    const index = getIndex() ?? 0;
    const nextItem = currentDayItems[index + 1];
    const walkingInfo = nextItem ? getWalkingInfo(
      item.location_lat, item.location_lng,
      nextItem.location_lat, nextItem.location_lng
    ) : null;
    const photoUrl = getPhotoUrl(item);

    return (
      <ScaleDecorator>
        <View style={styles.placeCardWrapper}>
          <TouchableOpacity
            activeOpacity={0.9}
            onLongPress={() => {
              HapticFeedback.heavy();
              drag();
            }}
            onPress={() => onPlaceSelect(item)}
            disabled={isActive}
            style={[styles.placeCard, isActive && styles.placeCardActive]}
          >
            {/* Number Badge */}
            <View style={styles.numberBadge}>
              <Text style={styles.numberText}>{index + 1}</Text>
            </View>

            {/* Photo */}
            <View style={styles.photoContainer}>
              {photoUrl ? (
                <Image source={{ uri: photoUrl }} style={styles.photo} />
              ) : (
                <View style={[styles.photo, styles.photoPlaceholder]}>
                  <Text style={styles.photoPlaceholderText}>📍</Text>
                </View>
              )}
            </View>

            {/* Info */}
            <View style={styles.placeInfo}>
              <Text style={styles.placeName} numberOfLines={1}>{item.name}</Text>
              <View style={styles.categoryRow}>
                <View style={[styles.categoryBadge, { backgroundColor: getCategoryColor(item.category) + '20' }]}>
                  <Text style={[styles.categoryText, { color: getCategoryColor(item.category) }]}>
                    {getCategoryLabel(item.category)}
                  </Text>
                </View>
                {item.rating && (
                  <Text style={styles.ratingText}>⭐ {Number(item.rating).toFixed(1)}</Text>
                )}
              </View>
              {item.area_name && (
                <Text style={styles.placeArea}>📍 {item.area_name}</Text>
              )}
            </View>

            {/* Directions Button */}
            <TouchableOpacity
              style={styles.directionsButton}
              onPress={() => openDirections(item)}
            >
              <Text style={styles.directionsText}>Directions</Text>
            </TouchableOpacity>
          </TouchableOpacity>

          {/* Walking Distance Connector */}
          {walkingInfo && (
            <View style={styles.walkingConnector}>
              <View style={styles.walkingLine} />
              <View style={styles.walkingInfo}>
                <Text style={styles.walkingIcon}>🚶</Text>
                <Text style={styles.walkingText}>{walkingInfo.time} • {walkingInfo.distance}</Text>
              </View>
              <View style={styles.walkingLine} />
            </View>
          )}
        </View>
      </ScaleDecorator>
    );
  };

  if (isLoading && localDayGroups.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading itinerary...</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      {/* Day Tabs */}
      <View style={styles.dayTabsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dayTabsScroll}
        >
          {tripDays.map(({ dayNumber, date }) => {
            const dayItems = getItemsForDay(dayNumber);
            const isSelected = selectedDay === dayNumber;
            
            return (
              <TouchableOpacity
                key={dayNumber}
                style={[styles.dayTab, isSelected && styles.dayTabActive]}
                onPress={() => {
                  HapticFeedback.light();
                  setSelectedDay(dayNumber);
                }}
              >
                <Text style={[styles.dayTabTitle, isSelected && styles.dayTabTitleActive]}>
                  Day {dayNumber}
                </Text>
                <Text style={[styles.dayTabDate, isSelected && styles.dayTabDateActive]}>
                  {formatDate(date)}
                </Text>
                {dayItems.length > 0 && (
                  <View style={[styles.dayTabCount, isSelected && styles.dayTabCountActive]}>
                    <Text style={[styles.dayTabCountText, isSelected && styles.dayTabCountTextActive]}>
                      {dayItems.length}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
          
          {/* Unassigned Tab */}
          <TouchableOpacity
            style={[styles.dayTab, styles.unassignedTab, selectedDay === null && styles.dayTabActive]}
            onPress={() => {
              HapticFeedback.light();
              setSelectedDay(null);
            }}
          >
            <Text style={[styles.dayTabTitle, selectedDay === null && styles.dayTabTitleActive]}>
              📦
            </Text>
            <Text style={[styles.dayTabDate, selectedDay === null && styles.dayTabDateActive]}>
              Unassigned
            </Text>
            {unassignedItems.length > 0 && (
              <View style={[styles.dayTabCount, selectedDay === null && styles.dayTabCountActive]}>
                <Text style={[styles.dayTabCountText, selectedDay === null && styles.dayTabCountTextActive]}>
                  {unassignedItems.length}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Selected Day Header */}
      <View style={styles.dayHeader}>
        <Text style={styles.dayHeaderTitle}>
          {selectedDay ? `Day ${selectedDay}` : 'Unassigned Places'}
        </Text>
        <Text style={styles.dayHeaderSubtitle}>
          {currentDayItems.length} {currentDayItems.length === 1 ? 'place' : 'places'}
          {selectedDay && tripDays[selectedDay - 1] && ` • ${formatDate(tripDays[selectedDay - 1].date)}`}
        </Text>
      </View>

      {/* Places List */}
      {currentDayItems.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📍</Text>
          <Text style={styles.emptyTitle}>No places yet</Text>
          <Text style={styles.emptySubtitle}>
            {selectedDay 
              ? 'Tap the button below to add places'
              : 'All places have been assigned to days!'}
          </Text>
          {selectedDay !== null && unassignedItems.length > 0 && (
            <TouchableOpacity 
              style={styles.emptyAddButton}
              onPress={() => setShowAddPlaceModal(true)}
            >
              <Text style={styles.emptyAddButtonText}>+ Add Place</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <DraggableFlatList
          data={currentDayItems}
          keyExtractor={(item) => item.id}
          renderItem={renderPlaceCard}
          onDragEnd={({ data }) => handleDragEnd(data)}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={
            selectedDay !== null && unassignedItems.length > 0 ? (
              <TouchableOpacity 
                style={styles.addPlaceButton}
                onPress={() => setShowAddPlaceModal(true)}
              >
                <Text style={styles.addPlaceIcon}>+</Text>
                <Text style={styles.addPlaceText}>Add Place ({unassignedItems.length} available)</Text>
              </TouchableOpacity>
            ) : null
          }
        />
      )}

      {/* Add Place Modal */}
      <Modal
        visible={showAddPlaceModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddPlaceModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.addPlaceModal}>
            <View style={styles.addPlaceModalHeader}>
              <Text style={styles.addPlaceModalTitle}>Add Place to Day {selectedDay}</Text>
              <TouchableOpacity onPress={() => setShowAddPlaceModal(false)}>
                <Text style={styles.addPlaceModalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <Text style={styles.addPlaceModalSubtitle}>
              {unassignedItems.length} unassigned {unassignedItems.length === 1 ? 'place' : 'places'}
            </Text>
            
            <FlatList
              data={unassignedItems}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const photoUrl = getPhotoUrl(item);
                return (
                  <TouchableOpacity
                    style={styles.addPlaceItem}
                    onPress={() => handleAddPlaceToDay(item)}
                  >
                    {photoUrl ? (
                      <Image source={{ uri: photoUrl }} style={styles.addPlaceItemPhoto} />
                    ) : (
                      <View style={[styles.addPlaceItemPhoto, styles.addPlaceItemPhotoPlaceholder]}>
                        <Text>📍</Text>
                      </View>
                    )}
                    <View style={styles.addPlaceItemInfo}>
                      <Text style={styles.addPlaceItemName} numberOfLines={1}>{item.name}</Text>
                      <Text style={styles.addPlaceItemCategory}>
                        {getCategoryLabel(item.category)}
                        {item.area_name ? ` in ${item.area_name}` : ''}
                      </Text>
                    </View>
                    <View style={styles.addPlaceItemAction}>
                      <Text style={styles.addPlaceItemActionText}>+ Add</Text>
                    </View>
                  </TouchableOpacity>
                );
              }}
              contentContainerStyle={styles.addPlaceList}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.addPlaceEmpty}>
                  <Text style={styles.addPlaceEmptyText}>All places assigned! 🎉</Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>

      {/* Guide Drawer - Shows imported YouTube/Instagram guides */}
      <GuideDrawer
        tripId={tripId}
        selectedUserDay={selectedDay}
        onAddToDay={handleGuideAddToDay}
        isVisible={isGuideDrawerVisible}
        onToggle={() => {
          HapticFeedback.light();
          setIsGuideDrawerVisible(!isGuideDrawerVisible);
        }}
      />
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#64748B',
  },

  // Day Tabs
  dayTabsContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingTop: 16, // Increased to prevent overlap with header border
  },
  dayTabsScroll: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  dayTab: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 80,
    position: 'relative',
  },
  dayTabActive: {
    backgroundColor: theme.colors.primary,
  },
  unassignedTab: {
    backgroundColor: '#FEF3C7',
  },
  dayTabTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#475569',
  },
  dayTabTitleActive: {
    color: '#FFFFFF',
  },
  dayTabDate: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  dayTabDateActive: {
    color: 'rgba(255,255,255,0.8)',
  },
  dayTabCount: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  dayTabCountActive: {
    backgroundColor: '#FFFFFF',
  },
  dayTabCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  dayTabCountTextActive: {
    color: theme.colors.primary,
  },

  // Day Header
  dayHeader: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  dayHeaderTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1E293B',
  },
  dayHeaderSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
  },

  // Place Card
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  placeCardWrapper: {
    marginBottom: 4,
  },
  placeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  placeCardActive: {
    backgroundColor: '#EFF6FF',
    transform: [{ scale: 1.02 }],
  },
  numberBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  numberText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  photoContainer: {
    marginRight: 12,
  },
  photo: {
    width: 56,
    height: 56,
    borderRadius: 10,
  },
  photoPlaceholder: {
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoPlaceholderText: {
    fontSize: 24,
  },
  placeInfo: {
    flex: 1,
  },
  placeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  ratingText: {
    fontSize: 12,
    color: '#64748B',
  },
  placeArea: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
  },
  directionsButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  directionsText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Walking Connector
  walkingConnector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingLeft: 40,
  },
  walkingLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#CBD5E1',
  },
  walkingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginHorizontal: 8,
  },
  walkingIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  walkingText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },

  // Empty State
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
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
    lineHeight: 20,
  },

  // Add Place Button (in list)
  addPlaceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    marginBottom: 80,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    borderStyle: 'dashed',
  },
  addPlaceIcon: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.primary,
    marginRight: 8,
  },
  addPlaceText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.primary,
  },

  // Empty State Add Button
  emptyAddButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 16,
  },
  emptyAddButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Add Place Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  addPlaceModal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
    paddingBottom: 30,
  },
  addPlaceModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  addPlaceModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  addPlaceModalClose: {
    fontSize: 24,
    color: '#94A3B8',
    padding: 4,
  },
  addPlaceModalSubtitle: {
    fontSize: 13,
    color: '#64748B',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  addPlaceList: {
    paddingHorizontal: 16,
  },
  addPlaceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  addPlaceItemPhoto: {
    width: 48,
    height: 48,
    borderRadius: 8,
    marginRight: 12,
  },
  addPlaceItemPhotoPlaceholder: {
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addPlaceItemInfo: {
    flex: 1,
  },
  addPlaceItemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  addPlaceItemCategory: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  addPlaceItemAction: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addPlaceItemActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  addPlaceEmpty: {
    padding: 40,
    alignItems: 'center',
  },
  addPlaceEmptyText: {
    fontSize: 15,
    color: '#64748B',
  },
});

export default DayPlannerView;
