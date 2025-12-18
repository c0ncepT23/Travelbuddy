/**
 * Glowing Bubble Component
 * 
 * Glassmorphic bubble with:
 * - Pastel gradient background
 * - Glow/shadow effect
 * - Floating/breathing animation
 * - Label + count display
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
  Easing,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type BubbleColor = 'green' | 'blue' | 'yellow' | 'purple' | 'pink' | 'orange';

interface GlowingBubbleProps {
  label: string;
  count: number;
  color: BubbleColor;
  size?: 'large' | 'small';
  position: { x: number; y: number }; // percentage
  onPress?: () => void;
  delay?: number;
}

// Color configurations matching Figma design
const COLOR_CONFIG: Record<BubbleColor, {
  gradient: [string, string, string];
  glow: string;
  text: string;
}> = {
  green: {
    gradient: ['rgba(167, 243, 208, 0.8)', 'rgba(153, 246, 228, 0.7)', 'rgba(165, 243, 252, 0.8)'],
    glow: 'rgba(52, 211, 153, 0.4)',
    text: '#065F46', // emerald-800
  },
  blue: {
    gradient: ['rgba(191, 219, 254, 0.8)', 'rgba(199, 210, 254, 0.7)', 'rgba(221, 214, 254, 0.8)'],
    glow: 'rgba(139, 92, 246, 0.4)',
    text: '#3730A3', // indigo-800
  },
  yellow: {
    gradient: ['rgba(253, 230, 138, 0.8)', 'rgba(254, 240, 138, 0.7)', 'rgba(254, 215, 170, 0.8)'],
    glow: 'rgba(251, 191, 36, 0.4)',
    text: '#92400E', // amber-800
  },
  purple: {
    gradient: ['rgba(221, 214, 254, 0.8)', 'rgba(237, 233, 254, 0.7)', 'rgba(245, 208, 254, 0.8)'],
    glow: 'rgba(192, 132, 252, 0.4)',
    text: '#5B21B6', // purple-800
  },
  pink: {
    gradient: ['rgba(251, 207, 232, 0.8)', 'rgba(254, 205, 211, 0.7)', 'rgba(245, 208, 254, 0.8)'],
    glow: 'rgba(244, 114, 182, 0.4)',
    text: '#9D174D', // pink-800
  },
  orange: {
    gradient: ['rgba(254, 215, 170, 0.8)', 'rgba(253, 230, 138, 0.7)', 'rgba(254, 240, 138, 0.8)'],
    glow: 'rgba(251, 146, 60, 0.4)',
    text: '#9A3412', // orange-800
  },
};

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export const GlowingBubble: React.FC<GlowingBubbleProps> = ({
  label,
  count,
  color,
  size = 'large',
  position,
  onPress,
  delay = 0,
}) => {
  const config = COLOR_CONFIG[color] || COLOR_CONFIG.green;
  const bubbleSize = size === 'large' ? 160 : 120;
  
  // Animation values
  const scale = useSharedValue(1);
  const translateY = useSharedValue(0);

  useEffect(() => {
    const duration = 4000;
    
    scale.value = withDelay(
      delay * 200,
      withRepeat(
        withSequence(
          withTiming(1.03, { duration: duration / 2, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: duration / 2, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      )
    );

    translateY.value = withDelay(
      delay * 200,
      withRepeat(
        withSequence(
          withTiming(-8, { duration: duration / 2, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: duration / 2, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      )
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateY: translateY.value },
    ],
  }));

  // Calculate absolute position
  const left = (position.x / 100) * SCREEN_WIDTH - bubbleSize / 2;
  const top = (position.y / 100) * SCREEN_HEIGHT - bubbleSize / 2;

  return (
    <AnimatedTouchable
      style={[
        styles.container,
        animatedStyle,
        {
          width: bubbleSize,
          height: bubbleSize,
          left,
          top,
          shadowColor: config.glow,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <LinearGradient
        colors={config.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.bubble, { width: bubbleSize, height: bubbleSize }]}
      >
        <Text style={[styles.label, { color: config.text, fontSize: size === 'large' ? 14 : 12 }]}>
          {label}
        </Text>
        <Text style={[styles.count, { color: config.text }]}>
          ({count})
        </Text>
      </LinearGradient>
    </AnimatedTouchable>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 1,
    shadowRadius: 60,
    elevation: 20,
  },
  bubble: {
    borderRadius: 1000,
    justifyContent: 'center',
    alignItems: 'center',
    // Glassmorphism effect
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  label: {
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  count: {
    fontSize: 16,
    opacity: 0.7,
  },
});

export default GlowingBubble;

