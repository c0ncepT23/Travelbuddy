/**
 * OrbitalBubbles - RPG-style orbital explosion animation
 * 
 * When a category bubble is tapped, sub-categories "explode" outward
 * and orbit around the parent bubble with spring physics.
 */

import React, { useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { SavedItem } from '../types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Spring config for bouncy, game-like feel
const SPRING_CONFIG = {
  damping: 12,
  stiffness: 120,
  mass: 0.8,
};

// Colors matching Zenly theme
const SUBCATEGORY_COLORS = [
  { bg: '#EC4899', glow: '#F472B6' }, // Pink
  { bg: '#8B5CF6', glow: '#A78BFA' }, // Purple
  { bg: '#06B6D4', glow: '#22D3EE' }, // Cyan
  { bg: '#22C55E', glow: '#4ADE80' }, // Green
  { bg: '#F59E0B', glow: '#FBBF24' }, // Amber
  { bg: '#EF4444', glow: '#F87171' }, // Red
];

interface SubCategoryData {
  id: string;
  label: string;
  count: number;
  items: SavedItem[];
}

interface OrbitalBubblesProps {
  parentPosition: { x: number; y: number }; // Percentage position (0-100)
  parentLabel: string;
  subCategories: SubCategoryData[];
  isExpanded: boolean;
  onSubCategoryPress: (subCategory: SubCategoryData) => void;
  onCollapse: () => void;
  orbitRadius?: number; // in pixels
}

const OrbitalBubble: React.FC<{
  data: SubCategoryData;
  index: number;
  totalCount: number;
  isExpanded: boolean;
  orbitRadius: number;
  onPress: () => void;
  color: { bg: string; glow: string };
}> = ({ data, index, totalCount, isExpanded, orbitRadius, onPress, color }) => {
  const progress = useSharedValue(0);

  // Calculate target angle for this bubble
  const angle = (index / totalCount) * 2 * Math.PI - Math.PI / 2; // Start from top
  const targetX = Math.cos(angle) * orbitRadius;
  const targetY = Math.sin(angle) * orbitRadius;

  useEffect(() => {
    if (isExpanded) {
      progress.value = withDelay(
        index * 50, // Stagger each bubble
        withSpring(1, SPRING_CONFIG)
      );
    } else {
      progress.value = withSpring(0, SPRING_CONFIG);
    }
  }, [isExpanded]);

  const animatedStyle = useAnimatedStyle(() => {
    const x = interpolate(progress.value, [0, 1], [0, targetX], Extrapolation.CLAMP);
    const y = interpolate(progress.value, [0, 1], [0, targetY], Extrapolation.CLAMP);
    const scale = interpolate(progress.value, [0, 0.5, 1], [0.3, 1.1, 1], Extrapolation.CLAMP);
    const opacity = interpolate(progress.value, [0, 0.3, 1], [0, 1, 1], Extrapolation.CLAMP);

    return {
      transform: [
        { translateX: x },
        { translateY: y },
        { scale },
      ],
      opacity,
    };
  });

  // Bubble size based on count (min 60, max 90)
  const bubbleSize = Math.min(90, Math.max(60, 50 + data.count * 3));

  return (
    <Animated.View style={[styles.orbitalBubble, animatedStyle]}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.85}
        style={[
          styles.bubbleTouch,
          {
            width: bubbleSize,
            height: bubbleSize,
            borderRadius: bubbleSize / 2,
          },
        ]}
      >
        {/* Glow effect */}
        <View
          style={[
            styles.bubbleGlow,
            {
              width: bubbleSize + 20,
              height: bubbleSize + 20,
              borderRadius: (bubbleSize + 20) / 2,
              backgroundColor: color.glow,
            },
          ]}
        />
        
        {/* Main bubble */}
        <LinearGradient
          colors={[color.bg, color.bg + 'CC']}
          style={[
            styles.bubbleGradient,
            {
              width: bubbleSize,
              height: bubbleSize,
              borderRadius: bubbleSize / 2,
            },
          ]}
        >
          <Text style={styles.bubbleLabel} numberOfLines={1}>
            {data.label}
          </Text>
          <Text style={styles.bubbleCount}>{data.count}</Text>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
};

export const OrbitalBubbles: React.FC<OrbitalBubblesProps> = ({
  parentPosition,
  parentLabel,
  subCategories,
  isExpanded,
  onSubCategoryPress,
  onCollapse,
  orbitRadius = 100,
}) => {
  // Convert percentage to pixels
  const centerX = (parentPosition.x / 100) * SCREEN_WIDTH;
  const centerY = (parentPosition.y / 100) * SCREEN_HEIGHT;

  // Backdrop opacity animation
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    backdropOpacity.value = withTiming(isExpanded ? 1 : 0, { duration: 200 });
  }, [isExpanded]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value * 0.4,
  }));

  if (!isExpanded && subCategories.length === 0) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={isExpanded ? 'auto' : 'none'}>
      {/* Dark backdrop */}
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          onPress={onCollapse}
          activeOpacity={1}
        />
      </Animated.View>

      {/* Orbital container centered on parent */}
      <View
        style={[
          styles.orbitalContainer,
          {
            left: centerX,
            top: centerY,
          },
        ]}
        pointerEvents="box-none"
      >
        {/* Parent label indicator */}
        {isExpanded && (
          <MotiView
            from={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', delay: 100 }}
            style={styles.parentIndicator}
          >
            <Text style={styles.parentLabel}>{parentLabel}</Text>
          </MotiView>
        )}

        {/* Orbital bubbles */}
        {subCategories.map((subCat, index) => (
          <OrbitalBubble
            key={subCat.id}
            data={subCat}
            index={index}
            totalCount={subCategories.length}
            isExpanded={isExpanded}
            orbitRadius={orbitRadius}
            onPress={() => onSubCategoryPress(subCat)}
            color={SUBCATEGORY_COLORS[index % SUBCATEGORY_COLORS.length]}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  orbitalContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  parentIndicator: {
    position: 'absolute',
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.5)',
  },
  parentLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  orbitalBubble: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleTouch: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleGlow: {
    position: 'absolute',
    opacity: 0.3,
  },
  bubbleGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  bubbleLabel: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 4,
  },
  bubbleCount: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 2,
  },
});

export default OrbitalBubbles;

