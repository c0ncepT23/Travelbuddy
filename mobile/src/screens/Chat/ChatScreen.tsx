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
  Alert,
} from 'react-native';
// import * as ImagePicker from 'expo-image-picker'; // TODO: Add back for image upload feature
import { useChatStore } from '../../stores/chatStore';
import { useAuthStore } from '../../stores/authStore';
import { format } from 'date-fns';
import ImportLocationsModal from '../../components/ImportLocationsModal';
import { ImportModalData } from '../../types';

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

    // Render CHUNKY Location Alert
    if (isLocationAlert && item.metadata?.places) {
      return (
        <View style={styles.locationAlertContainer}>
          <View style={styles.locationAlert}>
            <Text style={styles.locationAlertTitle}>
              🚨 LOCATION ALERT! You're in {item.metadata.location}! 🚨
            </Text>
            <Text style={styles.locationAlertSubtitle}>
              You saved {item.metadata.places.length} dope {item.metadata.places.length === 1 ? 'spot' : 'spots'} nearby. Which vibe are we catching?
            </Text>
            
            <View style={styles.placesContainer}>
              {item.metadata.places.map((place: any, index: number) => (
                <View key={place.id} style={styles.placeItem}>
                  <View style={styles.placeInfo}>
                    <Text style={styles.placeEmoji}>
                      {place.category === 'food' ? '🍽️' : 
                       place.category === 'place' ? '📍' : 
                       place.category === 'shopping' ? '🛍️' : 
                       place.category === 'activity' ? '🎯' : '✨'}
                    </Text>
                    <View style={styles.placeText}>
                      <Text style={styles.placeName}>{place.name}</Text>
                      <Text style={styles.placeDistance}>{place.distance}m away</Text>
                    </View>
                  </View>
                  <TouchableOpacity 
                    style={styles.goNowButton}
                    onPress={() => {
                      // Navigate to Trip Detail and show this place
                      navigation.navigate('TripDetail', { tripId, highlightItemId: place.id });
                    }}
                  >
                    <Text style={styles.goNowButtonText}>Go Now 🗺️</Text>
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
            <Text style={styles.agentBadge}>🤖 Agent</Text>
            
            {/* Source Card */}
            <View style={styles.importSourceCard}>
              <Text style={styles.importSourceEmoji}>{sourceEmoji}</Text>
              <View style={styles.importSourceInfo}>
                <Text style={styles.importSourceLabel}>
                  {(item.metadata.source_type || '').toUpperCase()}
                </Text>
                <Text style={styles.importSourceTitle} numberOfLines={2}>
                  {item.metadata.video_title || 'Content'}
                </Text>
              </View>
            </View>

            {/* Message Content */}
            <Text style={styles.importMessageText}>{content}</Text>

            {/* Review Button */}
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
              <Text style={styles.reviewButtonText}>Review Locations →</Text>
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
        {isAgent && <Text style={styles.agentBadge}>🤖 Agent</Text>}

        {/* Source Card for URLs */}
        {hasURL && !isAgent && renderSourceCard(content)}

        {/* Message Content */}
        {!hasURL && (
          <>
            {isComplete && <Text style={styles.successIcon}>✨</Text>}
            <Text style={[styles.messageText, isAgent && styles.agentText]}>
              {content}
            </Text>
          </>
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
            <Text style={styles.actionButtonText}>Go to Saved Places</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.timestamp}>
          {format(new Date(item.created_at), 'h:mm a')}
        </Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
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
              <Text style={styles.emptyIcon}>💬</Text>
              <Text style={styles.emptyText}>Start chatting with your travel agent!</Text>
              <Text style={styles.emptySubtext}>
                Share links, photos, or ask questions
              </Text>
            </View>
          ) : null
        }
      />

      <View style={styles.inputContainer}>
        <TouchableOpacity style={styles.imageButton} onPress={handleImagePick}>
          <Text style={styles.imageButtonText}>📷</Text>
        </TouchableOpacity>

        <TextInput
          style={styles.input}
          placeholder="Message or paste a link..."
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
          <Text style={styles.sendButtonText}>
            {isSending ? '...' : '➤'}
          </Text>
        </TouchableOpacity>
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  messageList: {
    padding: 16,
    paddingBottom: 8,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  agentBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#E3F2FD',
    borderBottomLeftRadius: 4,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#E8E8E8',
    borderBottomLeftRadius: 4,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  agentBadge: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1976D2',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
    color: '#fff',
  },
  agentText: {
    color: '#000',
  },
  timestamp: {
    fontSize: 10,
    color: 'rgba(0,0,0,0.4)',
    marginTop: 4,
  },
  successIcon: {
    fontSize: 24,
    marginBottom: 8,
  },

  // Source Card
  sourceCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
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
    fontSize: 12,
    fontWeight: '700',
    color: '#666',
    textTransform: 'uppercase',
  },
  sourceCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },

  // Processing Dots
  processingDots: {
    flexDirection: 'row',
    marginTop: 8,
  },
  dot: {
    fontSize: 20,
    color: '#007AFF',
    marginHorizontal: 2,
  },

  // Action Button
  actionButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 12,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    marginTop: 100,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },

  // Input Container
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    alignItems: 'center',
  },
  imageButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  imageButtonText: {
    fontSize: 24,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },

  // ========== CHUNKY LOCATION ALERT STYLES ==========
  locationAlertContainer: {
    marginBottom: 16,
    width: '100%',
  },
  locationAlert: {
    backgroundColor: '#FFFFFF',
    borderWidth: 4,
    borderColor: '#000000',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 6,
  },
  locationAlertTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#00FF00',
    textAlign: 'center',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  locationAlertSubtitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
    textAlign: 'center',
    marginBottom: 16,
  },
  placesContainer: {
    gap: 12,
  },
  placeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F5F5DC',
    borderWidth: 3,
    borderColor: '#000000',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  placeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  placeEmoji: {
    fontSize: 20,
    marginRight: 8,
  },
  placeText: {
    flex: 1,
  },
  placeName: {
    fontSize: 14,
    fontWeight: '900',
    color: '#000000',
    marginBottom: 2,
  },
  placeDistance: {
    fontSize: 12,
    fontWeight: '700',
    color: '#666666',
  },
  goNowButton: {
    backgroundColor: '#0000FF',
    borderWidth: 2,
    borderColor: '#000000',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  goNowButtonText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  locationTimestamp: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
    textAlign: 'center',
  },

  // ========== PENDING IMPORT MESSAGE STYLES ==========
  importMessageContainer: {
    marginBottom: 12,
    width: '85%',
    alignSelf: 'flex-start',
  },
  importMessage: {
    backgroundColor: '#E3F2FD',
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    padding: 12,
  },
  importSourceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 10,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
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
    fontWeight: '700',
    color: '#666',
    marginBottom: 2,
  },
  importSourceTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000',
  },
  importMessageText: {
    fontSize: 15,
    lineHeight: 20,
    color: '#000',
    marginBottom: 12,
  },
  reviewButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  reviewButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
