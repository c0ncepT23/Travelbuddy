/**
 * Category List Screen - V2 Figma Design
 * 
 * Shows list of places when user taps a bubble
 * Features:
 * - Dreamy pastel background with city grid
 * - Glassmorphic cards
 * - Check-in button (purple gradient)
 * - AI Agent pill at bottom
 */

import React, { useState, useMemo } from 'react';
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
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { SavedItem, ItemStatus } from '../../types';
import { useLocationStore } from '../../stores/locationStore';
import { FloatingCloud, MapBackground } from '../../components/bubbles';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Category emoji mapping
const CATEGORY_EMOJIS: Record<string, string> = {
  ramen: '🍜',
  sushi: '🍣',
  food: '🍽️',
  cheesecake: '🍰',
  tempura: '🍤',
  yakitori: '🍢',
  activity: '🎯',
  shopping: '🛍️',
  accommodation: '🏨',
  place: '📍',
  temple: '⛩️',
  shrine: '🛕',
};

interface RouteParams {
  tripId: string;
  countryName: string;
  categoryLabel: string;
  categoryType: string;
  items: SavedItem[];
}

// Place card component
const PlaceCard: React.FC<{
  item: SavedItem;
  index: number;
  userLocation: { latitude: number; longitude: number } | null;
  onCheckIn: (item: SavedItem) => void;
}> = ({ item, index, userLocation, onCheckIn }) => {
  // Defensive check - item must exist
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
    return d < 1 ? `${Math.round(d * 1000)}m away` : `${d.toFixed(1)}km away`;
  }, [userLocation, item.location_lat, item.location_lng]);

  // Get photo URL - defensive parsing
  const photoUrl = useMemo(() => {
    try {
      let photos = item.photos_json;
      // Parse if it's a string
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

  // Get category tag color
  const getCategoryColor = () => {
    const type = item.cuisine_type || item.place_type || item.category;
    return {
      bg: 'rgba(167, 243, 208, 0.6)',
      text: '#065F46',
    };
  };

  const tagColors = getCategoryColor();

  return (
    <MotiView
      from={{ opacity: 0, translateY: 20 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', delay: index * 80, duration: 400 }}
    >
      <View style={styles.card}>
        {/* Image */}
        <View style={styles.imageContainer}>
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={styles.image} />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Text style={styles.placeholderEmoji}>
                {CATEGORY_EMOJIS[item.cuisine_type?.toLowerCase() || ''] || '📍'}
              </Text>
            </View>
          )}
        </View>

        {/* Content */}
        <View style={styles.cardContent}>
          <Text style={styles.placeName} numberOfLines={2}>
            {item.name}
          </Text>
          
          <View style={styles.metaRow}>
            {item.rating != null && (
              <View style={styles.ratingContainer}>
                <Ionicons name="star" size={14} color="#FBBF24" />
                <Text style={styles.ratingText}>{Number(item.rating).toFixed(1)}</Text>
              </View>
            )}
            
            {distance && (
              <View style={styles.distanceContainer}>
                <Ionicons name="location-outline" size={12} color="#6B7280" />
                <Text style={styles.distanceText}>{distance}</Text>
              </View>
            )}
          </View>

          {/* Category tag */}
          <View style={[styles.categoryTag, { backgroundColor: tagColors.bg }]}>
            <Text style={[styles.categoryTagText, { color: tagColors.text }]}>
              {item.cuisine_type || item.place_type || item.category || 'place'}
            </Text>
          </View>
        </View>

        {/* Check-in button */}
        <TouchableOpacity onPress={() => onCheckIn(item)}>
          <LinearGradient
            colors={['#A78BFA', '#818CF8']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.checkInButton}
          >
            <Text style={styles.checkInText}>Check-in</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </MotiView>
  );
};

export default function CategoryListScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
  
  // Defensive extraction of route params
  const params = route.params || {};
  const tripId = params.tripId || '';
  const countryName = params.countryName || 'Unknown';
  const categoryLabel = params.categoryLabel || 'Places';
  const categoryType = params.categoryType || 'place';
  const items = Array.isArray(params.items) ? params.items : [];

  const { location } = useLocationStore();
  const userLocation = location ? {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
  } : null;

  // Sort items by distance (with defensive check)
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
    // TODO: Navigate to check-in flow
    console.log('Check in to:', item.name);
  };

  const handleAgentPress = () => {
    if (tripId) {
      navigation.navigate('GroupChat', { tripId });
    }
  };

  // Get category emoji (with defensive check)
  const categoryEmoji = CATEGORY_EMOJIS[categoryLabel?.toLowerCase?.()] || '📍';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* Gradient Background */}
      <LinearGradient
        colors={['#F5F3FF', '#EFF6FF', '#FAF5FF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Map Background - City view */}
      <MapBackground viewType="city" />

      {/* Floating Clouds */}
      <FloatingCloud color="purple" size={200} position={{ x: 85, y: 15 }} delay={0} />
      <FloatingCloud color="blue" size={180} position={{ x: 10, y: 60 }} delay={1} />
      <FloatingCloud color="pink" size={160} position={{ x: 90, y: 80 }} delay={2} />

      {/* Header */}
      <View style={styles.header}>
        <MotiView
          from={{ opacity: 0, translateX: -20 }}
          animate={{ opacity: 1, translateX: 0 }}
        >
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Ionicons name="arrow-back" size={20} color="#374151" />
          </TouchableOpacity>
        </MotiView>
      </View>

      {/* Title */}
      <MotiView
        from={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 100 }}
        style={styles.titleContainer}
      >
        <Text style={styles.title}>
          {categoryEmoji} {categoryLabel} Nearby
        </Text>
      </MotiView>

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
          />
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={() => (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🔍</Text>
            <Text style={styles.emptyText}>No places found</Text>
          </View>
        )}
      />

      {/* AI Agent Button */}
      <MotiView
        from={{ translateY: 100 }}
        animate={{ translateY: 0 }}
        transition={{ type: 'spring', delay: 300 }}
        style={styles.agentContainer}
      >
        <TouchableOpacity onPress={handleAgentPress}>
          <LinearGradient
            colors={['#A78BFA', '#818CF8']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.agentButton}
          >
            <Ionicons name="sparkles" size={18} color="#FFFFFF" />
            <Text style={styles.agentText}>AI Agent</Text>
            <MotiView
              from={{ scale: 1, opacity: 1 }}
              animate={{ scale: 1.2, opacity: 0.7 }}
              transition={{
                type: 'timing',
                duration: 1000,
                loop: true,
              }}
              style={styles.agentDot}
            />
          </LinearGradient>
        </TouchableOpacity>
      </MotiView>
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
  const dLat = toRad(item.location_lat - userLocation.latitude);
  const dLng = toRad(item.location_lng - userLocation.longitude);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(userLocation.latitude)) * Math.cos(toRad(item.location_lat)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 45,
    paddingHorizontal: 24,
    zIndex: 10,
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  titleContainer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '500',
    color: '#1F2937',
    letterSpacing: 0.3,
  },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 120,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: 24,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 5,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  imageContainer: {
    width: 96,
    height: 96,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  placeholderEmoji: {
    fontSize: 36,
  },
  cardContent: {
    flex: 1,
    marginLeft: 16,
  },
  placeName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  ratingText: {
    fontSize: 14,
    color: '#1F2937',
    marginLeft: 4,
  },
  distanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  distanceText: {
    fontSize: 13,
    color: '#6B7280',
    marginLeft: 4,
  },
  categoryTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryTagText: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  checkInButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  checkInText: {
    color: '#FFFFFF',
    fontWeight: '500',
    fontSize: 14,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
  },
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
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  agentText: {
    color: '#FFFFFF',
    fontWeight: '600',
    marginLeft: 8,
    marginRight: 8,
  },
  agentDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
});
