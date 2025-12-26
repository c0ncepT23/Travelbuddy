/**
 * Floating AI Orb - Zenly-Inspired Sparkly Button
 * 
 * A floating purple orb that:
 * - Floats up/down with gentle animation
 * - Has a pulsing glow ring
 * - Shows green online status dot
 * - Shows "Click to chat!" tooltip initially
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring,
  runOnJS
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface FloatingAIOrbProps {
  onPress: () => void;
  visible?: boolean;
}

export const FloatingAIOrb: React.FC<FloatingAIOrbProps> = ({ 
  onPress, 
  visible = true 
}) => {
  const [showHint, setShowHint] = useState(true);

  // DRAG STATE
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const context = useSharedValue({ x: 0, y: 0 });

  const panGesture = Gesture.Pan()
    .onStart(() => {
      context.value = { x: translateX.value, y: translateY.value };
    })
    .onUpdate((event) => {
      // Basic dragging with bounds checking
      const newX = event.translationX + context.value.x;
      const newY = event.translationY + context.value.y;
      
      // translateX 0 is right: 20. 
      // Limit X: can't go right beyond 20px margin (0), can't go left off screen
      translateX.value = Math.min(0, Math.max(-SCREEN_WIDTH + 84, newX)); 
      
      // translateY 0 is bottom: 160.
      // Limit Y: can't go down off screen (140), can't go up off screen
      translateY.value = Math.min(140, Math.max(-SCREEN_HEIGHT + 240, newY));
    })
    .onEnd((event) => {
      // Snap to edges (left or right)
      const snapX = -(SCREEN_WIDTH - 104); // Position for left edge
      const threshold = snapX / 2;
      
      if (translateX.value < threshold) {
        // Snap to left edge
        translateX.value = withSpring(snapX, { damping: 15 });
      } else {
        // Snap to right edge
        translateX.value = withSpring(0, { damping: 15 });
      }
      
      // Vertical bounce-back if out of bounds
      if (translateY.value < -SCREEN_HEIGHT + 240) {
        translateY.value = withSpring(-SCREEN_HEIGHT + 240);
      } else if (translateY.value > 140) {
        translateY.value = withSpring(140);
      }
    });

  const tapGesture = Gesture.Tap()
    .onEnd(() => {
      runOnJS(onPress)();
    });

  // Combine gestures: Pan takes priority, if no movement it's a Tap
  const composedGesture = Gesture.Exclusive(panGesture, tapGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));

  // Hide hint after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => setShowHint(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <GestureDetector gesture={composedGesture}>
      <Animated.View style={[styles.container, animatedStyle]}>
        {/* Hint Tooltip - Outside orbTouchable to preserve layout */}
        {showHint && (
          <MotiView
            from={{ opacity: 0, translateX: 20 }}
            animate={{ opacity: 1, translateX: 0 }}
            exit={{ opacity: 0 }}
            style={styles.hintContainer}
          >
            <View style={styles.hintBubble}>
              <Text style={styles.hintText}>Click to chat! ✨</Text>
              <View style={styles.hintArrow} />
            </View>
          </MotiView>
        )}

        {/* Main Orb Button - Tap handled by GestureDetector */}
        <View style={styles.orbTouchable}>
          {/* Pulsing Glow Ring */}
          <MotiView
            from={{ scale: 1, opacity: 0.5 }}
            animate={{ scale: 1.4, opacity: 0 }}
            transition={{
              type: 'timing',
              duration: 2000,
              loop: true,
            }}
            style={styles.glowRing}
          />

          {/* Second Glow Ring (offset) */}
          <MotiView
            from={{ scale: 1, opacity: 0.3 }}
            animate={{ scale: 1.6, opacity: 0 }}
            transition={{
              type: 'timing',
              duration: 2000,
              delay: 500,
              loop: true,
            }}
            style={styles.glowRing}
          />

          {/* Main Orb */}
          <MotiView
            from={{ translateY: 0, rotate: '0deg' }}
            animate={{ translateY: -6, rotate: '3deg' }}
            transition={{
              type: 'timing',
              duration: 2000,
              loop: true,
              repeatReverse: true,
            }}
          >
            <LinearGradient
              colors={['#22D3EE', '#06B6D4', '#0891B2']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.orb}
            >
              {/* Inner glow */}
              <View style={styles.innerGlow} />
              
              {/* Sparkles Icon */}
              <MotiView
                from={{ scale: 1, rotate: '0deg' }}
                animate={{ scale: 1.1, rotate: '10deg' }}
                transition={{
                  type: 'timing',
                  duration: 1500,
                  loop: true,
                  repeatReverse: true,
                }}
              >
                <Ionicons name="sparkles" size={28} color="#FFFFFF" />
              </MotiView>
            </LinearGradient>
          </MotiView>

          {/* Online Status Dot */}
          <MotiView
            from={{ scale: 1, opacity: 1 }}
            animate={{ scale: 1.2, opacity: 0.7 }}
            transition={{
              type: 'timing',
              duration: 1500,
              loop: true,
              repeatReverse: true,
            }}
            style={styles.statusDot}
          />
        </View>
      </Animated.View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 220, // Shifted up to avoid peek drawer X button (25% height)
    right: 20,
    zIndex: 1000, // Higher zIndex to ensure it stays on top
    alignItems: 'flex-end',
  },
  hintContainer: {
    marginBottom: 12,
  },
  hintBubble: {
    backgroundColor: 'rgba(31, 41, 55, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    position: 'relative',
  },
  hintText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  hintArrow: {
    position: 'absolute',
    bottom: -6,
    right: 24,
    width: 12,
    height: 12,
    backgroundColor: 'rgba(31, 41, 55, 0.9)',
    transform: [{ rotate: '45deg' }],
  },
  orbTouchable: {
    width: 64,
    height: 64,
    justifyContent: 'center',
    alignItems: 'center',
  },
  glowRing: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(6, 182, 212, 0.4)',
  },
  orb: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#06B6D4',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
  },
  innerGlow: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    bottom: 8,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  statusDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
});

export default FloatingAIOrb;

