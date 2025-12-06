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
import { LinearGradient } from 'expo-linear-gradient';
import { useChatStore } from '../../../stores/chatStore';
import { useAuthStore } from '../../../stores/authStore';
import { useTripStore } from '../../../stores/tripStore';
import { useItemStore } from '../../../stores/itemStore';
import { useBriefingStore } from '../../../stores/briefingStore';
import { useLocationStore } from '../../../stores/locationStore';
import ImportLocationsModal from '../../../components/ImportLocationsModal';
import { ImportModalData, SavedItem } from '../../../types';
import { HapticFeedback } from '../../../utils/haptics';
import { format, isToday, isYesterday } from 'date-fns';
import theme from '../../../config/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface TripChatTabProps {
  tripId: string;
  navigation: any;
}


// Helper functions
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
    '#3B82F6',
    '#10B981',
    '#F59E0B',
    '#EC4899',
    '#8B5CF6',
    '#06B6D4',
  ];
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
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
  const { briefing, fetchBriefing } = useBriefingStore();
  const { location } = useLocationStore();
  const { fetchTripItems } = useItemStore();

  const [inputText, setInputText] = useState('');
  const [importModalData, setImportModalData] = useState<ImportModalData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize chat
  useEffect(() => {
    const initChat = async () => {
      try {
        await fetchMessages(tripId);
        await fetchTripItems(tripId, {});
        
        // Fetch briefing with location
        const locationData = location
          ? { lat: location.coords.latitude, lng: location.coords.longitude }
          : undefined;
        await fetchBriefing(tripId, locationData);
        
        // Connect WebSocket
        await connectWebSocket();
        joinTripChat(tripId);
      } catch (error) {
        console.error('[ChatTab] Init error:', error);
      }
    };

    initChat();

    return () => {
      leaveTripChat(tripId);
    };
  }, [tripId]);

  // Handle input change with typing indicator
  const handleInputChange = (text: string) => {
    setInputText(text);
    
    if (text.length > 0) {
      startTyping(tripId);
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      typingTimeoutRef.current = setTimeout(() => {
        stopTyping(tripId);
      }, 2000);
    } else {
      stopTyping(tripId);
    }
  };

  // Send message
  const handleSendMessage = async (messageText?: string) => {
    const textToSend = messageText || inputText.trim();
    if (!textToSend || isSending) return;

    HapticFeedback.medium();
    setInputText('');
    stopTyping(tripId);

    try {
      await sendMessageViaSocket(tripId, textToSend);
    } catch (error) {
      console.error('[ChatTab] Send error:', error);
    }
  };


  // Pull to refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchMessages(tripId);
    setRefreshing(false);
  };

  // Empty state with welcome message
  const renderEmptyState = () => (
    <View style={styles.emptyStateContainer}>
      {/* AI Avatar */}
      <MotiView
        from={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 15 }}
        style={styles.welcomeAvatar}
      >
        <LinearGradient
          colors={['#3B82F6', '#8B5CF6']}
          style={styles.welcomeAvatarGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={styles.welcomeAvatarEmoji}>🤖</Text>
        </LinearGradient>
      </MotiView>

      {/* Welcome Text */}
      <MotiView
        from={{ translateY: 20, opacity: 0 }}
        animate={{ translateY: 0, opacity: 1 }}
        transition={{ type: 'timing', duration: 400, delay: 200 }}
      >
        <Text style={styles.welcomeTitle}>Hey there! 👋</Text>
        <Text style={styles.welcomeSubtitle}>
          I'm your AI travel companion for{'\n'}
          <Text style={styles.welcomeDestination}>{currentTrip?.destination || 'this trip'}</Text>
        </Text>
      </MotiView>

      {/* What I can help with */}
      <MotiView
        from={{ translateY: 20, opacity: 0 }}
        animate={{ translateY: 0, opacity: 1 }}
        transition={{ type: 'timing', duration: 400, delay: 400 }}
        style={styles.helpSection}
      >
        <Text style={styles.helpTitle}>I can help you with:</Text>
        <View style={styles.helpItems}>
          {[
            { icon: '📍', text: 'Find amazing places' },
            { icon: '🗓️', text: 'Plan your days' },
            { icon: '🎥', text: 'Import YouTube guides' },
            { icon: '💡', text: 'Local tips & insights' },
          ].map((item, index) => (
            <MotiView
              key={index}
              from={{ translateX: -20, opacity: 0 }}
              animate={{ translateX: 0, opacity: 1 }}
              transition={{ type: 'timing', duration: 300, delay: 500 + index * 100 }}
              style={styles.helpItem}
            >
              <Text style={styles.helpItemIcon}>{item.icon}</Text>
              <Text style={styles.helpItemText}>{item.text}</Text>
            </MotiView>
          ))}
        </View>
      </MotiView>

    </View>
  );

  // Render message
  const renderMessage = ({ item, index }: { item: any; index: number }) => {
    const isAI = item.metadata?.isAI || item.sender_email === 'ai@travelagent.app';
    const isOwnMessage = item.sender_id === user?.id && !isAI;
    const showDateSeparator = index === messages.length - 1 || 
      formatMessageDate(new Date(item.created_at)) !== formatMessageDate(new Date(messages[index + 1]?.created_at));

    return (
      <View>
        {showDateSeparator && (
          <View style={styles.dateSeparator}>
            <View style={styles.dateLine} />
            <Text style={styles.dateText}>{formatMessageDate(item.created_at)}</Text>
            <View style={styles.dateLine} />
          </View>
        )}
        
        <MotiView
          from={{ opacity: 0, translateY: 10 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 200 }}
          style={[
            styles.messageContainer,
            isOwnMessage && styles.ownMessageContainer,
          ]}
        >
          {/* Avatar */}
          {!isOwnMessage && (
            <View style={[
              styles.avatar,
              isAI && styles.aiAvatar,
              !isAI && { backgroundColor: getAvatarColor(item.sender_name || 'User') }
            ]}>
              {isAI ? (
                <LinearGradient
                  colors={['#3B82F6', '#8B5CF6']}
                  style={styles.aiAvatarGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Text style={styles.avatarText}>🤖</Text>
                </LinearGradient>
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
            {!isOwnMessage && (
              <Text style={[styles.senderName, isAI && styles.aiSenderName]}>
                {isAI ? '✨ TravelPal' : item.sender_name}
              </Text>
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
            
            {/* AI Suggestions - Disabled for now */}
          </View>
        </MotiView>
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
        <Text style={styles.typingText}>TravelPal is thinking...</Text>
      </View>
    );
  };

  const hasMessages = messages && messages.length > 0;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Background */}
      <View style={styles.backgroundPattern}>
        {[...Array(20)].map((_, i) => (
          <View 
            key={i} 
            style={[
              styles.patternDot,
              { 
                left: `${(i % 5) * 25}%`, 
                top: `${Math.floor(i / 5) * 25}%`,
                opacity: 0.03 + (i % 3) * 0.02,
              }
            ]} 
          />
        ))}
      </View>

      {hasMessages ? (
        <>
          {/* Messages List */}
          <FlatList
            ref={flatListRef}
            data={[...messages].reverse()}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
            contentContainerStyle={styles.messagesList}
            inverted
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={theme.colors.primary}
              />
            }
            ListHeaderComponent={renderTypingIndicator}
          />
        </>
      ) : (
        <ScrollView 
          style={styles.emptyScrollView}
          contentContainerStyle={styles.emptyScrollContent}
          showsVerticalScrollIndicator={false}
        >
          {renderEmptyState()}
        </ScrollView>
      )}

      {/* Input Area */}
      <View style={styles.inputContainer}>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={handleInputChange}
            placeholder="Ask me anything..."
            placeholderTextColor="#94A3B8"
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!inputText.trim() || isSending) && styles.sendButtonDisabled,
            ]}
            onPress={() => handleSendMessage()}
            disabled={!inputText.trim() || isSending}
          >
            {isSending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <LinearGradient
                colors={inputText.trim() ? ['#3B82F6', '#8B5CF6'] : ['#CBD5E1', '#CBD5E1']}
                style={styles.sendButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.sendButtonText}>↑</Text>
              </LinearGradient>
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
  backgroundPattern: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  patternDot: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#3B82F6',
  },

  // Empty State
  emptyScrollView: {
    flex: 1,
  },
  emptyScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: 40,
  },
  emptyStateContainer: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  welcomeAvatar: {
    marginBottom: 24,
  },
  welcomeAvatarGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  welcomeAvatarEmoji: {
    fontSize: 36,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 24,
  },
  welcomeDestination: {
    color: '#3B82F6',
    fontWeight: '700',
  },
  helpSection: {
    marginTop: 32,
    width: '100%',
  },
  helpTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 16,
    textAlign: 'center',
  },
  helpItems: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  helpItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  helpItemIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  helpItemText: {
    fontSize: 15,
    color: '#334155',
    fontWeight: '500',
  },

  // Messages
  messagesList: {
    padding: 16,
    paddingBottom: 8,
  },

  // Date Separator
  dateSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dateLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  dateText: {
    paddingHorizontal: 12,
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },

  // Message
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-end',
  },
  ownMessageContainer: {
    justifyContent: 'flex-end',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    overflow: 'hidden',
  },
  aiAvatar: {
    backgroundColor: 'transparent',
  },
  aiAvatarGradient: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  messageBubble: {
    maxWidth: '75%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderBottomLeftRadius: 4,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  ownMessageBubble: {
    backgroundColor: '#3B82F6',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 4,
  },
  aiMessageBubble: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  senderName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 4,
  },
  aiSenderName: {
    color: '#8B5CF6',
  },
  messageText: {
    fontSize: 15,
    color: '#1E293B',
    lineHeight: 22,
  },
  ownMessageText: {
    color: '#FFFFFF',
  },
  messageTime: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 6,
    alignSelf: 'flex-end',
  },
  ownMessageTime: {
    color: 'rgba(255,255,255,0.7)',
  },


  // Typing Indicator
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  typingDots: {
    flexDirection: 'row',
    marginRight: 8,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#8B5CF6',
    marginHorizontal: 2,
  },
  typingText: {
    fontSize: 12,
    color: '#8B5CF6',
    fontWeight: '500',
  },

  // Input
  inputContainer: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingTop: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#F1F5F9',
    borderRadius: 24,
    paddingLeft: 18,
    paddingRight: 4,
    paddingVertical: 4,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: '#1E293B',
    maxHeight: 100,
    paddingVertical: 12,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonGradient: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  connectionStatus: {
    alignItems: 'center',
    paddingTop: 8,
  },
  connectionText: {
    fontSize: 12,
    color: '#F59E0B',
    fontWeight: '500',
  },
});
