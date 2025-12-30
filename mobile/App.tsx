import 'react-native-gesture-handler';
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View, Text, Alert, Platform, NativeModules, NativeEventEmitter, AppState } from 'react-native';
import * as Linking from 'expo-linking';

// Native module for getting shared URLs on Android
const { ShareIntentModule } = NativeModules;
const shareIntentEmitter = Platform.OS === 'android' && ShareIntentModule 
  ? new NativeEventEmitter(ShareIntentModule) 
  : null;
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAuthStore } from './src/stores/authStore';
import { useTripStore } from './src/stores/tripStore';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { pushNotificationService } from './src/services/pushNotification.service';
import shareIntentService, { SharedContent } from './src/services/shareIntent.service';
import { SmartShareProcessor } from './src/components/SmartShareProcessor';
import { TransitionOverlay } from './src/components/TransitionOverlay';
import theme from './src/config/theme';

// Onboarding
import OnboardingScreen from './src/screens/Onboarding/OnboardingScreen';

// Auth Screens
import LoginScreen from './src/screens/Auth/LoginScreen';
import RegisterScreen from './src/screens/Auth/RegisterScreen';

// V2 World Screens (new UI)
import { WorldMapScreen, CountryBubbleScreen, CategoryListScreen, AgentChatScreen } from './src/screens/World';

// Legacy Trip Screens (keeping for compatibility during transition)
import TripTabScreen from './src/screens/Trip/TripTabScreen';
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
      WorldMap: '',
      JoinTrip: 'join/:inviteCode',
      CountryBubbles: 'country/:tripId',
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
  const processedUrlsRef = useRef<Set<string>>(new Set());

  // Centralized handler for shared URLs to prevent double-processing
  const handleIncomingUrl = useCallback((url: string, source: string) => {
    if (!isAuthenticated) return;
    
    // Clean up the URL - it might be a long string with text and a link
    let cleanUrl = url;
    const urlMatch = url.match(/(https?:\/\/[^\s]+)/);
    if (urlMatch) {
      cleanUrl = urlMatch[1];
    }
    
    const sharedUrl = extractSharedUrl(cleanUrl) || (isSocialLink(cleanUrl) ? cleanUrl : null);
    
    if (sharedUrl) {
      if (processedUrlsRef.current.has(sharedUrl)) {
        console.log(`[App] ⏭️ Skipping already processed URL from ${source}:`, sharedUrl);
        return;
      }
      
      console.log(`[App] ✅ Triggering processing for URL from ${source}:`, sharedUrl);
      processedUrlsRef.current.add(sharedUrl);
      setSharedContent({ type: 'url', data: sharedUrl });
      setShowShareModal(true);
    }
  }, [isAuthenticated]);

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

  // Helper function to extract URL from our custom share deep link
  const extractSharedUrl = (deepLink: string): string | null => {
    // Handle our custom share scheme: travelagent://share?url=...
    if (deepLink.startsWith('travelagent://share')) {
      try {
        const url = new URL(deepLink);
        const sharedUrl = url.searchParams.get('url');
        if (sharedUrl) {
          return decodeURIComponent(sharedUrl);
        }
      } catch (e) {
        // Fallback: manual parsing
        const match = deepLink.match(/[?&]url=([^&]+)/);
        if (match) {
          return decodeURIComponent(match[1]);
        }
      }
    }
    return null;
  };

  // Check if URL is a social/travel link worth processing
  const isSocialLink = (url: string): boolean => {
    const urlLower = url.toLowerCase();
    return (
      urlLower.includes('youtube.com') ||
      urlLower.includes('youtu.be') ||
      urlLower.includes('instagram.com') ||
      urlLower.includes('reddit.com') ||
      urlLower.includes('tiktok.com') ||
      urlLower.includes('maps.google') ||
      urlLower.includes('goo.gl/maps')
    );
  };

  // Handle share intent - content shared from other apps
  useEffect(() => {
    const handleShareIntent = async () => {
      try {
        // On Android, use our native module to get the shared URL
        if (Platform.OS === 'android' && ShareIntentModule) {
          try {
            const nativeSharedUrl = await ShareIntentModule.getSharedUrl();
            if (nativeSharedUrl) {
              console.log('[App] 📱 Found shared URL in NativeModule:', nativeSharedUrl);
              ShareIntentModule.clearSharedUrl();
              handleIncomingUrl(nativeSharedUrl, 'NativeModule');
              return;
            }
          } catch (nativeErr) {
            console.log('[App] Native module error:', nativeErr);
          }
        }
        
        // Fallback: Check Linking API
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl) {
          handleIncomingUrl(initialUrl, 'InitialURL');
        }
      } catch (err) {
        console.error('[App] Share intent error:', err);
      }
    };

    if (isReady && isAuthenticated) {
      handleShareIntent();
    }

    // Add AppState listener to check for share intent when app returns to foreground
    const appStateSubscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active' && isReady && isAuthenticated) {
        handleShareIntent();
      }
    });

    return () => appStateSubscription.remove();
  }, [isReady, isAuthenticated, handleIncomingUrl]);

  // Listen for incoming shared links while app is running (Expo Linking)
  useEffect(() => {
    const subscription = Linking.addEventListener('url', (event) => {
      handleIncomingUrl(event.url, 'LinkingEvent');
    });

    return () => subscription.remove();
  }, [handleIncomingUrl]);

  // Listen for share intent events from native Android module (when app is already open)
  useEffect(() => {
    if (!shareIntentEmitter || !isAuthenticated) return;

    const subscription = shareIntentEmitter.addListener('onShareIntent', (url: string) => {
      if (url) {
        if (ShareIntentModule) ShareIntentModule.clearSharedUrl();
        handleIncomingUrl(url, 'NativeEvent');
      }
    });

    return () => subscription.remove();
  }, [isAuthenticated, handleIncomingUrl]);

  const handleShareComplete = (result: any) => {
    setShowShareModal(false);
    setSharedContent(null);
    
    // Navigate to country bubble view
    if (navigationRef.current && result.tripId) {
      navigationRef.current.navigate('CountryBubbles', { 
        tripId: result.tripId,
        countryName: result.destinationCountry || result.destination || 'Unknown',
        discoveryIntent: result.discovery_intent,
        scoutResults: result.scout_results,
        scoutId: result.scout_id,
      });
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
              const data = notification.request.content.data as any;
              console.log('[App] Notification received:', notification.request.content.title, data);
              
              // Handle Native Share Intent captured by expo-notifications on Android (Foreground)
              if (data && (data['android.intent.extra.TEXT'] || data['android.intent.extra.SUBJECT'])) {
                const sharedUrl = data['android.intent.extra.TEXT'] || data['android.intent.extra.SUBJECT'];
                console.log('[App] 📱 Captured native share via foreground notification:', sharedUrl);
                handleIncomingUrl(sharedUrl, 'NotificationForeground');
              }
            },
            // When user taps on notification
            (response) => {
              const data = response.notification.request.content.data as any;
              console.log('[App] Notification tapped:', data);
              
              // Handle Native Share Intent captured by expo-notifications on Android
              if (data && (data['android.intent.extra.TEXT'] || data['android.intent.extra.SUBJECT'])) {
                const sharedUrl = data['android.intent.extra.TEXT'] || data['android.intent.extra.SUBJECT'];
                console.log('[App] 📱 Captured native share via notification:', sharedUrl);
                handleIncomingUrl(sharedUrl, 'NotificationIntent');
                return;
              }
              
              // Navigate based on notification type and data
              if (data && navigationRef.current) {
                const { type, tripId, placeId, placeName, screen } = data as any;
                
                // Handle nearby_alert notifications - navigate to country bubble view
                if (type === 'nearby_alert' && tripId) {
                  console.log('[App] Nearby alert tapped - navigating to country view');
                  // Navigate to country bubble screen with the trip
                  navigationRef.current.navigate('CountryBubbles', { 
                    tripId,
                    countryName: '', // Will be fetched from trip
                    highlightPlaceId: placeId,
                  });
                }
                // Handle group chat notifications
                else if (screen === 'GroupChat' && tripId) {
                  navigationRef.current.navigate('GroupChat', { tripId });
                }
                // Handle trip home/detail notifications
                else if ((screen === 'TripDetail' || screen === 'TripHome') && tripId) {
                  navigationRef.current.navigate('TripHome', { 
                    tripId,
                    highlightItemId: placeId,
                  });
                }
                // Default: if we have tripId, go to country bubbles
                else if (tripId) {
                  navigationRef.current.navigate('CountryBubbles', { tripId });
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
    <GestureHandlerRootView style={{ flex: 1 }}>
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
              // Main Stack - V2 UI
              <>
                {/* V2: World Map as Home */}
                <Stack.Screen
                  name="WorldMap"
                  component={WorldMapScreen}
                  options={{ headerShown: false }}
                />
                <Stack.Screen
                  name="CountryBubbles"
                  component={CountryBubbleScreen}
                  options={{ headerShown: false }}
                />
                <Stack.Screen
                  name="CategoryList"
                  component={CategoryListScreen}
                  options={{ headerShown: false }}
                />
                
                {/* Legacy: Keep TripHome for backward compatibility */}
                <Stack.Screen
                  name="TripHome"
                  component={TripTabScreen}
                  options={{ headerShown: false }}
                />
                <Stack.Screen
                  name="JoinTrip"
                  component={JoinTripScreen}
                  options={{ title: 'Join Trip' }}
                />
                
                {/* Chat & Agent */}
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
                  name="AgentChat"
                  component={AgentChatScreen}
                  options={{ 
                    headerShown: false,
                    presentation: 'transparentModal',
                    cardStyle: { backgroundColor: 'transparent' },
                    animationEnabled: true,
                  }}
                />
                
                {/* Utility Screens */}
                <Stack.Screen
                  name="BrowseItems"
                  component={BrowseItemsScreen}
                  options={{ title: 'Saved Items' }}
                />
                <Stack.Screen
                  name="Profile"
                  component={ProfileScreen}
                  options={{ headerShown: false }}
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
        
        {/* Smart Share Processor - AFTER NavigationContainer to render on top */}
        {showShareModal && sharedContent && isAuthenticated && (
          <SmartShareProcessor
            url={sharedContent.data}
            onComplete={handleShareComplete}
            onError={handleShareError}
            onClose={handleShareClose}
          />
        )}
        
        {/* Global Transition Overlay - Shows during cross-screen navigation */}
        <TransitionOverlay />
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}
