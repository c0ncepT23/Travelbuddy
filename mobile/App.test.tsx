import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';

// Simple test app to verify basic rendering works
export default function App() {
  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      <Text style={styles.title}>🎉 App Loaded Successfully!</Text>
      <Text style={styles.subtitle}>If you see this, the crash is in navigation/auth</Text>
      <View style={styles.box}>
        <Text style={styles.info}>✅ React Native: Working</Text>
        <Text style={styles.info}>✅ Expo SDK 51: Working</Text>
        <Text style={styles.info}>✅ TypeScript: Working</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 30,
    textAlign: 'center',
  },
  box: {
    backgroundColor: '#f0f0f0',
    padding: 20,
    borderRadius: 10,
  },
  info: {
    fontSize: 16,
    marginVertical: 5,
  },
});

