import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Image,
} from 'react-native';
import { MotiView, AnimatePresence } from 'moti';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring,
  runOnJS
} from 'react-native-reanimated';
import { useYoriStore, YoriState } from '../../stores/yoriStore';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface YoriMascotProps {
  onPress: () => void;
  visible?: boolean;
}

export const YoriMascot: React.FC<YoriMascotProps> = ({ 
  onPress, 
  visible = true 
}) => {
  const { currentState, message } = useYoriStore();
  const [showTooltip, setShowTooltip] = useState(false);

  // DRAG STATE (Reused from FloatingAIOrb)
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const context = useSharedValue({ x: 0, y: 0 });

  const panGesture = Gesture.Pan()
    .onStart(() => {
      context.value = { x: translateX.value, y: translateY.value };
    })
    .onUpdate((event) => {
      const newX = event.translationX + context.value.x;
      const newY = event.translationY + context.value.y;
      translateX.value = Math.min(0, Math.max(-SCREEN_WIDTH + 100, newX)); 
      translateY.value = Math.min(140, Math.max(-SCREEN_HEIGHT + 240, newY));
    })
    .onEnd(() => {
      const snapX = -(SCREEN_WIDTH - 120);
      const threshold = snapX / 2;
      
      if (translateX.value < threshold) {
        translateX.value = withSpring(snapX, { damping: 15 });
      } else {
        translateX.value = withSpring(0, { damping: 15 });
      }
      
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

  const composedGesture = Gesture.Exclusive(panGesture, tapGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));

  // Show tooltip when message exists
  useEffect(() => {
    if (message) {
      setShowTooltip(true);
      const timer = setTimeout(() => setShowTooltip(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  // Initial hint
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!message) setShowTooltip(true);
      setTimeout(() => setShowTooltip(false), 3000);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <GestureDetector gesture={composedGesture}>
      <Animated.View style={[styles.container, animatedStyle]}>
        <AnimatePresence>
          {showTooltip && (
            <MotiView
              from={{ opacity: 0, scale: 0.5, translateY: 10 }}
              animate={{ opacity: 1, scale: 1, translateY: 0 }}
              exit={{ opacity: 0, scale: 0.5, translateY: 10 }}
              style={styles.tooltipContainer}
            >
              <View style={styles.tooltipBubble}>
                <Text style={styles.tooltipText}>
                  {message || "Yoink a link! 🔗"}
                </Text>
                <View style={styles.tooltipArrow} />
              </View>
            </MotiView>
          )}
        </AnimatePresence>

        <View style={styles.mascotWrapper}>
          {/* Subtle Glow based on state */}
          <MotiView
            animate={{
              scale: currentState === 'THINKING' ? [1, 1.2, 1] : 1,
              opacity: currentState === 'THINKING' ? 0.6 : 0.2,
            }}
            transition={{
              type: 'timing',
              duration: 1000,
              loop: true,
            }}
            style={[
              styles.stateGlow,
              currentState === 'THINKING' && styles.thinkingGlow,
              currentState === 'CELEBRATING' && styles.celebratingGlow,
            ]}
          />

          {/* Yori-san Himself */}
          <MotiView
            animate={{
              translateY: currentState === 'IDLE' ? [-4, 4] : 0,
              rotate: currentState === 'THINKING' ? ['-5deg', '5deg'] : '0deg',
              scale: currentState === 'CELEBRATING' ? [1, 1.2, 1] : 1,
            }}
            transition={{
              type: 'timing',
              duration: currentState === 'IDLE' ? 2000 : 500,
              loop: true,
              repeatReverse: true,
            }}
          >
            <View style={styles.mascotCircle}>
              <Image 
                source={require('../../../assets/yori-san.gif')} 
                style={styles.mascotImage}
                resizeMode="contain"
              />
            </View>
          </MotiView>
        </View>
      </Animated.View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 220,
    right: 20,
    zIndex: 10000,
    alignItems: 'center',
  },
  tooltipContainer: {
    position: 'absolute',
    bottom: 90,
    minWidth: 120,
    alignItems: 'center',
  },
  tooltipBubble: {
    backgroundColor: '#1F2937',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  tooltipText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  tooltipArrow: {
    position: 'absolute',
    bottom: -6,
    alignSelf: 'center',
    width: 12,
    height: 12,
    backgroundColor: '#1F2937',
    transform: [{ rotate: '45deg' }],
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  mascotWrapper: {
    width: 90,
    height: 90,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mascotCircle: {
    width: 90,
    height: 90,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mascotImage: {
    width: 90, 
    height: 90,
  },
  stateGlow: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 50,
    backgroundColor: '#A78BFA',
    opacity: 0.2,
  },
  thinkingGlow: {
    backgroundColor: '#F59E0B',
  },
  celebratingGlow: {
    backgroundColor: '#10B981',
  },
});

