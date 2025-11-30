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
  ScrollView,
} from 'react-native';
import { MotiView } from 'moti';
import { useChatStore } from '../../stores/chatStore';
import { useAuthStore } from '../../stores/authStore';
import { useTripStore } from '../../stores/tripStore';
import { useItemStore } from '../../stores/itemStore';
import { useBriefingStore, getCategoryEmoji } from '../../stores/briefingStore';
import { useSegmentStore } from '../../stores/segmentStore';
import { useLocationStore } from '../../stores/locationStore';
import { SegmentContextHeader } from '../../components/SegmentContextHeader';
import { QuickActionChips, CategoryChips, QuickPrompts } from '../../components/QuickActionChips';
import ImportLocationsModal from '../../components/ImportLocationsModal';
import { ImportModalData, MorningBriefing, SavedItem } from '../../types';
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
  const { currentTrip, currentTripMembers, fetchTripDetails, fetchTripMembers } = useTripStore();
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
  const { briefing, isLoading: briefingLoading, fetchBriefing } = useBriefingStore();
  const { fetchCurrentSegment } = useSegmentStore();
  const { location } = useLocationStore();
  const { items, fetchTripItems } = useItemStore();

  const [inputText, setInputText] = useState('');
  const [showBriefingCard, setShowBriefingCard] = useState(true);
  const [importModalData, setImportModalData] = useState<ImportModalData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategoryPlaces, setSelectedCategoryPlaces] = useState<SavedItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingRef = useRef<number>(0);

  // Initialize chat and briefing
  useEffect(() => {
    const initScreen = async () => {
      try {
        await Promise.all([
          fetchTripDetails(tripId),
          fetchTripMembers(tripId),
          fetchMessages(tripId),
          fetchCurrentSegment(tripId),
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
  const handlePromptPress = (prompt: string) => {
    setInputText(prompt);
    setShowBriefingCard(false);
    // Auto-focus input after a delay
    setTimeout(() => {
      // Could trigger keyboard focus here
    }, 100);
  };

  // Handle category press - show places inline as horizontal list
  const handleCategoryPress = (category: string) => {
    HapticFeedback.light();
    
    if (selectedCategory === category) {
      // Toggle off if same category
      setSelectedCategory(null);
      setSelectedCategoryPlaces([]);
      return;
    }
    
    // Filter items by category
    const filtered = items.filter(item => item.category === category);
    setSelectedCategory(category);
    setSelectedCategoryPlaces(filtered);
    setShowBriefingCard(false);
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
    const othersTyping = typingUsers.filter((u) => u.userId !== user?.id);
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
  const renderMessage = ({ item, index }: { item: any; index: number }) => {
    const isAgent = item.sender_type === 'agent';
    const isCurrentUser = item.sender_id === user?.id;
    const content = item.content;
    const senderName = item.sender_name || 'Unknown';

    return (
      <View style={styles.messageContainer}>
        {isAgent ? (
          <View style={styles.agentMessageRow}>
            <View style={styles.aiAvatar}>
              <Text style={styles.aiAvatarEmoji}>🤖</Text>
            </View>
            <View style={styles.agentBubble}>
              <Text style={styles.agentLabel}>TravelPal</Text>
              <Text style={styles.agentText}>{content}</Text>
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
          <Text style={styles.headerTitle}>{currentTrip?.name || 'Trip'}</Text>
          <Text style={styles.headerSubtitle}>
            {currentTrip?.destination}
          </Text>
        </View>
        <TouchableOpacity 
          style={styles.mapButton}
          onPress={() => navigation.navigate('TripDetail', { tripId })}
        >
          <Text style={styles.mapButtonText}>🗺️</Text>
        </TouchableOpacity>
      </View>

      {/* Segment Context Header */}
      <SegmentContextHeader 
        briefing={briefing}
        isLoading={briefingLoading}
        onPress={() => setShowBriefingCard(true)}
      />

      {/* Quick Actions */}
      {briefing && (
        <View style={styles.actionsContainer}>
          <CategoryChips 
            categories={briefing.stats.byCategory}
            onCategoryPress={handleCategoryPress}
            selectedCategory={selectedCategory}
          />
        </View>
      )}

      {/* Horizontal Places List - Shows when category is selected */}
      {selectedCategoryPlaces.length > 0 && (
        <View style={styles.placesListContainer}>
          <View style={styles.placesListHeader}>
            <Text style={styles.placesListTitle}>
              {getCategoryEmoji(selectedCategory || 'place')} {selectedCategory?.toUpperCase()} ({selectedCategoryPlaces.length})
            </Text>
            <TouchableOpacity onPress={() => { setSelectedCategory(null); setSelectedCategoryPlaces([]); }}>
              <Text style={styles.placesListClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.placesListScroll}
          >
            {selectedCategoryPlaces.map((place) => (
              <TouchableOpacity
                key={place.id}
                style={styles.placeCard}
                onPress={() => handleTopPickPress(place.id)}
                activeOpacity={0.8}
              >
                <Text style={styles.placeCardEmoji}>{getCategoryEmoji(place.category)}</Text>
                <Text style={styles.placeCardName} numberOfLines={2}>{place.name}</Text>
                {place.rating != null && typeof place.rating === 'number' && (
                  <Text style={styles.placeCardRating}>⭐ {place.rating.toFixed(1)}</Text>
                )}
                {place.area_name && (
                  <Text style={styles.placeCardArea} numberOfLines={1}>{place.area_name}</Text>
                )}
                {place.is_must_visit && (
                  <View style={styles.mustVisitBadge}>
                    <Text style={styles.mustVisitText}>Must Visit</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

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

      {/* Quick Prompts */}
      {briefing && !inputText && (
        <QuickPrompts
          timeOfDay={briefing.timeOfDay}
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
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
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

  // Actions
  actionsContainer: {
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
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

  // Horizontal Places List
  placesListContainer: {
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.border,
    paddingVertical: 12,
  },
  placesListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  placesListTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  placesListClose: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.textTertiary,
    padding: 4,
  },
  placesListScroll: {
    paddingHorizontal: 16,
    gap: 12,
  },
  placeCard: {
    width: 140,
    backgroundColor: theme.colors.backgroundAlt,
    borderWidth: 2,
    borderColor: theme.colors.border,
    padding: 12,
    marginRight: 12,
  },
  placeCardEmoji: {
    fontSize: 24,
    marginBottom: 8,
  },
  placeCardName: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 4,
    minHeight: 36,
  },
  placeCardRating: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: 2,
  },
  placeCardArea: {
    fontSize: 11,
    color: theme.colors.textTertiary,
  },
  mustVisitBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  mustVisitText: {
    fontSize: 9,
    fontWeight: '800',
    color: theme.colors.textInverse,
    textTransform: 'uppercase',
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

