import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';

interface YoriLogoProps {
  size?: 'small' | 'medium' | 'large';
}

export default function YoriLogo({ size = 'medium' }: YoriLogoProps) {
  const fontSize = size === 'small' ? 32 : size === 'large' ? 72 : 48;
  
  return (
    <View style={styles.container}>
      <MaskedView
        maskElement={
          <Text style={[styles.logoText, { fontSize }]}>Yori</Text>
        }
      >
        <LinearGradient
          colors={['#5DBAF0', '#A8B4C2', '#E8A07A', '#F5A26B']}
          locations={[0, 0.35, 0.7, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={{ height: fontSize * 1.3, width: fontSize * 2.2 }}
        />
      </MaskedView>
    </View>
  );
}

// Simple fallback without MaskedView (gradient approximation)
export function YoriLogoSimple({ size = 'medium' }: YoriLogoProps) {
  const fontSize = size === 'small' ? 32 : size === 'large' ? 72 : 48;
  
  return (
    <View style={styles.container}>
      <Text style={[styles.logoTextSimple, { fontSize }]}>
        <Text style={styles.letterY}>Y</Text>
        <Text style={styles.letterO}>o</Text>
        <Text style={styles.letterR}>r</Text>
        <Text style={styles.letterI}>i</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontWeight: '700',
    letterSpacing: -1,
    color: '#000', // This is the mask, color doesn't matter
  },
  logoTextSimple: {
    fontWeight: '700',
    letterSpacing: -1,
  },
  // Gradient approximation per letter
  letterY: {
    color: '#5DBAF0', // Blue
  },
  letterO: {
    color: '#A8A0B0', // Muted purple-gray
  },
  letterR: {
    color: '#E8A07A', // Coral
  },
  letterI: {
    color: '#F5A26B', // Orange
  },
});

