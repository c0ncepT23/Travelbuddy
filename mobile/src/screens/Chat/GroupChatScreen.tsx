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
} from 'react-native';
import { useChatStore } from '../../stores/chatStore';
import { useAuthStore } from '../../stores/authStore';
import { useTripStore } from '../../stores/tripStore';
import { format, isToday, isYesterday } from 'date-fns';
import ImportLocationsModal from '../../components/ImportLocationsModal';
import { ImportModalData } from '../../types';
import theme from '../../config/theme';

/**
 * WhatsApp-style Group Chat Screen with Real-time WebSocket
 * - Real-time messaging via WebSocket
 * - Typing indicators ("Alice is typing...")
 * - Online status indicators (green dot)
 * - AI only responds when URL detected or @AI mentioned
 */

const isYouTubeURL = (text: string): boolean => {
  return text.includes('youtube.com') || text.includes('youtu.be');
};

const isRedditURL = (text: string): boolean => {
  return text.includes('reddit.com/r/');
};

const isInstagramURL = (text: string): boolean => {
  return text.includes('instagram.com/p/') || text.includes('instagram.com/reel/');
};

const isTikTokURL = (text: string): boolean => {
  return text.includes('tiktok.com/');
};

const getSourceIcon = (text: string): string => {
  if (isYouTubeURL(text)) return '▶️';
  if (isRedditURL(text)) return '💬';
  if (isInstagramURL(text)) return '📷';
  if (isTikTokURL(text)) return '🎵';
  return '🔗';
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

// Get initials for avatar
const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);
};

// Get avatar color based on name (consistent per user)
const getAvatarColor = (name: string): string => {
  const colors = [
    theme.colors.primary,
    theme.colors.success,
    theme.colors.secondary,
    '#EC4899', // Pink
    '#8B5CF6', // Purple
    '#06B6D4', // Cyan
  ];
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
};

export default function GroupChatScreen({ route, navigation }: any) {
  const { tripId } = route.params;
  const { 
    messages, 
    isLoading, 
    isSending, 
    isConnected,
    typingUsers,
    onlineUsers,
    fetchMessages, 
    sendMessage,
    sendMessageViaSocket,
    connectWebSocket,
    joinTripChat,
    leaveTripChat,
    startTyping,
    stopTyping,
    markAsRead,
  } = useChatStore();
  const { user } = useAuthStore();
  const { currentTrip, currentTripMembers, fetchTripDetails, fetchTripMembers } = useTripStore();
  const [inputText, setInputText] = useState('');
  const [importModalData, setImportModalData] = useState<ImportModalData | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingRef = useRef<number>(0);

  // Initialize WebSocket connection and join trip
  useEffect(() => {
    const initChat = async () => {
      await fetchMessages(tripId);
      await fetchTripDetails(tripId);
      await fetchTripMembers(tripId);
      
      // Connect WebSocket and join trip room
      await connectWebSocket();
      joinTripChat(tripId);
      
      // Mark all messages as read
      markAsRead(tripId);
    };

    initChat();

    // Cleanup on unmount
    return () => {
      leaveTripChat(tripId);
    };
  }, [tripId]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  // Handle typing with debounce
  const handleTyping = useCallback((text: string) => {
    setInputText(text);
    
    const now = Date.now();
    // Only emit typing event every 2 seconds
    if (now - lastTypingRef.current > 2000 && text.length > 0) {
      startTyping(tripId);
      lastTypingRef.current = now;
    }
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Stop typing after 3 seconds of no input
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping(tripId);
    }, 3000);
  }, [tripId, startTyping, stopTyping]);

  const handleSend = async () => {
    if (!inputText.trim()) return;

    const text = inputText.trim();
    setInputText('');
    
    // Clear typing timeout and stop typing
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    stopTyping(tripId);

    try {
      // Prefer WebSocket if connected, fallback to REST
      if (isConnected) {
        sendMessageViaSocket(tripId, text);
      } else {
        await sendMessage(tripId, text);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
      setInputText(text);
    }
  };

  // Check if a member is online
  const isMemberOnline = (memberId: number | string): boolean => {
    return onlineUsers.some((u) => u.user_id === Number(memberId) && u.is_online);
  };

  // Get online member count
  const onlineCount = onlineUsers.filter((u) => u.is_online).length;

  // Get typing users display text
  const getTypingText = (): string | null => {
    // Filter out current user
    const othersTyping = typingUsers.filter((u) => u.userId !== user?.id);
    if (othersTyping.length === 0) return null;
    
    // Get names from trip members
    const typingNames = othersTyping.map((t) => {
      const member = currentTripMembers?.find((m) => Number(m.id) === t.userId);
      return member?.name?.split(' ')[0] || t.email?.split('@')[0] || 'Someone';
    });
    
    if (typingNames.length === 1) {
      return `${typingNames[0]} is typing...`;
    } else if (typingNames.length === 2) {
      return `${typingNames[0]} and ${typingNames[1]} are typing...`;
    } else {
      return `${typingNames.length} people are typing...`;
    }
  };

  // Check if we should show date header
  const shouldShowDateHeader = (index: number): boolean => {
    if (index === 0) return true;
    const currentDate = new Date(messages[index].created_at).toDateString();
    const prevDate = new Date(messages[index - 1].created_at).toDateString();
    return currentDate !== prevDate;
  };

  const renderMessage = ({ item, index }: { item: any; index: number }) => {
    const isAgent = item.sender_type === 'agent';
    const isCurrentUser = item.sender_id === user?.id;
    const content = item.content;
    const senderName = item.sender_name || item.metadata?.sender_name || 'Unknown';

    // Check for special message types
    const isLocationAlert = item.metadata?.type === 'location_alert';
    const isPendingImport = item.metadata?.type === 'pending_import';
    const hasURL = isYouTubeURL(content) || isRedditURL(content) || isInstagramURL(content) || isTikTokURL(content);
    const isProcessing = content.includes('Processing') && content.includes('🔄');

    // Render date header if needed
    const showDateHeader = shouldShowDateHeader(index);

    return (
      <View>
        {showDateHeader && (
          <View style={styles.dateHeader}>
            <View style={styles.dateHeaderLine} />
            <Text style={styles.dateHeaderText}>
              {formatMessageDate(item.created_at)}
            </Text>
            <View style={styles.dateHeaderLine} />
          </View>
        )}

        {/* Location Alert Message */}
        {isLocationAlert && item.metadata?.places ? (
          <View style={styles.locationAlertContainer}>
            <View style={styles.locationAlert}>
              <Text style={styles.locationAlertTitle}>
                📍 NEARBY PLACES!
              </Text>
              <Text style={styles.locationAlertSubtitle}>
                You're near {item.metadata.places.length} saved spot{item.metadata.places.length > 1 ? 's' : ''}!
              </Text>
              {item.metadata.places.map((place: any) => (
                <TouchableOpacity
                  key={place.id}
                  style={styles.nearbyPlaceItem}
                  onPress={() => navigation.navigate('TripDetail', { tripId, highlightItemId: place.id })}
                >
                  <Text style={styles.nearbyPlaceEmoji}>
                    {place.category === 'food' ? '🍽️' : 
                     place.category === 'place' ? '📍' : 
                     place.category === 'shopping' ? '🛍️' : '✨'}
                  </Text>
                  <View style={styles.nearbyPlaceInfo}>
                    <Text style={styles.nearbyPlaceName}>{place.name}</Text>
                    <Text style={styles.nearbyPlaceDistance}>{place.distance}m away</Text>
                  </View>
                  <Text style={styles.nearbyPlaceArrow}>→</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : isPendingImport && item.metadata?.places ? (
          /* Pending Import Message */
          <View style={styles.importMessageContainer}>
            <View style={styles.aiAvatarSmall}>
              <Text style={styles.aiAvatarEmoji}>🤖</Text>
            </View>
            <View style={styles.importMessage}>
              <Text style={styles.agentLabel}>TravelPal</Text>
              <View style={styles.importSourceCard}>
                <Text style={styles.importSourceEmoji}>
                  {item.metadata.source_type === 'youtube' ? '▶️' : 
                   item.metadata.source_type === 'reddit' ? '💬' : '📷'}
                </Text>
                <View style={styles.importSourceInfo}>
                  <Text style={styles.importSourceLabel}>
                    {(item.metadata.source_type || '').toUpperCase()}
                  </Text>
                  <Text style={styles.importSourceTitle} numberOfLines={2}>
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
                <Text style={styles.reviewButtonText}>REVIEW LOCATIONS →</Text>
              </TouchableOpacity>
              <Text style={styles.timestamp}>{formatMessageTime(item.created_at)}</Text>
            </View>
          </View>
        ) : isAgent ? (
          /* AI Agent Message */
          <View style={styles.agentMessageContainer}>
            <View style={styles.aiAvatar}>
              <Text style={styles.aiAvatarEmoji}>🤖</Text>
            </View>
            <View style={styles.agentBubble}>
              <Text style={styles.agentLabel}>TravelPal</Text>
              {isProcessing && (
                <View style={styles.processingIndicator}>
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                </View>
              )}
              <Text style={styles.agentText}>{content}</Text>
              <Text style={styles.timestamp}>{formatMessageTime(item.created_at)}</Text>
            </View>
          </View>
        ) : isCurrentUser ? (
          /* Current User Message (Right side) */
          <View style={styles.userMessageContainer}>
            <View style={styles.userBubble}>
              {hasURL && (
                <View style={styles.urlPreview}>
                  <Text style={styles.urlIcon}>{getSourceIcon(content)}</Text>
                  <Text style={styles.urlText} numberOfLines={2}>{content}</Text>
                </View>
              )}
              {!hasURL && <Text style={styles.userText}>{content}</Text>}
              <Text style={styles.timestampRight}>{formatMessageTime(item.created_at)}</Text>
            </View>
          </View>
        ) : (
          /* Other Member Message (Left side with avatar) */
          <View style={styles.memberMessageContainer}>
            <View style={styles.memberAvatarWrapper}>
              <View style={[styles.memberAvatar, { backgroundColor: getAvatarColor(senderName) }]}>
                <Text style={styles.memberAvatarText}>{getInitials(senderName)}</Text>
              </View>
              {isMemberOnline(item.sender_id) && <View style={styles.onlineDotSmall} />}
            </View>
            <View style={styles.memberBubble}>
              <Text style={styles.memberName}>{senderName}</Text>
              {hasURL && (
                <View style={styles.urlPreview}>
                  <Text style={styles.urlIcon}>{getSourceIcon(content)}</Text>
                  <Text style={styles.urlTextDark} numberOfLines={2}>{content}</Text>
                </View>
              )}
              {!hasURL && <Text style={styles.memberText}>{content}</Text>}
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
      keyboardVerticalOffset={90}
    >
      {/* Header with Members and Online Status */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <View style={styles.headerTitleRow}>
            <Text style={styles.headerTitle}>{currentTrip?.name || 'Group Chat'}</Text>
            {/* Connection indicator */}
            <View style={[styles.connectionDot, isConnected ? styles.connectedDot : styles.disconnectedDot]} />
          </View>
          <View style={styles.membersRow}>
            {currentTripMembers?.slice(0, 4).map((member, i) => (
              <View key={member.id} style={[styles.memberAvatarContainer, { marginLeft: i > 0 ? -8 : 0 }]}>
                <View 
                  style={[
                    styles.memberAvatarSmall,
                    { backgroundColor: getAvatarColor(member.name) }
                  ]}
                >
                  <Text style={styles.memberAvatarSmallText}>{getInitials(member.name)}</Text>
                </View>
                {isMemberOnline(member.id) && <View style={styles.onlineDotTiny} />}
              </View>
            ))}
            {(currentTripMembers?.length || 0) > 4 && (
              <View style={[styles.memberAvatarSmall, styles.memberCountBadge]}>
                <Text style={styles.memberCountText}>+{(currentTripMembers?.length || 0) - 4}</Text>
              </View>
            )}
            <Text style={styles.memberCountLabel}>
              {onlineCount > 0 ? `${onlineCount} online` : `${currentTripMembers?.length || 0} members`}
            </Text>
          </View>
        </View>
        <TouchableOpacity 
          style={styles.mapButton}
          onPress={() => navigation.navigate('TripDetail', { tripId })}
        >
          <Text style={styles.mapButtonText}>🗺️</Text>
        </TouchableOpacity>
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
              <View style={styles.emptyIconBox}>
                <Text style={styles.emptyIcon}>💬</Text>
              </View>
              <Text style={styles.emptyText}>Start chatting!</Text>
              <Text style={styles.emptySubtext}>
                Share YouTube/Instagram links to save places{'\n'}
                or chat with your travel squad
              </Text>
              <View style={styles.tipBox}>
                <Text style={styles.tipTitle}>💡 Pro Tip</Text>
                <Text style={styles.tipText}>
                  Type @AI to ask about saved places
                </Text>
              </View>
            </View>
          ) : null
        }
      />

      {/* Typing Indicator */}
      {typingText && (
        <View style={styles.typingContainer}>
          <View style={styles.typingDots}>
            <View style={[styles.typingDot, styles.typingDot1]} />
            <View style={[styles.typingDot, styles.typingDot2]} />
            <View style={[styles.typingDot, styles.typingDot3]} />
          </View>
          <Text style={styles.typingText}>{typingText}</Text>
        </View>
      )}

      {/* Input Bar */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Message or paste a link..."
          placeholderTextColor={theme.colors.textTertiary}
          value={inputText}
          onChangeText={handleTyping}
          multiline
          maxLength={2000}
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
          onImportComplete={(count) => {
            setImportModalData(null);
          }}
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
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    marginRight: 8,
  },
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  connectedDot: {
    backgroundColor: theme.colors.success,
  },
  disconnectedDot: {
    backgroundColor: theme.colors.textTertiary,
  },
  membersRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberAvatarContainer: {
    position: 'relative',
  },
  memberAvatarSmall: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberAvatarSmallText: {
    fontSize: 10,
    fontWeight: '800',
    color: theme.colors.textInverse,
  },
  memberCountBadge: {
    backgroundColor: theme.colors.textSecondary,
    marginLeft: -8,
  },
  memberCountText: {
    fontSize: 9,
    fontWeight: '800',
    color: theme.colors.textInverse,
  },
  memberCountLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginLeft: 8,
    fontWeight: '600',
  },
  onlineDotTiny: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.success,
    borderWidth: 1.5,
    borderColor: theme.colors.surface,
  },
  mapButton: {
    width: 40,
    height: 40,
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

  // Date Header
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dateHeaderLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.border,
  },
  dateHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    marginHorizontal: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // AI Avatar
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
  aiAvatarSmall: {
    width: 32,
    height: 32,
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

  // Agent Messages
  agentMessageContainer: {
    flexDirection: 'row',
    marginBottom: 12,
    maxWidth: '85%',
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
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  agentText: {
    fontSize: 15,
    lineHeight: 22,
    color: theme.colors.textPrimary,
  },
  processingIndicator: {
    marginBottom: 8,
  },

  // User Messages (Current user - Right side)
  userMessageContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 12,
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

  // Other Member Messages (Left side)
  memberMessageContainer: {
    flexDirection: 'row',
    marginBottom: 12,
    maxWidth: '85%',
  },
  memberAvatarWrapper: {
    position: 'relative',
    marginRight: 8,
  },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: theme.colors.borderDark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberAvatarText: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.textInverse,
  },
  onlineDotSmall: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.success,
    borderWidth: 2,
    borderColor: theme.colors.background,
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
    letterSpacing: 0.5,
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

  // URL Preview
  urlPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.1)',
    padding: 8,
    borderRadius: 4,
    marginBottom: 4,
  },
  urlIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  urlText: {
    flex: 1,
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
  },
  urlTextDark: {
    flex: 1,
    fontSize: 13,
    color: theme.colors.textSecondary,
  },

  // Location Alert
  locationAlertContainer: {
    marginBottom: 12,
  },
  locationAlert: {
    backgroundColor: theme.categoryColors.place.bg,
    borderWidth: 3,
    borderColor: theme.colors.borderDark,
    padding: 16,
    ...theme.shadows.neopop.md,
  },
  locationAlertTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: theme.colors.primary,
    textAlign: 'center',
    marginBottom: 4,
  },
  locationAlertSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 12,
  },
  nearbyPlaceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: theme.colors.borderDark,
    padding: 12,
    marginTop: 8,
  },
  nearbyPlaceEmoji: {
    fontSize: 20,
    marginRight: 10,
  },
  nearbyPlaceInfo: {
    flex: 1,
  },
  nearbyPlaceName: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  nearbyPlaceDistance: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  nearbyPlaceArrow: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.primary,
  },

  // Import Message
  importMessageContainer: {
    flexDirection: 'row',
    marginBottom: 12,
    maxWidth: '90%',
  },
  importMessage: {
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: theme.colors.borderDark,
    padding: 12,
    flex: 1,
    ...theme.shadows.neopop.sm,
  },
  importSourceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.backgroundAlt,
    borderWidth: 2,
    borderColor: theme.colors.border,
    padding: 10,
    marginVertical: 8,
  },
  importSourceEmoji: {
    fontSize: 20,
    marginRight: 10,
  },
  importSourceInfo: {
    flex: 1,
  },
  importSourceLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: theme.colors.textTertiary,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  importSourceTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  importMessageText: {
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.textPrimary,
    marginBottom: 12,
  },
  reviewButton: {
    backgroundColor: theme.colors.primary,
    borderWidth: 2,
    borderColor: theme.colors.borderDark,
    paddingVertical: 12,
    alignItems: 'center',
    ...theme.shadows.neopop.sm,
  },
  reviewButtonText: {
    color: theme.colors.textInverse,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  // Typing Indicator
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: theme.colors.backgroundAlt,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  typingDots: {
    flexDirection: 'row',
    marginRight: 8,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.textSecondary,
    marginHorizontal: 2,
  },
  typingDot1: {
    opacity: 0.4,
  },
  typingDot2: {
    opacity: 0.6,
  },
  typingDot3: {
    opacity: 0.8,
  },
  typingText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    marginTop: 60,
    paddingHorizontal: 24,
  },
  emptyIconBox: {
    width: 80,
    height: 80,
    backgroundColor: theme.colors.primary,
    borderWidth: 3,
    borderColor: theme.colors.borderDark,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    ...theme.shadows.neopop.md,
  },
  emptyIcon: {
    fontSize: 36,
  },
  emptyText: {
    fontSize: 22,
    fontWeight: '900',
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  tipBox: {
    backgroundColor: theme.categoryColors.tip.bg,
    borderWidth: 2,
    borderColor: theme.colors.borderDark,
    padding: 16,
    width: '100%',
  },
  tipTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  tipText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontWeight: '600',
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
