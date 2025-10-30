import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  Dimensions,
  Share,
  Alert,
  Linking,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useTripStore } from '../../stores/tripStore';
import { useItemStore } from '../../stores/itemStore';
import { useCompanionStore } from '../../stores/companionStore';
import { useLocationStore } from '../../stores/locationStore';
import { MapView } from '../../components/MapView';
import CategorizedListView from './CategorizedListView';
import { TimelineScreen } from './TimelineScreen';
import { format } from 'date-fns';
import { SavedItem } from '../../types';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Helper function to generate consistent color from string
const stringToColor = (str: string) => {
  const colors = ['#6366F1', '#8B5CF6', '#EC4899', '#EF4444', '#F59E0B', '#10B981', '#06B6D4', '#3B82F6'];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

/**
 * TripDetailScreen - Map-First with AI Assistant
 * 
 * New Architecture:
 * - Primary view: Map showing all saved places
 * - FAB button opens AI chat as overlay
 * - Visual representation of all saved places
 * - Chat for adding content and queries
 */
export default function TripDetailScreen({ route, navigation }: any) {
  const { tripId } = route.params;
  const { currentTrip, currentTripMembers, fetchTripDetails, fetchTripMembers } = useTripStore();
  const { items, fetchTripItems } = useItemStore();
  const { getMessages, isLoading: chatLoading, sendQuery } = useCompanionStore();
  const { 
    location, 
    initializeNotifications, 
    startBackgroundTracking, 
    stopBackgroundTracking,
    isBackgroundTracking 
  } = useLocationStore();
  
  // Get trip-specific messages
  const messages = getMessages(tripId);
  const [isLoading, setIsLoading] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [inputText, setInputText] = useState('');
  const [viewMode, setViewMode] = useState<'map' | 'list' | 'timeline'>('map');
  const [showShareModal, setShowShareModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [mapRegion, setMapRegion] = useState({
    latitude: 35.6762, // Default to Tokyo
    longitude: 139.6503,
    latitudeDelta: 0.1,
    longitudeDelta: 0.1,
  });

  const handleShareTrip = async () => {
    if (!currentTrip) return;

    const inviteLink = `https://travelagent.app/join/${currentTrip.invite_code}`;
    const message = `Join my trip "${currentTrip.name}" to ${currentTrip.destination}!\n\nInvite Code: ${currentTrip.invite_code}\nLink: ${inviteLink}`;

    try {
      if (Platform.OS === 'web') {
        // For web, show modal with copy button
        setShowShareModal(true);
      } else {
        // For mobile, use native share
        await Share.share({
          message,
          title: `Join ${currentTrip.name}`,
        });
      }
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await Clipboard.setStringAsync(text);
      if (Platform.OS === 'web') {
        window.alert('Copied to clipboard!');
      } else {
        Alert.alert('Copied!', 'Invite link copied to clipboard');
      }
    } catch (error) {
      console.error('Error copying:', error);
    }
  };

  useEffect(() => {
    const loadTripData = async () => {
      try {
        setIsLoading(true);
        
        // Load trip details
        await fetchTripDetails(tripId);
        await fetchTripMembers(tripId);
        
        // Load saved places
        const loadedItems = await fetchTripItems(tripId, {});
        
        // DEBUG: Check items
        console.log('[TripDetail] Loaded items:', loadedItems.length);
        console.log('[TripDetail] First item:', loadedItems[0]);
        
        // Center map on saved places if any
        if (loadedItems.length > 0) {
          const validItems = loadedItems.filter(item => item.location_lat && item.location_lng);
          console.log('[TripDetail] Valid items with location:', validItems.length);
          
          if (validItems.length > 0) {
            const avgLat = validItems.reduce((sum, item) => sum + (item.location_lat || 0), 0) / validItems.length;
            const avgLng = validItems.reduce((sum, item) => sum + (item.location_lng || 0), 0) / validItems.length;
            
            console.log('[TripDetail] Setting map center:', { avgLat, avgLng });
            
            setMapRegion({
              latitude: avgLat,
              longitude: avgLng,
              latitudeDelta: 0.1,
              longitudeDelta: 0.1,
            });
          }
        }
        
        setIsLoading(false);
      } catch (error) {
        console.error('[TripDetail] Error loading trip:', error);
        setIsLoading(false);
      }
    };

    loadTripData();
  }, [tripId]);

  // Initialize notifications and background tracking
  useEffect(() => {
    const initializeLocationFeatures = async () => {
      try {
        // Initialize push notifications
        await initializeNotifications();
        console.log('[TripDetail] Notifications initialized');

        // Start background location tracking for this trip
        await startBackgroundTracking(tripId);
        console.log('[TripDetail] Background tracking started');
      } catch (error) {
        console.error('[TripDetail] Error initializing location features:', error);
        // Don't block the app if this fails
      }
    };

    initializeLocationFeatures();

    // Cleanup: stop background tracking when leaving this screen
    return () => {
      stopBackgroundTracking();
      console.log('[TripDetail] Background tracking stopped on unmount');
    };
  }, [tripId]);

  // Re-center map when items are updated
  useEffect(() => {
    if (items.length > 0) {
      const validItems = items.filter(item => item.location_lat && item.location_lng);
      
      if (validItems.length > 0) {
        const avgLat = validItems.reduce((sum, item) => sum + (item.location_lat || 0), 0) / validItems.length;
        const avgLng = validItems.reduce((sum, item) => sum + (item.location_lng || 0), 0) / validItems.length;
        
        setMapRegion({
          latitude: avgLat,
          longitude: avgLng,
          latitudeDelta: 0.1,
          longitudeDelta: 0.1,
        });
        
        console.log('[TripDetail] Map updated for', items.length, 'items');
      }
    }
  }, [items.length]);

  const handleSendMessage = async () => {
    if (!inputText.trim() || chatLoading) return;

    const message = inputText.trim();
    setInputText('');
    
    // Check if message is for AI or group members
    const hasAIMention = message.toLowerCase().includes('@ai') || 
                        message.toLowerCase().includes('@assistant');
    const hasYouTubeLink = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|m\.youtube\.com\/watch\?v=)([\w-]+)/.test(message);
    
    // AI processes: @AI mentions OR YouTube links
    const isAIMessage = hasAIMention || hasYouTubeLink;

    try {
      if (isAIMessage) {
        // Remove @AI or @assistant from message if present
        const cleanMessage = message.replace(/@ai|@assistant/gi, '').trim() || message;
        
        const locationData = location
          ? { lat: location.coords.latitude, lng: location.coords.longitude }
          : undefined;
        
        await sendQuery(tripId, cleanMessage, locationData);
        
        // Refresh items after processing (in case new places were added)
        setTimeout(async () => {
          const refreshedItems = await fetchTripItems(tripId, {});
          
          // Re-center map if new places were added
          if (refreshedItems && refreshedItems.length > items.length) {
            const validItems = refreshedItems.filter(item => item.location_lat && item.location_lng);
            
            if (validItems.length > 0) {
              const avgLat = validItems.reduce((sum, item) => sum + (item.location_lat || 0), 0) / validItems.length;
              const avgLng = validItems.reduce((sum, item) => sum + (item.location_lng || 0), 0) / validItems.length;
              
              setMapRegion({
                latitude: avgLat,
                longitude: avgLng,
                latitudeDelta: 0.1,
                longitudeDelta: 0.1,
              });
              
              console.log('[TripDetail] Map re-centered after adding new places');
            }
          }
        }, 2000);
      } else {
        // Regular group message - send to group members
        // TODO: Connect to WebSocket to broadcast to other members
        console.log('[GroupChat] Sending group message:', message);
        
        // For now, show a hint that this is a group message
        Alert.alert(
          '💬 Group Message', 
          'This message is for trip members.\n\nTip: Use @AI or paste YouTube links to talk to the AI assistant!',
          [{ text: 'Got it!' }]
        );
      }
    } catch (error) {
      console.error('Send query error:', error);
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: any = {
      food: '#FF6B6B',
      place: '#4ECDC4',
      shopping: '#FFD93D',
      activity: '#95E1D3',
      accommodation: '#A8E6CF',
      tip: '#C7CEEA',
    };
    return colors[category] || '#FF6B6B';
  };

  const getCategoryEmoji = (category: string) => {
    const emojis: any = {
      food: '🍽️',
      place: '📍',
      shopping: '🛍️',
      activity: '🎯',
      accommodation: '🏨',
      tip: '💡',
    };
    return emojis[category] || '📍';
  };

  // Loading state
  if (isLoading || !currentTrip) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#8B5CF6" />
        <Text style={styles.loadingText}>Loading your trip map...</Text>
      </View>
    );
  }

  // Main Map View
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.tripName}>{currentTrip.name}</Text>
          <Text style={styles.tripStats}>📍 {currentTrip?.destination || ''} • {items.length} places</Text>
        </View>
        {/* Action Buttons */}
        <View style={styles.headerActions}>
          {/* Members Display */}
          {currentTripMembers && currentTripMembers.length > 0 && (
            <TouchableOpacity 
              style={styles.membersButton}
              onPress={() => setShowMembersModal(true)}
            >
              <View style={styles.membersAvatars}>
                {currentTripMembers.slice(0, 3).map((member, index) => (
                  <View 
                    key={member.id} 
                    style={[
                      styles.memberAvatar,
                      { backgroundColor: stringToColor(member.email || '') },
                      index > 0 && { marginLeft: -12 }
                    ]}
                  >
                    <Text style={styles.memberInitial}>
                      {member.email ? member.email[0].toUpperCase() : '?'}
                    </Text>
                  </View>
                ))}
                {currentTripMembers.length > 3 && (
                  <View style={[styles.memberAvatar, styles.moreAvatar, { marginLeft: -12 }]}>
                    <Text style={styles.memberInitial}>+{currentTripMembers.length - 3}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.membersCount}>{currentTripMembers.length}</Text>
            </TouchableOpacity>
          )}
          {/* Share Button */}
          <TouchableOpacity 
            style={styles.shareBtn}
            onPress={handleShareTrip}
          >
            <Text style={styles.shareIcon}>↗</Text>
          </TouchableOpacity>
        </View>
      </View>
      
      {/* View Toggle Bar */}
      <View style={styles.viewToggleWrapper}>
        <View style={styles.viewToggleContainer}>
          <TouchableOpacity 
            style={[styles.viewToggleBtn, viewMode === 'map' && styles.viewToggleBtnActive]}
            onPress={() => setViewMode('map')}
          >
            <Text style={[styles.viewToggleText, viewMode === 'map' && styles.viewToggleTextActive]}>Map</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.viewToggleBtn, viewMode === 'list' && styles.viewToggleBtnActive]}
            onPress={() => setViewMode('list')}
          >
            <Text style={[styles.viewToggleText, viewMode === 'list' && styles.viewToggleTextActive]}>Places</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.viewToggleBtn, viewMode === 'timeline' && styles.viewToggleBtnActive]}
            onPress={() => setViewMode('timeline')}
          >
            <Text style={[styles.viewToggleText, viewMode === 'timeline' && styles.viewToggleTextActive]}>Journey</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Map or List View */}
      <View style={styles.contentContainer}>
        {items.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Text style={styles.emptyIcon}>🌍</Text>
            </View>
            <Text style={styles.emptyTitle}>Start Your Adventure</Text>
            <Text style={styles.emptySubtitle}>
              Tap the magic button to add places from YouTube or get AI recommendations
            </Text>
            <View style={styles.emptyArrow}>
              <Text style={styles.emptyArrowText}>↓</Text>
            </View>
          </View>
        ) : viewMode === 'map' ? (
          <MapView 
            items={items}
            region={mapRegion}
            onMarkerPress={() => {}}
          />
        ) : viewMode === 'list' ? (
          <CategorizedListView
            items={items}
            tripId={tripId}
          />
        ) : (
          <TimelineScreen 
            tripId={tripId}
            tripName={currentTrip?.name}
            destination={currentTrip?.destination}
          />
        )}
      </View>


      {/* FAB for Group Chat */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowChat(true)}
        activeOpacity={0.9}
      >
        <View style={styles.fabGradient}>
          <Text style={styles.fabIcon}>💬</Text>
        </View>
        <View style={styles.fabPulse} />
      </TouchableOpacity>

      {/* AI Chat Modal */}
      <Modal
        visible={showChat}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowChat(false)}
      >
        <View style={styles.modalContainer}>
          <KeyboardAvoidingView 
            style={styles.chatContainer}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            {/* Chat Header */}
            <View style={styles.chatHeader}>
              <View style={styles.chatHeaderInfo}>
                <Text style={styles.chatTitle}>{currentTrip?.name || 'Trip'} Chat</Text>
                <Text style={styles.chatSubtitle}>
                  ✨ AI Assistant Active • {currentTripMembers?.length || 0} members
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowChat(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Messages */}
            <FlatList
              data={messages}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const isUser = item.type === 'user';
                const isAI = item.type === 'companion';
                // For now, user messages are "You", AI messages are from AI
                const senderEmail = isUser ? 'You' : 'AI';
                const senderName = isAI ? 'AI Assistant' : 'You';
                const avatarColor = isAI ? '#6366F1' : stringToColor(senderEmail);
                const isMyMessage = isUser;
                
                return (
                  <View style={[
                    styles.messageContainer,
                    isMyMessage && styles.myMessageContainer
                  ]}>
                    {/* Avatar for other senders */}
                    {!isMyMessage && (
                      <View style={[styles.messageAvatar, { backgroundColor: avatarColor }]}>
                        <Text style={styles.messageAvatarText}>
                          {isAI ? '✨' : senderName[0].toUpperCase()}
                        </Text>
                      </View>
                    )}
                    
                    <View style={styles.messageWrapper}>
                      {/* Sender name for others */}
                      {!isMyMessage && (
                        <Text style={[
                          styles.messageSender,
                          isAI && styles.aiSender
                        ]}>
                          {senderName}
                        </Text>
                      )}
                      
                      <View style={[
                        styles.messageBubble,
                        isMyMessage ? styles.userMessage : 
                        isAI ? styles.aiMessage : styles.otherMessage
                      ]}>
                        <Text style={[
                          styles.messageText,
                          isMyMessage && styles.userMessageText
                        ]}>{item.content}</Text>
                        
                        {item.places && item.places.length > 0 && (
                          <View style={styles.placesContainer}>
                            {item.places.map((place, idx) => (
                              <View key={idx} style={styles.placeItem}>
                                <Text style={styles.placeName}>{place.name}</Text>
                                {place.location_name && (
                                  <Text style={styles.placeLocation}>{place.location_name}</Text>
                                )}
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                );
              }}
              inverted={false}
              contentContainerStyle={styles.messagesList}
            />

            {/* Input */}
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={inputText}
                onChangeText={setInputText}
                placeholder="Message group or use @AI for help..."
                placeholderTextColor="#999"
                multiline
              />
              <TouchableOpacity
                style={[styles.sendButton, chatLoading && styles.sendButtonDisabled]}
                onPress={handleSendMessage}
                disabled={chatLoading}
              >
                <Text style={styles.sendButtonText}>→</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Share Modal */}
      <Modal
        visible={showShareModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowShareModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.shareModalContainer}>
            <View style={styles.shareModalHeader}>
              <Text style={styles.shareModalTitle}>Invite Friends</Text>
              <TouchableOpacity onPress={() => setShowShareModal(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.shareModalSubtitle}>
              Share this code or link with your travel buddies!
            </Text>

            {/* Invite Code */}
            <View style={styles.inviteCodeSection}>
              <Text style={styles.inviteCodeLabel}>Invite Code</Text>
              <View style={styles.inviteCodeCard}>
                <Text style={styles.inviteCode}>{currentTrip?.invite_code}</Text>
                <TouchableOpacity
                  style={styles.copyButton}
                  onPress={() => copyToClipboard(currentTrip?.invite_code || '')}
                >
                  <Text style={styles.copyButtonText}>Copy</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Invite Link */}
            <View style={styles.inviteLinkSection}>
              <Text style={styles.inviteLinkLabel}>Invite Link</Text>
              <View style={styles.inviteLinkCard}>
                <Text style={styles.inviteLink} numberOfLines={1}>
                  https://travelagent.app/join/{currentTrip?.invite_code}
                </Text>
                <TouchableOpacity
                  style={styles.copyButton}
                  onPress={() => copyToClipboard(`https://travelagent.app/join/${currentTrip?.invite_code}`)}
                >
                  <Text style={styles.copyButtonText}>Copy</Text>
                </TouchableOpacity>
              </View>
            </View>

            <Text style={styles.shareModalHint}>
              💡 Friends can paste the code in the "Join Trip" screen or click the link to join automatically
            </Text>
          </View>
        </View>
      </Modal>

      {/* Members Modal */}
      <Modal
        visible={showMembersModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowMembersModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalContainer}
          activeOpacity={1}
          onPress={() => setShowMembersModal(false)}
        >
          <TouchableOpacity 
            style={styles.membersModalContent}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.membersModalHeader}>
              <Text style={styles.membersModalTitle}>Trip Members</Text>
              <TouchableOpacity onPress={() => setShowMembersModal(false)}>
                <Text style={styles.membersModalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={currentTripMembers}
              keyExtractor={(item) => item.id}
              renderItem={({ item, index }) => (
                <View style={styles.memberItem}>
                  <View style={[styles.memberItemAvatar, { backgroundColor: stringToColor(item.email || '') }]}>
                    <Text style={styles.memberItemInitial}>
                      {item.email ? item.email[0].toUpperCase() : '?'}
                    </Text>
                  </View>
                  <View style={styles.memberItemInfo}>
                    <Text style={styles.memberItemEmail}>{item.email}</Text>
                    <Text style={styles.memberItemRole}>
                      {item.role === 'owner' ? 'Trip Creator' : 'Member'}
                    </Text>
                  </View>
                </View>
              )}
              ListEmptyComponent={
                <Text style={styles.noMembersText}>No members yet</Text>
              }
            />
            
            <TouchableOpacity 
              style={styles.inviteMoreButton}
              onPress={() => {
                setShowMembersModal(false);
                handleShareTrip();
              }}
            >
              <Text style={styles.inviteMoreButtonText}>+ Invite More People</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '600',
  },
  
  // Header Styles
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingTop: Platform.OS === 'ios' ? 55 : 35,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    zIndex: 1000,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: '#F8F9FA',
  },
  backText: {
    fontSize: 28,
    color: '#374151',
    fontWeight: '300',
  },
  headerContent: {
    flex: 1,
    marginLeft: 12,
  },
  tripName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.5,
  },
  tripStats: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 3,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shareBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F8F9FA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareIcon: {
    fontSize: 20,
    color: '#374151',
  },
  shareText: {
    fontSize: 22,
  },
  membersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F8F9FA',
    borderRadius: 20,
  },
  membersAvatars: {
    flexDirection: 'row',
    marginRight: 8,
  },
  memberAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  moreAvatar: {
    backgroundColor: '#E5E7EB',
  },
  memberInitial: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  membersCount: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  viewToggleWrapper: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 130 : 110,
    left: 20,
    right: 20,
    zIndex: 999,
  },
  viewToggleContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 25,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  viewToggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 21,
    alignItems: 'center',
  },
  viewToggleBtnActive: {
    backgroundColor: '#6366F1',
  },
  viewToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  viewToggleTextActive: {
    color: '#FFFFFF',
  },
  
  // Content Styles
  contentContainer: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 180 : 160,
  },
  map: {
    flex: 1,
  },
  markerContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
  },
  markerEmoji: {
    fontSize: 20,
  },
  
  // Selected Place Card
  placeCard: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 16,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 9998,
  },
  closeCard: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 8,
  },
  closeCardText: {
    fontSize: 20,
    color: '#6B7280',
  },
  placeCardEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  placeCardName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  placeCardLocation: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  placeCardDescription: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  placeCardContent: {
    alignItems: 'center',
    paddingTop: 10,
  },
  youtubeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF0000',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 16,
  },
  youtubeButtonIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  youtubeButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  placeCardActions: {
    flexDirection: 'row',
    marginTop: 8,
  },
  placeCardActionBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    marginHorizontal: 6,
  },
  placeCardActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  
  // FAB Styles
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    zIndex: 9999,
  },
  fabGradient: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  fabIcon: {
    fontSize: 28,
  },
  fabPulse: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: '#6366F1',
    opacity: 0.3,
  },
  
  // Chat Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  chatContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: screenHeight * 0.8,
    minHeight: screenHeight * 0.6,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  chatHeaderInfo: {
    flex: 1,
  },
  chatTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  chatSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  closeButton: {
    fontSize: 24,
    color: '#6B7280',
    padding: 8,
  },
  
  // Messages Styles
  messagesList: {
    padding: 16,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-end',
  },
  myMessageContainer: {
    flexDirection: 'row-reverse',
  },
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageAvatarText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  messageWrapper: {
    maxWidth: '75%',
  },
  messageSender: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 4,
    marginLeft: 12,
    fontWeight: '600',
  },
  aiSender: {
    color: '#6366F1',
  },
  messageBubble: {
    maxWidth: '80%',
    marginVertical: 4,
    padding: 12,
    borderRadius: 16,
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#6366F1',
    borderBottomRightRadius: 4,
  },
  aiMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#F3F4F6',
    borderBottomLeftRadius: 4,
  },
  otherMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#E5E7EB',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
    color: '#111827',
  },
  userMessageText: {
    color: '#FFFFFF',
  },
  placesContainer: {
    marginTop: 8,
  },
  placeItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 8,
    borderRadius: 8,
    marginTop: 4,
  },
  placeName: {
    fontWeight: '600',
    fontSize: 14,
  },
  placeLocation: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  
  // Input Styles
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  input: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
    fontSize: 15,
    maxHeight: 100,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#8B5CF6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    fontSize: 20,
    color: 'white',
    fontWeight: 'bold',
  },
  
  // Empty State
  emptyState: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyIcon: {
    fontSize: 48,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 10,
    letterSpacing: -0.5,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 280,
  },
  emptyArrow: {
    position: 'absolute',
    bottom: 100,
    right: 40,
  },
  emptyArrowText: {
    fontSize: 32,
    color: '#6366F1',
    opacity: 0.6,
  },
  
  // List View Styles
  listContainer: {
    padding: 16,
  },
  listItem: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  listItemIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  listItemEmoji: {
    fontSize: 24,
  },
  listItemContent: {
    flex: 1,
    justifyContent: 'center',
  },
  listItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  listItemLocation: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  listItemDescription: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 18,
  },
  
  // Share Modal Styles
  shareModalContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
    maxHeight: screenHeight * 0.7,
  },
  shareModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  shareModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  shareModalSubtitle: {
    fontSize: 15,
    color: '#6B7280',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  inviteCodeSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  inviteCodeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  inviteCodeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 2,
    borderColor: '#8B5CF6',
    borderRadius: 12,
    padding: 16,
  },
  inviteCode: {
    flex: 1,
    fontSize: 28,
    fontWeight: '700',
    color: '#8B5CF6',
    letterSpacing: 4,
    textAlign: 'center',
  },
  copyButton: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  copyButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  inviteLinkSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  inviteLinkLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  inviteLinkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 12,
  },
  inviteLink: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    marginRight: 8,
  },
  shareModalHint: {
    fontSize: 13,
    color: '#6B7280',
    paddingHorizontal: 20,
    fontStyle: 'italic',
    lineHeight: 20,
  },

  // Members Modal Styles
  membersModalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    maxHeight: screenHeight * 0.7,
    paddingBottom: 30,
  },
  membersModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  membersModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  membersModalClose: {
    fontSize: 24,
    color: '#6B7280',
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F8F9FA',
  },
  memberItemAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  memberItemInitial: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  memberItemInfo: {
    flex: 1,
  },
  memberItemEmail: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  memberItemRole: {
    fontSize: 13,
    color: '#6B7280',
  },
  noMembersText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    padding: 40,
  },
  inviteMoreButton: {
    backgroundColor: '#6366F1',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginHorizontal: 20,
    marginTop: 20,
    alignItems: 'center',
  },
  inviteMoreButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
