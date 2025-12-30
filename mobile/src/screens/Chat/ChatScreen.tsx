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
  SafeAreaView,
} from 'react-native';
// import * as ImagePicker from 'expo-image-picker'; // TODO: Add back for image upload feature
import { useChatStore } from '../../stores/chatStore';
import { useAuthStore } from '../../stores/authStore';
import { format } from 'date-fns';
import ImportLocationsModal from '../../components/ImportLocationsModal';
import { ImportModalData } from '../../types';
import theme from '../../config/theme';
import { Ionicons } from '@expo/vector-icons';

const extractVideoId = (url: string): string | null => {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
};

const isYouTubeURL = (text: string): boolean => {
  return text.includes('youtube.com') || text.includes('youtu.be');
};

const isRedditURL = (text: string): boolean => {
  return text.includes('reddit.com/r/');
};

const extractVideoTitle = (url: string): string => {
  // For now, just show a generic message
  // In production, you'd fetch the actual title from the video
  return 'YouTube Video';
};

export default function ChatScreen({ route, navigation }: any) {
  const { tripId } = route.params;
  const { messages, isLoading, isSending, fetchMessages, sendMessage, uploadImage } =
    useChatStore();
  const { user } = useAuthStore();
  const [inputText, setInputText] = useState('');
  const [importModalData, setImportModalData] = useState<ImportModalData | null>(null);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    fetchMessages(tripId);
  }, [tripId]);

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const handleSend = async () => {
    if (!inputText.trim()) return;

    const text = inputText.trim();
    setInputText('');

    try {
      await sendMessage(tripId, text);
    } catch (error: any) {
      Alert.alert('Error', error.message);
      setInputText(text); // Restore input on error
    }
  };

  const handleGoToSavedPlaces = () => {
    navigation.navigate('TripDetail', { tripId });
  };

  // TODO: Re-enable when expo-image-picker is added
  const handleImagePick = async () => {
    Alert.alert('Coming Soon', 'Image upload will be available in the next update. For now, please paste YouTube or Reddit URLs!');
  };

  const renderSourceCard = (url: string) => {
    if (isYouTubeURL(url)) {
      const videoId = extractVideoId(url);
      return (
        <View style={styles.sourceCard}>
          <View style={styles.sourceCardHeader}>
            <Text style={styles.youtubeIcon}>▶️</Text>
            <Text style={styles.sourceCardLabel}>YouTube</Text>
          </View>
          <Text style={styles.sourceCardTitle} numberOfLines={2}>
            {url.split('watch?v=')[1]?.split('&')[0] || 'Video'}
          </Text>
        </View>
      );
    } else if (isRedditURL(url)) {
      return (
        <View style={styles.sourceCard}>
          <View style={styles.sourceCardHeader}>
            <Text style={styles.redditIcon}>💬</Text>
            <Text style={styles.sourceCardLabel}>Reddit</Text>
          </View>
          <Text style={styles.sourceCardTitle} numberOfLines={2}>
            {url}
          </Text>
        </View>
      );
    }
    return null;
  };

  const renderMessage = ({ item }: { item: any }) => {
    const isAgent = item.sender_type === 'agent';
    const isCurrentUser = item.sender_id === user?.id;
    const content = item.content;
    
    // Check if this is a location alert
    const isLocationAlert = item.metadata?.type === 'location_alert';
    
    // Check if this is a pending import message
    const isPendingImport = item.metadata?.type === 'pending_import';
    
    // Detect if message contains URL
    const hasURL = isYouTubeURL(content) || isRedditURL(content);
    
    // Detect processing status
    const isProcessing = content.includes('Processing') || content.includes('Analyzing');
    const isComplete = content.includes('Analysis Complete') || content.includes('Added') || content.includes('place(s)');
    const itemsCount = content.match(/Found (\d+) items?/i)?.[1] || content.match(/Added (\d+) place/i)?.[1];

    // Render Location Alert (Simplified)
    if (isLocationAlert && item.metadata?.places) {
      return (
        <View style={styles.locationAlertContainer}>
          <View style={styles.locationAlert}>
            <Text style={styles.locationAlertTitle}>
              📍 NEARBY DISCOVERY
            </Text>
            <Text style={styles.locationAlertSubtitle}>
              You're in {item.metadata.location}! We found {item.metadata.places.length} spots you saved nearby.
            </Text>
            
            <View style={styles.placesContainer}>
              {item.metadata.places.map((place: any, index: number) => (
                <View key={place.id} style={styles.placeItem}>
                  <View style={styles.placeInfo}>
                    <View style={styles.placeEmojiContainer}>
                      <Text style={styles.placeEmoji}>
                        {place.category === 'food' ? '🍜' : 
                         place.category === 'place' ? '📍' : 
                         place.category === 'shopping' ? '🛍️' : 
                         place.category === 'activity' ? '🎯' : '✨'}
                      </Text>
                    </View>
                    <View style={styles.placeText}>
                      <Text style={styles.placeName}>{place.name}</Text>
                      <Text style={styles.placeDistance}>{place.distance}m away</Text>
                    </View>
                  </View>
                  <TouchableOpacity 
                    style={styles.goNowButton}
                    onPress={() => {
                      navigation.navigate('TripDetail', { tripId, highlightItemId: place.id });
                    }}
                  >
                    <Text style={styles.goNowButtonText}>GO →</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
          <Text style={styles.locationTimestamp}>
            {format(new Date(item.created_at), 'h:mm a')}
          </Text>
        </View>
      );
    }

    // Render Pending Import Message
    if (isPendingImport && item.metadata?.places) {
      const sourceEmoji = item.metadata.source_type === 'youtube' ? '▶️' : 
                         item.metadata.source_type === 'reddit' ? '💬' : '📷';
      
      return (
        <View style={styles.importMessageContainer}>
          <View style={styles.importMessage}>
            <View style={styles.agentBadgeContainer}>
              <Text style={styles.agentBadge}>✨ YORI</Text>
            </View>
            
            <View style={styles.importSourceCard}>
              <View style={styles.importSourceEmojiBg}>
                <Text style={styles.importSourceEmoji}>{sourceEmoji}</Text>
              </View>
              <View style={styles.importSourceInfo}>
                <Text style={styles.importSourceLabel}>
                  {(item.metadata.source_type || '').toUpperCase()}
                </Text>
                <Text style={styles.importSourceTitle} numberOfLines={1}>
                  {item.metadata.video_title || 'Content'}
                </Text>
              </View>
            </View>

            <Text style={styles.importMessageText}>{content}</Text>

            <TouchableOpacity
              style={styles.reviewButton}
              onPress={() => {
                setImportModalData({
                  visible: true,
                  sourceUrl: item.metadata.source_url,
                  sourceType: item.metadata.source_type,
                  sourceTitle: item.metadata.video_title,
                  summary: item.metadata.summary,
                  places: item.metadata.places,
                  tripId,
                });
              }}
            >
              <Text style={styles.reviewButtonText}>Review Spots →</Text>
            </TouchableOpacity>

            <Text style={styles.timestamp}>
              {format(new Date(item.created_at), 'h:mm a')}
            </Text>
          </View>
        </View>
      );
    }

    return (
      <View
        style={[
          styles.messageBubble,
          isAgent ? styles.agentBubble : isCurrentUser ? styles.userBubble : styles.otherBubble,
        ]}
      >
        {!isAgent && !isCurrentUser && (
          <Text style={styles.senderName}>{item.sender_name}</Text>
        )}
        
        {isAgent && (
          <View style={styles.agentBadgeContainer}>
            <Text style={styles.agentBadge}>✨ YORI</Text>
          </View>
        )}

        {/* Source Card for URLs */}
        {hasURL && !isAgent && renderSourceCard(content)}

        {/* Message Content */}
        {!hasURL && (
          <View style={styles.messageContentRow}>
            {isComplete && <Text style={styles.successIcon}>✨</Text>}
            <Text style={[styles.messageText, isCurrentUser && styles.userText]}>
              {content}
            </Text>
          </View>
        )}

        {/* Processing Indicator */}
        {isProcessing && (
          <View style={styles.processingDots}>
            <Text style={styles.dot}>•</Text>
            <Text style={styles.dot}>•</Text>
            <Text style={styles.dot}>•</Text>
          </View>
        )}

        {/* "Go to Saved Places" Button */}
        {isComplete && itemsCount && (
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={handleGoToSavedPlaces}
          >
            <Text style={styles.actionButtonText}>View Collection</Text>
          </TouchableOpacity>
        )}

        <Text style={[styles.timestamp, isCurrentUser && styles.userTimestamp]}>
          {format(new Date(item.created_at), 'h:mm a')}
        </Text>
      </View>
    );
  };

  // Helper to get emoji for food/activity items
  const getItemEmoji = (item: string): string => {
    const lower = item.toLowerCase();
    if (lower.includes('pad thai') || lower.includes('noodle')) return '🍜';
    if (lower.includes('sushi') || lower.includes('ramen')) return '🍣';
    if (lower.includes('pizza')) return '🍕';
    if (lower.includes('taco') || lower.includes('burrito')) return '🌮';
    if (lower.includes('curry')) return '🍛';
    if (lower.includes('coffee') || lower.includes('cafe')) return '☕';
    if (lower.includes('dessert') || lower.includes('cake') || lower.includes('ice cream')) return '🍰';
    if (lower.includes('seafood') || lower.includes('fish')) return '🦐';
    if (lower.includes('bbq') || lower.includes('grill')) return '🍖';
    if (lower.includes('soup') || lower.includes('tom yum')) return '🥣';
    if (lower.includes('breakfast') || lower.includes('brunch')) return '🥞';
    if (lower.includes('street food')) return '🥡';
    if (lower.includes('bar') || lower.includes('cocktail')) return '🍸';
    if (lower.includes('beach') || lower.includes('surfing')) return '🏖️';
    if (lower.includes('temple') || lower.includes('shrine')) return '🛕';
    if (lower.includes('museum') || lower.includes('art')) return '🎨';
    if (lower.includes('market') || lower.includes('shopping')) return '🛍️';
    return '🍽️'; // Default food emoji
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitleText}>AI Agent</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            !isLoading ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconContainer}>
                  <Ionicons name="sparkles" size={40} color={theme.colors.primary} />
                </View>
                <Text style={styles.emptyText}>Hey! I'm Yori ✨</Text>
                <Text style={styles.emptySubtext}>
                  Drop a YouTube link, an Instagram reel, or just tell me where you want to go.
                </Text>
              </View>
            ) : null
          }
        />

        {/* Input Area */}
        <View style={styles.inputWrapper}>
          <View style={styles.inputContainer}>
            <TouchableOpacity style={styles.imageButton} onPress={handleImagePick}>
              <Ionicons name="camera" size={24} color={theme.colors.textSecondary} />
            </TouchableOpacity>

            <TextInput
              style={styles.input}
              placeholder="Ask Yori anything..."
              placeholderTextColor={theme.colors.textTertiary}
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={1000}
            />

            <TouchableOpacity
              style={[styles.sendButton, (!inputText.trim() || isSending) && styles.sendButtonDisabled]}
              onPress={handleSend}
              disabled={!inputText.trim() || isSending}
            >
              <Ionicons 
                name={isSending ? "sync" : "arrow-up"} 
                size={20} 
                color="#FFFFFF" 
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Import Locations Modal */}
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
            onImportComplete={(count) => {
              setImportModalData(null);
              // Success feedback is shown via agent message
            }}
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.backgroundAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleText: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  messageList: {
    padding: 16,
    paddingTop: 20,
    paddingBottom: 32,
  },
  messageBubble: {
    maxWidth: '85%',
    padding: 14,
    borderRadius: 20,
    marginBottom: 12,
  },
  agentBubble: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: theme.colors.primary,
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.backgroundAlt,
    borderBottomLeftRadius: 4,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textTertiary,
    marginBottom: 4,
    marginLeft: 4,
  },
  agentBadgeContainer: {
    backgroundColor: theme.colors.backgroundAlt,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  agentBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  messageContentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
    color: theme.colors.textPrimary,
    fontWeight: '500',
  },
  userText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  timestamp: {
    fontSize: 10,
    color: theme.colors.textTertiary,
    marginTop: 6,
    fontWeight: '600',
  },
  userTimestamp: {
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'right',
  },
  successIcon: {
    fontSize: 20,
    marginRight: 8,
  },

  // Source Card
  sourceCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  sourceCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  youtubeIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  redditIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  sourceCardLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
  },
  sourceCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },

  // Processing Dots
  processingDots: {
    flexDirection: 'row',
    marginTop: 8,
    paddingLeft: 4,
  },
  dot: {
    fontSize: 24,
    color: theme.colors.primary,
    marginRight: 4,
    lineHeight: 24,
  },

  // Action Button
  actionButton: {
    backgroundColor: theme.colors.backgroundAlt,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  actionButtonText: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: '800',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 80,
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.backgroundAlt,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 22,
    fontWeight: '900',
    color: theme.colors.textPrimary,
    marginBottom: 12,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '500',
  },

  // Input Container
  inputWrapper: {
    backgroundColor: theme.colors.background,
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 16 : 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  inputContainer: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderRadius: 24,
    paddingHorizontal: 8,
    paddingVertical: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  imageButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    color: theme.colors.textPrimary,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: theme.colors.backgroundAlt,
    opacity: 0.5,
  },

  // ========== LOCATION ALERT STYLES ==========
  locationAlertContainer: {
    marginBottom: 20,
    width: '100%',
  },
  locationAlert: {
    backgroundColor: theme.colors.surface,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.soft.md,
  },
  locationAlertTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.primary,
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: 1,
  },
  locationAlertSubtitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  placesContainer: {
    gap: 12,
  },
  placeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.backgroundAlt,
    borderRadius: 16,
    padding: 12,
  },
  placeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  placeEmojiContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  placeEmoji: {
    fontSize: 20,
  },
  placeText: {
    flex: 1,
  },
  placeName: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  placeDistance: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  goNowButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  goNowButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  locationTimestamp: {
    fontSize: 11,
    color: theme.colors.textTertiary,
    marginTop: 8,
    textAlign: 'center',
    fontWeight: '600',
  },

  // ========== PENDING IMPORT MESSAGE STYLES ==========
  importMessageContainer: {
    marginBottom: 16,
    width: '90%',
    alignSelf: 'flex-start',
  },
  importMessage: {
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    borderBottomLeftRadius: 4,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.soft.sm,
  },
  importSourceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.backgroundAlt,
    borderRadius: 12,
    padding: 12,
    marginVertical: 12,
  },
  importSourceEmojiBg: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  importSourceEmoji: {
    fontSize: 20,
  },
  importSourceInfo: {
    flex: 1,
  },
  importSourceLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.textTertiary,
    marginBottom: 2,
    letterSpacing: 1,
  },
  importSourceTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  importMessageText: {
    fontSize: 16,
    lineHeight: 22,
    color: theme.colors.textPrimary,
    marginBottom: 16,
    fontWeight: '500',
  },
  reviewButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  reviewButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
