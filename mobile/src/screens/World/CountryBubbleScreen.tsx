/**
 * Country Bubble Screen - V2 Figma Design
 * 
 * Features:
 * - Dreamy pastel gradient background
 * - Floating cloud decorations
 * - Map silhouette background
 * - Glassmorphic glowing bubbles
 * - Two views: Macro (categories) and Micro (subcategories)
 * - AI Agent pill button at bottom
 */

import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  StatusBar,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
} from 'react-native-reanimated';
import api from '../../config/api';
import { SavedItem, ItemCategory, SubClusters } from '../../types';
import { FloatingCloud, GlowingBubble, MapBackground } from '../../components/bubbles';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Country flag emojis
const COUNTRY_FLAGS: Record<string, string> = {
  japan: '🗾',
  korea: '🇰🇷',
  thailand: '🇹🇭',
  vietnam: '🇻🇳',
  singapore: '🇸🇬',
  indonesia: '🇮🇩',
  malaysia: '🇲🇾',
  india: '🇮🇳',
  china: '🇨🇳',
  usa: '🇺🇸',
  france: '🇫🇷',
  italy: '🇮🇹',
  spain: '🇪🇸',
  uk: '🇬🇧',
  australia: '🇦🇺',
};

// Bubble color mapping
const CATEGORY_COLORS: Record<string, 'green' | 'blue' | 'yellow' | 'purple' | 'pink' | 'orange'> = {
  food: 'green',
  activity: 'blue',
  shopping: 'yellow',
  accommodation: 'purple',
  place: 'blue',
  tip: 'pink',
};

// Subcategory colors for variety
const SUBCATEGORY_COLORS: ('green' | 'blue' | 'yellow' | 'purple' | 'pink' | 'orange')[] = [
  'green', 'blue', 'pink', 'orange', 'purple', 'yellow'
];

type ViewMode = 'macro' | 'micro';

interface RouteParams {
  tripId: string;
  countryName: string;
}

interface BubbleData {
  id: string;
  label: string;
  count: number;
  color: 'green' | 'blue' | 'yellow' | 'purple' | 'pink' | 'orange';
  position: { x: number; y: number };
  items: SavedItem[];
  category?: string;
}

export default function CountryBubbleScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
  
  // Defensive extraction of route params (for deep link access)
  const params = route.params || {};
  const tripId = params.tripId || '';
  const countryName = params.countryName || 'Unknown';

  const [isLoading, setIsLoading] = useState(true);
  const [items, setItems] = useState<SavedItem[]>([]);
  const [subClusters, setSubClusters] = useState<SubClusters | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('macro');
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  // Get country flag (safe - countryName has fallback)
  const countryFlag = COUNTRY_FLAGS[countryName.toLowerCase()] || '🌍';

  // Fetch data
  useEffect(() => {
    if (tripId) {
      fetchItems();
    } else {
      setIsLoading(false);
    }
  }, [tripId]);

  const fetchItems = async () => {
    // Guard against empty tripId to prevent malformed API URLs
    if (!tripId) {
      console.warn('[CountryBubbles] No tripId provided, skipping fetch');
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    try {
      console.log('[CountryBubbles] Fetching items for trip:', tripId);
      const itemsResponse = await api.get(`/trips/${tripId}/items`);
      const fetchedItems: SavedItem[] = itemsResponse.data.data || itemsResponse.data || [];
      console.log('[CountryBubbles] Fetched', fetchedItems.length, 'items');
      setItems(fetchedItems);

      try {
        const clustersResponse = await api.get(`/trips/${tripId}/items/sub-clusters`);
        setSubClusters(clustersResponse.data.data || clustersResponse.data);
      } catch (e) {
        console.log('[CountryBubbles] Sub-clusters not available');
        setSubClusters(null);
      }
    } catch (error) {
      console.error('[CountryBubbles] Fetch error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Generate MACRO bubbles (main categories: Food, Activities, Shopping)
  const macroBubbles = useMemo((): BubbleData[] => {
    if (items.length === 0) return [];

    const categoryGroups: Record<string, SavedItem[]> = {};
    items.forEach(item => {
      const cat = item.category || 'place';
      if (!categoryGroups[cat]) categoryGroups[cat] = [];
      categoryGroups[cat].push(item);
    });

    // Fixed positions for macro bubbles (matching Figma)
    const positions = [
      { x: 30, y: 35 },  // Food - left center
      { x: 70, y: 48 },  // Activities - right
      { x: 50, y: 68 },  // Shopping - bottom center
    ];

    const mainCategories = ['food', 'activity', 'shopping'];
    const bubbles: BubbleData[] = [];

    mainCategories.forEach((cat, index) => {
      const catItems = categoryGroups[cat] || [];
      // Also include related categories
      if (cat === 'activity') {
        const placeItems = categoryGroups['place'] || [];
        catItems.push(...placeItems);
      }
      
      if (catItems.length > 0 || Object.keys(categoryGroups).includes(cat)) {
        bubbles.push({
          id: `macro-${cat}`,
          label: cat.toUpperCase(),
          count: catItems.length,
          color: CATEGORY_COLORS[cat] || 'green',
          position: positions[index] || { x: 50, y: 50 },
          items: catItems,
          category: cat,
        });
      }
    });

    // Add any remaining categories
    Object.entries(categoryGroups).forEach(([cat, catItems]) => {
      if (!mainCategories.includes(cat) && catItems.length > 0) {
        bubbles.push({
          id: `macro-${cat}`,
          label: cat.toUpperCase(),
          count: catItems.length,
          color: CATEGORY_COLORS[cat] || 'purple',
          position: { x: 35 + Math.random() * 30, y: 55 + Math.random() * 20 },
          items: catItems,
          category: cat,
        });
      }
    });

    return bubbles;
  }, [items]);

  // Generate MICRO bubbles (subcategories: Ramen, Sushi, Cheesecake, etc.)
  const microBubbles = useMemo((): BubbleData[] => {
    try {
      if (!items || items.length === 0 || !selectedCategory) return [];

      const categoryItems = items.filter(item => {
        if (!item) return false;
        const cat = item.category || 'place';
        if (selectedCategory === 'activity') {
          return cat === 'activity' || cat === 'place';
        }
        return cat === selectedCategory;
      });

      if (categoryItems.length === 0) return [];

      // Group by cuisine_type or place_type
      const subGroups: Record<string, SavedItem[]> = {};
      categoryItems.forEach(item => {
        const subType = String(item.cuisine_type || item.place_type || 'other');
        if (!subGroups[subType]) subGroups[subType] = [];
        subGroups[subType].push(item);
      });

      // Positions for micro bubbles (matching Figma)
      const positions = [
        { x: 25, y: 28 },
        { x: 72, y: 32 },
        { x: 35, y: 52 },
        { x: 68, y: 58 },
        { x: 50, y: 75 },
        { x: 28, y: 70 },
      ];

      return Object.entries(subGroups)
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, 6)
        .map(([subType, subItems], index) => ({
          id: `micro-${subType || 'unknown'}`,
          label: String(subType || 'OTHER').toUpperCase(),
          count: subItems?.length || 0,
          color: SUBCATEGORY_COLORS[index % SUBCATEGORY_COLORS.length],
          position: positions[index] || { x: 50, y: 50 },
          items: subItems || [],
        }));
    } catch (error) {
      console.error('[CountryBubble] Error generating micro bubbles:', error);
      return [];
    }
  }, [items, selectedCategory]);

  const handleMacroBubblePress = (bubble: BubbleData) => {
    try {
      if (bubble.category) {
        console.log('[CountryBubble] Macro bubble pressed:', bubble.category);
        setSelectedCategory(bubble.category);
        setViewMode('micro');
      }
    } catch (error) {
      console.error('[CountryBubble] Error in handleMacroBubblePress:', error);
    }
  };

  const handleMicroBubblePress = (bubble: BubbleData) => {
    try {
      console.log('[CountryBubble] Micro bubble pressed:', bubble.label, 'items:', bubble.items?.length);
      
      // Simplify items to avoid serialization issues with large/complex objects
      const simplifiedItems = (bubble.items || []).map(item => ({
        id: item.id,
        name: item.name,
        category: item.category,
        description: item.description,
        location_name: item.location_name,
        location_lat: item.location_lat,
        location_lng: item.location_lng,
        rating: item.rating,
        user_ratings_total: item.user_ratings_total,
        cuisine_type: item.cuisine_type,
        place_type: item.place_type,
        area_name: item.area_name,
        google_place_id: item.google_place_id,
        // Simplify photos - only pass first photo URL if exists
        photos_json: item.photos_json ? 
          (typeof item.photos_json === 'string' ? item.photos_json : JSON.stringify(item.photos_json?.slice?.(0, 1) || [])) 
          : null,
      }));
      
      navigation.navigate('CategoryList', {
        tripId,
        countryName,
        categoryLabel: bubble.label || 'Places',
        categoryType: selectedCategory || 'place',
        items: simplifiedItems,
      });
    } catch (error) {
      console.error('[CountryBubble] Error in handleMicroBubblePress:', error);
    }
  };

  const handleBack = () => {
    if (viewMode === 'micro') {
      setViewMode('macro');
      setSelectedCategory('');
    } else {
      navigation.goBack();
    }
  };

  const handleAgentPress = () => {
    navigation.navigate('GroupChat', { tripId });
  };

  const currentBubbles = viewMode === 'macro' ? macroBubbles : microBubbles;

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

      {/* Map Background */}
      <MapBackground country={(countryName || 'unknown').toLowerCase()} viewType="country" />

      {/* Floating Cloud Decorations */}
      <FloatingCloud color="purple" size={300} position={{ x: 10, y: 5 }} delay={0} />
      <FloatingCloud color="blue" size={250} position={{ x: 75, y: 10 }} delay={1} />
      <FloatingCloud color="pink" size={200} position={{ x: 20, y: 70 }} delay={2} />
      <FloatingCloud color="green" size={220} position={{ x: 80, y: 75 }} delay={1.5} />
      <FloatingCloud color="yellow" size={180} position={{ x: 50, y: 85 }} delay={2.5} />

      {/* Subtle gradient overlay */}
      <View style={styles.gradientOverlay} />

      {/* Header */}
      <View style={styles.header}>
        {viewMode === 'micro' ? (
          <MotiView
            from={{ opacity: 0, translateX: -20 }}
            animate={{ opacity: 1, translateX: 0 }}
            transition={{ type: 'timing', duration: 300 }}
          >
            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <Ionicons name="arrow-back" size={20} color="#374151" />
            </TouchableOpacity>
          </MotiView>
        ) : (
          <MotiView
            from={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ type: 'timing', duration: 400 }}
          >
            <TouchableOpacity onPress={handleBack}>
              <Text style={styles.countryTitle}>
                {countryFlag} {countryName}
              </Text>
            </TouchableOpacity>
          </MotiView>
        )}
      </View>

      {/* Bubbles */}
      <View style={styles.bubblesContainer}>
        {!isLoading && currentBubbles.map((bubble, index) => (
          <MotiView
            key={bubble.id}
            from={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ 
              type: 'spring',
              delay: index * 100,
              damping: 12,
            }}
          >
            <GlowingBubble
              label={bubble.label}
              count={bubble.count}
              color={bubble.color}
              size={viewMode === 'macro' ? 'large' : 'small'}
              position={bubble.position}
              delay={index}
              onPress={() => viewMode === 'macro' 
                ? handleMacroBubblePress(bubble)
                : handleMicroBubblePress(bubble)
              }
            />
          </MotiView>
        ))}
      </View>

      {/* Empty state */}
      {!isLoading && items.length === 0 && (
        <MotiView
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={styles.emptyState}
        >
          <Text style={styles.emptyEmoji}>🗺️</Text>
          <Text style={styles.emptyTitle}>No places yet</Text>
          <Text style={styles.emptySubtitle}>
            Share videos about {countryName} to add places
          </Text>
        </MotiView>
      )}

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

      {/* Loading overlay */}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#8B5CF6" />
          <Text style={styles.loadingText}>Loading places...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    // Subtle top-to-bottom gradient effect
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 45,
    paddingHorizontal: 24,
    paddingBottom: 16,
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
  countryTitle: {
    fontSize: 24,
    fontWeight: '500',
    color: '#1F2937',
    letterSpacing: 0.5,
  },
  bubblesContainer: {
    flex: 1,
  },
  emptyState: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
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
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 12,
  },
});