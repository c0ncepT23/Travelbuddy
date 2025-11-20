import React from 'react';
import { ViewStyle, TouchableOpacity, StyleProp } from 'react-native';
import { MotiView } from 'moti';

interface AnimatedCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  delay?: number;
  onPress?: () => void;
}

export const AnimatedCard: React.FC<AnimatedCardProps> = ({ 
  children, 
  style, 
  delay = 0,
  onPress 
}) => {
  const Content = (
    <MotiView
      from={{
        opacity: 0,
        scale: 0.9,
        translateY: 10,
      }}
      animate={{
        opacity: 1,
        scale: 1,
        translateY: 0,
      }}
      transition={{
        type: 'timing',
        duration: 350,
        delay: delay,
      }}
      style={style}
    >
      {children}
    </MotiView>
  );

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.9} onPress={onPress}>
        {Content}
      </TouchableOpacity>
    );
  }

  return Content;
};

