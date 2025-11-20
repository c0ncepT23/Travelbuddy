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
} from 'react-native';
import { useTripStore } from '../../stores/tripStore';
import { useItemStore } from '../../stores/itemStore';
import { useLocationStore } from '../../stores/locationStore';
import { MapView } from '../../components/MapView';
import { MotiView } from 'moti';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
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
  const { currentTrip, fetchTripDetails } = useTripStore();
  const { items, fetchTripItems } = useItemStore();
  const { initializeNotifications, startBackgroundTracking, stopBackgroundTracking } = useLocationStore();

  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [mapRegion, setMapRegion] = useState({
    latitude: 35.6762,
    longitude: 139.6503,
    latitudeDelta: 0.1,
    longitudeDelta: 0.1,
  });

  const sheetHeight = useSharedValue(BOTTOM_SHEET_MIN_HEIGHT);

  useEffect(() => {
    const loadTripData = async () => {
      try {
        setIsLoading(true);
        await fetchTripDetails(tripId);
        const loadedItems = await fetchTripItems(tripId, {});

        if (loadedItems.length > 0) {
          const validItems = loadedItems.filter(item => item.location_lat && item.location_lng);
          if (validItems.length > 0) {
            const avgLat = validItems.reduce((sum, item) => sum + (item.location_lat || 0), 0) / validItems.length;
            const avgLng = validItems.reduce((sum, item) => sum + (item.location_lng || 0), 0) / validItems.length;
            setMapRegion({
              latitude: avgLat,
              longitude: avgLng,
              latitudeDelta: 0.1,
              longitudeDelta: 0.1,
            });
          }
        }
        setIsLoading(false);
      } catch (error) {
        console.error('[TripDetail] Error loading trip:', error);
        setIsLoading(false);
      }
    };
    loadTripData();
  }, [tripId]);

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
          onMarkerPress={() => {}}
        />
      </View>

      {/* FLOATING TOP CONTROLS (Z-Index 10) */}
      <View style={styles.topControls}>
        {/* Back Button */}
        <MotiView
          from={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', delay: 100 }}
        >
          <TouchableOpacity style={styles.floatingButton} onPress={() => navigation.goBack()}>
            <Text style={styles.floatingButtonText}>←</Text>
          </TouchableOpacity>
        </MotiView>

        {/* Trip Name Pill */}
        <MotiView
          from={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', delay: 200 }}
          style={styles.tripPill}
        >
          <Text style={styles.tripPillText}>{currentTrip.name}</Text>
          <Text style={styles.tripPillSubtext}>📍 {currentTrip.destination}</Text>
        </MotiView>

        {/* Share Button */}
        <MotiView
          from={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', delay: 300 }}
        >
          <TouchableOpacity 
            style={styles.floatingButton}
            onPress={() => Alert.alert('Share', 'Share feature coming soon!')}
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
          onPress={() => Alert.alert('AI Assistant', 'Chat feature coming soon!')}
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
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.bottomSheet, bottomSheetStyle]}>
          {/* Swipe Handle */}
          <View style={styles.sheetHandle} />

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
              <Text style={styles.expandedTitle}>Your Places 🗺️</Text>
              <ScrollView style={styles.expandedScroll} showsVerticalScrollIndicator={false}>
                {items.map((item, index) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.listItem}
                    onPress={() => Alert.alert(item.name, item.description || 'No description')}
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
                ))}
              </ScrollView>
            </View>
          )}
        </Animated.View>
      </GestureDetector>
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
    backdropFilter: 'blur(10px)',
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
    backdropFilter: 'blur(10px)',
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
    backdropFilter: 'blur(20px)',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
    paddingHorizontal: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(148, 163, 184, 0.2)',
  },
  sheetHandle: {
    width: 40,
    height: 5,
    backgroundColor: '#475569',
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 20,
  },
  
  // Sneak Peek
  sneakPeek: {
    paddingVertical: 8,
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
    flex: 1,
    paddingBottom: 20,
  },
  expandedTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 20,
    letterSpacing: -0.5,
  },
  expandedScroll: {
    flex: 1,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(71, 85, 105, 0.3)',
  },
  listItemIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
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
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  listItemLocation: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '500',
  },
  listItemArrow: {
    fontSize: 20,
    color: '#64748B',
    fontWeight: '600',
  },
});
