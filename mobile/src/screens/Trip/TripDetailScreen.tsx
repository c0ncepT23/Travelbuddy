import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  StatusBar,
  Dimensions,
  Platform,
  ScrollView,
  Alert,
  Linking,
  TextInput,
  KeyboardAvoidingView,
  FlatList,
  Share,
} from 'react-native';
import { useTripStore } from '../../stores/tripStore';
import { useItemStore } from '../../stores/itemStore';
import { useLocationStore } from '../../stores/locationStore';
import { useCompanionStore } from '../../stores/companionStore';
import { useXPStore, XP_REWARDS } from '../../stores/xpStore';
import { useCheckInStore } from '../../stores/checkInStore';
import { MapView, MapViewRef } from '../../components/MapView';
import { PlaceDetailCard } from '../../components/PlaceDetailCard';
import { PlaceListDrawer } from '../../components/PlaceListDrawer';
import { EnhancedCheckInModal } from '../../components/EnhancedCheckInModal';
import { DayPlannerView } from '../../components/DayPlannerView';
import { TimelineScreen } from './TimelineScreen';
import api from '../../config/api';
import { ItemCategory } from '../../types';
import { MotiView } from 'moti';
import { HapticFeedback } from '../../utils/haptics';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import ConfettiCannon from 'react-native-confetti-cannon';
import * as Clipboard from 'expo-clipboard';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import theme from '../../config/theme';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const BOTTOM_SHEET_MIN_HEIGHT = 140;
const BOTTOM_SHEET_MAX_HEIGHT = screenHeight * 0.75;

export default function TripDetailScreen({ route, navigation }: any) {
  const { tripId } = route.params;
  const { currentTrip, currentTripMembers, fetchTripDetails, fetchTripMembers } = useTripStore();
  const { items, fetchTripItems, toggleFavorite, toggleMustVisit, deleteItem, assignItemToDay, fetchItemsByDay, updateNotes } = useItemStore();
  const { sendQuery, getMessages, isLoading: chatLoading } = useCompanionStore();
  const { initializeNotifications, startBackgroundTracking, stopBackgroundTracking, location } = useLocationStore();
  const { addXP, level, getProgress, getLevelTitle } = useXPStore();
  const { fetchCheckIns, isPlaceCheckedIn, refreshCheckIns } = useCheckInStore();

  const messages = getMessages(tripId);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<any>(null);
  const [chatInput, setChatInput] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'food' | 'accommodation' | 'place' | 'shopping' | 'activity' | 'tip'>('all');
  const [showOnlyCheckedIn, setShowOnlyCheckedIn] = useState(false);
  const [showShareStoryModal, setShowShareStoryModal] = useState(false);
  const [showShareInviteModal, setShowShareInviteModal] = useState(false);
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [checkInPlace, setCheckInPlace] = useState<any>(null);
  const [drawerItems, setDrawerItems] = useState<any[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'map' | 'planner' | 'timeline'>('map');
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedAreas, setCollapsedAreas] = useState<Set<string>>(new Set());
  const confettiRef = React.useRef<any>(null);
  const mapRef = React.useRef<MapViewRef>(null);
  const [mapRegion, setMapRegion] = useState({
    latitude: 35.6762,
    longitude: 139.6503,
    latitudeDelta: 0.1,
    longitudeDelta: 0.1,
  });

  const sheetHeight = useSharedValue(BOTTOM_SHEET_MIN_HEIGHT);

  const handleSendMessage = async () => {
    if (!chatInput.trim() || chatLoading) return;
    
    const message = chatInput.trim();
    setChatInput('');
    
    const locationData = location
      ? { lat: location.coords.latitude, lng: location.coords.longitude }
      : undefined;
    
    const itemCountBefore = items.length;
    
    await sendQuery(tripId, message, locationData);
    
    // Refresh items after processing
    setTimeout(async () => {
      const refreshedItems = await fetchTripItems(tripId, {});
      
      // If new places were added, CELEBRATE! 🎉
      if (refreshedItems && refreshedItems.length > itemCountBefore) {
        const placesAdded = refreshedItems.length - itemCountBefore;
        
        // Award XP for adding places
        addXP(XP_REWARDS.ADD_PLACE * placesAdded);
        
        HapticFeedback.success();
        if (confettiRef.current) {
          confettiRef.current.start();
        }
      }
    }, 2000);
  };

  const getUserName = (userId: string) => {
    const member = currentTripMembers?.find(m => m.id === userId);
    return member?.name || member?.email || 'Someone';
  };

  const openInGoogleMaps = (place: any) => {
    if (place.location_lat && place.location_lng) {
      const url = `https://www.google.com/maps/search/?api=1&query=${place.location_lat},${place.location_lng}`;
      Linking.openURL(url);
    } else {
      Alert.alert('No Location', 'This place doesn\'t have coordinates yet.');
    }
  };

  const handleClusterPress = (category: ItemCategory, clusterItems: any[]) => {
    HapticFeedback.medium();
    setSelectedCategory(category);
    setDrawerItems(clusterItems);
    setSelectedPlace(null); // Clear any selected place
    setIsDrawerOpen(true); // Open drawer with list
  };

  const handlePlaceSelectFromDrawer = (item: any) => {
    HapticFeedback.medium();
    setSelectedPlace(item);
    // Drawer stays open but switches to detail mode
    // Animate map to show the selected place
    if (item.location_lat && item.location_lng && mapRef.current) {
      mapRef.current.animateToRegion(item.location_lat, item.location_lng, 0.01);
    }
  };

  const handleBackToList = () => {
    HapticFeedback.light();
    setSelectedPlace(null); // Go back to list view
    // Drawer stays open with the list
  };

  const handleDrawerClose = () => {
    setSelectedPlace(null);
    setDrawerItems([]);
    setSelectedCategory('all');
    setIsDrawerOpen(false); // Close drawer completely
  };

  const handleCheckIn = async (place: any) => {
    // Open the enhanced check-in modal
    setCheckInPlace(place);
    setShowCheckInModal(true);
  };

  const handleCheckInComplete = async (checkIn: any) => {
    // Show confetti
    if (confettiRef.current) {
      confettiRef.current.start();
    }
    
    // Refresh items and check-ins to update status
    await fetchTripItems(tripId, {});
    await refreshCheckIns(tripId);
    
    // Close the drawer detail view if it was showing this place
    if (selectedPlace?.id === checkInPlace?.id) {
      setSelectedPlace(null);
    }
    
    // Reset check-in modal state
    setCheckInPlace(null);
    setShowCheckInModal(false);
  };

  const handleToggleFavorite = async (place: any) => {
    try {
      HapticFeedback.light();
      const updatedPlace = await toggleFavorite(place.id);
      
      // Update selected place if it's currently showing
      if (selectedPlace?.id === place.id) {
        setSelectedPlace(updatedPlace);
      }
      
      // Update drawer items
      setDrawerItems(prev => prev.map(item => 
        item.id === place.id ? { ...item, is_favorite: updatedPlace.is_favorite } : item
      ));
    } catch (error: any) {
      console.error('Toggle favorite error:', error);
      Alert.alert('Error', 'Failed to update favorite status.');
    }
  };

  const handleToggleMustVisit = async (place: any) => {
    try {
      HapticFeedback.medium();
      const updatedPlace = await toggleMustVisit(place.id);
      
      // Update selected place if it's currently showing
      if (selectedPlace?.id === place.id) {
        setSelectedPlace(updatedPlace);
      }
      
      // Update drawer items
      setDrawerItems(prev => prev.map(item => 
        item.id === place.id ? { ...item, is_must_visit: updatedPlace.is_must_visit } : item
      ));
    } catch (error: any) {
      console.error('Toggle must-visit error:', error);
      Alert.alert('Error', 'Failed to update must-visit status.');
    }
  };

  const handleUpdateNotes = async (place: any, notes: string) => {
    try {
      const updatedPlace = await updateNotes(place.id, notes);
      
      // Update selected place if it's currently showing
      if (selectedPlace?.id === place.id) {
        setSelectedPlace(updatedPlace);
      }
      
      // Update drawer items
      setDrawerItems(prev => prev.map(item => 
        item.id === place.id ? { ...item, user_notes: updatedPlace.user_notes } : item
      ));
    } catch (error: any) {
      console.error('Update notes error:', error);
      Alert.alert('Error', 'Failed to update notes.');
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    Alert.alert(
      'Remove Place',
      'Are you sure you want to remove this place from the trip?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              HapticFeedback.medium();
              await deleteItem(itemId);
              
              // Update drawer items
              setDrawerItems(prev => prev.filter(item => item.id !== itemId));
              
              // Close detail card if it's showing the deleted item
              if (selectedPlace?.id === itemId) {
                setSelectedPlace(null);
              }
            } catch (error: any) {
              console.error('Delete item error:', error);
              Alert.alert('Error', 'Failed to remove place. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleAssignToDay = async (place: any, day: number | null) => {
    try {
      HapticFeedback.medium();
      const updatedPlace = await assignItemToDay(place.id, day);
      
      // Update selected place if it's currently showing
      if (selectedPlace?.id === place.id) {
        setSelectedPlace(updatedPlace);
      }
      
      // Update drawer items
      setDrawerItems(prev => prev.map(item => 
        item.id === place.id ? { ...item, planned_day: updatedPlace.planned_day, day_order: updatedPlace.day_order } : item
      ));

      // Refresh items to update the main list
      await fetchTripItems(tripId, {});
      
      // If in planner view, also refresh the day groups
      if (viewMode === 'planner') {
        await fetchItemsByDay(tripId);
      }

      Alert.alert(
        'Success',
        day === null ? 'Place unassigned from day' : `Place assigned to Day ${day}`,
        [{ text: 'OK' }]
      );
    } catch (error: any) {
      console.error('Assign to day error:', error);
      Alert.alert('Error', 'Failed to assign place to day.');
    }
  };


  useEffect(() => {
    const loadTripData = async () => {
      try {
        setIsLoading(true);
        const trip = await fetchTripDetails(tripId);
        await fetchTripMembers(tripId);
        const loadedItems = await fetchTripItems(tripId, {});
        await fetchCheckIns(tripId);

        // Debug: Log items by category and their coordinates
        const categories = ['food', 'place', 'shopping', 'activity', 'accommodation'];
        categories.forEach(cat => {
          const catItems = loadedItems.filter(i => i.category === cat);
          if (catItems.length > 0) {
            const coords = catItems.map(i => ({ 
              name: i.name.substring(0, 20), 
              lat: i.location_lat?.toFixed(2), 
              lng: i.location_lng?.toFixed(2) 
            }));
            console.log(`[TripDetail] ${cat} items (${catItems.length}):`, JSON.stringify(coords));
          }
        });

        // Set map center based on saved places OR destination
        if (loadedItems.length > 0) {
          const validItems = loadedItems.filter(item => item.location_lat && item.location_lng);
          if (validItems.length > 0) {
            const avgLat = validItems.reduce((sum, item) => sum + (item.location_lat || 0), 0) / validItems.length;
            const avgLng = validItems.reduce((sum, item) => sum + (item.location_lng || 0), 0) / validItems.length;
            
            // Calculate bounding box to show all places
            const minLat = Math.min(...validItems.map(i => i.location_lat!));
            const maxLat = Math.max(...validItems.map(i => i.location_lat!));
            const minLng = Math.min(...validItems.map(i => i.location_lng!));
            const maxLng = Math.max(...validItems.map(i => i.location_lng!));
            
            const latDelta = (maxLat - minLat) * 1.5; // 1.5x padding
            const lngDelta = (maxLng - minLng) * 1.5;
            
            setMapRegion({
              latitude: avgLat,
              longitude: avgLng,
              latitudeDelta: Math.max(latDelta, 2), // Minimum zoom level to show country view
              longitudeDelta: Math.max(lngDelta, 2),
            });
          }
        } else if (currentTrip?.destination) {
          // Fallback: Show entire destination country
          const destCoords = getDestinationCoordinates(currentTrip.destination);
          setMapRegion({
            latitude: destCoords.lat,
            longitude: destCoords.lng,
            latitudeDelta: 8, // Zoomed out to show whole country
            longitudeDelta: 8,
          });
        }
        setIsLoading(false);
      } catch (error) {
        console.error('[TripDetail] Error loading trip:', error);
        setIsLoading(false);
      }
    };
    loadTripData();
  }, [tripId]);

  // Helper to get approximate coordinates for common destinations
  const getDestinationCoordinates = (destination: string): { lat: number; lng: number } => {
    const dest = destination.toLowerCase();
    const coordinates: Record<string, { lat: number; lng: number }> = {
      'japan': { lat: 35.6762, lng: 139.6503 }, // Tokyo
      'tokyo': { lat: 35.6762, lng: 139.6503 },
      'osaka': { lat: 34.6937, lng: 135.5023 },
      'kyoto': { lat: 35.0116, lng: 135.7681 },
      'paris': { lat: 48.8566, lng: 2.3522 },
      'france': { lat: 48.8566, lng: 2.3522 },
      'london': { lat: 51.5074, lng: -0.1278 },
      'uk': { lat: 51.5074, lng: -0.1278 },
      'new york': { lat: 40.7128, lng: -74.0060 },
      'usa': { lat: 39.8283, lng: -98.5795 },
      'italy': { lat: 41.9028, lng: 12.4964 },
      'rome': { lat: 41.9028, lng: 12.4964 },
      'spain': { lat: 40.4168, lng: -3.7038 },
      'barcelona': { lat: 41.3851, lng: 2.1734 },
    };
    
    // Try to find a match
    for (const [key, coords] of Object.entries(coordinates)) {
      if (dest.includes(key)) {
        return coords;
      }
    }
    
    // Default fallback (center of world map)
    return { lat: 20, lng: 0 };
  };

  useEffect(() => {
    const initializeLocationFeatures = async () => {
      try {
        await initializeNotifications();
        // Always try to start background tracking - it will set the trip ID
        // even if the task is already running from a previous session
        console.log('[TripDetail] Starting background tracking for trip:', tripId);
        await startBackgroundTracking(tripId);
      } catch (error) {
        console.error('[TripDetail] Error initializing location features:', error);
      }
    };
    initializeLocationFeatures();
    
    // Don't stop background tracking on unmount - just let it run
    // The trip ID will be updated next time user enters a trip
    return () => {
      // Only stop if navigating away from app entirely (handled elsewhere)
      // stopBackgroundTracking();
    };
  }, [tripId]);

  // Pan gesture for bottom sheet
  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      const newHeight = sheetHeight.value - event.translationY;
      if (newHeight >= BOTTOM_SHEET_MIN_HEIGHT && newHeight <= BOTTOM_SHEET_MAX_HEIGHT) {
        sheetHeight.value = newHeight;
      }
    })
    .onEnd((event) => {
      if (event.velocityY < -500 || sheetHeight.value > (BOTTOM_SHEET_MIN_HEIGHT + BOTTOM_SHEET_MAX_HEIGHT) / 2) {
        sheetHeight.value = withSpring(BOTTOM_SHEET_MAX_HEIGHT, { damping: 20 });
        runOnJS(setIsExpanded)(true);
      } else {
        sheetHeight.value = withSpring(BOTTOM_SHEET_MIN_HEIGHT, { damping: 20 });
        runOnJS(setIsExpanded)(false);
      }
    });

  const bottomSheetStyle = useAnimatedStyle(() => ({
    height: sheetHeight.value,
  }));

  // Count items by category
  const foodCount = items.filter(i => i.category === 'food').length;
  const placeCount = items.filter(i => i.category === 'place').length;
  const shoppingCount = items.filter(i => i.category === 'shopping').length;
  const activityCount = items.filter(i => i.category === 'activity').length;
  const accommodationCount = items.filter(i => i.category === 'accommodation').length;
  const tipCount = items.filter(i => i.category === 'tip').length;

  // Filter items based on selected category and check-in status
  // Filter items by category, search, and check-in status
  const filteredItems = useMemo(() => {
    let result = selectedCategory === 'all' 
      ? items 
      : items.filter(i => i.category === selectedCategory);
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(item => 
        item.name.toLowerCase().includes(query) ||
        item.area_name?.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query)
      );
    }
    
    if (showOnlyCheckedIn) {
      result = result.filter(i => isPlaceCheckedIn(tripId, i.id));
    }
    
    return result;
  }, [items, selectedCategory, searchQuery, showOnlyCheckedIn, tripId]);

  // Extract city from formatted address
  const extractCity = (address: string | undefined): string => {
    if (!address) return '';
    const parts = address.split(',').map(p => p.trim());
    if (parts.length >= 3) {
      const cityPart = parts[parts.length - 2];
      const cityClean = cityPart.replace(/\d{3}-\d{4}/, '').trim();
      if (cityClean && cityClean !== 'Japan') {
        return cityClean;
      }
    }
    return '';
  };

  // Group items by area with city context
  const groupedByArea = useMemo(() => {
    const groups: Record<string, { items: any[], city: string }> = {};
    
    filteredItems.forEach(item => {
      const area = item.area_name || 'Other Locations';
      const city = extractCity(item.formatted_address || item.location_name);
      
      if (!groups[area]) {
        groups[area] = { items: [], city };
      }
      groups[area].items.push(item);
      if (city && !groups[area].city) {
        groups[area].city = city;
      }
    });
    
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

  if (isLoading || !currentTrip) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingBox}>
          <Text style={styles.loadingEmoji}>✈️</Text>
        </View>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading your adventure...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      
      {/* MAP VIEW */}
      {viewMode === 'map' && (
        <>
          {/* FULL SCREEN MAP (Z-Index 0) */}
          <View style={styles.mapContainer}>
            <MapView
              ref={mapRef}
              items={items}
              region={mapRegion}
              selectedPlace={selectedPlace}
              onMarkerPress={(item) => {
                HapticFeedback.medium();
                setSelectedPlace(item);
                // Animate to place
                if (item.location_lat && item.location_lng && mapRef.current) {
                  mapRef.current.animateToRegion(item.location_lat, item.location_lng, 0.01);
                }
              }}
              onClusterPress={handleClusterPress}
            />
          </View>

          {/* PLACE LIST DRAWER - Only shows when drawer is open */}
          {isDrawerOpen && (
            <PlaceListDrawer
              items={drawerItems}
              selectedCategory={selectedCategory}
              selectedPlace={selectedPlace}
              onPlaceSelect={handlePlaceSelectFromDrawer}
              onBackToList={handleBackToList}
              onClose={handleDrawerClose}
              onCheckIn={handleCheckIn}
              isPlaceCheckedIn={(placeId) => isPlaceCheckedIn(tripId, placeId)}
              getUserName={getUserName}
              onToggleFavorite={handleToggleFavorite}
              onToggleMustVisit={handleToggleMustVisit}
              onDeleteItem={handleDeleteItem}
              onUpdateNotes={handleUpdateNotes}
              userLocation={location ? { latitude: location.coords.latitude, longitude: location.coords.longitude } : null}
              trip={currentTrip}
              onAssignToDay={handleAssignToDay}
            />
          )}
        </>
      )}

      {/* DAY PLANNER VIEW - Full screen overlay */}
      {viewMode === 'planner' && currentTrip && (
        <MotiView
          from={{ opacity: 0, translateY: 50 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 300 }}
          style={styles.plannerContainer}
        >
          <DayPlannerView
            trip={currentTrip}
            tripId={tripId}
            onPlaceSelect={(item) => {
              HapticFeedback.medium();
              setSelectedPlace(item);
              // Switch to map view to show the place
              setViewMode('map');
              if (item.location_lat && item.location_lng && mapRef.current) {
                setTimeout(() => {
                  mapRef.current?.animateToRegion(item.location_lat!, item.location_lng!, 0.01);
                }, 100);
              }
            }}
            onClose={() => setViewMode('map')}
          />
        </MotiView>
      )}

      {/* TIMELINE VIEW - Shows checked-in places and share story */}
      {viewMode === 'timeline' && currentTrip && (
        <MotiView
          from={{ opacity: 0, translateY: 50 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 300 }}
          style={styles.plannerContainer}
        >
          <TimelineScreen
            tripId={tripId}
            tripName={currentTrip.name}
            destination={currentTrip.destination}
            onClose={() => setViewMode('map')}
          />
        </MotiView>
      )}

      {/* FLOATING TOP CONTROLS - Clean Modern Style */}
      {viewMode === 'map' ? (
        <View style={styles.topControls}>
          {/* Back Button */}
          <TouchableOpacity 
            style={styles.headerButton} 
            onPress={() => {
              HapticFeedback.medium();
              navigation.goBack();
            }}
          >
            <Text style={styles.headerButtonIcon}>←</Text>
          </TouchableOpacity>

          {/* Trip Name Pill - Clean minimal design */}
          {!isDrawerOpen && (
            <TouchableOpacity 
              style={styles.tripPill}
              onPress={() => {
                HapticFeedback.medium();
                navigation.navigate('GroupChat', { tripId });
              }}
              activeOpacity={0.9}
            >
              <Text style={styles.tripPillText}>{currentTrip.name}</Text>
              
              {/* Member Avatars - Inline */}
              <View style={styles.memberAvatarsInline}>
                {currentTripMembers?.slice(0, 3).map((member, index) => (
                  <View 
                    key={member.id}
                    style={[
                      styles.memberAvatarMini,
                      { 
                        marginLeft: index > 0 ? -6 : 0,
                        backgroundColor: ['#3B82F6', '#10B981', '#F59E0B', '#EC4899'][index % 4],
                        zIndex: 10 - index,
                      }
                    ]}
                  >
                    <Text style={styles.memberAvatarMiniText}>
                      {member.name?.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)}
                    </Text>
                  </View>
                ))}
                {(currentTripMembers?.length || 0) > 3 && (
                  <View style={[styles.memberAvatarMini, styles.memberCountMini]}>
                    <Text style={styles.memberCountMiniText}>+{(currentTripMembers?.length || 0) - 3}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          )}

          {/* View Toggle + Chat + Share Button - Hidden when drawer is open */}
          {!isDrawerOpen && (
            <View style={styles.headerRightButtons}>
              {/* Chat Button - Go to Chat-First Home */}
              <TouchableOpacity
                style={[styles.headerButton, styles.chatButton]}
                onPress={() => {
                  HapticFeedback.medium();
                  navigation.navigate('TripHome', { tripId });
                }}
              >
                <Text style={styles.headerButtonIcon}>💬</Text>
              </TouchableOpacity>

              {/* View Mode Toggle: Map → Planner → Timeline → Map */}
              <TouchableOpacity
                style={styles.headerButton}
                onPress={() => {
                  HapticFeedback.medium();
                  if (viewMode === 'map') {
                    setViewMode('planner');
                  } else if (viewMode === 'planner') {
                    setViewMode('timeline');
                  } else {
                    setViewMode('map');
                  }
                  if (isDrawerOpen) {
                    handleDrawerClose();
                  }
                }}
              >
                <Text style={styles.headerButtonIcon}>
                  {viewMode === 'map' ? '📅' : viewMode === 'planner' ? '📸' : '🗺️'}
                </Text>
              </TouchableOpacity>

              {/* Share Button */}
              <TouchableOpacity 
                style={styles.headerButton}
                onPress={() => {
                  HapticFeedback.medium();
                  setShowShareInviteModal(true);
                }}
              >
                <Text style={styles.headerButtonIcon}>↗</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ) : (
        // PLANNER/TIMELINE VIEW HEADER - Simple header with back to map
        <View style={styles.plannerHeader}>
          <TouchableOpacity 
            style={styles.plannerHeaderButton} 
            onPress={() => {
              HapticFeedback.medium();
              setViewMode('map'); // Go back to map, not previous screen
            }}
          >
            <Text style={styles.plannerHeaderButtonText}>←</Text>
          </TouchableOpacity>
          
          <View style={styles.plannerHeaderCenter}>
            <Text style={styles.plannerHeaderTitle}>
              {viewMode === 'planner' ? '📅 Day Planner' : '📸 My Journey'}
            </Text>
            <Text style={styles.plannerHeaderSubtitle}>{currentTrip?.name}</Text>
          </View>
          
          <TouchableOpacity 
            style={styles.plannerHeaderButton}
            onPress={() => {
              HapticFeedback.medium();
              navigation.goBack(); // This one exits the trip entirely
            }}
          >
            <Text style={styles.plannerHeaderButtonText}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* MY JOURNEY BUTTON (FAB) - Direct access to timeline */}
      {viewMode === 'map' && !isExpanded && !isDrawerOpen && (
        <TouchableOpacity 
          style={styles.journeyFab}
          onPress={() => {
            HapticFeedback.medium();
            setViewMode('timeline');
          }}
          activeOpacity={0.9}
        >
          <Text style={styles.journeyFabIcon}>📸</Text>
          <Text style={styles.journeyFabLabel}>Journey</Text>
        </TouchableOpacity>
      )}

      {/* GROUP CHAT BUTTON (FAB) - Clean modern style */}
      {viewMode === 'map' && !isExpanded && !isDrawerOpen && (
        <TouchableOpacity 
          style={styles.chatFab}
          onPress={() => {
            HapticFeedback.medium();
            navigation.navigate('GroupChat', { tripId });
          }}
          activeOpacity={0.9}
        >
          <Text style={styles.chatFabIcon}>💬</Text>
        </TouchableOpacity>
      )}

      {/* BOTTOM SHEET - SNEAK PEEK - Only in map view */}
      {viewMode === 'map' && (
      <Animated.View style={[styles.bottomSheet, bottomSheetStyle]}>
        {/* Swipe Handle - Only this should respond to pan gesture */}
        <GestureDetector gesture={panGesture}>
          <View style={styles.sheetHandleArea}>
            <View style={styles.sheetHandle} />
          </View>
        </GestureDetector>

          {/* Sneak Peek (Collapsed) - Clean modern style */}
          {!isExpanded && (
            <View style={styles.sneakPeek}>
              <View style={styles.sneakPeekHeader}>
                <Text style={styles.sneakPeekTitle}>{currentTrip?.destination || 'Your Places'}</Text>
                <Text style={styles.sneakPeekCount}>{items.length} saved</Text>
              </View>
              <View style={styles.sneakPeekStats}>
                {foodCount > 0 && (
                  <View style={styles.statPill}>
                    <Text style={styles.statPillText}>🍽️ {foodCount}</Text>
                  </View>
                )}
                {placeCount > 0 && (
                  <View style={styles.statPill}>
                    <Text style={styles.statPillText}>🏛️ {placeCount}</Text>
                  </View>
                )}
                {shoppingCount > 0 && (
                  <View style={styles.statPill}>
                    <Text style={styles.statPillText}>🛍️ {shoppingCount}</Text>
                  </View>
                )}
                {activityCount > 0 && (
                  <View style={styles.statPill}>
                    <Text style={styles.statPillText}>🎯 {activityCount}</Text>
                  </View>
                )}
                {accommodationCount > 0 && (
                  <View style={styles.statPill}>
                    <Text style={styles.statPillText}>🏨 {accommodationCount}</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Expanded List - Clean UX */}
          {isExpanded && (
            <View style={styles.expandedContent}>
              {/* Header */}
              <View style={styles.expandedHeader}>
                <Text style={styles.expandedTitle}>{currentTrip?.destination || 'Your Places'}</Text>
                <TouchableOpacity
                  style={styles.closeExpandedButton}
                  onPress={() => {
                    setIsExpanded(false);
                    sheetHeight.value = withSpring(BOTTOM_SHEET_MIN_HEIGHT);
                  }}
                >
                  <Text style={styles.closeExpandedText}>✕</Text>
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
                    <Text style={styles.clearSearchText}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
              
              {/* Category Filter Chips */}
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                style={styles.chipScrollView}
                contentContainerStyle={styles.chipContainer}
              >
                <TouchableOpacity
                  style={[styles.filterChip, selectedCategory === 'all' && styles.filterChipActive]}
                  onPress={() => setSelectedCategory('all')}
                >
                  <Text style={[styles.filterChipText, selectedCategory === 'all' && styles.filterChipTextActive]}>
                    All
                  </Text>
                </TouchableOpacity>
                
                {foodCount > 0 && (
                  <TouchableOpacity
                    style={[styles.filterChip, selectedCategory === 'food' && styles.filterChipActive]}
                    onPress={() => setSelectedCategory('food')}
                  >
                    <Text style={[styles.filterChipText, selectedCategory === 'food' && styles.filterChipTextActive]}>
                      Food
                    </Text>
                  </TouchableOpacity>
                )}
                
                {placeCount > 0 && (
                  <TouchableOpacity
                    style={[styles.filterChip, selectedCategory === 'place' && styles.filterChipActive]}
                    onPress={() => setSelectedCategory('place')}
                  >
                    <Text style={[styles.filterChipText, selectedCategory === 'place' && styles.filterChipTextActive]}>
                      Places
                    </Text>
                  </TouchableOpacity>
                )}
                
                {shoppingCount > 0 && (
                  <TouchableOpacity
                    style={[styles.filterChip, selectedCategory === 'shopping' && styles.filterChipActive]}
                    onPress={() => setSelectedCategory('shopping')}
                  >
                    <Text style={[styles.filterChipText, selectedCategory === 'shopping' && styles.filterChipTextActive]}>
                      Shopping
                    </Text>
                  </TouchableOpacity>
                )}
                
                {activityCount > 0 && (
                  <TouchableOpacity
                    style={[styles.filterChip, selectedCategory === 'activity' && styles.filterChipActive]}
                    onPress={() => setSelectedCategory('activity')}
                  >
                    <Text style={[styles.filterChipText, selectedCategory === 'activity' && styles.filterChipTextActive]}>
                      Activities
                    </Text>
                  </TouchableOpacity>
                )}
                
                {accommodationCount > 0 && (
                  <TouchableOpacity
                    style={[styles.filterChip, selectedCategory === 'accommodation' && styles.filterChipActive]}
                    onPress={() => setSelectedCategory('accommodation')}
                  >
                    <Text style={[styles.filterChipText, selectedCategory === 'accommodation' && styles.filterChipTextActive]}>
                      Hotels
                    </Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
              
              {/* Places grouped by area */}
              <ScrollView 
                style={styles.placesScrollView}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.placesScrollContent}
              >
                {groupedByArea.sortedAreas.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyStateEmoji}>🔍</Text>
                    <Text style={styles.emptyStateText}>No places found</Text>
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
                        <TouchableOpacity 
                          style={styles.areaHeader}
                          onPress={() => toggleAreaCollapse(area)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.areaHeaderLeft}>
                            <Text style={styles.areaTitle}>{displayName}</Text>
                            <Text style={styles.areaCount}>
                              {areaItems.length} {areaItems.length === 1 ? 'place' : 'places'}
                            </Text>
                          </View>
                          <Text style={styles.areaChevron}>
                            {isCollapsed ? '›' : '⌄'}
                          </Text>
                        </TouchableOpacity>

                        {!isCollapsed && areaItems.map((item: any) => (
                          <TouchableOpacity
                            key={item.id}
                            style={styles.placeCard}
                            onPress={() => {
                              HapticFeedback.light();
                              setSelectedPlace(item);
                              setDrawerItems(filteredItems);
                              setIsDrawerOpen(true);
                              setIsExpanded(false);
                              sheetHeight.value = withSpring(BOTTOM_SHEET_MIN_HEIGHT);
                              if (item.location_lat && item.location_lng && mapRef.current) {
                                mapRef.current.animateToRegion(item.location_lat, item.location_lng, 0.01);
                              }
                            }}
                            activeOpacity={0.7}
                          >
                            <View style={styles.placeIconContainer}>
                              <Text style={styles.placeIcon}>
                                {item.category === 'food' ? '🍽️' : 
                                 item.category === 'place' ? '🏛️' :
                                 item.category === 'shopping' ? '🛍️' :
                                 item.category === 'activity' ? '🎯' :
                                 item.category === 'accommodation' ? '🏨' : '📍'}
                              </Text>
                            </View>
                            <View style={styles.placeInfo}>
                              <Text style={styles.placeName} numberOfLines={1}>{item.name}</Text>
                              <Text style={styles.placeDescription} numberOfLines={2}>
                                {item.description || item.location_name || 'Tap to view details'}
                              </Text>
                            </View>
                            <Text style={styles.placeChevron}>›</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    );
                  })
                )}
              </ScrollView>
            </View>
          )}
        </Animated.View>
      )}

      {/* AI CHAT MODAL */}
      {showChatModal && (
        <View style={styles.chatModalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.chatModalKeyboard}
          >
            <View style={styles.chatModal}>
              <View style={styles.chatModalHeader}>
                <Text style={styles.chatModalTitle}>✨ Yori Assistant</Text>
                <TouchableOpacity onPress={() => setShowChatModal(false)}>
                  <Text style={styles.closeButtonText}>✕</Text>
                </TouchableOpacity>
              </View>
              
              <ScrollView style={styles.chatMessages} showsVerticalScrollIndicator={false}>
                {messages.map((msg) => (
                  <View
                    key={msg.id}
                    style={[
                      styles.chatBubble,
                      msg.type === 'user' ? styles.userBubble : styles.aiBubble
                    ]}
                  >
                    <Text style={[
                      styles.chatBubbleText,
                      msg.type === 'user' && styles.userBubbleText
                    ]}>
                      {msg.content}
                    </Text>
                  </View>
                ))}
              </ScrollView>

              <View style={styles.chatInputContainer}>
                <TextInput
                  style={styles.chatTextInput}
                  value={chatInput}
                  onChangeText={setChatInput}
                  placeholder="Paste YouTube/Instagram link..."
                  placeholderTextColor="#64748B"
                  multiline
                />
                <TouchableOpacity
                  style={[styles.chatSendButton, chatLoading && styles.chatSendButtonDisabled]}
                  onPress={handleSendMessage}
                  disabled={chatLoading}
                >
                  <Text style={styles.chatSendButtonText}>→</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      )}
      {/* CONFETTI CANNON */}
      <ConfettiCannon
        count={200}
        origin={{ x: screenWidth / 2, y: screenHeight / 2 }}
        autoStart={false}
        ref={confettiRef}
        fadeOut={true}
      />

      {/* ENHANCED CHECK-IN MODAL */}
      <EnhancedCheckInModal
        visible={showCheckInModal}
        place={checkInPlace}
        onClose={() => {
          setShowCheckInModal(false);
          setCheckInPlace(null);
        }}
        onCheckInComplete={handleCheckInComplete}
      />

      {/* SHARE INVITE MODAL - Modern NeoPOP Style */}
      {showShareInviteModal && currentTrip && (
        <View style={styles.shareInviteOverlay}>
          <TouchableOpacity 
            style={styles.shareInviteBackdrop} 
            activeOpacity={1} 
            onPress={() => setShowShareInviteModal(false)} 
          />
          <MotiView
            from={{ translateY: 300, opacity: 0 }}
            animate={{ translateY: 0, opacity: 1 }}
            transition={{ type: 'spring', damping: 20 }}
            style={styles.shareInviteModal}
          >
            {/* Header */}
            <View style={styles.shareInviteHeader}>
              <Text style={styles.shareInviteTitle}>Invite Friends ✈️</Text>
              <TouchableOpacity 
                onPress={() => setShowShareInviteModal(false)}
                style={styles.shareInviteCloseBtn}
              >
                <Text style={styles.shareInviteCloseBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Invite Code Display */}
            <View style={styles.inviteCodeContainer}>
              <Text style={styles.inviteCodeLabel}>INVITE CODE</Text>
              <View style={styles.inviteCodeBox}>
                <Text style={styles.inviteCodeText}>{currentTrip.invite_code}</Text>
              </View>
              <Text style={styles.inviteCodeHint}>Share this code with friends</Text>
            </View>

            {/* Action Buttons */}
            <View style={styles.shareInviteActions}>
              {/* Copy Code Button */}
              <TouchableOpacity
                style={styles.shareInviteBtn}
                onPress={async () => {
                  await Clipboard.setStringAsync(currentTrip.invite_code);
                  HapticFeedback.success();
                  setShowShareInviteModal(false);
                  Alert.alert('✅ Copied!', `Invite code "${currentTrip.invite_code}" copied to clipboard`);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.shareInviteBtnIcon}>📋</Text>
                <View style={styles.shareInviteBtnContent}>
                  <Text style={styles.shareInviteBtnTitle}>Copy Code</Text>
                  <Text style={styles.shareInviteBtnSubtitle}>They enter code in app</Text>
                </View>
              </TouchableOpacity>

              {/* Copy Link Button */}
              <TouchableOpacity
                style={styles.shareInviteBtn}
                onPress={async () => {
                  const inviteLink = `https://travelagent.app/join/${currentTrip.invite_code}`;
                  await Clipboard.setStringAsync(inviteLink);
                  HapticFeedback.success();
                  setShowShareInviteModal(false);
                  Alert.alert('✅ Copied!', 'Invite link copied to clipboard');
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.shareInviteBtnIcon}>🔗</Text>
                <View style={styles.shareInviteBtnContent}>
                  <Text style={styles.shareInviteBtnTitle}>Copy Link</Text>
                  <Text style={styles.shareInviteBtnSubtitle}>Direct join link</Text>
                </View>
              </TouchableOpacity>

              {/* Share Button - Primary */}
              <TouchableOpacity
                style={[styles.shareInviteBtn, styles.shareInviteBtnPrimary]}
                onPress={async () => {
                  const inviteCode = currentTrip.invite_code;
                  const inviteLink = `https://travelagent.app/join/${inviteCode}`;
                  const shareMessage = `Join my trip "${currentTrip.name}" to ${currentTrip.destination}! 🌍✈️\n\n📱 Invite Code: ${inviteCode}\n\n🔗 Or tap: ${inviteLink}`;
                  setShowShareInviteModal(false);
                  try {
                    await Share.share({
                      message: shareMessage,
                      title: `Join ${currentTrip.name}`,
                    });
                  } catch (error) {
                    console.error('Share error:', error);
                  }
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.shareInviteBtnIcon}>↗️</Text>
                <View style={styles.shareInviteBtnContent}>
                  <Text style={[styles.shareInviteBtnTitle, styles.shareInviteBtnTitlePrimary]}>Share</Text>
                  <Text style={[styles.shareInviteBtnSubtitle, styles.shareInviteBtnSubtitlePrimary]}>Send via WhatsApp, etc.</Text>
                </View>
              </TouchableOpacity>
            </View>
          </MotiView>
        </View>
      )}

      {/* SHARE MY STORY MODAL */}
      {showShareStoryModal && (
        <View style={styles.shareStoryOverlay}>
          <View style={styles.shareStoryModal}>
            <View style={styles.shareStoryHeader}>
              <Text style={styles.shareStoryTitle}>Share MY Trip Story 📖</Text>
              <TouchableOpacity onPress={() => setShowShareStoryModal(false)}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <Text style={styles.shareStoryInfo}>
              Create a story with YOUR checked-in places. Others in the trip can create their own stories too!
            </Text>
            
            <View style={styles.shareStoryStats}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{items.length}</Text>
                <Text style={styles.statLabel}>Places in Trip</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {items.filter(i => isPlaceCheckedIn(tripId, i.id)).length}
                </Text>
                <Text style={styles.statLabel}>YOU Visited</Text>
              </View>
            </View>
            
            <TouchableOpacity
              style={styles.createStoryButton}
              onPress={async () => {
                try {
                  HapticFeedback.heavy();
                  
                  const checkedInCount = items.filter(i => isPlaceCheckedIn(tripId, i.id)).length;
                  
                  if (checkedInCount === 0) {
                    Alert.alert('No Check-Ins Yet', 'Check in to some places first before creating a story!');
                    return;
                  }
                  
                  console.log('[CreateStory] Creating story for trip:', tripId);
                  console.log('[CreateStory] Current trip:', currentTrip);
                  
                  const storyData = {
                    isPublic: true,
                    title: `${currentTrip.name} - Trip Story`,
                    description: `My adventure in ${currentTrip.destination}`,
                  };
                  
                  console.log('[CreateStory] Sending data:', storyData);
                  
                  const response = await api.post(`/trips/${tripId}/story`, storyData);
                  
                  console.log('[CreateStory] Response:', response.data);
                  
                  if (response.data.success) {
                    const shareCode = response.data.data.share_code;
                    const shareUrl = `https://travelagent.app/story/${shareCode}`;
                    
                    HapticFeedback.success();
                    
                    Alert.alert(
                      '✨ Story Created!',
                      `Share this link:\n${shareUrl}`,
                      [
                        { text: 'Copy Link', onPress: async () => {
                          await Clipboard.setStringAsync(shareUrl);
                          Alert.alert('Copied!', 'Link copied to clipboard');
                        }},
                        { text: 'Close' }
                      ]
                    );
                    setShowShareStoryModal(false);
                  }
                } catch (error: any) {
                  console.error('[CreateStory] Error:', error);
                  console.error('[CreateStory] Error response:', error.response?.data);
                  console.error('[CreateStory] Error status:', error.response?.status);
                  
                  const errorMsg = error.response?.data?.error || error.message || 'Failed to create story';
                  Alert.alert('Error', errorMsg);
                }
              }}
            >
              <Text style={styles.createStoryButtonText}>✨ Create Story</Text>
            </TouchableOpacity>
            
            <Text style={styles.shareStoryHint}>
              💡 Only YOUR check-ins appear in your story. Each trip member can create their own!
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingBox: {
    width: 80,
    height: 80,
    backgroundColor: theme.colors.primary,
    borderWidth: 3,
    borderColor: theme.colors.borderDark,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    ...theme.shadows.neopop.md,
  },
  loadingEmoji: {
    fontSize: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: theme.colors.textSecondary,
    fontWeight: '700',
  },
  
  // Map
  mapContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  
  
  // Top Floating Controls - Clean Modern Style
  topControls: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 100,
  },
  headerButton: {
    width: 44,
    height: 44,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  headerButtonIcon: {
    fontSize: 20,
  },
  chatButton: {
    backgroundColor: theme.colors.primary,
  },
  headerRightButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  plannerContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 110 : 90, // Increased gap below planner header
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 50,
    backgroundColor: '#F8FAFC',
  },
  
  // Planner Header Styles
  plannerHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    zIndex: 100,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  plannerHeaderButton: {
    width: 44,
    height: 44,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  plannerHeaderButtonText: {
    fontSize: 20,
  },
  plannerHeaderCenter: {
    flex: 1,
    alignItems: 'center',
  },
  plannerHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  plannerHeaderSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  tripPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    gap: 10,
  },
  tripPillText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
  },
  xpBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: theme.colors.success,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 2,
    borderColor: theme.colors.borderDark,
    borderRadius: 4,
  },
  xpBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: theme.colors.textInverse,
  },

  // Member Avatars - Inline with trip name
  memberAvatarsInline: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberAvatarMini: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberAvatarMiniText: {
    fontSize: 8,
    fontWeight: '900',
    color: theme.colors.textInverse,
  },
  memberCountMini: {
    backgroundColor: theme.colors.textSecondary,
    marginLeft: -8,
  },
  memberCountMiniText: {
    fontSize: 9,
    fontWeight: '800',
    color: theme.colors.textInverse,
  },

  // Chat FAB - Clean Modern Style
  journeyFab: {
    position: 'absolute',
    bottom: BOTTOM_SHEET_MIN_HEIGHT + 16,
    left: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#10B981',
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 1000,
  },
  journeyFabIcon: {
    fontSize: 18,
  },
  journeyFabLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  chatFab: {
    position: 'absolute',
    bottom: BOTTOM_SHEET_MIN_HEIGHT + 16,
    right: 16,
    width: 56,
    height: 56,
    backgroundColor: '#1F2937',
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 1000,
  },
  chatFabIcon: {
    fontSize: 24,
  },

  // Bottom Sheet - Clean Modern Style
  bottomSheet: {
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
  },
  sheetHandleArea: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
  },
  
  // Sneak Peek - Clean Modern Style
  sneakPeek: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  sneakPeekHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 16,
  },
  sneakPeekTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1F2937',
    marginRight: 8,
  },
  sneakPeekCount: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  sneakPeekStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
  },
  statPillText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
  },

  // Expanded List - Clean Modern Style
  expandedContent: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  expandedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  expandedTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    letterSpacing: -0.5,
  },
  closeExpandedButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeExpandedText: {
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
  clearSearchText: {
    fontSize: 14,
    color: '#9CA3AF',
    padding: 4,
  },
  chipScrollView: {
    maxHeight: 44,
    marginBottom: 12,
  },
  chipContainer: {
    paddingHorizontal: 20,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#1F2937',
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  // Places List
  placesScrollView: {
    flex: 1,
  },
  placesScrollContent: {
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
  // Place Card
  placeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
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
    marginRight: 8,
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
  placeChevron: {
    fontSize: 20,
    color: '#9CA3AF',
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
  },

  // Place Card (when marker clicked)
  placeCardContainer: {
    position: 'absolute',
    bottom: BOTTOM_SHEET_MIN_HEIGHT,
    left: 0,
    right: 0,
    height: screenHeight * 0.6,
    zIndex: 500,
  },
  closeCardBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 8,
    zIndex: 1,
  },
  closeCardText: {
    fontSize: 24,
    color: '#94A3B8',
    fontWeight: '600',
  },
  placeCardEmoji: {
    fontSize: 48,
    marginBottom: 12,
    textAlign: 'center',
  },
  placeCardName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  placeCardLocation: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 8,
    textAlign: 'center',
  },
  placeCardAddedBy: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 12,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  placeCardDescription: {
    fontSize: 14,
    color: '#CBD5E1',
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 16,
  },
  placeCardActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  checkInButton: {
    flex: 1,
    backgroundColor: theme.colors.success,
    paddingVertical: 12,
    borderWidth: 2,
    borderColor: theme.colors.borderDark,
    alignItems: 'center',
    ...theme.shadows.neopop.sm,
  },
  checkInButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.textInverse,
  },
  checkedInBadge: {
    flex: 1,
    backgroundColor: theme.categoryColors?.activity?.bg || '#ECFDF5',
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.success,
  },
  checkedInBadgeText: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.success,
  },
  navigateButton: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    paddingVertical: 12,
    borderWidth: 2,
    borderColor: theme.colors.borderDark,
    alignItems: 'center',
    ...theme.shadows.neopop.sm,
  },
  navigateButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.textInverse,
  },

  // Chat Modal - NeoPOP Style
  chatModalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    zIndex: 2000,
  },
  chatModalKeyboard: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  chatModal: {
    backgroundColor: theme.colors.surface,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderRightWidth: 3,
    borderColor: theme.colors.borderDark,
    height: screenHeight * 0.75,
  },
  chatModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.backgroundAlt,
  },
  chatModalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  closeButtonText: {
    fontSize: 28,
    color: theme.colors.textSecondary,
  },
  chatMessages: {
    flex: 1,
    padding: 16,
    backgroundColor: theme.colors.background,
  },
  chatBubble: {
    marginBottom: 12,
    padding: 12,
    maxWidth: '80%',
    borderWidth: 2,
    borderColor: theme.colors.borderDark,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: theme.colors.primary,
    ...theme.shadows.neopop.sm,
  },
  aiBubble: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.backgroundAlt,
  },
  chatBubbleText: {
    fontSize: 15,
    color: theme.colors.textPrimary,
    lineHeight: 20,
  },
  userBubbleText: {
    color: theme.colors.textInverse,
  },
  chatInputContainer: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 2,
    borderTopColor: theme.colors.border,
    alignItems: 'flex-end',
    backgroundColor: theme.colors.surface,
  },
  chatTextInput: {
    flex: 1,
    backgroundColor: theme.colors.background,
    borderWidth: 2,
    borderColor: theme.colors.borderDark,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
    fontSize: 15,
    color: theme.colors.textPrimary,
    maxHeight: 100,
  },
  chatSendButton: {
    width: 48,
    height: 48,
    backgroundColor: theme.colors.primary,
    borderWidth: 3,
    borderColor: theme.colors.borderDark,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.neopop.sm,
  },
  chatSendButtonDisabled: {
    opacity: 0.5,
  },
  chatSendButtonText: {
    fontSize: 20,
    color: theme.colors.textInverse,
    fontWeight: '800',
  },

  // Share Invite Modal - Modern NeoPOP Style
  shareInviteOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    zIndex: 4000,
  },
  shareInviteBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  shareInviteModal: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    paddingHorizontal: 20,
    paddingBottom: 40,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderRightWidth: 3,
    borderColor: theme.colors.borderDark,
  },
  shareInviteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.border,
    marginBottom: 20,
  },
  shareInviteTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: theme.colors.textPrimary,
  },
  shareInviteCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  shareInviteCloseBtnText: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  inviteCodeContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  inviteCodeLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.textSecondary,
    letterSpacing: 2,
    marginBottom: 8,
  },
  inviteCodeBox: {
    backgroundColor: theme.colors.primaryLight,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: theme.colors.primary,
    marginBottom: 8,
  },
  inviteCodeText: {
    fontSize: 32,
    fontWeight: '900',
    color: theme.colors.primary,
    letterSpacing: 6,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  inviteCodeHint: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  shareInviteActions: {
    gap: 12,
  },
  shareInviteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  shareInviteBtnPrimary: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.borderDark,
    borderWidth: 3,
    ...theme.shadows.neopop.sm,
  },
  shareInviteBtnIcon: {
    fontSize: 24,
    marginRight: 16,
  },
  shareInviteBtnContent: {
    flex: 1,
  },
  shareInviteBtnTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  shareInviteBtnTitlePrimary: {
    color: theme.colors.textInverse,
  },
  shareInviteBtnSubtitle: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  shareInviteBtnSubtitlePrimary: {
    color: 'rgba(255, 255, 255, 0.8)',
  },

  // Share Story Modal - NeoPOP Style
  shareStoryOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 3000,
  },
  shareStoryModal: {
    backgroundColor: theme.colors.surface,
    padding: 24,
    width: screenWidth * 0.9,
    borderWidth: 3,
    borderColor: theme.colors.borderDark,
    ...theme.shadows.neopop.lg,
  },
  shareStoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  shareStoryTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: theme.colors.textPrimary,
  },
  shareStoryInfo: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    lineHeight: 22,
    marginBottom: 24,
    textAlign: 'center',
  },
  shareStoryStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 24,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 32,
    fontWeight: '900',
    color: theme.colors.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  createStoryButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 16,
    borderWidth: 3,
    borderColor: theme.colors.borderDark,
    alignItems: 'center',
    marginBottom: 12,
    ...theme.shadows.neopop.md,
  },
  createStoryButtonText: {
    fontSize: 17,
    fontWeight: '900',
    color: theme.colors.textInverse,
  },
  shareStoryHint: {
    fontSize: 13,
    color: theme.colors.textTertiary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
