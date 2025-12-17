import 'react-native-gesture-handler';
import React, { useEffect, useState, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View, Text, Alert } from 'react-native';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from './src/stores/authStore';
import { useTripStore } from './src/stores/tripStore';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { pushNotificationService } from './src/services/pushNotification.service';
import shareIntentService, { SharedContent } from './src/services/shareIntent.service';
import { SmartShareProcessor } from './src/components/SmartShareProcessor';
import theme from './src/config/theme';

// Onboarding
import OnboardingScreen from './src/screens/Onboarding/OnboardingScreen';

// Auth Screens
import LoginScreen from './src/screens/Auth/LoginScreen';
import RegisterScreen from './src/screens/Auth/RegisterScreen';

// Trip Screens
import TripListScreen from './src/screens/Trip/TripListScreen';
import TripDetailScreen from './src/screens/Trip/TripDetailScreen';
import TripHomeScreen from './src/screens/Trip/TripHomeScreen';
import TripTabScreen from './src/screens/Trip/TripTabScreen';
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

// Itinerary
import ItinerarySetupScreen from './src/screens/Trip/ItinerarySetupScreen';

// Timeline
import { TimelineScreen } from './src/screens/Trip/TimelineScreen';

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
  const [sharedContent, setSharedContent] = useState<SharedContent | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const { isAuthenticated, isLoading, loadStoredAuth } = useAuthStore();
  const navigationRef = React.useRef<any>(null);

  useEffect(() => {
    const prepare = async () => {
      try {
        // Check if user has seen onboarding
        const hasSeenOnboarding = await AsyncStorage.getItem('hasSeenOnboarding');
        if (!hasSeenOnboarding) {
          setShowOnboarding(true);
        }
        
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

  // Handle share intent - content shared from other apps
  useEffect(() => {
    const handleShareIntent = async () => {
      try {
        // Check initial URL for shared content
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl) {
          // Check if it's a shared link (contains common video/social URLs)
          const urlLower = initialUrl.toLowerCase();
          const isSocialLink = 
            urlLower.includes('youtube.com') ||
            urlLower.includes('youtu.be') ||
            urlLower.includes('instagram.com') ||
            urlLower.includes('reddit.com') ||
            urlLower.includes('tiktok.com');

          // If it's not our own deep link (join invite), treat it as shared content
          if (isSocialLink && !initialUrl.includes('travelagent.app/join')) {
            console.log('[App] Received shared content:', initialUrl);
            setSharedContent({ type: 'url', data: initialUrl });
            if (isAuthenticated) {
              setShowShareModal(true);
            }
          }
        }
      } catch (err) {
        console.error('[App] Share intent error:', err);
      }
    };

    if (isReady && isAuthenticated) {
      handleShareIntent();
    }
  }, [isReady, isAuthenticated]);

  // Listen for incoming shared links while app is running
  useEffect(() => {
    const subscription = Linking.addEventListener('url', (event) => {
      const url = event.url;
      const urlLower = url.toLowerCase();
      
      // Check if it's shared content from social apps
      const isSocialLink = 
        urlLower.includes('youtube.com') ||
        urlLower.includes('youtu.be') ||
        urlLower.includes('instagram.com') ||
        urlLower.includes('reddit.com') ||
        urlLower.includes('tiktok.com');

      if (isSocialLink && !url.includes('travelagent.app/join')) {
        console.log('[App] Received shared URL:', url);
        setSharedContent({ type: 'url', data: url });
        if (isAuthenticated) {
          setShowShareModal(true);
        }
      }
    });

    return () => subscription.remove();
  }, [isAuthenticated]);

  const handleShareComplete = (result: any) => {
    setShowShareModal(false);
    setSharedContent(null);
    
    // Navigate directly to the trip map!
    if (navigationRef.current && result.tripId) {
      navigationRef.current.navigate('TripHome', { tripId: result.tripId });
    }
  };

  const handleShareError = (error: string) => {
    setShowShareModal(false);
    setSharedContent(null);
    Alert.alert(
      '😕 Oops!',
      error || 'Failed to process the link. Try again later.',
      [{ text: 'OK' }]
    );
  };

  const handleShareClose = () => {
    setShowShareModal(false);
    setSharedContent(null);
  };

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
                } else if (data.screen === 'TripDetail' || data.screen === 'TripHome') {
                  navigationRef.current.navigate('TripHome', { tripId: data.tripId });
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

  // Show onboarding for first-time users
  if (showOnboarding) {
    return (
      <OnboardingScreen 
        onComplete={() => setShowOnboarding(false)} 
      />
    );
  }

  return (
    <ErrorBoundary>
      <StatusBar style="dark" />
      <NavigationContainer ref={navigationRef} linking={linking}>
        {/* Smart Share Processor - Zero friction! Shows when user shares from YouTube/Instagram/etc */}
        {showShareModal && sharedContent && isAuthenticated && (
          <SmartShareProcessor
            url={sharedContent.data}
            onComplete={handleShareComplete}
            onError={handleShareError}
            onClose={handleShareClose}
          />
        )}
        
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
                name="TripHome"
                component={TripTabScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="TripDetail"
                component={TripDetailScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="TripHomeOld"
                component={TripHomeScreen}
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
              <Stack.Screen
                name="ItinerarySetup"
                component={ItinerarySetupScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="Timeline"
                component={TimelineScreen}
                options={{ headerShown: false }}
              />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </ErrorBoundary>
  );
}
