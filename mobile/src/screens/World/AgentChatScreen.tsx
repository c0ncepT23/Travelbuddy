/**
 * Agent Chat Screen - Zenly-Inspired AI Assistant Panel
 * 
 * Design: Glassmorphic bottom sheet with purple/indigo gradients
 * Features:
 * - Slides up from bottom (85% viewport height)
 * - Glassmorphic background with purple glow
 * - Animated AI icon with sparkles
 * - Typing indicator with bouncing dots
 * - Location-aware recommendations
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  FlatList, 
  StyleSheet, 
  Platform, 
  ActivityIndicator, 
  Dimensions, 
  StatusBar,
  ScrollView,
  Pressable,
} from 'react-native';
import FastImage from 'react-native-fast-image';
import { getPlacePhotoUrl } from '../../config/maps';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useCompanionStore, CompanionMessage, PlaceResult } from '../../stores/companionStore';
import { useLocationStore } from '../../stores/locationStore';
import { useTripStore } from '../../stores/tripStore';

import { BouncyPressable } from '../../components/BouncyPressable';

// Hardcoded theme colors to avoid module load order issues
const COLORS = {
  primary: '#6366F1',
  primaryLight: '#818CF8',
  success: '#10B981',
  textPrimary: '#FFFFFF',
  textSecondary: '#94A3B8',
  food: '#F43F5E',
  accommodation: '#8B5CF6',
  place: '#0EA5E9',
  shopping: '#EC4899',
  activity: '#10B981',
  tip: '#F59E0B',
};

const GRADIENTS = {
  primary: ['#6366F1', '#A855F7'] as const,
};

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function AgentChatScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  
  const { tripId: paramTripId, countryName } = route.params || {};
  const { trips } = useTripStore();
  
  const tripId = paramTripId || 
    trips.find(t => t.destination?.toLowerCase().includes(countryName?.toLowerCase()))?.id ||
    trips[0]?.id;

  const { isLoading, sendQuery, clearMessages, getMessages, addMessage } = useCompanionStore();
  const messages = getMessages(tripId || 'global');
  const { location, startTracking } = useLocationStore();
  
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // Initialize location tracking
  useEffect(() => {
    startTracking();
  }, []);

  // Add welcome message if first time
  useEffect(() => {
    if (messages.length === 0) {
      const welcomeMessage: CompanionMessage = {
        id: 'welcome',
        type: 'companion',
        content: `Hey there! 👋 I'm your travel buddy.\nWant me to find the best ramen spots nearby?`,
        timestamp: new Date(),
      };
      addMessage(tripId || 'global', welcomeMessage);
    }
  }, [tripId, messages.length]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  // Simulate typing indicator
  useEffect(() => {
    if (isLoading) {
      setIsTyping(true);
    } else {
      setIsTyping(false);
    }
  }, [isLoading]);

  const handleSend = async () => {
    if (!inputText.trim() || isLoading || !tripId) return;

    const query = inputText.trim();
    setInputText('');

    try {
      const locationData = location
        ? { lat: location.coords.latitude, lng: location.coords.longitude }
        : undefined;
      
      await sendQuery(tripId, query, locationData);
    } catch (error) {
      console.error('Send query error:', error);
    }
  };

  const handleQuickQuery = (query: string) => {
    setInputText(query);
  };

  const handlePlacePress = (placeId: string, placeTripId?: string) => {
    const targetTripId = placeTripId || tripId;
    if (targetTripId) {
      navigation.navigate('TripDetail', { tripId: targetTripId, highlightItemId: placeId });
    }
  };

  const handleClose = () => {
    navigation.goBack();
  };

  const getCategoryColor = (category: string): string => {
    const categoryColors: Record<string, string> = {
      food: COLORS.food,
      place: COLORS.place,
      shopping: COLORS.shopping,
      activity: COLORS.activity,
      accommodation: COLORS.accommodation,
      tip: COLORS.tip,
    };
    return categoryColors[category] || COLORS.primary;
  };

  const getCategoryIcon = (category: string): string => {
    const icons: Record<string, string> = {
      food: '🍽️',
      shopping: '🛍️',
      place: '📍',
      activity: '🎯',
      accommodation: '🏨',
      tip: '💡',
    };
    return icons[category] || '📌';
  };

  const renderPlaceCard = (place: PlaceResult) => {
    const photoUrl = getPlacePhotoUrl(place.photos_json, 300);
    const categoryColor = getCategoryColor(place.category);
    
    return (
      <TouchableOpacity
        key={place.id}
        style={styles.miniPlaceCard}
        onPress={() => handlePlacePress(place.id)}
        activeOpacity={0.9}
      >
        <View style={styles.miniCardImageContainer}>
          {photoUrl ? (
            <FastImage
              source={{ uri: photoUrl }}
              style={styles.miniCardImage}
              resizeMode={FastImage.resizeMode.cover}
            />
          ) : (
            <View style={[styles.miniCardPlaceholder, { backgroundColor: categoryColor + '20' }]}>
              <Text style={styles.miniCardPlaceholderEmoji}>{getCategoryIcon(place.category)}</Text>
            </View>
          )}
          
          <View style={styles.miniCardCategory}>
            <Text style={styles.miniCardCategoryEmoji}>{getCategoryIcon(place.category)}</Text>
          </View>
        </View>
        
        <View style={styles.miniCardInfo}>
          <Text style={styles.miniCardName} numberOfLines={1}>{place.name}</Text>
          <View style={styles.miniCardFooter}>
            <View style={styles.miniCardRating}>
              <Ionicons name="star" size={12} color="#FFD700" />
              <Text style={styles.miniCardRatingText}>
                {place.rating ? Number(place.rating).toFixed(1) : '4.0'}
              </Text>
            </View>
            <View style={styles.miniCardGo}>
              <Ionicons name="navigate" size={12} color={COLORS.primary} />
              <Text style={styles.miniCardGoText}>GO</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderPlace = (place: PlaceResult) => (
    <TouchableOpacity
      key={place.id}
      style={styles.placeCard}
      onPress={() => handlePlacePress(place.id)}
      activeOpacity={0.8}
    >
      <View style={[styles.placeCategoryDot, { backgroundColor: getCategoryColor(place.category) }]}>
        <Text style={styles.placeCategoryIcon}>{getCategoryIcon(place.category)}</Text>
      </View>
      
      <View style={styles.placeInfo}>
        <Text style={styles.placeName} numberOfLines={1}>{place.name}</Text>
        
        {place.location_name && (
          <Text style={styles.placeLocation} numberOfLines={1}>
            {place.location_name}
          </Text>
        )}
        
        {place.distance !== undefined && (
          <View style={styles.distanceBadge}>
            <Ionicons name="navigate" size={10} color={COLORS.primary} />
            <Text style={styles.distanceText}>
              {place.distance < 1000
                ? `${Math.round(place.distance)}m`
                : `${(place.distance / 1000).toFixed(1)}km`}
            </Text>
          </View>
        )}
      </View>
      
      <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} />
    </TouchableOpacity>
  );

  // Typing indicator component
  const TypingIndicator = () => (
    <View style={styles.typingContainer}>
      <View style={styles.typingBubble}>
        {[0, 1, 2].map((index) => (
          <MotiView
            key={index}
            from={{ translateY: 0 }}
            animate={{ translateY: -8 }}
            transition={{
              type: 'timing',
              duration: 400,
              loop: true,
              delay: index * 200,
              repeatReverse: true,
            }}
            style={styles.typingDot}
          />
        ))}
      </View>
    </View>
  );

  const renderMessage = ({ item, index }: { item: CompanionMessage; index: number }) => {
    const isUser = item.type === 'user';

    return (
      <MotiView
        from={{ opacity: 0, translateY: 20 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ 
          type: 'timing', 
          duration: 300, 
          delay: index * 50 
        }}
        style={[styles.messageContainer, isUser && styles.userMessageContainer]}
      >
        <View style={[
          styles.messageBubble, 
          isUser ? styles.userBubble : styles.aiBubble
        ]}>
          {isUser ? (
            <LinearGradient
              colors={GRADIENTS.primary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.userBubbleGradient}
            >
              <Text style={styles.userMessageText}>{item.content}</Text>
            </LinearGradient>
          ) : (
            <>
              <Text style={styles.aiMessageText}>{item.content}</Text>

              {item.places && item.places.length > 0 && (
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalPlacesScroll}
                  style={styles.horizontalPlacesContainer}
                >
                  {item.places.map((place) => renderPlaceCard(place))}
                </ScrollView>
              )}

              {item.suggestions && item.suggestions.length > 0 && (
                <View style={styles.suggestionsContainer}>
                  {item.suggestions.map((suggestion, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={styles.suggestionButton}
                      onPress={() => handleQuickQuery(suggestion)}
                    >
                      <Text style={styles.suggestionText}>{suggestion}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </>
          )}
        </View>
      </MotiView>
    );
  };

  // Show error state if no trips
  if (!tripId) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <View style={styles.header}>
          <BouncyPressable style={styles.backButton} onPress={handleClose}>
            <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
          </BouncyPressable>
          <View style={styles.headerCenter}>
            <LinearGradient
              colors={GRADIENTS.primary}
              style={styles.aiIconBox}
            >
              <Ionicons name="sparkles" size={20} color={COLORS.textPrimary} />
            </LinearGradient>
            <View style={styles.headerText}>
              <Text style={styles.headerTitle}>AI Travel Agent</Text>
              <View style={styles.statusRow}>
                <View style={styles.onlineDot} />
                <Text style={styles.statusText}>Online & Ready</Text>
              </View>
            </View>
          </View>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🗺️</Text>
          <Text style={styles.emptyTitle}>No trips yet</Text>
          <Text style={styles.emptySubtitle}>
            Share a YouTube or Instagram link to get started!
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      
      {/* Dimmed backdrop */}
      <Pressable style={styles.backdrop} onPress={handleClose} />
      
      {/* Main Content Area */}
      <MotiView 
        from={{ translateY: SCREEN_HEIGHT }}
        animate={{ translateY: 0 }}
        transition={{ type: 'spring', damping: 20, stiffness: 150 }}
        style={styles.contentContainer}
      >
        {/* Header */}
        <View style={styles.header}>
          <BouncyPressable style={styles.backButton} onPress={handleClose}>
            <Ionicons name="close" size={24} color={COLORS.textPrimary} />
          </BouncyPressable>
          
          <View style={styles.headerCenter}>
            <LinearGradient
              colors={GRADIENTS.primary}
              style={styles.aiIconBox}
            >
              <Ionicons name="sparkles" size={20} color={COLORS.textPrimary} />
            </LinearGradient>
            <View style={styles.headerText}>
              <Text style={styles.headerTitle}>AI Travel Agent</Text>
              <View style={styles.statusRow}>
                <View style={styles.onlineDot} />
                <Text style={styles.statusText}>Online & Ready</Text>
              </View>
            </View>
          </View>
          
          <View style={styles.headerRight} />
        </View>

        {/* Messages Area */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={isTyping ? <TypingIndicator /> : null}
          keyboardShouldPersistTaps="handled"
          style={styles.messagesArea}
        />

        {/* Input Area */}
        <View style={styles.inputArea}>
          <View style={styles.inputContainer}>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                value={inputText}
                onChangeText={setInputText}
                placeholder="Ask me anything..."
                placeholderTextColor={COLORS.textSecondary}
                multiline
                maxLength={500}
                editable={!isLoading}
              />
            </View>
            
            <BouncyPressable
              style={[
                styles.sendButton,
                (!inputText.trim() || isLoading) && styles.sendButtonDisabled
              ]}
              onPress={handleSend}
              disabled={!inputText.trim() || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={COLORS.textPrimary} size="small" />
              ) : (
                <LinearGradient
                  colors={GRADIENTS.primary}
                  style={styles.sendButtonGradient}
                >
                  <Ionicons name="send" size={18} color={COLORS.textPrimary} />
                </LinearGradient>
              )}
            </BouncyPressable>
          </View>
        </View>
      </MotiView>
    </View>
  );
}

const styles = StyleSheet.create({
  // Container
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  contentContainer: {
    height: '85%',
    backgroundColor: '#1F2022', // Charcoal theme
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 8,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 16,
  },
  headerRight: {
    width: 36,
  },
  aiIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  headerText: {
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981', // success color
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },

  // Messages
  messagesArea: {
    flex: 1,
  },
  messagesList: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    flexGrow: 1,
  },
  messageContainer: {
    marginBottom: 20,
    alignItems: 'flex-start',
  },
  userMessageContainer: {
    alignItems: 'flex-end',
  },
  messageBubble: {
    maxWidth: '85%',
    borderRadius: 24,
    overflow: 'hidden',
  },
  aiBubble: {
    backgroundColor: 'rgba(45, 46, 48, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: 16,
    borderBottomLeftRadius: 4,
  },
  userBubble: {
    borderBottomRightRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  userBubbleGradient: {
    padding: 14,
    paddingHorizontal: 18,
    borderRadius: 24,
  },
  aiMessageText: {
    fontSize: 15,
    color: '#FFFFFF',
    lineHeight: 22,
    fontWeight: '500',
  },
  userMessageText: {
    fontSize: 15,
    color: '#FFFFFF',
    lineHeight: 22,
    fontWeight: '600',
  },

  // Typing Indicator
  typingContainer: {
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  typingBubble: {
    flexDirection: 'row',
    backgroundColor: 'rgba(45, 46, 48, 0.7)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#818CF8', // primaryLight
  },

  // Places (Horizontal)
  horizontalPlacesContainer: {
    marginTop: 16,
    marginLeft: -16,
    marginRight: -16,
  },
  horizontalPlacesScroll: {
    paddingHorizontal: 16,
    gap: 12,
  },
  miniPlaceCard: {
    width: 160,
    height: 180, // Fixed height to prevent stretching
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  miniCardImageContainer: {
    height: 100,
    width: '100%',
    backgroundColor: '#E8EAED',
  },
  miniCardImage: {
    width: '100%',
    height: '100%',
  },
  miniCardPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniCardPlaceholderEmoji: {
    fontSize: 36,
  },
  miniCardCategory: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 10,
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniCardCategoryEmoji: {
    fontSize: 14,
  },
  miniCardInfo: {
    padding: 10,
    flex: 1,
    justifyContent: 'space-between',
  },
  miniCardName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  miniCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  miniCardRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  miniCardRatingText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  miniCardGo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  miniCardGoText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#6366F1',
  },

  // Suggestions
  suggestionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
  },
  suggestionButton: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  suggestionText: {
    fontSize: 13,
    color: '#818CF8',
    fontWeight: '700',
  },

  // Input
  inputArea: {
    backgroundColor: '#1F2022',
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: '#2D2E30',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginRight: 12,
    minHeight: 48,
    justifyContent: 'center',
  },
  input: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
  },
  sendButtonGradient: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },

  // Empty state
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 22,
  },

  // Distance Badge
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  distanceText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6366F1',
  },

  // Place Card (Vertical)
  placeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
  },
  placeCategoryDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  placeCategoryIcon: {
    fontSize: 18,
  },
  placeInfo: {
    flex: 1,
  },
  placeName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 2,
  },
  placeLocation: {
    fontSize: 13,
    color: '#64748B',
  },
});
