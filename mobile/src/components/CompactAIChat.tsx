/**
 * Compact AI Chat - Minimal Input Bar + Latest Response
 * 
 * Features:
 * - Minimal input bar at bottom
 * - Latest AI response auto-hides after 10 seconds
 * - Expand button in input bar (always visible)
 * - Typing indicator
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Auto-hide response bubble after this many seconds
const RESPONSE_TIMEOUT_MS = 10000; // 10 seconds

interface Message {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
}

interface CompactAIChatProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenFullChat: () => void;
  messages: Message[];
  onSendMessage: (message: string) => void;
  isTyping: boolean;
}

export const CompactAIChat: React.FC<CompactAIChatProps> = ({
  isOpen,
  onClose,
  onOpenFullChat,
  messages,
  onSendMessage,
  isTyping,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [showResponse, setShowResponse] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Get the latest AI message
  const latestAIMessage = [...messages].reverse().find(m => m.type === 'ai');
  const hasUserSentMessage = messages.some(m => m.type === 'user');

  // Auto-focus when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  // Show response bubble when new AI message arrives, then auto-hide after timeout
  useEffect(() => {
    if (latestAIMessage && hasUserSentMessage && !isTyping) {
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      // Show the response
      setShowResponse(true);
      
      // Set timeout to hide it
      timeoutRef.current = setTimeout(() => {
        setShowResponse(false);
      }, RESPONSE_TIMEOUT_MS);
    }
    
    // Cleanup on unmount
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [latestAIMessage?.id, isTyping]); // Re-trigger on new message ID

  // Hide response when typing starts
  useEffect(() => {
    if (isTyping) {
      setShowResponse(false);
    }
  }, [isTyping]);

  const handleSend = () => {
    if (!inputValue.trim()) return;
    onSendMessage(inputValue.trim());
    setInputValue('');
  };

  if (!isOpen) return null;

  return (
    <MotiView
      from={{ opacity: 0, translateY: 30 }}
      animate={{ opacity: 1, translateY: 0 }}
      exit={{ opacity: 0, translateY: 30 }}
      transition={{ type: 'spring', damping: 20 }}
      style={styles.container}
    >
      {/* Latest AI Response Bubble (auto-hides after 10s) */}
      {showResponse && latestAIMessage && hasUserSentMessage && !isTyping && (
        <MotiView
          from={{ opacity: 0, scale: 0.95, translateY: 10 }}
          animate={{ opacity: 1, scale: 1, translateY: 0 }}
          exit={{ opacity: 0, scale: 0.95, translateY: 10 }}
          transition={{ type: 'spring', damping: 15 }}
          style={styles.responseBubbleContainer}
        >
          <TouchableOpacity 
            activeOpacity={0.9}
            onPress={() => setShowResponse(false)}
          >
            <LinearGradient
              colors={['#8B5CF6', '#6366F1']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.responseBubble}
            >
              <View style={styles.responseHeader}>
                <Ionicons name="sparkles" size={14} color="rgba(255,255,255,0.9)" />
                <Text style={styles.tapToHide}>tap to hide</Text>
              </View>
              <Text style={styles.responseText} numberOfLines={4}>
                {latestAIMessage.content}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </MotiView>
      )}

      {/* Typing Indicator */}
      {isTyping && (
        <MotiView
          from={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          style={styles.typingContainer}
        >
          <LinearGradient
            colors={['#8B5CF6', '#6366F1']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.typingBubble}
          >
            <View style={styles.typingDots}>
              {[0, 1, 2].map((index) => (
                <MotiView
                  key={index}
                  from={{ scale: 1, opacity: 0.5 }}
                  animate={{ scale: 1.3, opacity: 1 }}
                  transition={{
                    type: 'timing',
                    duration: 600,
                    delay: index * 200,
                    loop: true,
                    repeatReverse: true,
                  }}
                  style={styles.dot}
                />
              ))}
            </View>
          </LinearGradient>
        </MotiView>
      )}

      {/* Compact Input Bar */}
      <View style={styles.inputBar}>
        {/* Minimize Button */}
        <TouchableOpacity
          style={styles.minimizeButton}
          onPress={onClose}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-down" size={20} color="#6B7280" />
        </TouchableOpacity>

        {/* Input */}
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={inputValue}
          onChangeText={setInputValue}
          placeholder="Ask me anything..."
          placeholderTextColor="#9CA3AF"
          returnKeyType="send"
          onSubmitEditing={handleSend}
          blurOnSubmit={false}
        />

        {/* Expand to Full Chat Button */}
        <TouchableOpacity
          style={styles.expandButton}
          onPress={onOpenFullChat}
          activeOpacity={0.7}
        >
          <Ionicons name="chatbubbles-outline" size={20} color="#8B5CF6" />
        </TouchableOpacity>

        {/* Send Button */}
        <TouchableOpacity
          style={[
            styles.sendButton,
            !inputValue.trim() && styles.sendButtonDisabled
          ]}
          onPress={handleSend}
          disabled={!inputValue.trim()}
          activeOpacity={0.8}
        >
          {inputValue.trim() ? (
            <LinearGradient
              colors={['#8B5CF6', '#6366F1']}
              style={styles.sendButtonGradient}
            >
              <Ionicons name="send" size={16} color="#FFFFFF" />
            </LinearGradient>
          ) : (
            <View style={styles.sendButtonInactive}>
              <Ionicons name="send" size={16} color="#D1D5DB" />
            </View>
          )}
        </TouchableOpacity>
      </View>
    </MotiView>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    zIndex: 200,
  },

  // Response Bubble
  responseBubbleContainer: {
    marginBottom: 12,
    alignItems: 'flex-start',
    maxWidth: SCREEN_WIDTH - 80,
  },
  responseBubble: {
    borderRadius: 20,
    borderBottomLeftRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  responseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 6,
  },
  tapToHide: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
    fontStyle: 'italic',
  },
  responseText: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 20,
  },

  // Typing
  typingContainer: {
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  typingBubble: {
    borderRadius: 20,
    borderBottomLeftRadius: 6,
    paddingHorizontal: 20,
    paddingVertical: 14,
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  typingDots: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },

  // Input Bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderRadius: 28,
    paddingHorizontal: 6,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.15)',
  },
  minimizeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#1F2937',
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    paddingHorizontal: 4,
  },
  expandButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
  },
  sendButtonGradient: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonInactive: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 22,
  },
  sendButtonDisabled: {
    opacity: 1,
  },
});

export default CompactAIChat;
