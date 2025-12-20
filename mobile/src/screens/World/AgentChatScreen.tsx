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
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Dimensions,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { useNavigation, useRoute } from '@react-navigation/native';
import { format } from 'date-fns';
import { useCompanionStore, CompanionMessage, PlaceResult } from '../../stores/companionStore';
import { useLocationStore } from '../../stores/locationStore';
import { useTripStore } from '../../stores/tripStore';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const PANEL_HEIGHT = SCREEN_HEIGHT * 0.85;

// Zenly-inspired color palette
const colors = {
  // Gradients
  purpleGradientStart: '#A78BFA', // purple-400
  purpleGradientEnd: '#6366F1',   // indigo-500
  
  // Glassmorphic backgrounds
  panelBg: 'rgba(255, 255, 255, 0.95)',
  panelBgSecondary: 'rgba(255, 255, 255, 0.90)',
  
  // Text
  textPrimary: '#1F2937',    // gray-800
  textSecondary: '#6B7280',  // gray-500
  textWhite: '#FFFFFF',
  
  // UI Elements
  borderLight: 'rgba(255, 255, 255, 0.4)',
  purpleBorder: 'rgba(139, 92, 246, 0.5)', // purple-100/50
  closeButtonBg: '#F3F4F6',        // gray-100
  closeButtonHover: '#E5E7EB',     // gray-200
  
  // Messages
  aiBubbleBg: 'rgba(255, 255, 255, 0.8)',
  userBubbleStart: '#8B5CF6',  // purple-500
  userBubbleEnd: '#6366F1',    // indigo-500
  
  // Dots
  typingDot: '#A78BFA', // purple-400
  onlineDot: '#10B981', // green-500
  
  // Places
  categoryFood: '#EF4444',
  categoryPlace: '#3B82F6',
  categoryShopping: '#F59E0B',
  categoryActivity: '#10B981',
  
  // Suggestions
  suggestionBg: 'rgba(139, 92, 246, 0.1)',
  suggestionBorder: '#8B5CF6',
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
                <View style={styles.placesContainer}>
                  {item.places.map((place) => renderPlace(place))}
                </View>
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
      <View style={styles.overlay}>
        <StatusBar barStyle="light-content" />
        <TouchableOpacity style={styles.backdrop} onPress={handleClose} activeOpacity={1} />
        <View style={styles.panel}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <LinearGradient
                colors={[colors.purpleGradientStart, colors.purpleGradientEnd]}
                style={styles.aiIconBox}
              >
                <Ionicons name="sparkles" size={24} color={colors.textWhite} />
              </LinearGradient>
              <View style={styles.headerText}>
                <Text style={styles.headerTitle}>AI Travel Agent</Text>
                <View style={styles.statusRow}>
                  <View style={styles.onlineDot} />
                  <Text style={styles.statusText}>Online & Ready</Text>
                </View>
              </View>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🗺️</Text>
            <Text style={styles.emptyTitle}>No trips yet</Text>
            <Text style={styles.emptySubtitle}>
              Share a YouTube or Instagram link to get started!
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <StatusBar barStyle="light-content" />
      
      {/* Backdrop - only closes when tapped directly */}
      <TouchableOpacity 
        style={styles.backdrop} 
        onPress={handleClose} 
        activeOpacity={1}
      />
      
      {/* Main Panel - receives all touch events */}
      <MotiView
        from={{ translateY: PANEL_HEIGHT }}
        animate={{ translateY: 0 }}
        transition={{ type: 'spring', damping: 20, stiffness: 200 }}
        style={styles.panel}
        pointerEvents="box-none"
      >
        <View style={styles.blurContainer} pointerEvents="auto">
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              {/* AI Icon with rotation animation */}
              <MotiView
                from={{ rotate: '0deg' }}
                animate={{ rotate: '5deg' }}
                transition={{
                  type: 'timing',
                  duration: 1000,
                  loop: true,
                  repeatReverse: true,
                }}
              >
                <LinearGradient
                  colors={[colors.purpleGradientStart, colors.purpleGradientEnd]}
                  style={styles.aiIconBox}
                >
                  <Ionicons name="sparkles" size={24} color={colors.textWhite} />
                </LinearGradient>
              </MotiView>
              
              <View style={styles.headerText}>
                <Text style={styles.headerTitle}>AI Travel Agent</Text>
                <View style={styles.statusRow}>
                  <MotiView
                    from={{ scale: 0.8, opacity: 0.5 }}
                    animate={{ scale: 1.2, opacity: 1 }}
                    transition={{
                      type: 'timing',
                      duration: 800,
                      loop: true,
                      repeatReverse: true,
                    }}
                    style={styles.onlineDot}
                  />
                  <Text style={styles.statusText}>Online & Ready</Text>
                </View>
              </View>
            </View>
            
            {/* Close Button */}
            <TouchableOpacity style={styles.closeButton} onPress={handleClose} activeOpacity={0.7}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Messages Area */}
          <KeyboardAvoidingView
            style={styles.keyboardAvoid}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={0}
          >
            <FlatList
              ref={flatListRef}
              data={messages}
              renderItem={renderMessage}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.messagesList}
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
              showsVerticalScrollIndicator={false}
              ListFooterComponent={isTyping ? <TypingIndicator /> : null}
            />

            {/* Input Area */}
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
                    colors={[colors.purpleGradientStart, colors.purpleGradientEnd]}
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
          </KeyboardAvoidingView>
        </View>
      </MotiView>
    </View>
  );
}

const styles = StyleSheet.create({
  // Overlay & Backdrop
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    zIndex: 40,
  },
  
  // Panel
  panel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: PANEL_HEIGHT,
    maxWidth: 448,
    alignSelf: 'center',
    width: '100%',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: 'hidden',
    zIndex: 50,
    // Purple glow shadow
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.3,
    shadowRadius: 60,
    elevation: 20,
  },
  blurContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderBottomWidth: 0,
    overflow: 'hidden',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.purpleBorder,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  aiIconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
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
    backgroundColor: colors.onlineDot,
    marginRight: 6,
  },
  statusText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.closeButtonBg,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Messages
  keyboardAvoid: {
    flex: 1,
  },
  messagesList: {
    paddingHorizontal: 24,
    paddingVertical: 16,
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
    borderColor: colors.purpleBorder,
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
    borderColor: colors.purpleBorder,
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

  // Places
  placesContainer: {
    marginTop: 12,
    gap: 8,
  },
  placeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.purpleBorder,
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
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingVertical: 12,
    alignItems: 'flex-end',
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.purpleBorder,
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
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
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
