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
import { format } from 'date-fns';
import { useCompanionStore, CompanionMessage, PlaceResult } from '../../stores/companionStore';
import { useLocationStore } from '../../stores/locationStore';
import { useTripStore } from '../../stores/tripStore';

import { BlurView } from 'expo-blur';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Midnight Discovery palette
const colors = {
  // Gradients
  primaryGradientStart: '#22D3EE', // cyan-400
  primaryGradientEnd: '#06B6D4',   // cyan-500
  
  // Glassmorphic backgrounds
  panelBg: 'rgba(15, 17, 21, 0.98)',
  panelBgSecondary: 'rgba(23, 25, 31, 0.95)',
  
  // Text
  textPrimary: '#F8FAFC',    // slate-50
  textSecondary: '#94A3B8',  // slate-400
  textWhite: '#FFFFFF',
  
  // UI Elements
  borderLight: 'rgba(255, 255, 255, 0.1)',
  primaryBorder: 'rgba(6, 182, 212, 0.2)', // cyan-500/20
  closeButtonBg: '#1E293B',        // slate-800
  closeButtonHover: '#334155',     // slate-700
  
  // Messages
  aiBubbleBg: '#1E293B',
  userBubbleStart: '#06B6D4',  // cyan-500
  userBubbleEnd: '#0891B2',    // cyan-600
  
  // Dots
  typingDot: '#22D3EE', // cyan-400
  onlineDot: '#10B981', // green-500
  
  // Places
  categoryFood: '#22C55E',
  categoryPlace: '#6366F1',
  categoryShopping: '#EAB308',
  categoryActivity: '#06B6D4',
  
  // Suggestions
  suggestionBg: 'rgba(6, 182, 212, 0.1)',
  suggestionBorder: '#06B6D4',
};

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
      food: colors.categoryFood,
      place: colors.categoryPlace,
      shopping: colors.categoryShopping,
      activity: colors.categoryActivity,
      accommodation: '#6366F1',
      tip: '#8B5CF6',
    };
    return categoryColors[category] || colors.userBubbleStart;
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
            <View style={[styles.miniCardPlaceholder, { backgroundColor: getCategoryColor(place.category) + '20' }]}>
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
              <Ionicons name="star" size={10} color="#FFD700" />
              <Text style={styles.miniCardRatingText}>{place.rating || '4.0'}</Text>
            </View>
            <View style={styles.miniCardGo}>
              <Ionicons name="navigate" size={12} color="#06B6D4" />
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
            <Ionicons name="navigate" size={10} color={colors.userBubbleStart} />
            <Text style={styles.distanceText}>
              {place.distance < 1000
                ? `${Math.round(place.distance)}m`
                : `${(place.distance / 1000).toFixed(1)}km`}
            </Text>
          </View>
        )}
      </View>
      
      <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
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
              colors={[colors.userBubbleStart, colors.userBubbleEnd]}
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
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleClose} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <LinearGradient
              colors={[colors.primaryGradientStart, colors.primaryGradientEnd]}
              style={styles.aiIconBox}
            >
              <Ionicons name="sparkles" size={20} color={colors.textWhite} />
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
      
      {/* Dimmed backdrop for the top 20% area */}
      <Pressable style={styles.backdrop} onPress={handleClose} />
      
      {/* Main Content Area (80% Height) */}
      <MotiView 
        from={{ translateY: SCREEN_HEIGHT }}
        animate={{ translateY: 0 }}
        transition={{ type: 'spring', damping: 20, stiffness: 150 }}
        style={styles.contentContainer}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleClose} activeOpacity={0.7}>
            <Ionicons name="close" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          
          <View style={styles.headerCenter}>
            <LinearGradient
              colors={[colors.primaryGradientStart, colors.primaryGradientEnd]}
              style={styles.aiIconBox}
            >
              <Ionicons name="sparkles" size={20} color={colors.textWhite} />
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
                placeholderTextColor={colors.textSecondary}
                multiline
                maxLength={500}
                editable={!isLoading}
              />
            </View>
            
            <TouchableOpacity
              style={[
                styles.sendButton,
                (!inputText.trim() || isLoading) && styles.sendButtonDisabled
              ]}
              onPress={handleSend}
              disabled={!inputText.trim() || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.textWhite} size="small" />
              ) : (
                <LinearGradient
                  colors={[colors.primaryGradientStart, colors.primaryGradientEnd]}
                  style={styles.sendButtonGradient}
                >
                  <Ionicons name="send" size={18} color={colors.textWhite} />
                </LinearGradient>
              )}
            </TouchableOpacity>
          </View>

          {/* Footer text */}
          <Text style={styles.footerText}>
            Powered by AI · Always learning 🧠 ✨
          </Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  contentContainer: {
    height: '80%',
    backgroundColor: '#0F1115',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#17191F',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
  },
  headerRight: {
    width: 40,
  },
  aiIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    marginLeft: 10,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 1,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.onlineDot,
    marginRight: 4,
  },
  statusText: {
    fontSize: 12,
    color: colors.textSecondary,
  },

  // Messages
  messagesArea: {
    flex: 1,
  },
  messagesList: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    flexGrow: 1,
  },
  messageContainer: {
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  userMessageContainer: {
    alignItems: 'flex-end',
  },
  messageBubble: {
    maxWidth: '75%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  aiBubble: {
    backgroundColor: colors.aiBubbleBg,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    padding: 12,
    paddingHorizontal: 16,
    // Medium drop shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  userBubble: {
    // Shadow handled by gradient wrapper
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  userBubbleGradient: {
    padding: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
  },
  aiMessageText: {
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  userMessageText: {
    fontSize: 14,
    color: colors.textWhite,
    lineHeight: 20,
  },

  // Typing Indicator
  typingContainer: {
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  typingBubble: {
    flexDirection: 'row',
    backgroundColor: colors.aiBubbleBg,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 6,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.typingDot,
  },

  // Places (New Horizontal Style)
  horizontalPlacesContainer: {
    marginTop: 12,
    marginLeft: -16, // Bleed out of bubble
    marginRight: -16,
  },
  horizontalPlacesScroll: {
    paddingHorizontal: 16,
    gap: 12,
  },
  miniPlaceCard: {
    width: 160,
    backgroundColor: 'rgba(15, 17, 21, 0.95)',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  miniCardImageContainer: {
    height: 100,
    width: '100%',
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
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
    fontSize: 32,
  },
  miniCardCategory: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniCardCategoryEmoji: {
    fontSize: 12,
  },
  miniCardInfo: {
    padding: 10,
  },
  miniCardName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 6,
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
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },
  miniCardGo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  miniCardGoText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#06B6D4',
  },

  // Legacy Places style
  placesContainer: {
    marginTop: 12,
    gap: 8,
  },
  placeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
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
    color: colors.textPrimary,
    marginBottom: 2,
  },
  placeLocation: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  distanceText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.userBubbleStart,
  },

  // Suggestions
  suggestionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  suggestionButton: {
    backgroundColor: colors.suggestionBg,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.suggestionBorder,
  },
  suggestionText: {
    fontSize: 13,
    color: colors.userBubbleStart,
    fontWeight: '500',
  },

  // Input
  inputArea: {
    backgroundColor: '#17191F',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
  },
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingTop: 12,
    alignItems: 'flex-end',
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginRight: 8,
  },
  input: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.textPrimary,
    maxHeight: 100,
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
    opacity: 0.5,
  },

  // Footer
  footerText: {
    textAlign: 'center',
    fontSize: 12,
    color: colors.textSecondary,
    paddingTop: 8,
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
    color: colors.textPrimary,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
