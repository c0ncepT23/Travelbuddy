import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  SafeAreaView,
  Dimensions,
  Platform,
  Share,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { MotiView } from 'moti';
import * as Clipboard from 'expo-clipboard';
import { useTripStore } from '../../stores/tripStore';
import { useLocationStore } from '../../stores/locationStore';
import { HapticFeedback } from '../../utils/haptics';

// Tab Screens
import TripChatTab from './tabs/TripChatTab';
import TripMapTab from './tabs/TripMapTab';
import TripPlannerTab from './tabs/TripPlannerTab';
import ProfileScreen from '../Profile/ProfileScreen';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const STATUS_BAR_HEIGHT = Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 0;
const BOTTOM_TAB_HEIGHT = 80;

type TabName = 'Chat' | 'Map' | 'Planner' | 'Profile';

interface TabConfig {
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
  label: string;
}

const TAB_CONFIG: Record<TabName, TabConfig> = {
  Chat: { icon: 'chatbubble-outline', activeIcon: 'chatbubble', label: 'Chat' },
  Map: { icon: 'map-outline', activeIcon: 'map', label: 'Map' },
  Planner: { icon: 'calendar-outline', activeIcon: 'calendar', label: 'Planner' },
  Profile: { icon: 'person-outline', activeIcon: 'person', label: 'Profile' },
};

const TAB_ORDER: TabName[] = ['Chat', 'Map', 'Planner', 'Profile'];

// Glassmorphic Bottom Tab Bar
const BottomTabBar = ({ 
  activeTab, 
  onTabPress 
}: { 
  activeTab: TabName; 
  onTabPress: (tab: TabName) => void;
}) => {
  return (
    <View style={styles.bottomTabContainer}>
      <BlurView intensity={80} tint="light" style={styles.bottomTabBlur}>
        <View style={styles.bottomTabInner}>
          {TAB_ORDER.map((tabName) => {
            const config = TAB_CONFIG[tabName];
            const isActive = activeTab === tabName;

            return (
              <TouchableOpacity
                key={tabName}
                style={styles.tabItem}
                onPress={() => onTabPress(tabName)}
                activeOpacity={0.7}
              >
                {isActive && (
                  <MotiView
                    from={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', damping: 15 }}
                    style={styles.activeTabIndicator}
                  />
                )}
                <Ionicons 
                  name={isActive ? config.activeIcon : config.icon} 
                  size={24} 
                  color={isActive ? '#3B82F6' : '#94A3B8'} 
                />
                <Text style={[
                  styles.tabLabel,
                  isActive && styles.tabLabelActive
                ]}>
                  {config.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </BlurView>
    </View>
  );
};

// Header Component
const TripHeader = ({ 
  trip, 
  onBack,
  onShare,
}: { 
  trip: any;
  onBack: () => void;
  onShare: () => void;
}) => {
  return (
    <View style={styles.header}>
      <TouchableOpacity style={styles.headerBackButton} onPress={onBack}>
        <Ionicons name="chevron-back" size={24} color="#1F2937" />
      </TouchableOpacity>
      
      <Text style={styles.headerTitle} numberOfLines={1}>
        {trip?.name || 'Trip'}
      </Text>
      
      <TouchableOpacity style={styles.headerShareButton} onPress={onShare}>
        <Ionicons name="share-outline" size={22} color="#1F2937" />
      </TouchableOpacity>
    </View>
  );
};

export default function TripTabScreen({ route, navigation }: any) {
  const { tripId } = route.params;
  const { currentTrip, fetchTripDetails, fetchTripMembers } = useTripStore();
  const { initializeNotifications, startBackgroundTracking, stopBackgroundTracking } = useLocationStore();
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabName>('Chat');
  const [showShareModal, setShowShareModal] = useState(false);

  useEffect(() => {
    const initTrip = async () => {
      try {
        await Promise.all([
          fetchTripDetails(tripId),
          fetchTripMembers(tripId),
        ]);
        
        // Initialize location services & notifications
        await initializeNotifications();
        
        // Start background location tracking for proximity alerts
        console.log('[TripTab] Starting background tracking for trip:', tripId);
        await startBackgroundTracking(tripId);
        
        setIsLoading(false);
      } catch (error) {
        console.error('[TripTab] Init error:', error);
        setIsLoading(false);
      }
    };

    initTrip();

    // Cleanup on unmount
    return () => {
      console.log('[TripTab] Stopping background tracking');
      stopBackgroundTracking();
    };
  }, [tripId]);

  const handleBack = () => {
    HapticFeedback.light();
    navigation.goBack();
  };

  const handleTabPress = (tab: TabName) => {
    HapticFeedback.light();
    setActiveTab(tab);
  };

  const handleShare = async () => {
    HapticFeedback.light();
    if (currentTrip) {
      const inviteCode = currentTrip.invite_code;
      const inviteLink = `https://travelagent.app/join/${inviteCode}`;
      const shareMessage = `Join my trip "${currentTrip.name}" to ${currentTrip.destination}! 🌍✈️\n\n📱 Invite Code: ${inviteCode}\n\n🔗 Or tap: ${inviteLink}`;
      try {
        await Share.share({
          message: shareMessage,
          title: `Join ${currentTrip.name}`,
        });
      } catch (error) {
        console.error('Share error:', error);
      }
    }
  };

  // Render active tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'Chat':
        return <TripChatTab tripId={tripId} navigation={navigation} />;
      case 'Map':
        return <TripMapTab tripId={tripId} navigation={navigation} />;
      case 'Planner':
        return <TripPlannerTab tripId={tripId} navigation={navigation} />;
      case 'Profile':
        return <ProfileScreen navigation={navigation} embedded />;
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      <SafeAreaView style={styles.safeArea}>
        {/* Header - Only show for non-profile tabs */}
        {activeTab !== 'Profile' && (
          <TripHeader 
            trip={currentTrip} 
            onBack={handleBack}
            onShare={handleShare}
          />
        )}
        
        {/* Tab Content */}
        <View style={styles.contentArea}>
          {renderTabContent()}
        </View>
        
        {/* Bottom Tab Bar */}
        <BottomTabBar 
          activeTab={activeTab} 
          onTabPress={handleTabPress} 
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingTop: Platform.OS === 'android' ? STATUS_BAR_HEIGHT : 0,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  headerBackButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
    marginHorizontal: 12,
  },
  headerShareButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Content
  contentArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },

  // Bottom Tab Bar - Glassmorphic
  bottomTabContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: BOTTOM_TAB_HEIGHT,
  },
  bottomTabBlur: {
    flex: 1,
    overflow: 'hidden',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  bottomTabInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 20 : 8,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    position: 'relative',
  },
  activeTabIndicator: {
    position: 'absolute',
    top: 0,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#94A3B8',
    marginTop: 4,
  },
  tabLabelActive: {
    color: '#3B82F6',
    fontWeight: '600',
  },
});
