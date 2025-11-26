import 'react-native-gesture-handler';
import React, { useEffect, useState, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View, Text, Alert } from 'react-native';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import { useAuthStore } from './src/stores/authStore';
import { useTripStore } from './src/stores/tripStore';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { pushNotificationService } from './src/services/pushNotification.service';
import theme from './src/config/theme';

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
import GroupChatScreen from './src/screens/Chat/GroupChatScreen';
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

  // Initialize push notifications when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      const initPushNotifications = async () => {
        try {
          const token = await pushNotificationService.initialize();
          if (token) {
            console.log('[App] Push notifications initialized');
          }
          
          // Set up notification listeners
          pushNotificationService.setupListeners(
            // When notification received while app is open
            (notification) => {
              console.log('[App] Notification received:', notification.request.content.title);
            },
            // When user taps on notification
            (response) => {
              const data = response.notification.request.content.data;
              console.log('[App] Notification tapped:', data);
              
              // Navigate based on notification data
              if (data?.tripId && navigationRef.current) {
                if (data.screen === 'GroupChat') {
                  navigationRef.current.navigate('GroupChat', { tripId: data.tripId });
                } else if (data.screen === 'TripDetail') {
                  navigationRef.current.navigate('TripDetail', { tripId: data.tripId });
                }
              }
            }
          );
        } catch (error) {
          console.error('[App] Push notification init error:', error);
        }
      };
      
      initPushNotifications();
      
      return () => {
        pushNotificationService.removeListeners();
      };
    }
  }, [isAuthenticated]);

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
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background }}>
        <View style={{
          width: 80,
          height: 80,
          backgroundColor: theme.colors.primary,
          borderWidth: 3,
          borderColor: theme.colors.borderDark,
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: 24,
          shadowColor: '#000',
          shadowOffset: { width: 4, height: 4 },
          shadowOpacity: 1,
          shadowRadius: 0,
          elevation: 4,
        }}>
          <Text style={{ fontSize: 40 }}>✈️</Text>
        </View>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        {error && (
          <View style={{ marginTop: 20, padding: 20 }}>
            <Text style={{ color: theme.colors.error, textAlign: 'center', fontWeight: '700' }}>{error}</Text>
            <Text style={{ color: theme.colors.textSecondary, textAlign: 'center', marginTop: 10 }}>
              Continuing to app...
            </Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <StatusBar style="dark" />
      <NavigationContainer ref={navigationRef} linking={linking}>
        <Stack.Navigator
          screenOptions={{
            headerStyle: { 
              backgroundColor: theme.colors.background,
              elevation: 0,
              shadowOpacity: 0,
              borderBottomWidth: 2,
              borderBottomColor: theme.colors.border,
            },
            headerTintColor: theme.colors.textPrimary,
            headerTitleStyle: { 
              fontWeight: '700',
              fontSize: 18,
              color: theme.colors.textPrimary,
            },
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
                name="GroupChat"
                component={GroupChatScreen}
                options={{ headerShown: false }}
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
                }}
              />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </ErrorBoundary>
  );
}
