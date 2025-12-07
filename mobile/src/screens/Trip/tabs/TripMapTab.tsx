import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Text,
  TouchableOpacity,
} from 'react-native';
import { useItemStore } from '../../../stores/itemStore';
import { useLocationStore } from '../../../stores/locationStore';
import { useTripStore } from '../../../stores/tripStore';
import { useCheckInStore } from '../../../stores/checkInStore';
import { MapView, MapViewRef } from '../../../components/MapView';
import { PlaceListDrawer } from '../../../components/PlaceListDrawer';
import { SavedItem, ItemCategory } from '../../../types';
import { HapticFeedback } from '../../../utils/haptics';
import theme from '../../../config/theme';

interface TripMapTabProps {
  tripId: string;
  navigation: any;
}

export default function TripMapTab({ tripId, navigation }: TripMapTabProps) {
  const { items, fetchTripItems, toggleFavorite, toggleMustVisit, deleteItem, assignItemToDay, updateNotes, isLoading } = useItemStore();
  const { location } = useLocationStore();
  const { currentTrip, currentTripMembers } = useTripStore();
  const { isPlaceCheckedIn, createCheckIn, fetchCheckIns } = useCheckInStore();
  
  const [selectedPlace, setSelectedPlace] = useState<SavedItem | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'food' | 'accommodation' | 'place' | 'shopping' | 'activity' | 'tip'>('all');
  const [drawerItems, setDrawerItems] = useState<SavedItem[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(true); // Open by default
  // Known destination coordinates
  const DESTINATION_COORDS: Record<string, { lat: number; lng: number }> = {
    'mumbai': { lat: 19.0760, lng: 72.8777 },
    'india': { lat: 20.5937, lng: 78.9629 },
    'tokyo': { lat: 35.6762, lng: 139.6503 },
    'japan': { lat: 36.2048, lng: 138.2529 },
    'paris': { lat: 48.8566, lng: 2.3522 },
    'france': { lat: 46.2276, lng: 2.2137 },
    'bangkok': { lat: 13.7563, lng: 100.5018 },
    'thailand': { lat: 15.8700, lng: 100.9925 },
    'london': { lat: 51.5074, lng: -0.1278 },
    'new york': { lat: 40.7128, lng: -74.0060 },
    'dubai': { lat: 25.2048, lng: 55.2708 },
    'singapore': { lat: 1.3521, lng: 103.8198 },
    'bali': { lat: -8.3405, lng: 115.0920 },
    'sydney': { lat: -33.8688, lng: 151.2093 },
  };

  // Get region based on destination string
  const getRegionForDestination = (destination: string | undefined) => {
    if (destination) {
      const dest = destination.toLowerCase();
      for (const [key, coords] of Object.entries(DESTINATION_COORDS)) {
        if (dest.includes(key)) {
          return {
            latitude: coords.lat,
            longitude: coords.lng,
            latitudeDelta: 0.15,
            longitudeDelta: 0.15,
          };
        }
      }
    }
    return null;
  };

  // Get region based on items with coordinates
  const getRegionForItems = (itemsList: SavedItem[]) => {
    const itemsWithLocation = itemsList.filter(item => item.location_lat && item.location_lng);
    if (itemsWithLocation.length > 0) {
      const lats = itemsWithLocation.map(item => item.location_lat!);
      const lngs = itemsWithLocation.map(item => item.location_lng!);
      const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
      const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
      const latDelta = Math.max(0.08, (Math.max(...lats) - Math.min(...lats)) * 1.5);
      const lngDelta = Math.max(0.08, (Math.max(...lngs) - Math.min(...lngs)) * 1.5);
      
      return {
        latitude: centerLat,
        longitude: centerLng,
        latitudeDelta: latDelta,
        longitudeDelta: lngDelta,
      };
    }
    return null;
  };

  const [mapRegion, setMapRegion] = useState({
    latitude: 19.0760, // Default to Mumbai as fallback
    longitude: 72.8777,
    latitudeDelta: 0.15,
    longitudeDelta: 0.15,
  });
  const [regionSet, setRegionSet] = useState(false);
  
  const mapRef = useRef<MapViewRef>(null);

  useEffect(() => {
    const loadAndEnrichItems = async () => {
      await fetchTripItems(tripId, {});
      // Auto-enrich items that don't have Google data yet
      // This runs in background after items load
    };
    loadAndEnrichItems();
  }, [tripId]);

  // Priority: Items with coords > Trip destination > Default
  useEffect(() => {
    // First priority: center on items if they have coordinates
    if (items && items.length > 0) {
      const itemRegion = getRegionForItems(items);
      if (itemRegion) {
        console.log('[MapTab] Setting region from items:', itemRegion);
        setMapRegion(itemRegion);
        setRegionSet(true);
        return;
      }
    }
    
    // Second priority: use trip destination
    if (currentTrip?.destination && !regionSet) {
      const destRegion = getRegionForDestination(currentTrip.destination);
      if (destRegion) {
        console.log('[MapTab] Setting region from destination:', currentTrip.destination, destRegion);
        setMapRegion(destRegion);
        setRegionSet(true);
      }
    }
  }, [items, currentTrip?.destination]);

  // Keep drawer items synced with store items (for enrichment updates)
  useEffect(() => {
    if (items && items.length > 0) {
      // Always update drawer items when store items change (includes photo enrichment)
      setDrawerItems(items);
    }
  }, [items]);

  // Get user name from trip members
  const getUserName = (userId: string) => {
    const member = currentTripMembers?.find(m => m.id === userId);
    return member?.name || member?.email || 'Someone';
  };

  // Handle marker press on map
  const handleMarkerPress = (item: SavedItem) => {
    HapticFeedback.medium();
    setSelectedPlace(item);
    
    if (item.location_lat && item.location_lng && mapRef.current) {
      mapRef.current.animateToRegion(item.location_lat, item.location_lng, 15);
    }
  };

  // Handle cluster press - opens drawer with category items
  const handleClusterPress = (category: ItemCategory, clusterItems: SavedItem[]) => {
    HapticFeedback.medium();
    setSelectedCategory(category as any);
    setDrawerItems(clusterItems);
    setSelectedPlace(null);
    setIsDrawerOpen(true);
  };

  // Handle place select from drawer
  const handlePlaceSelectFromDrawer = (item: SavedItem) => {
    HapticFeedback.medium();
    setSelectedPlace(item);
    
    if (item.location_lat && item.location_lng && mapRef.current) {
      mapRef.current.animateToRegion(item.location_lat, item.location_lng, 15);
    }
  };

  // Back to list in drawer
  const handleBackToList = () => {
    HapticFeedback.light();
    setSelectedPlace(null);
  };

  // Close drawer
  const handleDrawerClose = () => {
    setSelectedPlace(null);
    setDrawerItems([]);
    setSelectedCategory('all');
    setIsDrawerOpen(false);
  };

  // Toggle favorite
  const handleToggleFavorite = async (place: SavedItem) => {
    try {
      HapticFeedback.light();
      const updatedPlace = await toggleFavorite(place.id);
      
      if (selectedPlace?.id === place.id) {
        setSelectedPlace(updatedPlace);
      }
      
      setDrawerItems(prev => prev.map(item => 
        item.id === place.id ? { ...item, is_favorite: updatedPlace.is_favorite } : item
      ));
    } catch (error) {
      console.error('Toggle favorite error:', error);
    }
  };

  // Toggle must visit
  const handleToggleMustVisit = async (place: SavedItem) => {
    try {
      HapticFeedback.medium();
      const updatedPlace = await toggleMustVisit(place.id);
      
      if (selectedPlace?.id === place.id) {
        setSelectedPlace(updatedPlace);
      }
      
      setDrawerItems(prev => prev.map(item => 
        item.id === place.id ? { ...item, is_must_visit: updatedPlace.is_must_visit } : item
      ));
    } catch (error) {
      console.error('Toggle must visit error:', error);
    }
  };

  // Delete item
  const handleDeleteItem = async (itemId: string) => {
    try {
      await deleteItem(itemId);
      setDrawerItems(prev => prev.filter(item => item.id !== itemId));
      if (selectedPlace?.id === itemId) {
        setSelectedPlace(null);
      }
    } catch (error) {
      console.error('Delete item error:', error);
    }
  };

  // Update notes
  const handleUpdateNotes = async (place: SavedItem, notes: string) => {
    try {
      await updateNotes(place.id, notes);
    } catch (error) {
      console.error('Update notes error:', error);
    }
  };

  // Assign to day
  const handleAssignToDay = async (place: SavedItem, day: number | null) => {
    try {
      await assignItemToDay(place.id, day);
    } catch (error) {
      console.error('Assign to day error:', error);
    }
  };

  // Instant check-in handler
  const handleCheckIn = async (place: SavedItem) => {
    HapticFeedback.success();
    try {
      await createCheckIn(tripId, { savedItemId: place.id });
      await fetchCheckIns(tripId);
    } catch (error) {
      console.error('Check-in error:', error);
    }
  };

  if (isLoading && (!items || items.length === 0)) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading map...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Full Screen Map */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          items={items || []}
          region={mapRegion}
          selectedPlace={selectedPlace}
          onMarkerPress={handleMarkerPress}
          onClusterPress={handleClusterPress}
        />
      </View>

      {/* Place List Drawer - Only shows when drawer is open */}
      {isDrawerOpen && (
        <PlaceListDrawer
          items={drawerItems}
          selectedCategory={selectedCategory}
          selectedPlace={selectedPlace}
          onPlaceSelect={handlePlaceSelectFromDrawer}
          onBackToList={handleBackToList}
          onClose={handleDrawerClose}
          onCheckIn={handleCheckIn}
          isPlaceCheckedIn={(placeId: string) => isPlaceCheckedIn(tripId, placeId)}
          getUserName={getUserName}
          onToggleFavorite={handleToggleFavorite}
          onToggleMustVisit={handleToggleMustVisit}
          onDeleteItem={handleDeleteItem}
          onUpdateNotes={handleUpdateNotes}
          userLocation={location?.coords ? { 
            latitude: location.coords.latitude, 
            longitude: location.coords.longitude 
          } : null}
          trip={currentTrip || undefined}
          onAssignToDay={handleAssignToDay}
        />
      )}

      {/* Floating button to reopen drawer when closed */}
      {!isDrawerOpen && (
        <TouchableOpacity
          style={styles.floatingButton}
          onPress={() => {
            setDrawerItems(items || []);
            setIsDrawerOpen(true);
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.floatingButtonIcon}>📍</Text>
          <Text style={styles.floatingButtonText}>{items?.length || 0} Places</Text>
        </TouchableOpacity>
      )}

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
  mapContainer: {
    flex: 1,
  },
  floatingButton: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    backgroundColor: '#1E293B',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  floatingButtonIcon: {
    fontSize: 16,
  },
  floatingButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
