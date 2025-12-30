/**
 * Transition Overlay - Global UI feedback during navigation
 * 
 * Shows a beautiful animated overlay when transitioning between screens
 * Uses the transitionState from useTripDataStore
 * 
 * Usage: Add to App.tsx root, it auto-shows/hides based on store state
 */

import React, { useEffect } from 'react';
import { StyleSheet, Text, View, Dimensions } from 'react-native';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { useTripDataStore } from '../stores/tripDataStore';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const TransitionOverlay: React.FC = () => {
  const { transitionState, clearTransition } = useTripDataStore();
  
  // Auto-clear after 3 seconds (safety net)
  useEffect(() => {
    if (transitionState.isActive) {
      const timeout = setTimeout(() => {
        clearTransition();
      }, 3000);
      return () => clearTimeout(timeout);
    }
  }, [transitionState.isActive]);

  if (!transitionState.isActive) {
    return null;
  }

  return (
    <MotiView
      from={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ type: 'timing', duration: 200 }}
      style={styles.overlay}
      pointerEvents="auto"
    >
      <LinearGradient
        colors={['rgba(15, 23, 42, 0.95)', 'rgba(30, 41, 59, 0.98)']}
        style={styles.gradient}
      >
        {/* Animated emoji */}
        <MotiView
          from={{ scale: 0.5, translateY: 20 }}
          animate={{ scale: 1, translateY: 0 }}
          transition={{
            type: 'spring',
            damping: 12,
            stiffness: 120,
          }}
        >
          <Text style={styles.emoji}>{transitionState.emoji}</Text>
        </MotiView>

        {/* Message */}
        <MotiView
          from={{ opacity: 0, translateY: 10 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{
            type: 'timing',
            duration: 300,
            delay: 100,
          }}
        >
          <Text style={styles.message}>{transitionState.message}</Text>
        </MotiView>

        {/* Animated dots */}
        <View style={styles.dotsContainer}>
          {[0, 1, 2].map((index) => (
            <MotiView
              key={index}
              from={{ opacity: 0.3, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{
                type: 'timing',
                duration: 400,
                loop: true,
                delay: index * 150,
                repeatReverse: true,
              }}
              style={styles.dot}
            />
          ))}
        </View>
      </LinearGradient>
    </MotiView>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    zIndex: 9999,
    elevation: 9999,
  },
  gradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  message: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
    marginHorizontal: 32,
    lineHeight: 28,
  },
  dotsContainer: {
    flexDirection: 'row',
    marginTop: 24,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6366F1',
  },
});

export default TransitionOverlay;

