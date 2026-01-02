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
  ScrollView,
  Dimensions,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { format } from 'date-fns';
import * as Haptics from 'expo-haptics';

import { useCompanionStore, CompanionMessage, PlaceResult } from '../../stores/companionStore';
import { useLocationStore } from '../../stores/locationStore';
import theme from '../../config/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Midnight Navy Palette
const COLORS = {
  background: '#0F172A',
  surface: '#1E293B',
  primary: '#06B6D4', // Cyan
  secondary: '#3B82F6', // Blue
  accent: '#8B5CF6', // Purple
  text: '#FFFFFF',
  textDim: '#94A3B8',
  border: 'rgba(6, 182, 212, 0.2)',
  inputBg: '#FFFFFF',
};

export default function CompanionScreen({ route, navigation }: any) {
  const { tripId } = route.params;
  const { isLoading, sendQuery, clearMessages, getMessages, addMessage } = useCompanionStore();
  const messages = getMessages(tripId);
  const { location } = useLocationStore();
  const [inputText, setInputText] = useState('');
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (messages.length === 0) {
      const welcomeMessage: CompanionMessage = {
        id: 'welcome',
        type: 'companion',
        content: "Hey! I'm Yori, your travel co-pilot ✨\n\nI can help you navigate your saved notes! Ask me about what you've saved or paste a new link to add it to your map.",
        timestamp: new Date(),
      };
      addMessage(tripId, welcomeMessage);
    }
  }, [tripId]);

  const handleSend = async () => {
    if (!inputText.trim() || isLoading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInputText(query);
  };

  const handlePlacePress = (placeId: string) => {
    Haptics.selectionAsync();
    navigation.navigate('TripDetail', { tripId, highlightItemId: placeId });
  };

  const renderPlace = (place: PlaceResult) => (
    <MotiView
      from={{ opacity: 0, translateY: 10 }}
      animate={{ opacity: 1, translateY: 0 }}
      key={place.id}
      style={styles.placeCard}
    >
      <TouchableOpacity onPress={() => handlePlacePress(place.id)} activeOpacity={0.9}>
        <View style={styles.placeHeader}>
          <View style={styles.placeTitleGroup}>
            <Text style={styles.placeName} numberOfLines={1}>{place.name}</Text>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryIcon}>{getCategoryIcon(place.category)}</Text>
              <Text style={styles.categoryText}>{place.category}</Text>
            </View>
          </View>
          {place.rating && (
            <View style={styles.ratingBadge}>
              <Ionicons name="star" size={12} color="#FFD700" />
              <Text style={styles.ratingText}>{Number(place.rating).toFixed(1)}</Text>
            </View>
          )}
        </View>
        
        {place.location_name && (
          <Text style={styles.placeLocation} numberOfLines={1}>
            <Ionicons name="location" size={12} color={COLORS.textDim} /> {place.location_name}
          </Text>
        )}
        
        <Text style={styles.placeDescription} numberOfLines={2}>
          {place.description}
        </Text>
        
        <View style={styles.placeFooter}>
          {place.distance !== undefined && (
            <Text style={styles.placeDistance}>
              {place.distance < 1000
                ? `${Math.round(place.distance)}m away`
                : `${(place.distance / 1000).toFixed(1)}km away`}
            </Text>
          )}
          <Text style={styles.placeAction}>View Details →</Text>
        </View>
      </TouchableOpacity>
    </MotiView>
  );

  const renderMessage = ({ item }: { item: CompanionMessage }) => {
    const isUser = item.type === 'user';

    return (
      <View style={[styles.messageContainer, isUser ? styles.userMessageAlign : styles.aiMessageAlign]}>
        {isUser ? (
          <LinearGradient
            colors={[COLORS.primary, COLORS.secondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.userBubble}
          >
            <Text style={styles.messageText}>{item.content}</Text>
          </LinearGradient>
        ) : (
          <View style={styles.aiBubble}>
            <View style={styles.aiHeader}>
              <Ionicons name="sparkles" size={14} color={COLORS.primary} />
              <Text style={styles.aiName}>YORI</Text>
            </View>
            <Text style={styles.messageText}>{item.content}</Text>
            
            {item.places && item.places.length > 0 && (
              <View style={styles.placesList}>
                {item.places.map((place) => renderPlace(place))}
              </View>
            )}
          </View>
        )}
        <Text style={[styles.messageTime, isUser && styles.userTime]}>
          {format(new Date(item.timestamp), 'HH:mm')}
        </Text>
      </View>
    );
  };

  const quickQueries = [
    { icon: '🍜', text: 'Food I saved' },
    { icon: '📍', text: "What's near me?" },
    { icon: '✨', text: 'Surprise me' },
    { icon: '🎯', text: 'Top picks' },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Header - Floating Opaque */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>✨ Yori Co-pilot</Text>
          <Text style={styles.headerSubtitle}>Your personal travel notes guide</Text>
        </View>
        <TouchableOpacity onPress={() => clearMessages(tripId)} style={styles.headerAction}>
          <Ionicons name="trash-outline" size={20} color={COLORS.textDim} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
          ListHeaderComponent={() => (
            <View style={styles.quickQueriesWrapper}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickQueriesContainer}>
                {quickQueries.map((q, i) => (
                  <TouchableOpacity key={i} style={styles.quickQueryChip} onPress={() => handleQuickQuery(q.text)}>
                    <Text style={styles.quickQueryIcon}>{q.icon}</Text>
                    <Text style={styles.quickQueryText}>{q.text}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        />

        {/* Input Bar - Opaque White Zenly Style */}
        <View style={styles.inputWrapper}>
          <View style={styles.inputBar}>
            <TextInput
              style={styles.input}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Ask me about your notes..."
              placeholderTextColor="#94A3B8"
              multiline
              maxLength={500}
              editable={!isLoading}
            />
            <TouchableOpacity
              style={[styles.sendButton, (!inputText.trim() || isLoading) && styles.sendButtonDisabled]}
              onPress={handleSend}
              disabled={!inputText.trim() || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <LinearGradient
                  colors={[COLORS.accent, COLORS.secondary]}
                  style={styles.sendGradient}
                >
                  <Ionicons name="arrow-up" size={24} color="#FFFFFF" />
                </LinearGradient>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function getCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    food: '🍽️',
    shopping: '🛍️',
    place: '📍',
    activity: '🎯',
    accommodation: '🏨',
    tip: '💡',
  };
  return icons[category] || '📌';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    zIndex: 100,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContent: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 12,
    color: COLORS.textDim,
    marginTop: 2,
  },
  headerAction: {
    padding: 8,
  },
  keyboardView: {
    flex: 1,
  },
  messagesList: {
    padding: 16,
    paddingBottom: 100,
  },
  messageContainer: {
    marginBottom: 20,
    maxWidth: '85%',
  },
  userMessageAlign: {
    alignSelf: 'flex-end',
  },
  aiMessageAlign: {
    alignSelf: 'flex-start',
  },
  userBubble: {
    padding: 14,
    borderRadius: 20,
    borderBottomRightRadius: 4,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  aiBubble: {
    backgroundColor: COLORS.surface,
    padding: 14,
    borderRadius: 20,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  aiName: {
    fontSize: 10,
    fontWeight: '900',
    color: COLORS.primary,
    letterSpacing: 1,
  },
  messageText: {
    fontSize: 15,
    color: COLORS.text,
    lineHeight: 22,
  },
  messageTime: {
    fontSize: 10,
    color: COLORS.textDim,
    marginTop: 6,
  },
  userTime: {
    textAlign: 'right',
  },
  quickQueriesWrapper: {
    marginBottom: 20,
  },
  quickQueriesContainer: {
    paddingRight: 20,
    gap: 10,
  },
  quickQueryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  quickQueryIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  quickQueryText: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '700',
  },
  placesList: {
    marginTop: 16,
    gap: 12,
  },
  placeCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  placeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  placeTitleGroup: {
    flex: 1,
    marginRight: 8,
  },
  placeName: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 4,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  categoryIcon: {
    fontSize: 10,
    marginRight: 4,
  },
  categoryText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textDim,
    textTransform: 'uppercase',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  ratingText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFD700',
    marginLeft: 2,
  },
  placeLocation: {
    fontSize: 12,
    color: COLORS.textDim,
    marginBottom: 8,
  },
  placeDescription: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 18,
    marginBottom: 12,
  },
  placeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  placeDistance: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
  placeAction: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.secondary,
  },
  inputWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    backgroundColor: 'transparent',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.inputBg,
    borderRadius: 28,
    paddingHorizontal: 8,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#1F2937',
    paddingHorizontal: 12,
    paddingVertical: 10,
    maxHeight: 100,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
  },
  sendGradient: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});
