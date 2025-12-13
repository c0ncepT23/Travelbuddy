import React, { useEffect, useState, useRef } from 'react';
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
  RefreshControl,
  ScrollView,
  Dimensions,
} from 'react-native';
import { MotiView } from 'moti';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useChatStore } from '../../../stores/chatStore';
import { useAuthStore } from '../../../stores/authStore';
import { useTripStore } from '../../../stores/tripStore';
import { useItemStore } from '../../../stores/itemStore';
import ImportLocationsModal from '../../../components/ImportLocationsModal';
import YoriLogo from '../../../components/YoriLogo';
import { ImportModalData, SavedItem } from '../../../types';
import { HapticFeedback } from '../../../utils/haptics';
import { format, isToday, isYesterday } from 'date-fns';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const BOTTOM_TAB_HEIGHT = 80;

interface TripChatTabProps {
  tripId: string;
  navigation: any;
}


// Helper functions
const formatMessageTime = (date: Date): string => {
  return format(new Date(date), 'h:mm a');
};

const formatMessageDate = (date: Date | string): string => {
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

// Processing Card Component (for link parsing)
const ProcessingCard = ({ 
  status, 
  placesFound, 
  onViewMap 
}: { 
  status: 'parsing' | 'done' | 'error';
  placesFound: string[];
  onViewMap: () => void;
}) => {
  return (
    <MotiView
      from={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      style={styles.processingCard}
    >
      <View style={styles.processingHeader}>
        {status === 'parsing' ? (
          <>
            <ActivityIndicator size="small" color="#3B82F6" />
            <Text style={styles.processingTitle}>Parsing video...</Text>
          </>
        ) : status === 'done' ? (
          <>
            <Ionicons name="checkmark-circle" size={20} color="#10B981" />
            <Text style={styles.processingTitle}>Found {placesFound.length} places!</Text>
          </>
        ) : (
          <>
            <Ionicons name="alert-circle" size={20} color="#EF4444" />
            <Text style={styles.processingTitle}>Couldn't parse link</Text>
          </>
        )}
      </View>
      
      {status === 'done' && placesFound.length > 0 && (
        <>
          <View style={styles.processingPlaces}>
            {placesFound.slice(0, 3).map((place, idx) => (
              <View key={idx} style={styles.processingPlaceItem}>
                <Ionicons name="checkmark" size={16} color="#10B981" />
                <Text style={styles.processingPlaceText}>{place}</Text>
              </View>
            ))}
            {placesFound.length > 3 && (
              <Text style={styles.processingMore}>+{placesFound.length - 3} more</Text>
            )}
          </View>
          
          <TouchableOpacity style={styles.viewMapButton} onPress={onViewMap}>
            <Ionicons name="map" size={18} color="#FFFFFF" />
            <Text style={styles.viewMapText}>View on Map</Text>
          </TouchableOpacity>
        </>
      )}
    </MotiView>
  );
};

export default function TripChatTab({ tripId, navigation }: TripChatTabProps) {
  const { user } = useAuthStore();
  const { currentTrip } = useTripStore();
  const { 
    messages, 
    isLoading: chatLoading, 
    isSending,
    isConnected,
    typingUsers,
    fetchMessages, 
    sendMessageViaSocket,
    connectWebSocket,
    joinTripChat,
    leaveTripChat,
    startTyping,
    stopTyping,
  } = useChatStore();
  const { fetchTripItems } = useItemStore();

  const [inputText, setInputText] = useState('');
  const [importModalData, setImportModalData] = useState<ImportModalData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize chat
  useEffect(() => {
    const initChat = async () => {
      await fetchMessages(tripId);
      connectWebSocket();
      joinTripChat(tripId);
    };

    initChat();

    return () => {
      leaveTripChat(tripId);
    };
  }, [tripId]);

  // Handle input change with typing indicator
  const handleInputChange = (text: string) => {
    setInputText(text);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    if (text.length > 0) {
      startTyping(tripId);
      typingTimeoutRef.current = setTimeout(() => {
        stopTyping(tripId);
      }, 2000);
    } else {
      stopTyping(tripId);
    }
  };

  // Check if text is a URL
  const isURL = (text: string): boolean => {
    return text.includes('youtube.com') || 
           text.includes('youtu.be') || 
           text.includes('instagram.com') || 
           text.includes('reddit.com');
  };

  // Handle send message
  const handleSendMessage = async () => {
    if (!inputText.trim() || isSending) return;

    const messageText = inputText.trim();
    setInputText('');
    HapticFeedback.light();

    try {
      await sendMessageViaSocket(tripId, messageText);
      await fetchTripItems(tripId, {});
    } catch (error) {
      console.error('Send message error:', error);
    }
  };

  // Refresh messages
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchMessages(tripId);
    setRefreshing(false);
  };

  // Render processing card for link extraction
  const renderProcessingCard = (item: any) => {
    const metadata = item.metadata;
    const status = metadata?.status || 'processing';
    const sourceType = metadata?.source_type || 'link';
    
    const sourceIcon = sourceType === 'youtube' ? 'logo-youtube' :
                       sourceType === 'instagram' ? 'logo-instagram' :
                       sourceType === 'reddit' ? 'logo-reddit' : 'link';
    const sourceColor = sourceType === 'youtube' ? '#FF0000' :
                        sourceType === 'instagram' ? '#E4405F' :
                        sourceType === 'reddit' ? '#FF4500' : '#3B82F6';

    return (
      <MotiView
        from={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        style={styles.processingCard}
      >
        <View style={styles.processingHeader}>
          <View style={[styles.processingIconBg, { backgroundColor: `${sourceColor}15` }]}>
            <Ionicons name={sourceIcon as any} size={20} color={sourceColor} />
          </View>
          <View style={styles.processingHeaderText}>
            {status === 'processing' ? (
              <>
                <Text style={styles.processingTitle}>Analyzing content...</Text>
                <Text style={styles.processingSubtitle}>Extracting places with AI</Text>
              </>
            ) : status === 'empty' ? (
              <>
                <Text style={styles.processingTitle}>No places found</Text>
                <Text style={styles.processingSubtitle}>Try adding manually</Text>
              </>
            ) : status === 'error' ? (
              <>
                <Text style={[styles.processingTitle, { color: '#EF4444' }]}>Couldn't process</Text>
                <Text style={styles.processingSubtitle}>See message for details</Text>
              </>
            ) : null}
          </View>
          {status === 'processing' && (
            <ActivityIndicator size="small" color={sourceColor} />
          )}
          {status === 'empty' && (
            <Ionicons name="alert-circle" size={24} color="#F59E0B" />
          )}
          {status === 'error' && (
            <Ionicons name="close-circle" size={24} color="#EF4444" />
          )}
        </View>
        
        {status === 'processing' && (
          <View style={styles.processingSteps}>
            <MotiView
              from={{ width: '0%' }}
              animate={{ width: '100%' }}
              transition={{ type: 'timing', duration: 15000 }}
              style={styles.processingProgress}
            />
          </View>
        )}
      </MotiView>
    );
  };

  // Render message bubble
  const renderMessage = ({ item, index }: { item: any; index: number }) => {
    const isOwnMessage = item.sender_id === user?.id;
    const isAI = item.sender_type === 'agent';
    const showDate = index === messages.length - 1 || 
      formatMessageDate(messages[index + 1]?.created_at) !== formatMessageDate(item.created_at);
    
    // Check if this is a processing/extraction message
    const isProcessingMessage = item.metadata?.type === 'processing';
    const isExtractionResult = item.metadata?.type === 'extraction_result';

    return (
      <View>
        {showDate && (
          <View style={styles.dateHeader}>
            <Text style={styles.dateHeaderText}>{formatMessageDate(item.created_at)}</Text>
          </View>
        )}
        
        {/* Show processing card for processing messages */}
        {isProcessingMessage && renderProcessingCard(item)}
        
        {/* Show extraction result card for empty/error states */}
        {isExtractionResult && item.metadata?.status !== 'success' && renderProcessingCard(item)}
        
        {/* Regular message bubble (skip for processing-only messages) */}
        {!isProcessingMessage && (
          <MotiView
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 200 }}
            style={[
              styles.messageContainer,
              isOwnMessage ? styles.ownMessageContainer : styles.otherMessageContainer,
            ]}
          >
            {/* Avatar for AI/Others */}
            {!isOwnMessage && (
              <View style={[
                styles.avatar,
                isAI && styles.aiAvatar,
              ]}>
                {isAI ? (
                  <View style={styles.aiAvatarContent}>
                    <Ionicons name="sparkles" size={10} color="#5DBAF0" style={styles.aiAvatarSparkle} />
                    <Text style={styles.aiAvatarText}>Y</Text>
                  </View>
                ) : (
                  <Text style={styles.avatarText}>
                    {getInitials(item.sender_name || 'U')}
                  </Text>
                )}
              </View>
            )}

            {/* Message Bubble */}
            <View style={[
              styles.messageBubble,
              isOwnMessage && styles.ownMessageBubble,
              isAI && styles.aiMessageBubble,
            ]}>
              {!isOwnMessage && !isAI && (
                <Text style={styles.senderName}>{item.sender_name}</Text>
              )}
              <Text style={[
                styles.messageText,
                isOwnMessage && styles.ownMessageText,
              ]}>
                {item.content}
              </Text>
              <Text style={[
                styles.messageTime,
                isOwnMessage && styles.ownMessageTime,
              ]}>
                {formatMessageTime(item.created_at)}
              </Text>
            </View>
          </MotiView>
        )}
      </View>
    );
  };

  // Typing indicator
  const renderTypingIndicator = () => {
    const otherTypingUsers = typingUsers.filter(u => String(u.userId) !== user?.id);
    if (otherTypingUsers.length === 0) return null;

    return (
      <View style={styles.typingContainer}>
        <View style={styles.typingDots}>
          {[0, 1, 2].map((i) => (
            <MotiView
              key={i}
              from={{ opacity: 0.3 }}
              animate={{ opacity: 1 }}
              transition={{
                type: 'timing',
                duration: 400,
                loop: true,
                delay: i * 150,
              }}
              style={styles.typingDot}
            />
          ))}
        </View>
        <Text style={styles.typingText}>AI is thinking...</Text>
      </View>
    );
  };

  // Empty state with Yori logo and AI sparkles
  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <MotiView
        from={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 15 }}
        style={styles.emptyMascotContainer}
      >
        {/* AI Sparkles around logo - animated */}
        <MotiView
          from={{ opacity: 0.4, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1.1 }}
          transition={{ type: 'timing', duration: 1500, loop: true }}
          style={[styles.sparkle, { top: -5, left: 5 }]}
        >
          <Ionicons name="sparkles" size={22} color="#5DBAF0" />
        </MotiView>
        <MotiView
          from={{ opacity: 0.6, scale: 1 }}
          animate={{ opacity: 1, scale: 0.9 }}
          transition={{ type: 'timing', duration: 1200, loop: true, delay: 400 }}
          style={[styles.sparkle, { top: 10, right: -5 }]}
        >
          <Ionicons name="sparkles" size={18} color="#F5A26B" />
        </MotiView>
        <MotiView
          from={{ opacity: 0.5, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1.15 }}
          transition={{ type: 'timing', duration: 1800, loop: true, delay: 800 }}
          style={[styles.sparkle, { bottom: 5, left: -8 }]}
        >
          <Ionicons name="sparkles" size={16} color="#A8B4C2" />
        </MotiView>
        <MotiView
          from={{ opacity: 0.3, scale: 1.1 }}
          animate={{ opacity: 0.9, scale: 0.85 }}
          transition={{ type: 'timing', duration: 2000, loop: true, delay: 200 }}
          style={[styles.sparkle, { bottom: 15, right: 0 }]}
        >
          <Ionicons name="sparkles" size={14} color="#E8A07A" />
        </MotiView>
        
        {/* Yori Logo Circle */}
        <View style={styles.yoriLogoCircle}>
          <LinearGradient
            colors={['#F8FCFF', '#F0F7FF']}
            style={styles.yoriLogoGradient}
          >
            <YoriLogo size="medium" />
          </LinearGradient>
        </View>
      </MotiView>
      <Text style={styles.emptyTitle}>Hey there!</Text>
      <Text style={styles.emptySubtitle}>
        I'm Yori, your AI travel assistant. Paste a YouTube guide, ask for recommendations, or let me help plan your trip!
      </Text>
    </View>
  );

  const hasMessages = messages && messages.length > 0;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {hasMessages ? (
        <FlatList
          ref={flatListRef}
          data={[...messages].reverse()}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
          contentContainerStyle={[styles.messagesList, { paddingBottom: BOTTOM_TAB_HEIGHT + 80 }]}
          inverted
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#3B82F6"
            />
          }
          ListHeaderComponent={renderTypingIndicator}
        />
      ) : (
        <ScrollView 
          style={styles.emptyScrollView}
          contentContainerStyle={[styles.emptyScrollContent, { paddingBottom: BOTTOM_TAB_HEIGHT + 100 }]}
          showsVerticalScrollIndicator={false}
        >
          {renderEmptyState()}
        </ScrollView>
      )}

      {/* Input Area */}
      <View style={styles.inputArea}>
        {/* Input Bar */}
        <View style={styles.inputBar}>
          <TouchableOpacity style={styles.linkButton}>
            <Ionicons name="link" size={20} color="#94A3B8" />
          </TouchableOpacity>
          
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={handleInputChange}
            placeholder="Paste a link or ask..."
            placeholderTextColor="#94A3B8"
            multiline
            maxLength={1000}
          />
          
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!inputText.trim() || isSending) && styles.sendButtonDisabled,
            ]}
            onPress={handleSendMessage}
            disabled={!inputText.trim() || isSending}
          >
            {isSending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>
        
        {/* Connection Status */}
        {!isConnected && (
          <View style={styles.connectionStatus}>
            <Text style={styles.connectionText}>⚡ Reconnecting...</Text>
          </View>
        )}
      </View>

      {/* Import Modal */}
      {importModalData && (
        <ImportLocationsModal
          visible={!!importModalData}
          onClose={() => setImportModalData(null)}
          sourceUrl={importModalData.sourceUrl}
          sourceType={importModalData.sourceType}
          sourceTitle={importModalData.sourceTitle}
          summary={importModalData.summary}
          places={importModalData.places}
          tripId={tripId}
          onImportComplete={(count) => {
            console.log(`[ChatTab] Imported ${count} places`);
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
    backgroundColor: '#F8FAFC',
  },

  // Messages
  messagesList: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  dateHeader: {
    alignItems: 'center',
    marginVertical: 16,
  },
  dateHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 12,
    maxWidth: '85%',
  },
  ownMessageContainer: {
    alignSelf: 'flex-end',
    flexDirection: 'row-reverse',
  },
  otherMessageContainer: {
    alignSelf: 'flex-start',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  aiAvatar: {
    backgroundColor: '#F8F8F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  aiAvatarContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiAvatarSparkle: {
    position: 'absolute',
    top: -2,
    right: -2,
  },
  aiAvatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#5DBAF0',
  },
  avatarEmoji: {
    fontSize: 18,
  },
  avatarText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  messageBubble: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderTopLeftRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxWidth: SCREEN_WIDTH * 0.7,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  ownMessageBubble: {
    backgroundColor: '#3B82F6',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 4,
  },
  aiMessageBubble: {
    backgroundColor: '#F1F5F9',
    borderTopLeftRadius: 4,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 15,
    color: '#1F2937',
    lineHeight: 20,
  },
  ownMessageText: {
    color: '#FFFFFF',
  },
  messageTime: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  ownMessageTime: {
    color: 'rgba(255,255,255,0.7)',
  },

  // Typing Indicator
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  typingDots: {
    flexDirection: 'row',
    gap: 4,
    marginRight: 8,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#94A3B8',
  },
  typingText: {
    fontSize: 12,
    color: '#94A3B8',
  },

  // Empty State
  emptyScrollView: {
    flex: 1,
  },
  emptyScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyState: {
    alignItems: 'center',
  },
  emptyMascotContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
    width: 140,
    height: 140,
  },
  sparkle: {
    position: 'absolute',
    zIndex: 10,
  },
  yoriLogoCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
    shadowColor: '#5DBAF0',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 6,
  },
  yoriLogoGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 60,
    borderWidth: 3,
    borderColor: 'rgba(93, 186, 240, 0.2)',
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
  },

  // Input Area
  inputArea: {
    position: 'absolute',
    bottom: BOTTOM_TAB_HEIGHT,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 8 : 12,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#F8FAFC',
    borderRadius: 24,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  linkButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: '#1F2937',
    maxHeight: 100,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#CBD5E1',
  },
  connectionStatus: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  connectionText: {
    fontSize: 11,
    color: '#F59E0B',
  },

  // Processing Card - Enhanced
  processingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginVertical: 8,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  processingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  processingIconBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingHeaderText: {
    flex: 1,
  },
  processingTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  processingSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  processingSteps: {
    marginTop: 16,
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  processingProgress: {
    height: '100%',
    backgroundColor: '#3B82F6',
    borderRadius: 2,
  },
  processingPlaces: {
    marginTop: 12,
    marginBottom: 12,
  },
  processingPlaceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  processingPlaceText: {
    fontSize: 13,
    color: '#475569',
  },
  processingMore: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
  },
  viewMapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    paddingVertical: 10,
    gap: 8,
  },
  viewMapText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
