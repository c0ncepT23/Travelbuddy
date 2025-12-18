/**
 * Floating Cloud Component
 * 
 * Dreamy, blurred cloud decorations that float in the background
 * Creates the soft, pastel atmosphere from the Figma design
 */

import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
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

interface FloatingCloudProps {
  color: 'purple' | 'blue' | 'pink' | 'green' | 'yellow';
  size: number;
  position: { x: number; y: number }; // percentage
  delay?: number;
}

const COLOR_MAP: Record<string, string> = {
  purple: 'rgba(196, 181, 253, 0.4)',
  blue: 'rgba(191, 219, 254, 0.4)',
  pink: 'rgba(251, 207, 232, 0.4)',
  green: 'rgba(167, 243, 208, 0.4)',
  yellow: 'rgba(254, 240, 138, 0.4)',
};

export const FloatingCloud: React.FC<FloatingCloudProps> = ({
  color,
  size,
  position,
  delay = 0,
}) => {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    const duration = 8000 + delay * 1000;
    
    translateX.value = withDelay(
      delay * 1000,
      withRepeat(
        withSequence(
          withTiming(30, { duration: duration / 2, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: duration / 2, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      )
    );

    translateY.value = withDelay(
      delay * 1000,
      withRepeat(
        withSequence(
          withTiming(-20, { duration: duration / 2, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: duration / 2, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      )
    );

    scale.value = withDelay(
      delay * 1000,
      withRepeat(
        withSequence(
          withTiming(1.1, { duration: duration / 2, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: duration / 2, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      )
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.cloud,
        animatedStyle,
        {
          width: size,
          height: size,
          left: (position.x / 100) * SCREEN_WIDTH - size / 2,
          top: (position.y / 100) * SCREEN_HEIGHT - size / 2,
          backgroundColor: COLOR_MAP[color] || COLOR_MAP.purple,
        },
      ]}
    />
  );
};

const styles = StyleSheet.create({
  cloud: {
    position: 'absolute',
    borderRadius: 1000,
    // Note: React Native doesn't have blur-3xl like CSS
    // We simulate with opacity and large size
    opacity: 0.6,
  },
});

export default FloatingCloud;

