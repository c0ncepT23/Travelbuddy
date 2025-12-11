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
} from 'react-native';
import { useCompanionStore, CompanionMessage, PlaceResult } from '../../stores/companionStore';
import { useLocationStore } from '../../stores/locationStore';
import { format } from 'date-fns';

export default function CompanionScreen({ route, navigation }: any) {
  const { tripId } = route.params;
  const { isLoading, sendQuery, clearMessages, getMessages, addMessage } = useCompanionStore();
  const messages = getMessages(tripId);
  const { location } = useLocationStore();
  const [inputText, setInputText] = useState('');
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    // Only send welcome message if this is the first time opening (no messages yet)
    if (messages.length === 0) {
      const welcomeMessage: CompanionMessage = {
        id: 'welcome',
        type: 'companion',
        content: "Hey! I'm Yori, your travel companion ✨\n\nI can help you with your trip! You can:\n\n• Ask me: \"I'm hungry for ramen\" or \"What's near me?\"\n• Share links: Paste YouTube/Instagram/Reddit links and I'll extract places\n• Get recommendations: \"Show me matcha spots\" or \"Surprise me\"\n\nGo ahead, what can I help you with?",
        timestamp: new Date(),
      };
      
      addMessage(tripId, welcomeMessage);
    }
  }, [tripId, messages.length]);

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const handleSend = async () => {
    if (!inputText.trim() || isLoading) return;

    const query = inputText.trim();
    setInputText('');

    try {
      // Convert LocationObject to {lat, lng} format
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

  const handlePlacePress = (placeId: string) => {
    // Navigate to place details or trip detail screen
    navigation.navigate('TripDetail', { tripId, highlightItemId: placeId });
  };

  const renderPlace = (place: PlaceResult) => (
    <TouchableOpacity
      key={place.id}
      style={styles.placeCard}
      onPress={() => handlePlacePress(place.id)}
    >
      <View style={styles.placeHeader}>
        <Text style={styles.placeName}>{place.name}</Text>
        <Text style={styles.placeCategory}>{getCategoryIcon(place.category)}</Text>
      </View>
      
      {place.location_name && (
        <Text style={styles.placeLocation}>📍 {place.location_name}</Text>
      )}
      
      {place.distance !== undefined && (
        <Text style={styles.placeDistance}>
          {place.distance < 1000
            ? `${Math.round(place.distance)}m away`
            : `${(place.distance / 1000).toFixed(1)}km away`}
        </Text>
      )}
      
      <Text style={styles.placeDescription} numberOfLines={2}>
        {place.description}
      </Text>
      
      <View style={styles.placeFooter}>
        <Text style={styles.placeAction}>View Details →</Text>
      </View>
    </TouchableOpacity>
  );

  const renderMessage = ({ item }: { item: CompanionMessage }) => {
    const isUser = item.type === 'user';

    return (
      <View style={[styles.messageContainer, isUser && styles.userMessageContainer]}>
        <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.companionBubble]}>
          <Text style={[styles.messageText, isUser && styles.userMessageText]}>
            {item.content}
          </Text>

          {item.places && item.places.length > 0 && (
            <View style={styles.placesContainer}>
              {item.places.map((place) => renderPlace(place))}
            </View>
          )}

          {item.suggestions && item.suggestions.length > 0 && (
            <View style={styles.suggestionsContainer}>
              {item.suggestions.map((suggestion, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.suggestionButton}
                  onPress={() => handleQuickQuery(suggestion)}
                >
                  <Text style={styles.suggestionText}>{suggestion}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <Text style={styles.messageTime}>
            {format(new Date(item.timestamp), 'HH:mm')}
          </Text>
        </View>
      </View>
    );
  };

  const quickQueries = [
    { icon: '🍜', text: 'Food nearby' },
    { icon: '📍', text: "What's near me?" },
    { icon: '✨', text: 'Surprise me' },
    { icon: '🎯', text: 'Top recommendations' },
  ];

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>✨ Yori</Text>
          <Text style={styles.headerSubtitle}>Ask me anything about your saved places</Text>
        </View>
        {messages.length > 1 && (
          <TouchableOpacity onPress={() => clearMessages(tripId)} style={styles.clearButton}>
            <Text style={styles.clearButtonText}>🗑️</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Quick Queries */}
      {messages.length <= 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.quickQueriesScroll}
          contentContainerStyle={styles.quickQueriesContainer}
        >
          {quickQueries.map((query, index) => (
            <TouchableOpacity
              key={index}
              style={styles.quickQueryButton}
              onPress={() => handleQuickQuery(query.text)}
            >
              <Text style={styles.quickQueryIcon}>{query.icon}</Text>
              <Text style={styles.quickQueryText}>{query.text}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      {/* Input */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Ask me anything..."
          placeholderTextColor="#999"
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
            <Text style={styles.sendButtonText}>→</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
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
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingTop: 50,
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 24,
    color: '#333',
  },
  headerContent: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  clearButton: {
    padding: 8,
  },
  clearButtonText: {
    fontSize: 20,
  },
  quickQueriesScroll: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  quickQueriesContainer: {
    padding: 12,
    gap: 8,
  },
  quickQueryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 8,
  },
  quickQueryIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  quickQueryText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  messagesList: {
    padding: 16,
  },
  messageContainer: {
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  userMessageContainer: {
    alignItems: 'flex-end',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
  },
  companionBubble: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderBottomLeftRadius: 4,
  },
  userBubble: {
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 4,
  },
  messageText: {
    fontSize: 15,
    color: '#333',
    lineHeight: 20,
  },
  userMessageText: {
    color: '#fff',
  },
  messageTime: {
    fontSize: 11,
    color: '#999',
    marginTop: 6,
    textAlign: 'right',
  },
  placesContainer: {
    marginTop: 12,
    gap: 8,
  },
  placeCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  placeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  placeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  placeCategory: {
    fontSize: 20,
  },
  placeLocation: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  placeDistance: {
    fontSize: 13,
    color: '#007AFF',
    fontWeight: '500',
    marginBottom: 6,
  },
  placeDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
    marginBottom: 8,
  },
  placeFooter: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 8,
  },
  placeAction: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  suggestionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  suggestionButton: {
    backgroundColor: '#e8f4ff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  suggestionText: {
    fontSize: 13,
    color: '#007AFF',
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
    marginRight: 8,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
});

