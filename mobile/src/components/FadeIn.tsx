import React from 'react';
import { ViewStyle, StyleProp } from 'react-native';
import { MotiView } from 'moti';

interface FadeInProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  delay?: number;
  duration?: number;
}

export const FadeIn: React.FC<FadeInProps> = ({ 
  children, 
  style, 
  delay = 0,
  duration = 500
}) => {
  return (
    <MotiView
      from={{ opacity: 0, translateY: 15 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{
        type: 'timing',
        duration: duration,
        delay: delay,
      }}
      style={style}
    >
      {children}
    </MotiView>
  );
};

