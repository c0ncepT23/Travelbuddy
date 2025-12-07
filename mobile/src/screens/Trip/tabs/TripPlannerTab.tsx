import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  TextInput,
  Modal,
  Image,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { useTripStore } from '../../../stores/tripStore';
import { useItemStore } from '../../../stores/itemStore';
import { useGuideStore } from '../../../stores/guideStore';
import { SavedItem, GuideWithPlaces } from '../../../types';
import { HapticFeedback } from '../../../utils/haptics';
import { getPlacePhotoUrl } from '../../../config/maps';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const BOTTOM_TAB_HEIGHT = 80;

interface TripPlannerTabProps {
  tripId: string;
  navigation: any;
}

export default function TripPlannerTab({ tripId, navigation }: TripPlannerTabProps) {
  const { currentTrip } = useTripStore();
  const { items, fetchTripItems, assignItemToDay } = useItemStore();
  const { guides, fetchGuides, fetchGuideById, selectedGuide: guideDetails, selectGuide } = useGuideStore();
  
  const [activeDayIndex, setActiveDayIndex] = useState<number | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedDayForAdd, setSelectedDayForAdd] = useState<number>(1);
  const [addModalTab, setAddModalTab] = useState<'saved' | 'guides'>('saved');
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingGuide, setLoadingGuide] = useState(false);

  useEffect(() => {
    fetchTripItems(tripId, {});
    fetchGuides(tripId);
  }, [tripId]);

  // Calculate trip days
  const tripDays = useMemo(() => {
    if (!currentTrip?.start_date || !currentTrip?.end_date) {
      return [1, 2, 3, 4, 5]; // Default days
    }
    const start = new Date(currentTrip.start_date);
    const end = new Date(currentTrip.end_date);
    const dayCount = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return Array.from({ length: Math.max(dayCount, 1) }, (_, i) => i + 1);
  }, [currentTrip]);

  // Group items by day
  const itemsByDay = useMemo(() => {
    const grouped: Record<number, SavedItem[]> = {};
    tripDays.forEach(day => {
      grouped[day] = [];
    });
    
    items?.forEach(item => {
      if (item.planned_day && grouped[item.planned_day]) {
        grouped[item.planned_day].push(item);
      }
    });
    
    return grouped;
  }, [items, tripDays]);

  // Unassigned places (for Add Modal)
  const unassignedItems = useMemo(() => {
    return items?.filter(item => !item.planned_day) || [];
  }, [items]);

  // Filter for search
  const filteredUnassigned = useMemo(() => {
    if (!searchQuery.trim()) return unassignedItems;
    const query = searchQuery.toLowerCase();
    return unassignedItems.filter(item =>
      item.name.toLowerCase().includes(query) ||
      item.area_name?.toLowerCase().includes(query)
    );
  }, [unassignedItems, searchQuery]);

  // Handle add place to day
  const handleAddPlace = async (item: SavedItem, dayNumber: number) => {
    HapticFeedback.success();
    try {
      await assignItemToDay(item.id, dayNumber);
      setShowAddModal(false);
      setSearchQuery('');
    } catch (error) {
      console.error('Failed to assign place:', error);
    }
  };

  // Handle remove from day
  const handleRemoveFromDay = async (item: SavedItem) => {
    HapticFeedback.light();
    try {
      await assignItemToDay(item.id, null);
    } catch (error) {
      console.error('Failed to unassign place:', error);
    }
  };

  // Open add modal for specific day
  const openAddModal = (dayNumber: number) => {
    HapticFeedback.light();
    setSelectedDayForAdd(dayNumber);
    setShowAddModal(true);
    setAddModalTab('saved');
    setSearchQuery('');
  };

  // Load guide details
  const handleSelectGuide = async (guide: any) => {
    setLoadingGuide(true);
    try {
      await fetchGuideById(tripId, guide.id);
      // guideDetails will be updated via store
    } catch (error) {
      console.error('Failed to load guide:', error);
    }
    setLoadingGuide(false);
  };

  // Render place card in day
  const renderDayPlace = (item: SavedItem, index: number) => {
    const photoUrl = getPlacePhotoUrl(item);
    
    return (
      <MotiView
        key={item.id}
        from={{ opacity: 0, translateX: -10 }}
        animate={{ opacity: 1, translateX: 0 }}
        transition={{ type: 'timing', duration: 200, delay: index * 50 }}
        style={styles.dayPlaceCard}
      >
        <View style={styles.placeOrderBadge}>
          <Text style={styles.placeOrderText}>{index + 1}</Text>
        </View>
        
        <View style={styles.dayPlaceImage}>
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={styles.placeImage} />
          ) : (
            <View style={styles.placeImagePlaceholder}>
              <Text style={styles.placeImageEmoji}>
                {item.category === 'food' ? '🍽️' : '📍'}
              </Text>
            </View>
          )}
        </View>
        
        <View style={styles.dayPlaceInfo}>
          <Text style={styles.dayPlaceName} numberOfLines={1}>{item.name}</Text>
          {item.area_name && (
            <Text style={styles.dayPlaceArea} numberOfLines={1}>{item.area_name}</Text>
          )}
        </View>
        
        <TouchableOpacity 
          style={styles.removePlaceButton}
          onPress={() => handleRemoveFromDay(item)}
        >
          <Ionicons name="close" size={16} color="#94A3B8" />
        </TouchableOpacity>
      </MotiView>
    );
  };

  // Render day card
  const renderDayCard = (dayNumber: number) => {
    const dayItems = itemsByDay[dayNumber] || [];
    const isExpanded = activeDayIndex === dayNumber;
    
    return (
      <MotiView
        key={dayNumber}
        style={styles.dayCard}
      >
        <TouchableOpacity
          style={styles.dayCardHeader}
          onPress={() => setActiveDayIndex(isExpanded ? null : dayNumber)}
          activeOpacity={0.7}
        >
          <View style={styles.dayCardTitle}>
            <View style={styles.dayBadge}>
              <Text style={styles.dayBadgeText}>Day {dayNumber}</Text>
            </View>
            <Text style={styles.dayPlaceCount}>
              {dayItems.length} {dayItems.length === 1 ? 'place' : 'places'}
            </Text>
          </View>
          <Ionicons 
            name={isExpanded ? 'chevron-up' : 'chevron-down'} 
            size={20} 
            color="#64748B" 
          />
        </TouchableOpacity>
        
        {isExpanded && (
          <View style={styles.dayCardContent}>
            {dayItems.length > 0 ? (
              dayItems.map((item, index) => renderDayPlace(item, index))
            ) : (
              <View style={styles.emptyDayContent}>
                <Ionicons name="calendar-outline" size={32} color="#CBD5E1" />
                <Text style={styles.emptyDayText}>No places planned</Text>
              </View>
            )}
            
            {/* Add Place Button */}
            <TouchableOpacity
              style={styles.addPlaceButton}
              onPress={() => openAddModal(dayNumber)}
            >
              <Ionicons name="add" size={20} color="#3B82F6" />
              <Text style={styles.addPlaceButtonText}>Add Place</Text>
            </TouchableOpacity>
          </View>
        )}
      </MotiView>
    );
  };

  // Add Place Modal
  const renderAddModal = () => (
    <Modal
      visible={showAddModal}
      animationType="slide"
      transparent
      onRequestClose={() => setShowAddModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add to Day {selectedDayForAdd}</Text>
            <TouchableOpacity onPress={() => setShowAddModal(false)}>
              <Ionicons name="close" size={24} color="#64748B" />
            </TouchableOpacity>
          </View>
          
          {/* Modal Tabs */}
          <View style={styles.modalTabs}>
            <TouchableOpacity
              style={[styles.modalTab, addModalTab === 'saved' && styles.modalTabActive]}
              onPress={() => { setAddModalTab('saved'); selectGuide(null); }}
            >
              <Text style={[
                styles.modalTabText,
                addModalTab === 'saved' && styles.modalTabTextActive,
              ]}>
                Saved Places
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalTab, addModalTab === 'guides' && styles.modalTabActive]}
              onPress={() => setAddModalTab('guides')}
            >
              <Text style={[
                styles.modalTabText,
                addModalTab === 'guides' && styles.modalTabTextActive,
              ]}>
                Guide Sources
              </Text>
            </TouchableOpacity>
          </View>
          
          {/* Search */}
          {addModalTab === 'saved' && (
            <View style={styles.modalSearch}>
              <Ionicons name="search" size={18} color="#94A3B8" />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Search saved places..."
                placeholderTextColor="#94A3B8"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
          )}
          
          {/* Content */}
          <ScrollView style={styles.modalList}>
            {addModalTab === 'saved' ? (
              filteredUnassigned.length > 0 ? (
                filteredUnassigned.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.modalPlaceItem}
                    onPress={() => handleAddPlace(item, selectedDayForAdd)}
                  >
                    <View style={styles.modalPlaceImage}>
                      {getPlacePhotoUrl(item) ? (
                        <Image 
                          source={{ uri: getPlacePhotoUrl(item)! }} 
                          style={styles.placeImage} 
                        />
                      ) : (
                        <View style={styles.placeImagePlaceholder}>
                          <Text style={styles.placeImageEmoji}>📍</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.modalPlaceInfo}>
                      <Text style={styles.modalPlaceName}>{item.name}</Text>
                      {item.area_name && (
                        <Text style={styles.modalPlaceArea}>{item.area_name}</Text>
                      )}
                    </View>
                    <Ionicons name="add-circle" size={24} color="#3B82F6" />
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.modalEmpty}>
                  <Text style={styles.modalEmptyText}>
                    {searchQuery ? 'No matching places' : 'All places are assigned!'}
                  </Text>
                </View>
              )
            ) : (
              // Guide Sources Tab
              guideDetails ? (
                <View>
                  {/* Back button */}
                  <TouchableOpacity 
                    style={styles.guideBackButton}
                    onPress={() => selectGuide(null)}
                  >
                    <Ionicons name="chevron-back" size={20} color="#3B82F6" />
                    <Text style={styles.guideBackText}>Back to guides</Text>
                  </TouchableOpacity>
                  
                  {/* Guide places grouped by day */}
                  {Object.entries(
                    guideDetails.places.reduce((acc, place) => {
                      const dayKey = place.guide_day_number || 0;
                      if (!acc[dayKey]) acc[dayKey] = [];
                      acc[dayKey].push(place);
                      return acc;
                    }, {} as Record<number, typeof guideDetails.places>)
                  ).map(([dayKey, places]) => (
                    <View key={dayKey}>
                      <Text style={styles.guideDayHeader}>
                        {dayKey === '0' ? 'All Places' : `Day ${dayKey}`}
                      </Text>
                      {places.map((place) => {
                        const matchingItem = items?.find(i => i.id === place.saved_item_id);
                        if (!matchingItem) return null;
                        
                        const isAssigned = !!matchingItem.planned_day;
                        
                        return (
                          <TouchableOpacity
                            key={place.saved_item_id}
                            style={[
                              styles.modalPlaceItem,
                              isAssigned && styles.modalPlaceItemAssigned,
                            ]}
                            onPress={() => !isAssigned && handleAddPlace(matchingItem, selectedDayForAdd)}
                            disabled={isAssigned}
                          >
                            <View style={styles.modalPlaceImage}>
                              {getPlacePhotoUrl(matchingItem) ? (
                                <Image 
                                  source={{ uri: getPlacePhotoUrl(matchingItem)! }} 
                                  style={styles.placeImage} 
                                />
                              ) : (
                                <View style={styles.placeImagePlaceholder}>
                                  <Text style={styles.placeImageEmoji}>📍</Text>
                                </View>
                              )}
                            </View>
                            <View style={styles.modalPlaceInfo}>
                              <Text style={styles.modalPlaceName}>{matchingItem.name}</Text>
                              {matchingItem.area_name && (
                                <Text style={styles.modalPlaceArea}>{matchingItem.area_name}</Text>
                              )}
                            </View>
                            {isAssigned ? (
                              <View style={styles.assignedBadge}>
                                <Ionicons name="checkmark" size={14} color="#10B981" />
                                <Text style={styles.assignedText}>Day {matchingItem.planned_day}</Text>
                              </View>
                            ) : (
                              <Ionicons name="add-circle" size={24} color="#3B82F6" />
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ))}
                </View>
              ) : (
                // Guide list
                guides && guides.length > 0 ? (
                  guides.map((guide) => (
                    <TouchableOpacity
                      key={guide.id}
                      style={styles.guideItem}
                      onPress={() => handleSelectGuide(guide)}
                    >
                      <View style={styles.guideItemImage}>
                        {guide.thumbnail_url ? (
                          <Image 
                            source={{ uri: guide.thumbnail_url }} 
                            style={styles.placeImage} 
                          />
                        ) : (
                          <View style={styles.placeImagePlaceholder}>
                            <Text style={styles.placeImageEmoji}>🎥</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.guideItemInfo}>
                        <Text style={styles.guideItemName} numberOfLines={2}>
                          {guide.title || 'Untitled Guide'}
                        </Text>
                        <Text style={styles.guideItemCreator}>
                          {guide.creator_name || 'Unknown'}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
                    </TouchableOpacity>
                  ))
                ) : (
                  <View style={styles.modalEmpty}>
                    <Text style={styles.modalEmptyText}>
                      No guides imported yet. Share a YouTube guide in chat!
                    </Text>
                  </View>
                )
              )
            )}
            <View style={{ height: 40 }} />
          </ScrollView>
          
          {loadingGuide && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#3B82F6" />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Day Cards */}
        {tripDays.map(dayNumber => renderDayCard(dayNumber))}
        
        {/* Full Width Add Button at bottom */}
        <TouchableOpacity
          style={styles.fullAddButton}
          onPress={() => openAddModal(tripDays[0])}
        >
          <Ionicons name="add" size={24} color="#FFFFFF" />
          <Text style={styles.fullAddButtonText}>Add Place to Itinerary</Text>
        </TouchableOpacity>
        
        <View style={{ height: BOTTOM_TAB_HEIGHT + 20 }} />
      </ScrollView>
      
      {/* Add Place Modal */}
      {renderAddModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },

  // Day Card
  dayCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    overflow: 'hidden',
  },
  dayCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  dayCardTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dayBadge: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  dayBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  dayPlaceCount: {
    fontSize: 13,
    color: '#64748B',
  },
  dayCardContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },

  // Day Place Card
  dayPlaceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  placeOrderBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  placeOrderText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  dayPlaceImage: {
    width: 44,
    height: 44,
    borderRadius: 10,
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
    fontSize: 20,
  },
  dayPlaceInfo: {
    flex: 1,
    marginLeft: 12,
  },
  dayPlaceName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  dayPlaceArea: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  removePlaceButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Empty Day
  emptyDayContent: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyDayText: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 8,
  },

  // Add Place Button (in day)
  addPlaceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    borderStyle: 'dashed',
  },
  addPlaceButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
    marginLeft: 8,
  },

  // Full Width Add Button
  fullAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    paddingVertical: 16,
    borderRadius: 16,
    marginTop: 8,
    gap: 8,
  },
  fullAddButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.8,
    minHeight: SCREEN_HEIGHT * 0.5,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  modalTabs: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  modalTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
  },
  modalTabActive: {
    backgroundColor: '#EEF2FF',
  },
  modalTabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748B',
  },
  modalTabTextActive: {
    color: '#3B82F6',
    fontWeight: '600',
  },
  modalSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  modalSearchInput: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    fontSize: 15,
    color: '#1F2937',
  },
  modalList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  modalPlaceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalPlaceItemAssigned: {
    opacity: 0.6,
  },
  modalPlaceImage: {
    width: 48,
    height: 48,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#F1F5F9',
  },
  modalPlaceInfo: {
    flex: 1,
    marginLeft: 12,
  },
  modalPlaceName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  modalPlaceArea: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  modalEmpty: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  modalEmptyText: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
  },
  assignedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  assignedText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#10B981',
  },

  // Guide Items
  guideItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  guideItemImage: {
    width: 60,
    height: 40,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#F1F5F9',
  },
  guideItemInfo: {
    flex: 1,
    marginLeft: 12,
  },
  guideItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  guideItemCreator: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  guideBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 8,
  },
  guideBackText: {
    fontSize: 14,
    color: '#3B82F6',
    marginLeft: 4,
  },
  guideDayHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    marginTop: 16,
    marginBottom: 8,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
