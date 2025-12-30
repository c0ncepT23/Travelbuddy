import React from 'react';
import { Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

interface BouncyPressableProps extends PressableProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  animatedStyle?: StyleProp<ViewStyle>;
  hapticType?: Haptics.ImpactFeedbackStyle;
  scaleTo?: number;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const BouncyPressable: React.FC<BouncyPressableProps> = ({
  children,
  style,
  animatedStyle,
  hapticType = Haptics.ImpactFeedbackStyle.Light,
  scaleTo = 0.96,
  onPress,
  ...props
}) => {
  const scale = useSharedValue(1);

  const rStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  const handlePressIn = () => {
    scale.value = withSpring(scaleTo, {
      damping: 15,
      stiffness: 300,
    });
    Haptics.impactAsync(hapticType);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, {
      damping: 15,
      stiffness: 300,
    });
  };

  return (
    <AnimatedPressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      style={[style, rStyle, animatedStyle]}
      {...props}
    >
      {children}
    </AnimatedPressable>
  );
};

export default BouncyPressable;

