import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Image,
  Modal,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { MotiView } from 'moti';
import { HapticFeedback } from '../utils/haptics';
import { GuideWithPlaces, GuidePlace, GuideDayGroup } from '../types';
import { useGuideStore, getSourceTypeIcon, getGuideCategoryEmoji } from '../stores/guideStore';
import theme from '../config/theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface GuideDrawerProps {
  tripId: string;
  selectedUserDay: number | null; // Currently selected day in user's plan
  onAddToDay: (savedItemId: string, day: number) => void;
  isVisible: boolean;
  onToggle: () => void;
}

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
  const [expandedDays, setExpandedDays] = useState<Set<number | null>>(new Set([1])); // Day 1 expanded by default

  useEffect(() => {
    if (isVisible) {
      fetchGuidesWithPlaces(tripId);
    }
  }, [tripId, isVisible]);

  const currentGuide = guidesWithPlaces[selectedGuideIndex];

  // Group places by day for current guide
  const getPlacesByDay = (guide: GuideWithPlaces): GuideDayGroup[] => {
    const dayMap = new Map<number | null, GuidePlace[]>();
    
    for (const place of guide.places) {
      const day = place.guide_day_number;
      if (!dayMap.has(day)) {
        dayMap.set(day, []);
      }
      dayMap.get(day)!.push(place);
    }
    
    // Convert to array and sort
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
    
    // Call the store to update
    const result = await addPlaceToDay(tripId, currentGuide.id, placeToAdd.saved_item_id, day);
    
    if (result) {
      // Also notify parent
      onAddToDay(placeToAdd.saved_item_id, day);
    }
    
    setPlaceToAdd(null);
  };

  if (!isVisible) {
    // Collapsed state - just show a toggle bar
    return (
      <TouchableOpacity 
        style={styles.collapsedBar} 
        onPress={onToggle}
        activeOpacity={0.8}
      >
        <Text style={styles.collapsedIcon}>📺</Text>
        <Text style={styles.collapsedText}>
          GUIDES {guidesWithPlaces.length > 0 ? `(${guidesWithPlaces.length})` : ''}
        </Text>
        <Text style={styles.collapsedArrow}>▲</Text>
      </TouchableOpacity>
    );
  }

  return (
    <MotiView
      from={{ translateY: 300 }}
      animate={{ translateY: 0 }}
      transition={{ type: 'spring', damping: 20 }}
      style={styles.container}
    >
      {/* Header */}
      <TouchableOpacity 
        style={styles.header} 
        onPress={onToggle}
        activeOpacity={0.8}
      >
        <Text style={styles.headerIcon}>📺</Text>
        <Text style={styles.headerTitle}>GUIDES</Text>
        <Text style={styles.headerArrow}>▼</Text>
      </TouchableOpacity>

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
            Share YouTube travel videos in chat to add guides!
          </Text>
        </View>
      ) : (
        <>
          {/* Guide Tabs */}
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.tabsContainer}
            contentContainerStyle={styles.tabsContent}
          >
            {guidesWithPlaces.map((guide, index) => (
              <TouchableOpacity
                key={guide.id}
                style={[
                  styles.guideTab,
                  selectedGuideIndex === index && styles.guideTabActive
                ]}
                onPress={() => {
                  HapticFeedback.light();
                  setSelectedGuideIndex(index);
                }}
              >
                <Text style={styles.guideTabIcon}>
                  {getSourceTypeIcon(guide.source_type)}
                </Text>
                <Text 
                  style={[
                    styles.guideTabName,
                    selectedGuideIndex === index && styles.guideTabNameActive
                  ]}
                  numberOfLines={1}
                >
                  {guide.creator_name}
                </Text>
                <View style={[
                  styles.guideTabBadge,
                  selectedGuideIndex === index && styles.guideTabBadgeActive
                ]}>
                  <Text style={[
                    styles.guideTabCount,
                    selectedGuideIndex === index && styles.guideTabCountActive
                  ]}>
                    {guide.total_places}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Selected Guide Content */}
          {currentGuide && (
            <View style={styles.guideContent}>
              {/* Guide Info */}
              <View style={styles.guideInfo}>
                <Text style={styles.guideTitle} numberOfLines={2}>
                  {currentGuide.title}
                </Text>
                {currentGuide.has_day_structure && (
                  <Text style={styles.guideDays}>
                    {currentGuide.total_days} day itinerary
                  </Text>
                )}
              </View>

              {/* Places by Day */}
              <ScrollView 
                style={styles.placesScroll}
                showsVerticalScrollIndicator={false}
              >
                {getPlacesByDay(currentGuide).map((dayGroup) => (
                  <View key={dayGroup.day ?? 'all'} style={styles.daySection}>
                    {/* Day Header */}
                    <TouchableOpacity
                      style={styles.dayHeader}
                      onPress={() => toggleDayExpanded(dayGroup.day)}
                    >
                      <Text style={styles.dayHeaderText}>
                        {dayGroup.day 
                          ? `Day ${dayGroup.day}` 
                          : 'All Places'}
                      </Text>
                      <Text style={styles.dayHeaderCount}>
                        {dayGroup.places.length} places
                      </Text>
                      <Text style={styles.dayHeaderArrow}>
                        {expandedDays.has(dayGroup.day) ? '▼' : '▶'}
                      </Text>
                    </TouchableOpacity>

                    {/* Places List */}
                    {expandedDays.has(dayGroup.day) && (
                      <View style={styles.placesList}>
                        {dayGroup.places.map((place) => {
                          const isAdded = place.planned_day !== null;
                          
                          return (
                            <View key={place.saved_item_id} style={styles.placeItem}>
                              <View style={[
                                styles.placeIndicator,
                                { backgroundColor: getCategoryColor(place.category) }
                              ]} />
                              
                              <View style={styles.placeInfo}>
                                <Text 
                                  style={[
                                    styles.placeName,
                                    isAdded && styles.placeNameAdded
                                  ]} 
                                  numberOfLines={1}
                                >
                                  {place.name}
                                </Text>
                                <Text style={styles.placeCategory}>
                                  {getGuideCategoryEmoji(place.category)} {place.category}
                                  {place.area_name ? ` • ${place.area_name}` : ''}
                                </Text>
                              </View>

                              {isAdded ? (
                                <View style={styles.addedBadge}>
                                  <Text style={styles.addedText}>
                                    ✓ Day {place.planned_day}
                                  </Text>
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
                        })}
                      </View>
                    )}
                  </View>
                ))}
              </ScrollView>
            </View>
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
            <Text style={styles.addModalTitle}>Add to your plan?</Text>
            
            {placeToAdd && (
              <View style={styles.addModalPlace}>
                <Text style={styles.addModalPlaceEmoji}>
                  {getGuideCategoryEmoji(placeToAdd.category)}
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
              {[1, 2, 3, 4, 5, 6, 7].map((day) => (
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
              onPress={() => {
                setShowAddModal(false);
                setPlaceToAdd(null);
              }}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </MotiView>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: SCREEN_HEIGHT * 0.45,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  
  // Collapsed bar
  collapsedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  collapsedIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  collapsedText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  collapsedArrow: {
    fontSize: 12,
    color: '#94A3B8',
    marginLeft: 8,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  headerIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  headerArrow: {
    fontSize: 12,
    color: '#94A3B8',
    marginLeft: 8,
  },

  // Loading
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
    color: '#64748B',
  },

  // Empty
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
  },

  // Guide tabs
  tabsContainer: {
    maxHeight: 56,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tabsContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  guideTab: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  guideTabActive: {
    backgroundColor: theme.colors.primary,
  },
  guideTabIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  guideTabName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    maxWidth: 100,
  },
  guideTabNameActive: {
    color: '#FFFFFF',
  },
  guideTabBadge: {
    backgroundColor: '#CBD5E1',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
    paddingHorizontal: 6,
  },
  guideTabBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  guideTabCount: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  guideTabCountActive: {
    color: '#FFFFFF',
  },

  // Guide content
  guideContent: {
    flex: 1,
  },
  guideInfo: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  guideTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  guideDays: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },

  // Places scroll
  placesScroll: {
    flex: 1,
  },

  // Day section
  daySection: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#F8FAFC',
  },
  dayHeaderText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    flex: 1,
  },
  dayHeaderCount: {
    fontSize: 12,
    color: '#64748B',
    marginRight: 8,
  },
  dayHeaderArrow: {
    fontSize: 10,
    color: '#94A3B8',
  },

  // Places list
  placesList: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  placeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  placeIndicator: {
    width: 4,
    height: 32,
    borderRadius: 2,
    marginRight: 12,
  },
  placeInfo: {
    flex: 1,
  },
  placeName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1E293B',
  },
  placeNameAdded: {
    color: '#94A3B8',
  },
  placeCategory: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  addButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  addButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  addedBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  addedText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#16A34A',
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
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 340,
  },
  addModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: 16,
  },
  addModalPlace: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  addModalPlaceEmoji: {
    fontSize: 20,
    marginRight: 10,
  },
  addModalPlaceName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
    flex: 1,
  },
  addModalLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 10,
  },
  dayPicker: {
    maxHeight: 50,
    marginBottom: 16,
  },
  dayPickerContent: {
    gap: 8,
  },
  dayPickerItem: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    marginRight: 8,
  },
  dayPickerItemSelected: {
    backgroundColor: theme.colors.primary,
  },
  dayPickerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  dayPickerTextSelected: {
    color: '#FFFFFF',
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748B',
  },
});

export default GuideDrawer;

