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
import { MapView } from '../../components/MapView';
import { PlaceDetailCard } from '../../components/PlaceDetailCard';
import { PlaceListDrawer } from '../../components/PlaceListDrawer';
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

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const BOTTOM_SHEET_MIN_HEIGHT = 140;
const BOTTOM_SHEET_MAX_HEIGHT = screenHeight * 0.75;

export default function TripDetailScreen({ route, navigation }: any) {
  const { tripId } = route.params;
  const { currentTrip, currentTripMembers, fetchTripDetails, fetchTripMembers } = useTripStore();
  const { items, fetchTripItems } = useItemStore();
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
  const [selectedCategory, setSelectedCategory] = useState<ItemCategory | 'all'>('all');
  const [showOnlyCheckedIn, setShowOnlyCheckedIn] = useState(false);
  const [showShareStoryModal, setShowShareStoryModal] = useState(false);
  const [drawerItems, setDrawerItems] = useState<any[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const confettiRef = React.useRef<any>(null);
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
    // Map will show this place's marker on top of clusters
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
    try {
      HapticFeedback.success();
      
      const response = await api.post(`/trips/${tripId}/checkin`, {
        savedItemId: place.id,
        rating: 5,
        note: 'Checked in!',
      });
      
      if (response.data.success) {
        // Award XP for visiting
        addXP(XP_REWARDS.VISIT_PLACE);
        
        // Show confetti
        if (confettiRef.current) {
          confettiRef.current.start();
        }
        
        // Refresh items and check-ins to update status
        await fetchTripItems(tripId, {});
        await refreshCheckIns(tripId);
        
        Alert.alert('🎉 Checked In!', `You earned +${XP_REWARDS.VISIT_PLACE} XP!`);
        setSelectedPlace(null);
      }
    } catch (error: any) {
      console.error('Check-in error:', error);
      Alert.alert('Error', 'Failed to check in. Please try again.');
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
        <ActivityIndicator size="large" color="#A78BFA" />
        <Text style={styles.loadingText}>Loading your adventure...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      {/* FULL SCREEN MAP (Z-Index 0) */}
      <View style={styles.mapContainer}>
        <MapView
          items={items}
          region={mapRegion}
          selectedPlace={selectedPlace}
          onMarkerPress={(item) => {
            HapticFeedback.medium();
            setSelectedPlace(item);
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
        />
      )}

      {/* FLOATING TOP CONTROLS (Z-Index 10) */}
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

        {/* Trip Name Pill */}
        <View>
          <MotiView
            from={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', delay: 200 }}
            style={styles.tripPill}
          >
            <Text style={styles.tripPillText}>{currentTrip.name}</Text>
            <Text style={styles.tripPillSubtext}>📍 {currentTrip.destination}</Text>
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
        </View>

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

      {/* MAGIC AI BUTTON (FAB) */}
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
            setShowChatModal(true);
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
            style={[styles.magicGlow, { backgroundColor: '#A78BFA' }]}
          />
          <Text style={styles.magicButtonText}>✨</Text>
        </TouchableOpacity>
      </MotiView>

      {/* BOTTOM SHEET - SNEAK PEEK */}
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
    backgroundColor: '#0F172A',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#94A3B8',
    fontWeight: '600',
  },
  
  // Map
  mapContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  
  // Top Floating Controls
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
    borderRadius: 24,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  floatingButtonText: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  tripPill: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    maxWidth: screenWidth * 0.5,
  },
  tripPillText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  tripPillSubtext: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 2,
  },
  xpBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#10B981',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(15, 23, 42, 0.9)',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 8,
  },
  xpBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FFFFFF',
  },

  // Magic AI Button
  magicButton: {
    position: 'absolute',
    bottom: BOTTOM_SHEET_MIN_HEIGHT + 20,
    right: 20,
    zIndex: 1000,
  },
  magicButtonInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#8B5CF6',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 12,
  },
  magicGlow: {
    position: 'absolute',
    width: 70,
    height: 70,
    borderRadius: 35,
    opacity: 0.4,
  },
  magicButtonText: {
    fontSize: 28,
  },

  // Bottom Sheet
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(148, 163, 184, 0.2)',
  },
  sheetHandleArea: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  sheetHandle: {
    width: 40,
    height: 5,
    backgroundColor: '#475569',
    borderRadius: 3,
  },
  
  // Sneak Peek
  sneakPeek: {
    paddingVertical: 8,
    paddingHorizontal: 24,
  },
  sneakPeekTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
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
    borderRadius: 16,
  },
  statBadgeText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  swipeHint: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 12,
    textAlign: 'center',
  },

  // Expanded List
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
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  shareStoryButton: {
    backgroundColor: 'rgba(139, 92, 246, 0.3)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.5)',
  },
  shareStoryButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#A78BFA',
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
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: 'rgba(148, 163, 184, 0.2)',
    marginRight: 10,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterChipActive: {
    backgroundColor: '#8B5CF6',
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#94A3B8',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
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
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(139, 92, 246, 0.3)',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  listItemIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(139, 92, 246, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    borderWidth: 2,
    borderColor: 'rgba(167, 139, 250, 0.4)',
  },
  listItemEmoji: {
    fontSize: 28,
  },
  listItemInfo: {
    flex: 1,
  },
  listItemName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  listItemLocation: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '600',
  },
  listItemArrow: {
    fontSize: 22,
    color: '#A78BFA',
    fontWeight: '700',
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
    backgroundColor: '#10B981',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  checkInButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  checkedInBadge: {
    flex: 1,
    backgroundColor: 'rgba(16, 185, 129, 0.3)',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#10B981',
  },
  checkedInBadgeText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#10B981',
  },
  navigateButton: {
    flex: 1,
    backgroundColor: '#8B5CF6',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  navigateButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Chat Modal
  chatModalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    zIndex: 2000,
  },
  chatModalKeyboard: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  chatModal: {
    backgroundColor: 'rgba(15, 23, 42, 0.98)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: screenHeight * 0.75,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.3)',
  },
  chatModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.2)',
  },
  chatModalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  closeButtonText: {
    fontSize: 28,
    color: '#94A3B8',
  },
  chatMessages: {
    flex: 1,
    padding: 16,
  },
  chatBubble: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 16,
    maxWidth: '80%',
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#8B5CF6',
  },
  aiBubble: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(148, 163, 184, 0.2)',
  },
  chatBubbleText: {
    fontSize: 15,
    color: '#FFFFFF',
    lineHeight: 20,
  },
  userBubbleText: {
    color: '#FFFFFF',
  },
  chatInputContainer: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(148, 163, 184, 0.2)',
    alignItems: 'flex-end',
  },
  chatTextInput: {
    flex: 1,
    backgroundColor: 'rgba(148, 163, 184, 0.2)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
    fontSize: 15,
    color: '#FFFFFF',
    maxHeight: 100,
  },
  chatSendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#8B5CF6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatSendButtonDisabled: {
    opacity: 0.5,
  },
  chatSendButtonText: {
    fontSize: 20,
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // Share Story Modal
  shareStoryOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 3000,
  },
  shareStoryModal: {
    backgroundColor: 'rgba(15, 23, 42, 0.98)',
    borderRadius: 24,
    padding: 24,
    width: screenWidth * 0.9,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.3)',
  },
  shareStoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  shareStoryTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  shareStoryInfo: {
    fontSize: 15,
    color: '#CBD5E1',
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
    color: '#8B5CF6',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
  },
  createStoryButton: {
    backgroundColor: '#8B5CF6',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  createStoryButtonText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  shareStoryHint: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
