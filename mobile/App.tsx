import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View, Text } from 'react-native';
import { useAuthStore } from './src/stores/authStore';
import { ErrorBoundary } from './src/components/ErrorBoundary';

// Auth Screens
import LoginScreen from './src/screens/Auth/LoginScreen';
import RegisterScreen from './src/screens/Auth/RegisterScreen';

// Trip Screens
import TripListScreen from './src/screens/Trip/TripListScreen';
import TripDetailScreen from './src/screens/Trip/TripDetailScreen';
import CreateTripScreen from './src/screens/Trip/CreateTripScreen';

// Chat & Items
import ChatScreen from './src/screens/Chat/ChatScreen';
import BrowseItemsScreen from './src/screens/Items/BrowseItemsScreen';

// Profile
import ProfileScreen from './src/screens/Profile/ProfileScreen';

const Stack = createStackNavigator();

export default function App() {
  console.log('🚀 App: Component rendering');
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  console.log('🚀 App: Accessing auth store...');
  let authStore;
  try {
    authStore = useAuthStore();
    console.log('🚀 App: Auth store accessed', { 
      isAuthenticated: authStore.isAuthenticated, 
      isLoading: authStore.isLoading 
    });
  } catch (err) {
    console.error('❌ App: Failed to access auth store:', err);
    throw err;
  }
  
  const { isAuthenticated, isLoading, loadStoredAuth } = authStore;

  useEffect(() => {
    console.log('🚀 App: useEffect running');
    const prepare = async () => {
      try {
        console.log('🚀 App: Calling loadStoredAuth...');
        await loadStoredAuth();
        console.log('🚀 App: loadStoredAuth complete');
        setIsReady(true);
        console.log('✅ App: Ready to render');
      } catch (err) {
        console.error('❌ App initialization error:', err);
        console.error('❌ Error stack:', err instanceof Error ? err.stack : 'No stack');
        setError(err instanceof Error ? err.message : 'Failed to initialize app');
        setIsReady(true); // Continue to app even if auth loading fails
      }
    };
    prepare();
  }, []);

  if (!isReady || isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#007AFF" />
        {error && (
          <View style={{ marginTop: 20, padding: 20 }}>
            <Text style={{ color: 'red', textAlign: 'center' }}>{error}</Text>
            <Text style={{ color: '#666', textAlign: 'center', marginTop: 10 }}>
              Continuing to app...
            </Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <StatusBar style="auto" />
      <NavigationContainer
        onReady={() => console.log('✅ Navigation ready')}
      >
        <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: '#007AFF' },
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
                options={({ route }: any) => ({
                  title: route.params?.tripName || 'Trip Details',
                })}
              />
              <Stack.Screen
                name="CreateTrip"
                component={CreateTripScreen}
                options={{ title: 'Create Trip' }}
              />
              <Stack.Screen
                name="Chat"
                component={ChatScreen}
                options={{ title: 'Travel Agent' }}
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
                  headerStyle: { backgroundColor: '#3B82F6' },
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

