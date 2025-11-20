import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View, Text, Alert } from 'react-native';
import * as Linking from 'expo-linking';
import { useAuthStore } from './src/stores/authStore';
import { useTripStore } from './src/stores/tripStore';
import { ErrorBoundary } from './src/components/ErrorBoundary';

// Auth Screens
import LoginScreen from './src/screens/Auth/LoginScreen';
import RegisterScreen from './src/screens/Auth/RegisterScreen';

// Trip Screens
import TripListScreen from './src/screens/Trip/TripListScreen';
import TripDetailScreen from './src/screens/Trip/TripDetailScreen';
import CreateTripScreen from './src/screens/Trip/CreateTripScreen';
import JoinTripScreen from './src/screens/Trip/JoinTripScreen';

// Chat & Items
import ChatScreen from './src/screens/Chat/ChatScreen';
import BrowseItemsScreen from './src/screens/Items/BrowseItemsScreen';

// AI Companion
import CompanionScreen from './src/screens/Companion/CompanionScreen';

// Profile
import ProfileScreen from './src/screens/Profile/ProfileScreen';

const Stack = createStackNavigator();

const linking = {
  prefixes: ['https://travelagent.app', 'travelagent://'],
  config: {
    screens: {
      JoinTrip: 'join/:inviteCode',
    },
  },
};

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isAuthenticated, isLoading, loadStoredAuth } = useAuthStore();
  const navigationRef = React.useRef<any>(null);

  useEffect(() => {
    const prepare = async () => {
      try {
        await loadStoredAuth();
        setIsReady(true);
      } catch (err) {
        console.error('❌ App initialization error:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize app');
        setIsReady(true);
      }
    };
    prepare();
  }, []);

  // Handle deep links
  useEffect(() => {
    const handleDeepLink = (event: Linking.EventType) => {
      const url = event.url;
      console.log('[DeepLink] Received:', url);
      
      // Extract invite code from URL
      const match = url.match(/\/join\/([A-Z0-9]{6})/);
      if (match && match[1]) {
        const inviteCode = match[1];
        console.log('[DeepLink] Invite code:', inviteCode);
        
        if (isAuthenticated && navigationRef.current) {
          navigationRef.current.navigate('JoinTrip', { inviteCode });
        } else {
          Alert.alert(
            'Join Trip',
            'Please log in first to join this trip!',
            [{ text: 'OK' }]
          );
        }
      }
    };

    // Listen for deep links
    const subscription = Linking.addEventListener('url', handleDeepLink);

    // Check if app was opened via deep link
    Linking.getInitialURL().then(url => {
      if (url) {
        handleDeepLink({ url });
      }
    });

    return () => {
      subscription.remove();
    };
  }, [isAuthenticated]);

  if (!isReady || isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F172A' }}>
        <ActivityIndicator size="large" color="#8B5CF6" />
        {error && (
          <View style={{ marginTop: 20, padding: 20 }}>
            <Text style={{ color: '#F87171', textAlign: 'center' }}>{error}</Text>
            <Text style={{ color: '#94A3B8', textAlign: 'center', marginTop: 10 }}>
              Continuing to app...
            </Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <StatusBar style="light" />
      <NavigationContainer ref={navigationRef} linking={linking}>
        <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: '#0F172A' },
            headerTintColor: '#fff',
            headerTitleStyle: { fontWeight: 'bold' },
          }}
        >
          {!isAuthenticated ? (
            // Auth Stack
            <>
              <Stack.Screen
                name="Login"
                component={LoginScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="Register"
                component={RegisterScreen}
                options={{ title: 'Create Account' }}
              />
            </>
          ) : (
            // Main Stack
            <>
              <Stack.Screen
                name="TripList"
                component={TripListScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="TripDetail"
                component={TripDetailScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="CreateTrip"
                component={CreateTripScreen}
                options={{ title: 'Create Trip' }}
              />
              <Stack.Screen
                name="JoinTrip"
                component={JoinTripScreen}
                options={{ title: 'Join Trip' }}
              />
              <Stack.Screen
                name="Chat"
                component={ChatScreen}
                options={{ title: 'Travel Agent' }}
              />
              <Stack.Screen
                name="Companion"
                component={CompanionScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="BrowseItems"
                component={BrowseItemsScreen}
                options={{ title: 'Saved Items' }}
              />
              <Stack.Screen
                name="Profile"
                component={ProfileScreen}
                options={{ 
                  title: 'Profile',
                  headerStyle: { backgroundColor: '#0F172A' },
                  headerTintColor: '#fff',
                }}
              />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </ErrorBoundary>
  );
}
