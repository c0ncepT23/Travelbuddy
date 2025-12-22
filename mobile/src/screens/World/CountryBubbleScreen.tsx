/**
 * Country Bubble Screen - V2 with Interactive Map + Compact AI Chat
 * 
 * Features:
 * - REAL interactive Google Map as background
 * - Floating glassmorphic bubbles
 * - Compact AI Chat (non-intrusive)
 * - FloatingAIOrb to open chat
 */

import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  StatusBar,
  Keyboard,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import api from '../../config/api';
import { SavedItem, ItemCategory, SubClusters } from '../../types';
import { FloatingCloud, GlowingBubble } from '../../components/bubbles';
import { FloatingAIOrb } from '../../components/FloatingAIOrb';
import { CompactAIChat } from '../../components/CompactAIChat';
import { useCompanionStore } from '../../stores/companionStore';
import { useLocationStore } from '../../stores/locationStore';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Country center coordinates
const COUNTRY_COORDS: Record<string, { latitude: number; longitude: number; latDelta: number; lngDelta: number }> = {
  japan: { latitude: 36.2048, longitude: 138.2529, latDelta: 10, lngDelta: 10 },
  thailand: { latitude: 15.8700, longitude: 100.9925, latDelta: 12, lngDelta: 8 },
  korea: { latitude: 35.9078, longitude: 127.7669, latDelta: 5, lngDelta: 4 },
  vietnam: { latitude: 14.0583, longitude: 108.2772, latDelta: 12, lngDelta: 8 },
  singapore: { latitude: 1.3521, longitude: 103.8198, latDelta: 0.5, lngDelta: 0.5 },
  indonesia: { latitude: -0.7893, longitude: 113.9213, latDelta: 20, lngDelta: 25 },
  malaysia: { latitude: 4.2105, longitude: 101.9758, latDelta: 10, lngDelta: 10 },
  india: { latitude: 20.5937, longitude: 78.9629, latDelta: 20, lngDelta: 20 },
  china: { latitude: 35.8617, longitude: 104.1954, latDelta: 25, lngDelta: 30 },
  usa: { latitude: 37.0902, longitude: -95.7129, latDelta: 30, lngDelta: 50 },
  france: { latitude: 46.2276, longitude: 2.2137, latDelta: 8, lngDelta: 8 },
  italy: { latitude: 41.8719, longitude: 12.5674, latDelta: 8, lngDelta: 6 },
  spain: { latitude: 40.4637, longitude: -3.7492, latDelta: 8, lngDelta: 10 },
  uk: { latitude: 55.3781, longitude: -3.4360, latDelta: 10, lngDelta: 8 },
  australia: { latitude: -25.2744, longitude: 133.7751, latDelta: 30, lngDelta: 35 },
  default: { latitude: 20, longitude: 0, latDelta: 60, lngDelta: 60 },
};

const COUNTRY_FLAGS: Record<string, string> = {
  japan: '🇯🇵',
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

const CATEGORY_COLORS: Record<string, 'green' | 'blue' | 'yellow' | 'purple' | 'pink' | 'orange'> = {
  food: 'green',
  activity: 'blue',
  shopping: 'yellow',
  accommodation: 'purple',
  place: 'blue',
  tip: 'pink',
};

const SUBCATEGORY_COLORS: ('green' | 'blue' | 'yellow' | 'purple' | 'pink' | 'orange')[] = [
  'green', 'blue', 'pink', 'orange', 'purple', 'yellow'
];

const MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#f5f5f5' }] },
  { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.arterial', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#dadada' }] },
  { featureType: 'road.highway', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'road.local', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c9d6ff' }] },
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

// Simple message type for compact chat
interface ChatMessage {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
}

export default function CountryBubbleScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
  const mapRef = useRef<MapView>(null);
  
  const params = route.params || {};
  const tripId = params.tripId || '';
  const countryName = params.countryName || 'Unknown';

  // Data state
  const [isLoading, setIsLoading] = useState(true);
  const [items, setItems] = useState<SavedItem[]>([]);
  const [subClusters, setSubClusters] = useState<SubClusters | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('macro');
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  // Compact Chat state
  const [isCompactChatOpen, setIsCompactChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      type: 'ai',
      content: `Hey there! 👋 I'm your travel buddy for ${countryName}. What would you like to explore?`,
      timestamp: new Date(),
    }
  ]);
  const [isAITyping, setIsAITyping] = useState(false);

  // Stores
  const { sendQuery, isLoading: companionLoading, getMessages } = useCompanionStore();
  const { location } = useLocationStore();

  const countryCoords = COUNTRY_COORDS[countryName.toLowerCase()] || COUNTRY_COORDS.default;
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
    if (!tripId) {
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    try {
      const itemsResponse = await api.get(`/trips/${tripId}/items`);
      const fetchedItems: SavedItem[] = itemsResponse.data.data || itemsResponse.data || [];
      setItems(fetchedItems);

      try {
        const clustersResponse = await api.get(`/trips/${tripId}/items/sub-clusters`);
        setSubClusters(clustersResponse.data.data || clustersResponse.data);
      } catch (e) {
        setSubClusters(null);
      }
    } catch (error) {
      console.error('[CountryBubbles] Fetch error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Generate MACRO bubbles
  const macroBubbles = useMemo((): BubbleData[] => {
    if (items.length === 0) return [];

    const categoryGroups: Record<string, SavedItem[]> = {};
    items.forEach(item => {
      const cat = item.category || 'place';
      if (!categoryGroups[cat]) categoryGroups[cat] = [];
      categoryGroups[cat].push(item);
    });

    const positions = [
      { x: 30, y: 35 },
      { x: 70, y: 48 },
      { x: 50, y: 68 },
    ];

    const mainCategories = ['food', 'activity', 'shopping'];
    const bubbles: BubbleData[] = [];

    mainCategories.forEach((cat, index) => {
      const catItems = categoryGroups[cat] || [];
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

  // Generate MICRO bubbles
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

      const subGroups: Record<string, SavedItem[]> = {};
      categoryItems.forEach(item => {
        const subType = String(item.cuisine_type || item.place_type || 'other');
        if (!subGroups[subType]) subGroups[subType] = [];
        subGroups[subType].push(item);
      });

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
      return [];
    }
  }, [items, selectedCategory]);

  // Handlers
  const handleMacroBubblePress = (bubble: BubbleData) => {
    if (bubble.category) {
      setSelectedCategory(bubble.category);
      setViewMode('micro');
    }
  };

  const handleMicroBubblePress = (bubble: BubbleData) => {
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
  };

  const handleBack = () => {
    if (viewMode === 'micro') {
      setViewMode('macro');
      setSelectedCategory('');
    } else {
      navigation.goBack();
    }
  };

  // Compact Chat handlers
  const handleOrbPress = () => {
    setIsCompactChatOpen(true);
  };

  const handleCloseCompactChat = () => {
    setIsCompactChatOpen(false);
    Keyboard.dismiss();
  };

  const handleOpenFullChat = () => {
    setIsCompactChatOpen(false);
    navigation.navigate('AgentChat', { tripId, countryName });
  };

  const handleSendMessage = async (message: string) => {
    // Add user message
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      type: 'user',
      content: message,
      timestamp: new Date(),
    };
    setChatMessages(prev => [...prev, userMessage]);

    // Show typing
    setIsAITyping(true);

    try {
      const locationData = location
        ? { lat: location.coords.latitude, lng: location.coords.longitude }
        : undefined;

      // Send to AI (this updates companionStore internally)
      await sendQuery(tripId, message, locationData);
      
      // Get the latest message from the store
      const storeMessages = getMessages(tripId);
      const latestAIMessage = storeMessages.filter(m => m.type === 'companion').pop();
      
      // Add AI response to local state
      const aiMessage: ChatMessage = {
        id: `ai-${Date.now()}`,
        type: 'ai',
        content: latestAIMessage?.content || "I found some great places! Tap expand to see details 🗺️",
        timestamp: new Date(),
      };
      setChatMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      // Add error message
      const errorMessage: ChatMessage = {
        id: `ai-${Date.now()}`,
        type: 'ai',
        content: "Oops! Something went wrong. Try again? 😅",
        timestamp: new Date(),
      };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsAITyping(false);
    }
  };

  const currentBubbles = viewMode === 'macro' ? macroBubbles : microBubbles;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      
      {/* Map Background */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={{
          latitude: countryCoords.latitude,
          longitude: countryCoords.longitude,
          latitudeDelta: countryCoords.latDelta,
          longitudeDelta: countryCoords.lngDelta,
        }}
        customMapStyle={MAP_STYLE}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        scrollEnabled={true}
        zoomEnabled={true}
        pitchEnabled={false}
        rotateEnabled={false}
      />

      {/* Gradient Overlay */}
      <LinearGradient
        colors={['rgba(255,255,255,0.7)', 'rgba(255,255,255,0.3)', 'rgba(255,255,255,0.5)']}
        locations={[0, 0.5, 1]}
        style={styles.gradientOverlay}
        pointerEvents="none"
      />

      {/* Floating Clouds */}
      <FloatingCloud color="purple" size={200} position={{ x: 10, y: 5 }} delay={0} />
      <FloatingCloud color="blue" size={150} position={{ x: 80, y: 8 }} delay={1} />

      {/* Header */}
      <View style={styles.header}>
        {viewMode === 'micro' ? (
          <MotiView
            from={{ opacity: 0, translateX: -20 }}
            animate={{ opacity: 1, translateX: 0 }}
          >
            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <Ionicons name="arrow-back" size={20} color="#374151" />
            </TouchableOpacity>
          </MotiView>
        ) : (
          <MotiView
            from={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <TouchableOpacity style={styles.countryHeader} onPress={handleBack}>
              <View style={styles.countryFlagContainer}>
                <Text style={styles.countryFlag}>{countryFlag}</Text>
              </View>
              <View>
                <Text style={styles.countryTitle}>{countryName}</Text>
                <Text style={styles.placeCount}>{items.length} places saved</Text>
              </View>
            </TouchableOpacity>
          </MotiView>
        )}

        {viewMode === 'micro' && selectedCategory && (
          <MotiView
            from={{ opacity: 0, translateY: -10 }}
            animate={{ opacity: 1, translateY: 0 }}
            style={styles.viewModeLabel}
          >
            <Text style={styles.viewModeLabelText}>
              {selectedCategory.toUpperCase()} • {microBubbles.length} types
            </Text>
          </MotiView>
        )}
      </View>

      {/* Bubbles */}
      <View style={styles.bubblesContainer} pointerEvents="box-none">
        {!isLoading && currentBubbles.map((bubble, index) => (
          <MotiView
            key={bubble.id}
            from={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', delay: index * 100, damping: 12 }}
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
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>🗺️</Text>
            <Text style={styles.emptyTitle}>No places yet</Text>
            <Text style={styles.emptySubtitle}>
              Share videos about {countryName} to add places
            </Text>
          </View>
        </MotiView>
      )}

      {/* Floating AI Orb (hidden when compact chat is open) */}
      <FloatingAIOrb
        onPress={handleOrbPress}
        visible={!isCompactChatOpen}
      />

      {/* Compact AI Chat */}
      <CompactAIChat
        isOpen={isCompactChatOpen}
        onClose={handleCloseCompactChat}
        onOpenFullChat={handleOpenFullChat}
        messages={chatMessages}
        onSendMessage={handleSendMessage}
        isTyping={isAITyping || companionLoading}
      />

      {/* Loading overlay */}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color="#8B5CF6" />
            <Text style={styles.loadingText}>Loading places...</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 48,
    paddingHorizontal: 20,
    paddingBottom: 16,
    zIndex: 10,
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  countryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
    alignSelf: 'flex-start',
  },
  countryFlagContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  countryFlag: {
    fontSize: 24,
  },
  countryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  placeCount: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  viewModeLabel: {
    marginTop: 12,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  viewModeLabelText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8B5CF6',
  },
  bubblesContainer: {
    flex: 1,
    zIndex: 5,
  },
  emptyState: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    zIndex: 10,
  },
  emptyCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
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
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 50,
  },
  loadingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  loadingText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 16,
  },
});
