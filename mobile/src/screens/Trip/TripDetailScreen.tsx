import React, { useEffect, useState } from 'react';
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
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [checkInPlace, setCheckInPlace] = useState<any>(null);
  const [drawerItems, setDrawerItems] = useState<any[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'map' | 'planner'>('map');
  const [mapDisplayMode, setMapDisplayMode] = useState<'markers' | 'heatmap' | 'photos'>('markers');
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
        await startBackgroundTracking(tripId);
      } catch (error) {
        console.error('[TripDetail] Error initializing location features:', error);
      }
    };
    initializeLocationFeatures();
    return () => {
      stopBackgroundTracking();
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
  let filteredItems = selectedCategory === 'all' 
    ? items 
    : items.filter(i => i.category === selectedCategory);
  
  if (showOnlyCheckedIn) {
    filteredItems = filteredItems.filter(i => isPlaceCheckedIn(tripId, i.id));
  }

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
              displayMode={mapDisplayMode}
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
            
            {/* Map Display Mode Toggle */}
            <View style={styles.mapModeToggle}>
              <TouchableOpacity
                style={[styles.mapModeButton, mapDisplayMode === 'markers' && styles.mapModeButtonActive]}
                onPress={() => setMapDisplayMode('markers')}
              >
                <Text style={[styles.mapModeIcon, mapDisplayMode === 'markers' && styles.mapModeIconActive]}>📍</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.mapModeButton, mapDisplayMode === 'heatmap' && styles.mapModeButtonActive]}
                onPress={() => setMapDisplayMode('heatmap')}
              >
                <Text style={[styles.mapModeIcon, mapDisplayMode === 'heatmap' && styles.mapModeIconActive]}>🔥</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.mapModeButton, mapDisplayMode === 'photos' && styles.mapModeButtonActive]}
                onPress={() => setMapDisplayMode('photos')}
              >
                <Text style={[styles.mapModeIcon, mapDisplayMode === 'photos' && styles.mapModeIconActive]}>📷</Text>
              </TouchableOpacity>
            </View>
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

      {/* FLOATING TOP CONTROLS (Z-Index 10) */}
      {viewMode === 'map' ? (
        // MAP VIEW HEADER - Full header with trip info
        <View style={styles.topControls}>
          {/* Back Button */}
          <MotiView
            from={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', delay: 100 }}
          >
            <TouchableOpacity 
            style={styles.floatingButton} 
            onPress={() => {
              HapticFeedback.medium();
              navigation.goBack();
            }}
          >
              <Text style={styles.floatingButtonText}>←</Text>
            </TouchableOpacity>
          </MotiView>

          {/* Trip Name Pill with Members */}
          <TouchableOpacity 
            onPress={() => {
              HapticFeedback.medium();
              navigation.navigate('GroupChat', { tripId });
            }}
            activeOpacity={0.9}
          >
            <MotiView
              from={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', delay: 200 }}
              style={styles.tripPill}
            >
              <Text style={styles.tripPillText}>{currentTrip.name}</Text>
              <Text style={styles.tripPillSubtext}>📍 {currentTrip.destination}</Text>
              
              {/* Member Avatars Row */}
              <View style={styles.memberAvatarsRow}>
                {currentTripMembers?.slice(0, 4).map((member, index) => (
                  <View 
                    key={member.id}
                    style={[
                      styles.memberAvatarMini,
                      { 
                        marginLeft: index > 0 ? -8 : 0,
                        backgroundColor: ['#2563EB', '#10B981', '#F59E0B', '#EC4899'][index % 4],
                        zIndex: 10 - index,
                      }
                    ]}
                  >
                    <Text style={styles.memberAvatarMiniText}>
                      {member.name?.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)}
                    </Text>
                  </View>
                ))}
                {(currentTripMembers?.length || 0) > 4 && (
                  <View style={[styles.memberAvatarMini, styles.memberCountMini]}>
                    <Text style={styles.memberCountMiniText}>+{(currentTripMembers?.length || 0) - 4}</Text>
                  </View>
                )}
              </View>
            </MotiView>
            
            {/* XP Badge */}
            <MotiView
              from={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', delay: 400 }}
              style={styles.xpBadge}
            >
              <Text style={styles.xpBadgeText}>⭐ Lv.{level}</Text>
            </MotiView>
          </TouchableOpacity>

          {/* View Toggle + Share Button */}
          <View style={styles.headerRightButtons}>
            {/* View Toggle */}
            <MotiView
              from={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', delay: 250 }}
            >
              <TouchableOpacity
                style={[
                  styles.viewToggleButton,
                  viewMode === 'planner' && styles.viewToggleButtonActive,
                ]}
                onPress={() => {
                  HapticFeedback.medium();
                  setViewMode(viewMode === 'map' ? 'planner' : 'map');
                  // Close drawer when switching views
                  if (isDrawerOpen) {
                    handleDrawerClose();
                  }
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.viewToggleText}>
                  {viewMode === 'map' ? '📅' : '🗺️'}
                </Text>
              </TouchableOpacity>
            </MotiView>

            {/* Share Button */}
            <MotiView
              from={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', delay: 300 }}
            >
              <TouchableOpacity 
                style={styles.floatingButton}
                onPress={async () => {
                  HapticFeedback.medium();
                  
                  const inviteLink = `https://travelagent.app/join/${currentTrip.invite_code}`;
                  const shareMessage = `Join my trip "${currentTrip.name}" to ${currentTrip.destination}!\n\n${inviteLink}`;
                  
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
                <Text style={styles.floatingButtonText}>↗</Text>
              </TouchableOpacity>
            </MotiView>
          </View>
        </View>
      ) : (
        // PLANNER VIEW HEADER - Simple header with just back and map buttons
        <View style={styles.plannerHeader}>
          <TouchableOpacity 
            style={styles.plannerHeaderButton} 
            onPress={() => {
              HapticFeedback.medium();
              navigation.goBack();
            }}
          >
            <Text style={styles.plannerHeaderButtonText}>←</Text>
          </TouchableOpacity>
          
          <View style={styles.plannerHeaderCenter}>
            <Text style={styles.plannerHeaderTitle}>📅 Day Planner</Text>
            <Text style={styles.plannerHeaderSubtitle}>{currentTrip.name}</Text>
          </View>
          
          <TouchableOpacity 
            style={styles.plannerHeaderButton}
            onPress={() => {
              HapticFeedback.medium();
              setViewMode('map');
            }}
          >
            <Text style={styles.plannerHeaderButtonText}>🗺️</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* GROUP CHAT BUTTON (FAB) - Only in map view */}
      {viewMode === 'map' && (
        <MotiView
          from={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', delay: 500, damping: 12 }}
          style={styles.magicButton}
          pointerEvents="box-none"
        >
          <TouchableOpacity 
            style={styles.magicButtonInner}
            onPress={() => {
              HapticFeedback.heavy();
              navigation.navigate('GroupChat', { tripId });
            }}
            activeOpacity={0.8}
          >
            <MotiView
              from={{ scale: 1 }}
              animate={{ scale: 1.15 }}
              transition={{
                type: 'timing',
                duration: 2000,
                loop: true,
              }}
              style={[styles.magicGlow, { backgroundColor: theme.colors.primary }]}
            />
            <Text style={styles.magicButtonText}>💬</Text>
          </TouchableOpacity>
        </MotiView>
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

          {/* Sneak Peek (Collapsed) */}
          {!isExpanded && (
            <MotiView
              from={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ type: 'timing', duration: 300 }}
              style={styles.sneakPeek}
            >
              <Text style={styles.sneakPeekTitle}>{items.length} saved spots ✨</Text>
              <View style={styles.sneakPeekStats}>
                {foodCount > 0 && (
                  <View style={[styles.statBadge, { backgroundColor: 'rgba(244, 114, 182, 0.2)' }]}>
                    <Text style={styles.statBadgeText}>🍜 {foodCount}</Text>
                  </View>
                )}
                {placeCount > 0 && (
                  <View style={[styles.statBadge, { backgroundColor: 'rgba(6, 182, 212, 0.2)' }]}>
                    <Text style={styles.statBadgeText}>📍 {placeCount}</Text>
                  </View>
                )}
                {shoppingCount > 0 && (
                  <View style={[styles.statBadge, { backgroundColor: 'rgba(251, 191, 36, 0.2)' }]}>
                    <Text style={styles.statBadgeText}>🛍️ {shoppingCount}</Text>
                  </View>
                )}
                {activityCount > 0 && (
                  <View style={[styles.statBadge, { backgroundColor: 'rgba(132, 204, 22, 0.2)' }]}>
                    <Text style={styles.statBadgeText}>🎯 {activityCount}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.swipeHint}>Swipe up to explore →</Text>
            </MotiView>
          )}

          {/* Expanded List */}
          {isExpanded && (
            <View style={styles.expandedContent}>
              <View style={styles.expandedHeader}>
                <Text style={styles.expandedTitle}>Your Places 🗺️</Text>
                <TouchableOpacity
                  style={styles.shareStoryButton}
                  onPress={() => {
                    HapticFeedback.medium();
                    setShowShareStoryModal(true);
                  }}
                >
                  <Text style={styles.shareStoryButtonText}>📖 My Story</Text>
                </TouchableOpacity>
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
                  onPress={() => {
                    HapticFeedback.selection();
                    setSelectedCategory('all');
                  }}
                >
                  <Text style={[styles.filterChipText, selectedCategory === 'all' && styles.filterChipTextActive]}>
                    All ({items.length})
                  </Text>
                </TouchableOpacity>
                
                {foodCount > 0 && (
                  <TouchableOpacity
                    style={[styles.filterChip, selectedCategory === 'food' && styles.filterChipActive]}
                    onPress={() => {
                      HapticFeedback.selection();
                      setSelectedCategory('food');
                    }}
                  >
                    <Text style={[styles.filterChipText, selectedCategory === 'food' && styles.filterChipTextActive]}>
                      🍜 Food ({foodCount})
                    </Text>
                  </TouchableOpacity>
                )}
                
                {placeCount > 0 && (
                  <TouchableOpacity
                    style={[styles.filterChip, selectedCategory === 'place' && styles.filterChipActive]}
                    onPress={() => {
                      HapticFeedback.selection();
                      setSelectedCategory('place');
                    }}
                  >
                    <Text style={[styles.filterChipText, selectedCategory === 'place' && styles.filterChipTextActive]}>
                      📍 Places ({placeCount})
                    </Text>
                  </TouchableOpacity>
                )}
                
                {shoppingCount > 0 && (
                  <TouchableOpacity
                    style={[styles.filterChip, selectedCategory === 'shopping' && styles.filterChipActive]}
                    onPress={() => {
                      HapticFeedback.selection();
                      setSelectedCategory('shopping');
                    }}
                  >
                    <Text style={[styles.filterChipText, selectedCategory === 'shopping' && styles.filterChipTextActive]}>
                      🛍️ Shopping ({shoppingCount})
                    </Text>
                  </TouchableOpacity>
                )}
                
                {activityCount > 0 && (
                  <TouchableOpacity
                    style={[styles.filterChip, selectedCategory === 'activity' && styles.filterChipActive]}
                    onPress={() => {
                      HapticFeedback.selection();
                      setSelectedCategory('activity');
                    }}
                  >
                    <Text style={[styles.filterChipText, selectedCategory === 'activity' && styles.filterChipTextActive]}>
                      🎯 Activity ({activityCount})
                    </Text>
                  </TouchableOpacity>
                )}
                
                {accommodationCount > 0 && (
                  <TouchableOpacity
                    style={[styles.filterChip, selectedCategory === 'accommodation' && styles.filterChipActive]}
                    onPress={() => {
                      HapticFeedback.selection();
                      setSelectedCategory('accommodation');
                    }}
                  >
                    <Text style={[styles.filterChipText, selectedCategory === 'accommodation' && styles.filterChipTextActive]}>
                      🏨 Hotels ({accommodationCount})
                    </Text>
                  </TouchableOpacity>
                )}
                
                {/* Checked In Filter */}
                <TouchableOpacity
                  style={[styles.filterChip, showOnlyCheckedIn && styles.filterChipActive]}
                  onPress={() => {
                    HapticFeedback.selection();
                    setShowOnlyCheckedIn(!showOnlyCheckedIn);
                  }}
                >
                  <Text style={[styles.filterChipText, showOnlyCheckedIn && styles.filterChipTextActive]}>
                    ✓ Visited
                  </Text>
                </TouchableOpacity>
              </ScrollView>
              
              <FlatList
                data={filteredItems}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.listItem}
                    onPress={() => {
                      HapticFeedback.light();
                      setSelectedPlace(item);
                      setIsExpanded(false);
                      sheetHeight.value = withSpring(BOTTOM_SHEET_MIN_HEIGHT);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.listItemIconContainer}>
                      <Text style={styles.listItemEmoji}>
                        {item.category === 'food' ? '🍜' : 
                         item.category === 'place' ? '📍' :
                         item.category === 'shopping' ? '🛍️' :
                         item.category === 'activity' ? '🎯' :
                         item.category === 'accommodation' ? '🏨' : '💡'}
                      </Text>
                    </View>
                    <View style={styles.listItemInfo}>
                      <Text style={styles.listItemName}>{item.name}</Text>
                      <Text style={styles.listItemLocation}>{item.location_name || 'Location unknown'}</Text>
                    </View>
                    <Text style={styles.listItemArrow}>→</Text>
                  </TouchableOpacity>
                )}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.flatListContent}
              />
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
                <Text style={styles.chatModalTitle}>AI Assistant 🤖</Text>
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
  
  // Map Display Mode Toggle
  mapModeToggle: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: '50%',
    marginLeft: -72, // Half of total width (3 buttons * 48px / 2)
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderWidth: 3,
    borderColor: theme.colors.borderDark,
    ...theme.shadows.neopop.sm,
    zIndex: 100,
  },
  mapModeButton: {
    width: 48,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 2,
    borderRightColor: theme.colors.border,
  },
  mapModeButtonActive: {
    backgroundColor: theme.colors.primary,
  },
  mapModeIcon: {
    fontSize: 20,
  },
  mapModeIconActive: {
    // The icon will look the same but on primary background
  },
  
  // Top Floating Controls - NeoPOP Style
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
  floatingButton: {
    width: 48,
    height: 48,
    backgroundColor: theme.colors.surface,
    borderWidth: 3,
    borderColor: theme.colors.borderDark,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.neopop.sm,
  },
  floatingButtonText: {
    fontSize: 22,
    color: theme.colors.textPrimary,
    fontWeight: '800',
  },
  headerRightButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  viewToggleButton: {
    width: 48,
    height: 48,
    backgroundColor: theme.colors.surface,
    borderWidth: 3,
    borderColor: theme.colors.borderDark,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.neopop.sm,
  },
  viewToggleButtonActive: {
    backgroundColor: theme.colors.primary,
  },
  viewToggleText: {
    fontSize: 22,
  },
  plannerContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 100 : 80, // Below planner header
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
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: theme.colors.surface,
    borderWidth: 3,
    borderColor: theme.colors.borderDark,
    maxWidth: screenWidth * 0.5,
    ...theme.shadows.neopop.sm,
  },
  tripPillText: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  tripPillSubtext: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 2,
  },
  xpBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: theme.colors.success,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 2,
    borderColor: theme.colors.borderDark,
    ...theme.shadows.neopop.sm,
  },
  xpBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: theme.colors.textInverse,
  },

  // Member Avatars in Header
  memberAvatarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  memberAvatarMini: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberAvatarMiniText: {
    fontSize: 9,
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

  // Magic AI Button - NeoPOP Style
  magicButton: {
    position: 'absolute',
    bottom: BOTTOM_SHEET_MIN_HEIGHT + 20,
    right: 20,
    zIndex: 1000,
  },
  magicButtonInner: {
    width: 64,
    height: 64,
    backgroundColor: theme.colors.primary,
    borderWidth: 3,
    borderColor: theme.colors.borderDark,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.neopop.lg,
  },
  magicGlow: {
    position: 'absolute',
    width: 70,
    height: 70,
    opacity: 0.4,
  },
  magicButtonText: {
    fontSize: 28,
  },

  // Bottom Sheet - NeoPOP Style
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderRightWidth: 3,
    borderColor: theme.colors.borderDark,
    ...theme.shadows.soft.lg,
  },
  sheetHandleArea: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  sheetHandle: {
    width: 48,
    height: 6,
    backgroundColor: theme.colors.borderMedium,
    borderRadius: 3,
  },
  
  // Sneak Peek - NeoPOP Style
  sneakPeek: {
    paddingVertical: 8,
    paddingHorizontal: 24,
  },
  sneakPeekTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: theme.colors.textPrimary,
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  sneakPeekStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statBadge: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 2,
    borderColor: theme.colors.borderDark,
  },
  statBadgeText: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  swipeHint: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginTop: 12,
    textAlign: 'center',
  },

  // Expanded List - NeoPOP Style
  expandedContent: {
    height: BOTTOM_SHEET_MAX_HEIGHT - 50,
    paddingHorizontal: 4,
  },
  expandedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  expandedTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: theme.colors.textPrimary,
    letterSpacing: -0.5,
  },
  shareStoryButton: {
    backgroundColor: theme.colors.secondary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 2,
    borderColor: theme.colors.borderDark,
    ...theme.shadows.neopop.sm,
  },
  shareStoryButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  chipScrollView: {
    marginBottom: 16,
    maxHeight: 48,
  },
  chipContainer: {
    paddingHorizontal: 20,
    paddingVertical: 4,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: theme.colors.backgroundAlt,
    borderWidth: 2,
    borderColor: theme.colors.border,
    marginRight: 10,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.borderDark,
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  filterChipTextActive: {
    color: theme.colors.textInverse,
  },
  flatListContent: {
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: theme.colors.borderDark,
    ...theme.shadows.neopop.sm,
  },
  listItemIconContainer: {
    width: 48,
    height: 48,
    backgroundColor: theme.colors.primary,
    borderWidth: 2,
    borderColor: theme.colors.borderDark,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  listItemEmoji: {
    fontSize: 24,
  },
  listItemInfo: {
    flex: 1,
  },
  listItemName: {
    fontSize: 17,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  listItemLocation: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  listItemArrow: {
    fontSize: 20,
    color: theme.colors.primary,
    fontWeight: '800',
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
