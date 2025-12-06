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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { useTripStore } from '../../stores/tripStore';
import { useLocationStore } from '../../stores/locationStore';
import { HapticFeedback } from '../../utils/haptics';
import theme from '../../config/theme';

// Tab Screens
import TripChatTab from './tabs/TripChatTab';
import TripMapTab from './tabs/TripMapTab';
import TripPlannerTab from './tabs/TripPlannerTab';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const STATUS_BAR_HEIGHT = Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 0;

type TabName = 'Chat' | 'Map' | 'Planner';

interface TabConfig {
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
  label: string;
}

const TAB_CONFIG: Record<TabName, TabConfig> = {
  Chat: { icon: 'chatbubble-outline', activeIcon: 'chatbubble', label: 'Chat' },
  Map: { icon: 'map-outline', activeIcon: 'map', label: 'Map' },
  Planner: { icon: 'calendar-outline', activeIcon: 'calendar', label: 'Planner' },
};

const TAB_ORDER: TabName[] = ['Chat', 'Map', 'Planner'];

// Modern Side Rail Component
const SideRail = ({ 
  activeTab, 
  onTabPress, 
  trip, 
  onBack 
}: { 
  activeTab: TabName; 
  onTabPress: (tab: TabName) => void;
  trip: any;
  onBack: () => void;
}) => {
  const getDestinationInitial = () => {
    if (!trip?.destination) return '✈️';
    return trip.destination.charAt(0).toUpperCase();
  };

  return (
    <View style={styles.sideRail}>
      {/* Back Button */}
      <TouchableOpacity
        style={styles.railBackButton}
        onPress={onBack}
        activeOpacity={0.7}
      >
        <Ionicons name="chevron-back" size={22} color="#94A3B8" />
      </TouchableOpacity>

      {/* Trip Avatar */}
      <MotiView
        from={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', damping: 15 }}
      >
        <LinearGradient
          colors={['#3B82F6', '#8B5CF6']}
          style={styles.tripAvatar}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={styles.tripAvatarText}>{getDestinationInitial()}</Text>
        </LinearGradient>
      </MotiView>

      {/* Divider */}
      <View style={styles.railDivider} />

      {/* Tab Items */}
      <View style={styles.railTabs}>
        {TAB_ORDER.map((tabName, index) => {
          const config = TAB_CONFIG[tabName];
          const isActive = activeTab === tabName;

          return (
            <MotiView
              key={tabName}
              from={{ opacity: 0, translateX: -10 }}
              animate={{ opacity: 1, translateX: 0 }}
              transition={{ type: 'timing', duration: 300, delay: index * 100 }}
            >
              <TouchableOpacity
                style={styles.railTabItem}
                onPress={() => onTabPress(tabName)}
                activeOpacity={0.7}
              >
                {/* Active Indicator */}
                {isActive && (
                  <MotiView
                    from={{ opacity: 0, scaleY: 0 }}
                    animate={{ opacity: 1, scaleY: 1 }}
                    transition={{ type: 'spring', damping: 15 }}
                    style={styles.railActiveIndicator}
                  />
                )}
                
                {/* Icon Container */}
                {isActive ? (
                  <LinearGradient
                    colors={['#3B82F6', '#6366F1']}
                    style={styles.railIconContainer}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Ionicons 
                      name={config.activeIcon} 
                      size={22} 
                      color="#FFFFFF" 
                    />
                  </LinearGradient>
                ) : (
                  <View style={styles.railIconContainer}>
                    <Ionicons 
                      name={config.icon} 
                      size={22} 
                      color="#64748B" 
                    />
                  </View>
                )}
                
                {/* Label */}
                <Text style={[styles.railLabel, isActive && styles.railLabelActive]}>
                  {config.label}
                </Text>
              </TouchableOpacity>
            </MotiView>
          );
        })}
      </View>

      {/* Settings at bottom */}
      <View style={styles.railBottom}>
        <TouchableOpacity
          style={styles.railSettingsButton}
          onPress={() => {
            HapticFeedback.light();
            // TODO: Open trip settings
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="settings-outline" size={20} color="#64748B" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Header Component
const TripHeader = ({ 
  trip, 
  activeTab, 
  onItineraryPress,
  onProfilePress 
}: { 
  trip: any; 
  activeTab: TabName;
  onItineraryPress: () => void;
  onProfilePress: () => void;
}) => {
  return (
    <View style={styles.header}>
      <View style={styles.headerContent}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {trip?.name || 'Trip'}
          </Text>
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>{TAB_CONFIG[activeTab].label}</Text>
          </View>
        </View>
        
        {/* Right Actions */}
        <View style={styles.headerActions}>
          {/* Itinerary Button */}
          <TouchableOpacity
            style={styles.headerActionButton}
            onPress={onItineraryPress}
            activeOpacity={0.7}
          >
            <Ionicons name="airplane-outline" size={20} color="#64748B" />
          </TouchableOpacity>
          
          {/* Profile Button */}
          <TouchableOpacity
            style={styles.headerActionButton}
            onPress={onProfilePress}
            activeOpacity={0.7}
          >
            <Ionicons name="person-circle-outline" size={22} color="#64748B" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export default function TripTabScreen({ route, navigation }: any) {
  const { tripId } = route.params;
  const { currentTrip, fetchTripDetails, fetchTripMembers } = useTripStore();
  const { initializeNotifications } = useLocationStore();
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabName>('Chat');

  useEffect(() => {
    const initTrip = async () => {
      try {
        await Promise.all([
          fetchTripDetails(tripId),
          fetchTripMembers(tripId),
        ]);
        
        // Initialize location services
        await initializeNotifications();
        
        setIsLoading(false);
      } catch (error) {
        console.error('[TripTab] Init error:', error);
        setIsLoading(false);
      }
    };

    initTrip();
  }, [tripId]);

  const handleBack = () => {
    HapticFeedback.light();
    navigation.goBack();
  };

  const handleTabPress = (tab: TabName) => {
    HapticFeedback.light();
    setActiveTab(tab);
  };

  const handleItineraryPress = () => {
    HapticFeedback.light();
    navigation.navigate('ItinerarySetup', { tripId, isInitialSetup: false });
  };

  const handleProfilePress = () => {
    HapticFeedback.light();
    navigation.navigate('Profile');
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
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
      
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.mainLayout}>
          {/* Side Rail Navigation */}
          <SideRail
            activeTab={activeTab}
            onTabPress={handleTabPress}
            trip={currentTrip}
            onBack={handleBack}
          />

          {/* Main Content Area */}
          <View style={styles.contentArea}>
            {/* Compact Header */}
            <TripHeader 
              trip={currentTrip} 
              activeTab={activeTab} 
              onItineraryPress={handleItineraryPress}
              onProfilePress={handleProfilePress}
            />
            
            {/* Tab Content */}
            <View style={styles.tabContent}>
              {renderTabContent()}
            </View>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const RAIL_WIDTH = 76;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  mainLayout: {
    flex: 1,
    flexDirection: 'row',
  },

  // Side Rail - Modern Dark Theme
  sideRail: {
    width: RAIL_WIDTH,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    paddingTop: Platform.OS === 'android' ? STATUS_BAR_HEIGHT + 16 : 16,
    paddingBottom: 16,
  },
  railBackButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  tripAvatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  tripAvatarText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  railDivider: {
    width: 32,
    height: 2,
    backgroundColor: '#1E293B',
    borderRadius: 1,
    marginBottom: 20,
  },
  railTabs: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  railTabItem: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    position: 'relative',
  },
  railActiveIndicator: {
    position: 'absolute',
    left: -4,
    top: '50%',
    marginTop: -16,
    width: 3,
    height: 32,
    backgroundColor: '#3B82F6',
    borderRadius: 2,
  },
  railIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  railLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
  },
  railLabelActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  railBottom: {
    marginTop: 'auto',
    paddingTop: 16,
  },
  railSettingsButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Content Area
  contentArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderTopLeftRadius: 24,
    borderBottomLeftRadius: 24,
    overflow: 'hidden',
    marginTop: Platform.OS === 'android' ? STATUS_BAR_HEIGHT : 0,
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    flexShrink: 1,
  },
  headerBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  headerBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6366F1',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 12,
  },
  headerActionButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabContent: {
    flex: 1,
  },
});
