import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { MotiView } from 'moti';
import { useChatStore } from '../../stores/chatStore';
import { useAuthStore } from '../../stores/authStore';
import { useTripStore } from '../../stores/tripStore';
import { useItemStore } from '../../stores/itemStore';
import { useBriefingStore, getCategoryEmoji } from '../../stores/briefingStore';
import { useLocationStore } from '../../stores/locationStore';
import { QuickPrompts } from '../../components/QuickActionChips';
import ImportLocationsModal from '../../components/ImportLocationsModal';
import { PlaceListDrawer } from '../../components/PlaceListDrawer';
import { ImportModalData, MorningBriefing, SavedItem } from '../../types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { HapticFeedback } from '../../utils/haptics';
import { format, isToday, isYesterday } from 'date-fns';
import theme from '../../config/theme';

/**
 * TripHomeScreen - Chat-First Home Screen
 * 
 * This is the new default screen when entering a trip.
 * Features:
 * - Segment context header (city, day number)
 * - Morning briefing with top picks
 * - Quick action chips (time-appropriate suggestions)
 * - Chat interface with AI companion
 * - Category-based filters
 */

// Helper functions
const isYouTubeURL = (text: string): boolean => {
  return text.includes('youtube.com') || text.includes('youtu.be');
};

const isRedditURL = (text: string): boolean => {
  return text.includes('reddit.com/r/');
};

const isInstagramURL = (text: string): boolean => {
  return text.includes('instagram.com/p/') || text.includes('instagram.com/reel/');
};

const formatMessageTime = (date: Date): string => {
  return format(new Date(date), 'h:mm a');
};

const formatMessageDate = (date: Date): string => {
  const d = new Date(date);
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'MMMM d, yyyy');
};

const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);
};

const getAvatarColor = (name: string): string => {
  const colors = [
    theme.colors.primary,
    theme.colors.success,
    theme.colors.secondary,
    '#EC4899',
    '#8B5CF6',
    '#06B6D4',
  ];
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
};

export default function TripHomeScreen({ route, navigation }: any) {
  const { tripId } = route.params;
  const { user } = useAuthStore();
  const { currentTrip, currentTripMembers, fetchTripDetails, fetchTripMembers, markTripCompleted } = useTripStore();
  const { 
    messages, 
    isLoading: chatLoading, 
    isSending,
    isConnected,
    typingUsers,
    fetchMessages, 
    sendMessage,
    sendMessageViaSocket,
    connectWebSocket,
    joinTripChat,
    leaveTripChat,
    startTyping,
    stopTyping,
  } = useChatStore();
  const { briefing, fetchBriefing } = useBriefingStore();
  const { location } = useLocationStore();
  const { items, fetchTripItems } = useItemStore();

  const [inputText, setInputText] = useState('');
  const [showBriefingCard, setShowBriefingCard] = useState(true);
  const [importModalData, setImportModalData] = useState<ImportModalData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<SavedItem | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<string[] | null>(null);
  
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingRef = useRef<number>(0);

  // Initialize chat and briefing
  useEffect(() => {
    const initScreen = async () => {
      try {
        const [tripData] = await Promise.all([
          fetchTripDetails(tripId),
          fetchTripMembers(tripId),
          fetchMessages(tripId),
          fetchTripItems(tripId, {}),
        ]);
        
        // Fetch briefing with location if available
        const locationData = location
          ? { lat: location.coords.latitude, lng: location.coords.longitude }
          : undefined;
        await fetchBriefing(tripId, locationData);
        
        // Connect WebSocket
        await connectWebSocket();
        joinTripChat(tripId);

      } catch (error) {
        console.error('[TripHome] Init error:', error);
      }
    };

    initScreen();

    return () => {
      leaveTripChat(tripId);
    };
  }, [tripId]);

  // Hide briefing card if there are messages (chat history exists)
  useEffect(() => {
    if (messages.length > 0) {
      setShowBriefingCard(false);
    }
  }, [messages.length]);

  // Check for AI suggestions in the latest message
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.metadata?.suggestions && lastMessage.metadata.suggestions.length > 0) {
        setAiSuggestions(lastMessage.metadata.suggestions);
      } else {
        setAiSuggestions(null);
      }
    }
  }, [messages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > 0 && !showBriefingCard) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages, showBriefingCard]);

  // Pull to refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const locationData = location
        ? { lat: location.coords.latitude, lng: location.coords.longitude }
        : undefined;
      await Promise.all([
        fetchBriefing(tripId, locationData),
        fetchMessages(tripId),
      ]);
    } catch (error) {
      console.error('[TripHome] Refresh error:', error);
    }
    setRefreshing(false);
  }, [tripId, location]);

  // Handle typing
  const handleTyping = useCallback((text: string) => {
    setInputText(text);
    
    const now = Date.now();
    if (now - lastTypingRef.current > 2000 && text.length > 0) {
      startTyping(tripId);
      lastTypingRef.current = now;
    }
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping(tripId);
    }, 3000);
  }, [tripId]);

  // Handle send
  const handleSend = async () => {
    if (!inputText.trim()) return;

    const text = inputText.trim();
    setInputText('');
    setShowBriefingCard(false);
    setAiSuggestions(null); // Clear AI suggestions when sending a new message
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    stopTyping(tripId);

    try {
      if (isConnected) {
        sendMessageViaSocket(tripId, text);
      } else {
        await sendMessage(tripId, text);
      }
      HapticFeedback.light();
    } catch (error: any) {
      Alert.alert('Error', error.message);
      setInputText(text);
    }
  };

  // Handle quick prompt press
  const handlePromptPress = async (prompt: string) => {
    const lowerPrompt = prompt.toLowerCase();
    
    // Special handling for "Surprise me!"
    if (lowerPrompt.includes('surprise')) {
      await handleSurpriseMe();
      return;
    }
    
    // Handle "View Day Planner" - navigate directly
    if (lowerPrompt.includes('view day planner') || lowerPrompt.includes('day planner')) {
      setAiSuggestions(null);
      navigation.navigate('TripDetail', { tripId, viewMode: 'planner' });
      return;
    }
    
    // Handle "Show my places" - navigate to map/browse
    if (lowerPrompt.includes('show my places') || lowerPrompt.includes('my places')) {
      setAiSuggestions(null);
      setIsDrawerOpen(true);
      return;
    }
    
    // Handle welcome prompts - send directly
    if (lowerPrompt.includes('set up my itinerary')) {
      setShowBriefingCard(false);
      if (isConnected) {
        sendMessageViaSocket(tripId, `I want to set up my itinerary for ${currentTrip?.destination || 'this trip'}`);
      }
      return;
    }
    
    if (lowerPrompt.includes('add places from youtube')) {
      setShowBriefingCard(false);
      setInputText('');
      Alert.alert(
        '📺 Add from YouTube',
        'Paste a YouTube video link in the chat and I\'ll extract all the places mentioned!',
        [{ text: 'Got it!' }]
      );
      return;
    }
    
    if (lowerPrompt.includes('just explore')) {
      setShowBriefingCard(false);
      setInputText('');
      // Just hide the briefing card and let user explore
      return;
    }
    
    // Default: set as input text
    setInputText(prompt);
    setShowBriefingCard(false);
  };

  // Handle "Surprise me!" - Find nearest unvisited place
  const handleSurpriseMe = async () => {
    HapticFeedback.medium();
    setShowBriefingCard(false);
    
    // Check if we have saved places
    if (!items || items.length === 0) {
      Alert.alert(
        '📍 No places saved yet!',
        'Share some YouTube videos or links to add places first.',
        [{ text: 'Got it!' }]
      );
      return;
    }
    
    // Filter to unvisited places
    const unvisitedItems = items.filter(item => item.status !== 'visited');
    
    if (unvisitedItems.length === 0) {
      Alert.alert(
        '🎉 All done!',
        "You've visited all your saved places! Add more or explore freely.",
        [{ text: 'Amazing!' }]
      );
      return;
    }
    
    let selectedPlace: SavedItem;
    
    // If we have location, find nearest place
    if (location?.coords) {
      const placesWithDistance = unvisitedItems.map(item => {
        if (!item.location_lat || !item.location_lng) {
          return { ...item, distance: Infinity };
        }
        
        // Calculate distance (simple Haversine)
        const R = 6371e3; // Earth radius in meters
        const lat1 = location.coords.latitude * Math.PI / 180;
        const lat2 = item.location_lat * Math.PI / 180;
        const deltaLat = (item.location_lat - location.coords.latitude) * Math.PI / 180;
        const deltaLng = (item.location_lng - location.coords.longitude) * Math.PI / 180;
        
        const a = Math.sin(deltaLat/2) ** 2 + 
                  Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng/2) ** 2;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distance = R * c;
        
        return { ...item, distance };
      });
      
      // Sort by distance
      placesWithDistance.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
      selectedPlace = placesWithDistance[0];
      
      const dist = (selectedPlace as any).distance || 0;
      const distanceStr = dist < 1000 
        ? `${Math.round(dist)}m away`
        : `${(dist / 1000).toFixed(1)}km away`;
      
      // Send as AI message to chat
      const categoryEmoji = getCategoryEmoji(selectedPlace.category);
      const message = `🎲 **Surprise!** Here's a place near you:\n\n${categoryEmoji} **${selectedPlace.name}**\n📍 ${distanceStr}\n${selectedPlace.description ? `\n${selectedPlace.description.substring(0, 100)}...` : ''}\n\nWant to go?`;
      
      // Send a fake "AI response" to show the suggestion
      if (isConnected) {
        sendMessageViaSocket(tripId, `Surprise me with a nearby place!`);
      }
      
      // Also open the drawer with this place selected
      setSelectedPlace(selectedPlace);
      setIsDrawerOpen(true);
    } else {
      // No location - pick a random unvisited place
      const randomIndex = Math.floor(Math.random() * unvisitedItems.length);
      selectedPlace = unvisitedItems[randomIndex];
      
      // Send request to AI
      if (isConnected) {
        sendMessageViaSocket(tripId, `Surprise me with a place to visit!`);
      }
      
      // Open drawer with random place
      setSelectedPlace(selectedPlace);
      setIsDrawerOpen(true);
    }
  };

  // Handle category press - open bottom drawer with places
  const handleCategoryPress = (category: string) => {
    HapticFeedback.light();
    
    if (selectedCategory === category && isDrawerOpen) {
      // Toggle off if same category and drawer is open
      setIsDrawerOpen(false);
      setSelectedCategory(null);
      return;
    }
    
    // Open drawer with selected category
    setSelectedCategory(category);
    setShowBriefingCard(false);
    setIsDrawerOpen(true);
  };

  // Handle place selection from drawer
  const handlePlaceSelectFromDrawer = (item: SavedItem) => {
    HapticFeedback.medium();
    setSelectedPlace(item);
  };

  // Handle back to list in drawer
  const handleBackToList = () => {
    HapticFeedback.light();
    setSelectedPlace(null);
  };

  // Handle drawer close
  const handleDrawerClose = () => {
    setSelectedPlace(null);
    setSelectedCategory(null);
    setIsDrawerOpen(false);
  };

  // Handle suggestion chip press
  const handleSuggestionPress = (suggestion: string) => {
    // Convert suggestion to a query
    const query = suggestion.replace(/[^\w\s?]/g, '').trim();
    setInputText(query);
    setShowBriefingCard(false);
  };

  // Handle top pick press
  const handleTopPickPress = (placeId: string) => {
    navigation.navigate('TripDetail', { tripId, highlightItemId: placeId });
  };

  // Get typing text
  const getTypingText = (): string | null => {
    const othersTyping = typingUsers.filter((u) => String(u.userId) !== String(user?.id));
    if (othersTyping.length === 0) return null;
    
    const typingNames = othersTyping.map((t) => {
      const member = currentTripMembers?.find((m) => Number(m.id) === t.userId);
      return member?.name?.split(' ')[0] || 'Someone';
    });
    
    if (typingNames.length === 1) {
      return `${typingNames[0]} is typing...`;
    }
    return `${typingNames.length} people are typing...`;
  };

  // Render briefing card
  const renderBriefingCard = () => {
    if (!briefing || !showBriefingCard) return null;

    return (
      <MotiView
        from={{ opacity: 0, translateY: -20 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 400 }}
        style={styles.briefingCard}
      >
        {/* Greeting */}
        <Text style={styles.briefingGreeting}>{briefing.greeting}</Text>

        {/* Top Picks */}
        {briefing.topPicks.length > 0 && (
          <View style={styles.topPicksSection}>
            <Text style={styles.sectionTitle}>✨ TOP PICKS FOR TODAY</Text>
            {briefing.topPicks.slice(0, 3).map((pick, index) => (
              <TouchableOpacity
                key={pick.id}
                style={styles.topPickItem}
                onPress={() => handleTopPickPress(pick.id)}
                activeOpacity={0.7}
              >
                <Text style={styles.topPickEmoji}>{getCategoryEmoji(pick.category)}</Text>
                <View style={styles.topPickInfo}>
                  <Text style={styles.topPickName}>{pick.name}</Text>
                  {pick.rating != null && typeof pick.rating === 'number' && (
                    <Text style={styles.topPickRating}>⭐ {pick.rating.toFixed(1)}</Text>
                  )}
                </View>
                <Text style={styles.topPickArrow}>→</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Near Hotel */}
        {briefing.nearbyHotel.length > 0 && (
          <View style={styles.nearbySection}>
            <Text style={styles.sectionTitle}>📍 NEAR YOUR HOTEL</Text>
            <View style={styles.nearbyList}>
              {briefing.nearbyHotel.slice(0, 3).map((place) => (
                <TouchableOpacity
                  key={place.id}
                  style={styles.nearbyItem}
                  onPress={() => handleTopPickPress(place.id)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.nearbyEmoji}>{getCategoryEmoji(place.category)}</Text>
                  <Text style={styles.nearbyName} numberOfLines={1}>{place.name}</Text>
                  <Text style={styles.nearbyDistance}>{place.distance}m</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Dismiss button - only show if no messages yet */}
        {messages.length === 0 && (
          <TouchableOpacity
            style={styles.dismissButton}
            onPress={() => setShowBriefingCard(false)}
          >
            <Text style={styles.dismissText}>Start chatting →</Text>
          </TouchableOpacity>
        )}
      </MotiView>
    );
  };

  // Render message
  // Handle View Day Planner button
  const handleViewDayPlanner = (planId: string) => {
    // Navigate to day planner screen with the plan ID
    navigation.navigate('TripDetail', { tripId, viewMode: 'planner', highlightPlanId: planId });
  };

  // Handle suggestion button press (for guide video preview)
  const handleSuggestionButtonPress = (suggestion: string) => {
    HapticFeedback.medium();
    // Send the suggestion as a message to trigger the action
    if (isConnected) {
      sendMessageViaSocket(tripId, suggestion);
    } else {
      sendMessage(tripId, suggestion);
    }
  };

  const renderMessage = ({ item, index }: { item: any; index: number }) => {
    // Check message_type for AI responses (they have same sender_id as user but different type)
    const isAgent = item.message_type === 'ai_response' || item.sender_type === 'agent';
    const isCurrentUser = !isAgent && String(item.sender_id) === String(user?.id);
    const content = item.content;
    const senderName = item.sender_name || 'Unknown';
    const planId = item.metadata?.planId;
    const suggestions = item.metadata?.suggestions;
    const isGuidePreview = item.metadata?.type === 'guide_video_preview';

    return (
      <View style={styles.messageContainer}>
        {isAgent ? (
          <View style={styles.agentMessageRow}>
            <View style={styles.aiAvatar}>
              <Text style={styles.aiAvatarEmoji}>✨</Text>
            </View>
            <View style={styles.agentBubble}>
              <Text style={styles.agentLabel}>TravelPal</Text>
              <Text style={styles.agentText}>{content}</Text>
              
              {/* Show suggestion buttons for guide preview messages */}
              {isGuidePreview && suggestions && suggestions.length > 0 && (
                <View style={styles.suggestionButtonsContainer}>
                  {suggestions.map((suggestion: string, idx: number) => (
                    <TouchableOpacity
                      key={idx}
                      style={[
                        styles.suggestionButton,
                        suggestion.includes('Both') && styles.suggestionButtonPrimary
                      ]}
                      onPress={() => handleSuggestionButtonPress(suggestion)}
                    >
                      <Text style={[
                        styles.suggestionButtonText,
                        suggestion.includes('Both') && styles.suggestionButtonTextPrimary
                      ]}>
                        {suggestion}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              
              {/* Show Day Planner button if plan was created */}
              {planId && (
                <TouchableOpacity 
                  style={styles.viewPlanButton}
                  onPress={() => handleViewDayPlanner(planId)}
                >
                  <Text style={styles.viewPlanButtonText}>📅 View Day Planner →</Text>
                </TouchableOpacity>
              )}
              
              <Text style={styles.timestamp}>{formatMessageTime(item.created_at)}</Text>
            </View>
          </View>
        ) : isCurrentUser ? (
          <View style={styles.userMessageRow}>
            <View style={styles.userBubble}>
              <Text style={styles.userText}>{content}</Text>
              <Text style={styles.timestampRight}>{formatMessageTime(item.created_at)}</Text>
            </View>
          </View>
        ) : (
          <View style={styles.memberMessageRow}>
            <View style={[styles.memberAvatar, { backgroundColor: getAvatarColor(senderName) }]}>
              <Text style={styles.memberAvatarText}>{getInitials(senderName)}</Text>
            </View>
            <View style={styles.memberBubble}>
              <Text style={styles.memberName}>{senderName}</Text>
              <Text style={styles.memberText}>{content}</Text>
              <Text style={styles.timestamp}>{formatMessageTime(item.created_at)}</Text>
            </View>
          </View>
        )}
      </View>
    );
  };

  const typingText = getTypingText();

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.headerTitle}>{currentTrip?.name || 'Trip'}</Text>
            {currentTrip?.is_completed && (
              <Text style={{ marginLeft: 6, fontSize: 14 }}>✅</Text>
            )}
          </View>
          <Text style={styles.headerSubtitle}>
            {currentTrip?.destination}
          </Text>
        </View>
        {/* Browse places button */}
        <TouchableOpacity 
          style={[styles.browseButton, isDrawerOpen && styles.browseButtonActive]}
          onPress={() => {
            HapticFeedback.light();
            if (isDrawerOpen) {
              handleDrawerClose();
            } else {
              setSelectedCategory('all');
              setIsDrawerOpen(true);
            }
          }}
        >
          <Text style={styles.browseButtonText}>📍</Text>
          {items.length > 0 && (
            <View style={styles.browseBadge}>
              <Text style={styles.browseBadgeText}>{items.length}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.mapButton}
          onPress={() => navigation.navigate('TripDetail', { tripId })}
        >
          <Text style={styles.mapButtonText}>🗺️</Text>
        </TouchableOpacity>
        {/* Mark as Completed toggle */}
        <TouchableOpacity 
          style={[styles.mapButton, currentTrip?.is_completed && { backgroundColor: '#22C55E20' }]}
          onPress={async () => {
            try {
              HapticFeedback.medium();
              const newStatus = !currentTrip?.is_completed;
              await markTripCompleted(tripId, newStatus);
              Alert.alert(
                newStatus ? '🏆 Trip Completed!' : '✈️ Trip Reactivated',
                newStatus 
                  ? 'This trip will appear as a trophy on your globe.' 
                  : 'This trip is now active again.'
              );
            } catch (error: any) {
              Alert.alert('Error', error.message);
            }
          }}
        >
          <Text style={styles.mapButtonText}>
            {currentTrip?.is_completed ? '🏆' : '✓'}
          </Text>
        </TouchableOpacity>
      </View>


      {/* Content Area */}
      <FlatList
        ref={flatListRef}
        data={showBriefingCard ? [] : messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messageList}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListHeaderComponent={renderBriefingCard}
        ListEmptyComponent={
          !chatLoading && !showBriefingCard ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>💬</Text>
              <Text style={styles.emptyText}>Ask me anything!</Text>
              <Text style={styles.emptySubtext}>
                Share links, ask for recommendations, or plan your day
              </Text>
            </View>
          ) : null
        }
      />

      {/* Typing Indicator */}
      {typingText && (
        <View style={styles.typingContainer}>
          <Text style={styles.typingText}>{typingText}</Text>
        </View>
      )}

      {/* Quick Prompts - Show AI suggestions or default prompts */}
      {briefing && !inputText && (
        <QuickPrompts
          timeOfDay={briefing.timeOfDay}
          isNewTrip={messages.length === 0}
          customSuggestions={aiSuggestions}
          onPromptPress={handlePromptPress}
        />
      )}

      {/* Input Bar */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Ask me anything..."
          placeholderTextColor={theme.colors.textTertiary}
          value={inputText}
          onChangeText={handleTyping}
          multiline
          maxLength={2000}
          onFocus={() => setShowBriefingCard(false)}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!inputText.trim() || isSending) && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!inputText.trim() || isSending}
        >
          <Text style={styles.sendButtonText}>
            {isSending ? '...' : '→'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Import Modal */}
      {importModalData && (
        <ImportLocationsModal
          visible={importModalData.visible}
          onClose={() => setImportModalData(null)}
          sourceUrl={importModalData.sourceUrl}
          sourceType={importModalData.sourceType}
          sourceTitle={importModalData.sourceTitle}
          summary={importModalData.summary}
          places={importModalData.places}
          tripId={importModalData.tripId}
          onImportComplete={() => setImportModalData(null)}
        />
      )}


      {/* Bottom Drawer for Places - Like Maps UI */}
      {isDrawerOpen && (
        <PlaceListDrawer
          items={selectedCategory === 'all' || !selectedCategory 
            ? items 
            : items.filter(i => i.category === selectedCategory)}
          selectedCategory={(selectedCategory || 'all') as any}
          selectedPlace={selectedPlace}
          onPlaceSelect={handlePlaceSelectFromDrawer}
          onBackToList={handleBackToList}
          onClose={handleDrawerClose}
          onCheckIn={(place) => handleTopPickPress(place.id)}
          trip={currentTrip || undefined}
        />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 50 : (StatusBar.currentHeight || 24) + 12,
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    backgroundColor: theme.colors.backgroundAlt,
    borderWidth: 2,
    borderColor: theme.colors.borderDark,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  backButtonText: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  browseButton: {
    width: 44,
    height: 44,
    backgroundColor: theme.colors.backgroundAlt,
    borderWidth: 2,
    borderColor: theme.colors.borderDark,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    position: 'relative',
  },
  browseButtonActive: {
    backgroundColor: theme.colors.primary,
  },
  browseButtonText: {
    fontSize: 20,
  },
  browseBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: theme.colors.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.surface,
  },
  browseBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: theme.colors.textInverse,
  },
  mapButton: {
    width: 44,
    height: 44,
    backgroundColor: theme.colors.primary,
    borderWidth: 2,
    borderColor: theme.colors.borderDark,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.neopop.sm,
  },
  mapButtonText: {
    fontSize: 20,
  },

  // Messages
  messageList: {
    padding: 16,
    paddingBottom: 8,
  },
  messageContainer: {
    marginBottom: 12,
  },

  // Agent messages
  agentMessageRow: {
    flexDirection: 'row',
    maxWidth: '85%',
  },
  aiAvatar: {
    width: 36,
    height: 36,
    backgroundColor: theme.colors.primary,
    borderWidth: 2,
    borderColor: theme.colors.borderDark,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  aiAvatarEmoji: {
    fontSize: 18,
  },
  agentBubble: {
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: theme.colors.borderDark,
    padding: 12,
    flex: 1,
    ...theme.shadows.neopop.sm,
  },
  agentLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.primary,
    marginBottom: 4,
  },
  agentText: {
    fontSize: 15,
    lineHeight: 22,
    color: theme.colors.textPrimary,
  },
  viewPlanButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  viewPlanButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },

  // Suggestion buttons (for guide preview)
  suggestionButtonsContainer: {
    marginTop: 12,
    gap: 8,
  },
  suggestionButton: {
    backgroundColor: theme.colors.backgroundAlt,
    borderWidth: 2,
    borderColor: theme.colors.border,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  suggestionButtonPrimary: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.borderDark,
  },
  suggestionButtonText: {
    color: theme.colors.textPrimary,
    fontWeight: '600',
    fontSize: 14,
    textAlign: 'center',
  },
  suggestionButtonTextPrimary: {
    color: '#FFFFFF',
  },

  // User messages
  userMessageRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  userBubble: {
    backgroundColor: theme.colors.primary,
    borderWidth: 2,
    borderColor: theme.colors.borderDark,
    padding: 12,
    maxWidth: '80%',
    ...theme.shadows.neopop.sm,
  },
  userText: {
    fontSize: 15,
    lineHeight: 22,
    color: theme.colors.textInverse,
  },

  // Member messages
  memberMessageRow: {
    flexDirection: 'row',
    maxWidth: '85%',
  },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: theme.colors.borderDark,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  memberAvatarText: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.textInverse,
  },
  memberBubble: {
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: theme.colors.borderDark,
    padding: 12,
    flex: 1,
  },
  memberName: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.textSecondary,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  memberText: {
    fontSize: 15,
    lineHeight: 22,
    color: theme.colors.textPrimary,
  },

  // Timestamps
  timestamp: {
    fontSize: 10,
    color: theme.colors.textTertiary,
    marginTop: 6,
    fontWeight: '600',
  },
  timestampRight: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 6,
    fontWeight: '600',
    textAlign: 'right',
  },

  // Briefing Card
  briefingCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: theme.colors.borderDark,
    padding: 16,
    marginBottom: 16,
    ...theme.shadows.neopop.md,
  },
  briefingGreeting: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    marginBottom: 16,
    lineHeight: 26,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  topPicksSection: {
    marginBottom: 16,
  },
  topPickItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.backgroundAlt,
    borderWidth: 2,
    borderColor: theme.colors.border,
    padding: 12,
    marginBottom: 8,
  },
  topPickEmoji: {
    fontSize: 20,
    marginRight: 12,
  },
  topPickInfo: {
    flex: 1,
  },
  topPickName: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  topPickRating: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  topPickArrow: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  nearbySection: {
    marginBottom: 16,
  },
  nearbyList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  nearbyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.backgroundAlt,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  nearbyEmoji: {
    fontSize: 14,
    marginRight: 6,
  },
  nearbyName: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    maxWidth: 100,
  },
  nearbyDistance: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.textTertiary,
    marginLeft: 6,
  },
  dismissButton: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  dismissText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.primary,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    marginTop: 40,
    paddingHorizontal: 24,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Typing indicator
  typingContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: theme.colors.backgroundAlt,
  },
  typingText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
  },

  // Input
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 2,
    borderTopColor: theme.colors.border,
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    backgroundColor: theme.colors.background,
    borderWidth: 2,
    borderColor: theme.colors.borderDark,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  sendButton: {
    width: 48,
    height: 48,
    backgroundColor: theme.colors.primary,
    borderWidth: 3,
    borderColor: theme.colors.borderDark,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.neopop.sm,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: theme.colors.textInverse,
    fontSize: 22,
    fontWeight: '900',
  },
});

