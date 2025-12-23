/**
 * Category List Screen - Enhanced V2 Design
 * 
 * Shows list of places when user taps a bubble/sub-category
 * Features:
 * - Clean card design with photo, rating, distance
 * - Quick Check-in (2 second loading with cancel option)
 * - Directions button (opens Google Maps)
 * - Shows checked-in status
 * - AI Agent button at bottom
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  FlatList,
  Image,
  Linking,
  Platform,
  StatusBar,
  Modal,
  Animated,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import Mapbox, { MapView, Camera } from '@rnmapbox/maps';
import Constants from 'expo-constants';
import { SavedItem } from '../../types';
import { useLocationStore } from '../../stores/locationStore';
import { useCheckInStore } from '../../stores/checkInStore';
import { FloatingCloud } from '../../components/bubbles';

// Initialize Mapbox
const MAPBOX_TOKEN = Constants.expoConfig?.extra?.mapboxAccessToken || 
                     process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || '';
Mapbox.setAccessToken(MAPBOX_TOKEN);

// Mapbox style
const MAPBOX_STYLE = 'mapbox://styles/mapbox/navigation-night-v1';

// Country center coordinates for map
const COUNTRY_COORDS: Record<string, { lat: number; lng: number; zoom: number }> = {
  japan: { lat: 36.2048, lng: 138.2529, zoom: 5 },
  thailand: { lat: 15.8700, lng: 100.9925, zoom: 5 },
  korea: { lat: 35.9078, lng: 127.7669, zoom: 6 },
  vietnam: { lat: 14.0583, lng: 108.2772, zoom: 5 },
  singapore: { lat: 1.3521, lng: 103.8198, zoom: 10 },
  indonesia: { lat: -0.7893, lng: 113.9213, zoom: 4 },
  malaysia: { lat: 4.2105, lng: 101.9758, zoom: 5 },
  india: { lat: 20.5937, lng: 78.9629, zoom: 4 },
  china: { lat: 35.8617, lng: 104.1954, zoom: 4 },
  usa: { lat: 37.0902, lng: -95.7129, zoom: 3 },
  france: { lat: 46.2276, lng: 2.2137, zoom: 5 },
  italy: { lat: 41.8719, lng: 12.5674, zoom: 5 },
  spain: { lat: 40.4637, lng: -3.7492, zoom: 5 },
  uk: { lat: 55.3781, lng: -3.4360, zoom: 5 },
  australia: { lat: -25.2744, lng: 133.7751, zoom: 3 },
  default: { lat: 20, lng: 0, zoom: 2 },
};

// Area/City coordinates for focused map
const AREA_COORDS: Record<string, { lat: number; lng: number; zoom: number }> = {
  // Japan
  tokyo: { lat: 35.6762, lng: 139.6503, zoom: 11 },
  shibuya: { lat: 35.6580, lng: 139.7016, zoom: 14 },
  shinjuku: { lat: 35.6938, lng: 139.7034, zoom: 14 },
  osaka: { lat: 34.6937, lng: 135.5023, zoom: 11 },
  kyoto: { lat: 35.0116, lng: 135.7681, zoom: 12 },
  // Thailand
  bangkok: { lat: 13.7563, lng: 100.5018, zoom: 11 },
  chiangmai: { lat: 18.7883, lng: 98.9853, zoom: 12 },
  phuket: { lat: 7.8804, lng: 98.3923, zoom: 10 },
  // Korea
  seoul: { lat: 37.5665, lng: 126.9780, zoom: 11 },
  gangnam: { lat: 37.4979, lng: 127.0276, zoom: 14 },
  busan: { lat: 35.1796, lng: 129.0756, zoom: 11 },
  // Singapore
  orchard: { lat: 1.3048, lng: 103.8318, zoom: 14 },
  marinabay: { lat: 1.2834, lng: 103.8607, zoom: 14 },
  // Vietnam
  hanoi: { lat: 21.0285, lng: 105.8542, zoom: 12 },
  hochiminh: { lat: 10.8231, lng: 106.6297, zoom: 11 },
  // Indonesia
  bali: { lat: -8.4095, lng: 115.1889, zoom: 9 },
  ubud: { lat: -8.5069, lng: 115.2625, zoom: 13 },
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Category emoji mapping
const CATEGORY_EMOJIS: Record<string, string> = {
  ramen: '🍜',
  sushi: '🍣',
  food: '🍽️',
  cheesecake: '🍰',
  tempura: '🍤',
  yakitori: '🍢',
  wagyu: '🥩',
  curry: '🍛',
  udon: '🍜',
  matcha: '🍵',
  activity: '🎯',
  shopping: '🛍️',
  accommodation: '🏨',
  place: '📍',
  temple: '⛩️',
  shrine: '🛕',
  market: '🏪',
  park: '🌳',
  viewpoint: '🌄',
  museum: '🏛️',
};

// Category colors for tags
const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  food: { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA' },
  ramen: { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA' },
  sushi: { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA' },
  cheesecake: { bg: '#FDF4FF', text: '#A855F7', border: '#E9D5FF' },
  wagyu: { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA' },
  activity: { bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE' },
  shopping: { bg: '#FDF2F8', text: '#DB2777', border: '#FBCFE8' },
  place: { bg: '#F0FDF4', text: '#16A34A', border: '#BBF7D0' },
  temple: { bg: '#FFF7ED', text: '#EA580C', border: '#FED7AA' },
  shrine: { bg: '#FFF7ED', text: '#EA580C', border: '#FED7AA' },
  default: { bg: '#F3F4F6', text: '#4B5563', border: '#E5E7EB' },
};

interface RouteParams {
  tripId: string;
  countryName: string;
  categoryLabel: string;
  categoryType: string;
  items: SavedItem[];
  areaFilter?: string | null;
}

// Quick Check-in Popup Component
const CheckInPopup: React.FC<{
  visible: boolean;
  placeName: string;
  onCancel: () => void;
  onComplete: () => void;
}> = ({ visible, placeName, onCancel, onComplete }) => {
  const progressAnim = useRef(new Animated.Value(0)).current;
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (visible) {
      progressAnim.setValue(0);
      animationRef.current = Animated.timing(progressAnim, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: false,
      });
      
      animationRef.current.start(({ finished }) => {
        if (finished) {
          onComplete();
        }
      });
    } else {
      if (animationRef.current) {
        animationRef.current.stop();
      }
      progressAnim.setValue(0);
    }

    return () => {
      if (animationRef.current) {
        animationRef.current.stop();
      }
    };
  }, [visible]);

  const handleCancel = () => {
    if (animationRef.current) {
      animationRef.current.stop();
    }
    onCancel();
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="fade">
      <TouchableOpacity 
        style={styles.popupOverlay} 
        activeOpacity={1} 
        onPress={handleCancel}
      >
        <View style={styles.popupContainer}>
          {/* Icon */}
          <View style={styles.popupIconContainer}>
            <Ionicons name="location" size={28} color="#10B981" />
          </View>

          {/* Text */}
          <Text style={styles.popupTitle}>Checking you in...</Text>
          <Text style={styles.popupPlaceName} numberOfLines={2}>{placeName}</Text>

          {/* Progress bar */}
          <View style={styles.progressBarContainer}>
            <Animated.View 
              style={[styles.progressBarFill, { width: progressWidth }]} 
            />
          </View>

          {/* Cancel hint */}
          <Text style={styles.popupHint}>Tap anywhere to cancel</Text>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

// Success Toast Component
const SuccessToast: React.FC<{
  visible: boolean;
  placeName: string;
}> = ({ visible, placeName }) => {
  if (!visible) return null;

  return (
    <MotiView
      from={{ opacity: 0, translateY: 50, scale: 0.9 }}
      animate={{ opacity: 1, translateY: 0, scale: 1 }}
      exit={{ opacity: 0, translateY: 50 }}
      transition={{ type: 'spring', damping: 15 }}
      style={styles.successToast}
    >
      <View style={styles.successIconContainer}>
        <Ionicons name="checkmark-circle" size={24} color="#FFFFFF" />
      </View>
      <View style={styles.successTextContainer}>
        <Text style={styles.successTitle}>Checked in! 🎉</Text>
        <Text style={styles.successPlace} numberOfLines={1}>{placeName}</Text>
      </View>
    </MotiView>
  );
};

// Place card component
const PlaceCard: React.FC<{
  item: SavedItem;
  index: number;
  userLocation: { latitude: number; longitude: number } | null;
  onCheckIn: (item: SavedItem) => void;
  onDirections: (item: SavedItem) => void;
  isCheckedIn: boolean;
}> = ({ item, index, userLocation, onCheckIn, onDirections, isCheckedIn }) => {
  if (!item || typeof item !== 'object') {
    return null;
  }

  // Calculate distance
  const distance = useMemo(() => {
    if (!userLocation) return null;
    const lat = Number(item.location_lat);
    const lng = Number(item.location_lng);
    if (!lat || !lng || isNaN(lat) || isNaN(lng)) return null;
    
    const R = 6371;
    const dLat = toRad(lat - userLocation.latitude);
    const dLng = toRad(lng - userLocation.longitude);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(userLocation.latitude)) * Math.cos(toRad(lat)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c;
    return d < 1 ? `${Math.round(d * 1000)}m` : `${d.toFixed(1)}km`;
  }, [userLocation, item.location_lat, item.location_lng]);

  // Get photo URL
  const photoUrl = useMemo(() => {
    try {
      let photos = item.photos_json;
      if (typeof photos === 'string') {
        photos = JSON.parse(photos);
      }
      if (photos && Array.isArray(photos) && photos.length > 0) {
        const photo = photos[0];
        return photo?.url || photo?.photo_reference ? 
          `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${photo.photo_reference}&key=AIzaSyAiWhzrvdNb2NKSyzWpvNrhImz72I395Qo` 
          : null;
      }
    } catch (e) {
      console.warn('Error parsing photos_json:', e);
    }
    return null;
  }, [item.photos_json]);

  // Get category colors
  const getCategoryColors = () => {
    const type = (item.cuisine_type || item.place_type || item.category || 'default').toLowerCase();
    return CATEGORY_COLORS[type] || CATEGORY_COLORS.default;
  };

  const categoryColors = getCategoryColors();
  const categoryEmoji = CATEGORY_EMOJIS[(item.cuisine_type || item.place_type || '')?.toLowerCase()] || 
                        CATEGORY_EMOJIS[item.category?.toLowerCase()] || '📍';

  return (
    <MotiView
      from={{ opacity: 0, translateY: 30, scale: 0.95 }}
      animate={{ opacity: 1, translateY: 0, scale: 1 }}
      transition={{ type: 'spring', delay: index * 60, damping: 15 }}
    >
      <View style={styles.card}>
        {/* Checked-in badge */}
        {isCheckedIn && (
          <View style={styles.checkedBadge}>
            <Ionicons name="checkmark-circle" size={14} color="#10B981" />
            <Text style={styles.checkedBadgeText}>Visited</Text>
          </View>
        )}

        {/* Main content row */}
        <View style={styles.cardRow}>
          {/* Photo */}
          <View style={styles.photoContainer}>
            {photoUrl ? (
              <Image source={{ uri: photoUrl }} style={styles.photo} />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Text style={styles.placeholderEmoji}>{categoryEmoji}</Text>
              </View>
            )}
          </View>

          {/* Info */}
          <View style={styles.infoContainer}>
            {/* Name */}
            <Text style={styles.placeName} numberOfLines={2}>
              {item.name}
            </Text>

            {/* Rating + Distance row */}
            <View style={styles.metaRow}>
              {item.rating != null && Number(item.rating) > 0 && (
                <View style={styles.ratingBadge}>
                  <Ionicons name="star" size={12} color="#F59E0B" />
                  <Text style={styles.ratingText}>{Number(item.rating).toFixed(1)}</Text>
                  {item.user_ratings_total != null && Number(item.user_ratings_total) > 0 && (
                    <Text style={styles.reviewCount}>({item.user_ratings_total})</Text>
                  )}
                </View>
              )}
              
              {distance && (
                <View style={styles.distanceBadge}>
                  <Ionicons name="navigate" size={11} color="#6B7280" />
                  <Text style={styles.distanceText}>{distance}</Text>
                </View>
              )}
            </View>

            {/* Category tag */}
            <View style={[styles.categoryTag, { backgroundColor: categoryColors.bg, borderColor: categoryColors.border }]}>
              <Text style={styles.categoryEmoji}>{categoryEmoji}</Text>
              <Text style={[styles.categoryText, { color: categoryColors.text }]}>
                {item.cuisine_type || item.place_type || item.category || 'place'}
              </Text>
            </View>
          </View>
        </View>

        {/* Action buttons row */}
        <View style={styles.actionsRow}>
          {/* Directions button */}
          <TouchableOpacity 
            style={styles.directionsButton}
            onPress={() => onDirections(item)}
            activeOpacity={0.7}
          >
            <Ionicons name="navigate" size={16} color="#2563EB" />
            <Text style={styles.directionsText}>Directions</Text>
          </TouchableOpacity>

          {/* Check-in button */}
          <TouchableOpacity 
            onPress={() => !isCheckedIn && onCheckIn(item)}
            activeOpacity={0.7}
            disabled={isCheckedIn}
          >
            {isCheckedIn ? (
              <View style={styles.checkedInButton}>
                <Ionicons name="checkmark" size={16} color="#10B981" />
                <Text style={styles.checkedInText}>Checked In</Text>
              </View>
            ) : (
              <LinearGradient
                colors={['#10B981', '#059669']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.checkInButton}
              >
                <Ionicons name="location" size={16} color="#FFFFFF" />
                <Text style={styles.checkInText}>Check In</Text>
              </LinearGradient>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </MotiView>
  );
};

export default function CategoryListScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
  
  // State
  const [checkingInPlace, setCheckingInPlace] = useState<SavedItem | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successPlaceName, setSuccessPlaceName] = useState('');

  // Defensive extraction of route params
  const params = route.params || {};
  const tripId = params.tripId || '';
  const countryName = params.countryName || 'Unknown';
  const categoryLabel = params.categoryLabel || 'Places';
  const categoryType = params.categoryType || 'place';
  const areaFilter = params.areaFilter;

  // Get map coordinates based on area filter or country
  const mapCoords = useMemo(() => {
    // If there's an area filter, try to get area coordinates
    if (areaFilter) {
      const areaKey = areaFilter.toLowerCase().replace(/\s+/g, '');
      if (AREA_COORDS[areaKey]) {
        return AREA_COORDS[areaKey];
      }
    }
    // Fall back to country coordinates
    const countryKey = countryName.toLowerCase();
    return COUNTRY_COORDS[countryKey] || COUNTRY_COORDS.default;
  }, [areaFilter, countryName]);
  
  // Stores
  const { location } = useLocationStore();
  const { fetchCheckIns, isPlaceCheckedIn, createCheckIn } = useCheckInStore();

  // Fetch check-ins on mount
  useEffect(() => {
    if (tripId) {
      fetchCheckIns(tripId);
    }
  }, [tripId]);

  const userLocation = location ? {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
  } : null;

  // Safely extract and validate items array
  const items = useMemo(() => {
    try {
      if (!params.items) return [];
      if (!Array.isArray(params.items)) return [];
      return params.items.filter((item: any) => item && typeof item === 'object' && item.id);
    } catch (error) {
      console.error('[CategoryList] Error processing items:', error);
      return [];
    }
  }, [params.items]);

  // Sort items by distance
  const sortedItems = useMemo(() => {
    if (!items || items.length === 0) return [];
    if (!userLocation) return items;
    return [...items].sort((a, b) => {
      const distA = calculateDistance(userLocation, a);
      const distB = calculateDistance(userLocation, b);
      return distA - distB;
    });
  }, [items, userLocation]);

  const handleBack = () => {
    navigation.goBack();
  };

  const handleCheckIn = (item: SavedItem) => {
    setCheckingInPlace(item);
  };

  const handleCheckInCancel = () => {
    setCheckingInPlace(null);
  };

  const handleCheckInComplete = async () => {
    if (!checkingInPlace) return;
    
    const placeName = checkingInPlace.name;
    
    // Actually create the check-in
    try {
      await createCheckIn(tripId, {
        savedItemId: checkingInPlace.id,
      });
      
      // Show success toast
      setSuccessPlaceName(placeName);
      setShowSuccess(true);
      
      // Refresh check-ins
      fetchCheckIns(tripId);
      
      // Hide success after 2.5 seconds
      setTimeout(() => {
        setShowSuccess(false);
      }, 2500);
    } catch (error) {
      console.error('Check-in failed:', error);
    }
    
    setCheckingInPlace(null);
  };

  const handleDirections = (item: SavedItem) => {
    if (item.location_lat && item.location_lng) {
      const url = Platform.select({
        ios: `maps://app?daddr=${item.location_lat},${item.location_lng}`,
        android: `google.navigation:q=${item.location_lat},${item.location_lng}`,
        default: `https://www.google.com/maps/dir/?api=1&destination=${item.location_lat},${item.location_lng}`,
      });
      Linking.openURL(url).catch(() => {
        Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${item.location_lat},${item.location_lng}`);
      });
    }
  };

  const handleAgentPress = () => {
    if (tripId) {
      navigation.navigate('AgentChat', { tripId, countryName });
    }
  };

  // Get category emoji
  const categoryEmoji = CATEGORY_EMOJIS[categoryLabel?.toLowerCase?.()] || '📍';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Mapbox Background (non-interactive, just aesthetic) */}
      <MapView
        style={StyleSheet.absoluteFill}
        styleURL={MAPBOX_STYLE}
        logoEnabled={false}
        attributionEnabled={false}
        compassEnabled={false}
        scaleBarEnabled={false}
        scrollEnabled={false}
        zoomEnabled={false}
        pitchEnabled={false}
        rotateEnabled={false}
      >
        <Camera
          centerCoordinate={[mapCoords.lng, mapCoords.lat]}
          zoomLevel={mapCoords.zoom}
          animationDuration={0}
        />
      </MapView>

      {/* Dark gradient overlay for readability */}
      <LinearGradient
        colors={['rgba(10, 10, 26, 0.7)', 'rgba(10, 10, 26, 0.4)', 'rgba(10, 10, 26, 0.6)']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* Floating Clouds */}
      <FloatingCloud color="purple" size={180} position={{ x: 85, y: 12 }} delay={0} />
      <FloatingCloud color="blue" size={140} position={{ x: 5, y: 65 }} delay={1.5} />

      {/* Header */}
      <View style={styles.header}>
        <MotiView
          from={{ opacity: 0, translateX: -20 }}
          animate={{ opacity: 1, translateX: 0 }}
        >
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </MotiView>

        <MotiView
          from={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 100 }}
          style={styles.headerCenter}
        >
          <Text style={styles.headerEmoji}>{categoryEmoji}</Text>
          <View>
            <Text style={styles.headerTitle}>{categoryLabel}</Text>
            <Text style={styles.headerSubtitle}>{sortedItems.length} places nearby</Text>
          </View>
        </MotiView>

        <View style={styles.headerSpacer} />
      </View>

      {/* List */}
      <FlatList
        data={sortedItems}
        keyExtractor={(item, index) => item?.id || `item-${index}`}
        renderItem={({ item, index }) => (
          <PlaceCard
            item={item}
            index={index}
            userLocation={userLocation}
            onCheckIn={handleCheckIn}
            onDirections={handleDirections}
            isCheckedIn={isPlaceCheckedIn(tripId, item.id)}
          />
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={() => (
          <MotiView
            from={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            style={styles.emptyState}
          >
            <Text style={styles.emptyEmoji}>🔍</Text>
            <Text style={styles.emptyTitle}>No places found</Text>
            <Text style={styles.emptySubtitle}>Share some content to save places!</Text>
          </MotiView>
        )}
      />

      {/* AI Agent Button */}
      <MotiView
        from={{ translateY: 100, opacity: 0 }}
        animate={{ translateY: 0, opacity: 1 }}
        transition={{ type: 'spring', delay: 300, damping: 15 }}
        style={styles.agentContainer}
      >
        <TouchableOpacity onPress={handleAgentPress} activeOpacity={0.9}>
          <LinearGradient
            colors={['#8B5CF6', '#6366F1']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.agentButton}
          >
            <View style={styles.agentIconContainer}>
              <Ionicons name="sparkles" size={16} color="#FFFFFF" />
            </View>
            <Text style={styles.agentText}>Ask AI Agent</Text>
            <MotiView
              from={{ scale: 1, opacity: 0.8 }}
              animate={{ scale: 1.3, opacity: 0.4 }}
              transition={{
                type: 'timing',
                duration: 1200,
                loop: true,
              }}
              style={styles.agentPulse}
            />
          </LinearGradient>
        </TouchableOpacity>
      </MotiView>

      {/* Quick Check-in Popup */}
      <CheckInPopup
        visible={checkingInPlace !== null}
        placeName={checkingInPlace?.name || ''}
        onCancel={handleCheckInCancel}
        onComplete={handleCheckInComplete}
      />

      {/* Success Toast */}
      <SuccessToast visible={showSuccess} placeName={successPlaceName} />
    </View>
  );
}

// Helper functions
function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

function calculateDistance(
  userLocation: { latitude: number; longitude: number },
  item: SavedItem
): number {
  if (!item.location_lat || !item.location_lng) return Infinity;
  const R = 6371;
  const dLat = toRad(Number(item.location_lat) - userLocation.latitude);
  const dLng = toRad(Number(item.location_lng) - userLocation.longitude);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(userLocation.latitude)) * Math.cos(toRad(Number(item.location_lat))) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a1a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 60 : 48,
    paddingHorizontal: 20,
    paddingBottom: 16,
    zIndex: 10,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 16,
  },
  headerEmoji: {
    fontSize: 32,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 2,
  },
  headerSpacer: {
    width: 44,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 120,
  },
  
  // Card styles - glassmorphic dark theme
  card: {
    backgroundColor: 'rgba(30, 41, 59, 0.85)',
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)',
  },
  checkedBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    zIndex: 1,
  },
  checkedBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#10B981',
    marginLeft: 4,
  },
  cardRow: {
    flexDirection: 'row',
  },
  photoContainer: {
    width: 88,
    height: 88,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
  },
  placeholderEmoji: {
    fontSize: 32,
  },
  infoContainer: {
    flex: 1,
    marginLeft: 14,
    justifyContent: 'center',
  },
  placeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    lineHeight: 22,
    marginBottom: 6,
    paddingRight: 50,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 8,
    gap: 8,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FCD34D',
    marginLeft: 4,
  },
  reviewCount: {
    fontSize: 11,
    color: '#FCD34D',
    marginLeft: 2,
    opacity: 0.8,
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  distanceText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    marginLeft: 4,
    fontWeight: '500',
  },
  categoryTag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
  },
  categoryEmoji: {
    fontSize: 12,
    marginRight: 5,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },

  // Actions row
  actionsRow: {
    flexDirection: 'row',
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    gap: 10,
  },
  directionsButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  directionsText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563EB',
    marginLeft: 6,
  },
  checkInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  checkInText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 6,
  },
  checkedInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ECFDF5',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  checkedInText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
    marginLeft: 6,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyEmoji: {
    fontSize: 56,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
  },

  // AI Agent button
  agentContainer: {
    position: 'absolute',
    bottom: 32,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 20,
  },
  agentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 28,
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },
  agentIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  agentText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  agentPulse: {
    position: 'absolute',
    right: 16,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },

  // Check-in popup
  popupOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  popupContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 32,
    width: SCREEN_WIDTH - 64,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 30,
    elevation: 20,
  },
  popupIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  popupTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  popupPlaceName: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  progressBarContainer: {
    width: '100%',
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 20,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 3,
  },
  popupHint: {
    fontSize: 13,
    color: '#9CA3AF',
  },

  // Success toast
  successToast: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    backgroundColor: '#10B981',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  successIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  successTextContainer: {
    flex: 1,
  },
  successTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  successPlace: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
});
