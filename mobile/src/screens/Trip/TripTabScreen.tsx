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
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import * as Clipboard from 'expo-clipboard';
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
  onBack,
  onSharePress,
  onTimelinePress,
}: { 
  activeTab: TabName; 
  onTabPress: (tab: TabName) => void;
  trip: any;
  onBack: () => void;
  onSharePress: () => void;
  onTimelinePress: () => void;
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

      {/* Bottom Actions */}
      <View style={styles.railBottom}>
        {/* Timeline/Story Button */}
        <TouchableOpacity
          style={styles.railBottomButton}
          onPress={onTimelinePress}
          activeOpacity={0.7}
        >
          <Ionicons name="time-outline" size={20} color="#64748B" />
        </TouchableOpacity>

        {/* Share/Invite Button */}
        <TouchableOpacity
          style={styles.railBottomButton}
          onPress={onSharePress}
          activeOpacity={0.7}
        >
          <Ionicons name="share-social-outline" size={20} color="#64748B" />
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
}: { 
  trip: any; 
  activeTab: TabName;
  onItineraryPress: () => void;
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
        
        {/* Itinerary Button */}
        <TouchableOpacity
          style={styles.headerActionButton}
          onPress={onItineraryPress}
          activeOpacity={0.7}
        >
          <Ionicons name="git-branch-outline" size={20} color="#64748B" />
        </TouchableOpacity>
      </View>
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

  const handleItineraryPress = () => {
    HapticFeedback.light();
    navigation.navigate('ItinerarySetup', { tripId, isInitialSetup: false });
  };

  const handleSharePress = () => {
    HapticFeedback.light();
    setShowShareModal(true);
  };

  const handleTimelinePress = () => {
    HapticFeedback.light();
    navigation.navigate('Timeline', { tripId });
  };

  const handleCopyCode = async () => {
    if (currentTrip?.invite_code) {
      await Clipboard.setStringAsync(currentTrip.invite_code);
      HapticFeedback.success();
      setShowShareModal(false);
      Alert.alert('✅ Copied!', `Invite code "${currentTrip.invite_code}" copied!`);
    }
  };

  const handleCopyLink = async () => {
    if (currentTrip?.invite_code) {
      const inviteLink = `https://travelagent.app/join/${currentTrip.invite_code}`;
      await Clipboard.setStringAsync(inviteLink);
      HapticFeedback.success();
      setShowShareModal(false);
      Alert.alert('✅ Copied!', 'Invite link copied to clipboard');
    }
  };

  const handleShareInvite = async () => {
    if (currentTrip) {
      const inviteCode = currentTrip.invite_code;
      const inviteLink = `https://travelagent.app/join/${inviteCode}`;
      const shareMessage = `Join my trip "${currentTrip.name}" to ${currentTrip.destination}! 🌍✈️\n\n📱 Invite Code: ${inviteCode}\n\n🔗 Or tap: ${inviteLink}`;
      setShowShareModal(false);
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
            onSharePress={handleSharePress}
            onTimelinePress={handleTimelinePress}
          />

          {/* Main Content Area */}
          <View style={styles.contentArea}>
            {/* Compact Header */}
            <TripHeader 
              trip={currentTrip} 
              activeTab={activeTab} 
              onItineraryPress={handleItineraryPress}
            />
            
            {/* Tab Content */}
            <View style={styles.tabContent}>
              {renderTabContent()}
            </View>
          </View>
        </View>
      </SafeAreaView>

      {/* Share Invite Modal */}
      {showShareModal && currentTrip && (
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.modalBackdrop} 
            activeOpacity={1} 
            onPress={() => setShowShareModal(false)} 
          />
          <MotiView
            from={{ translateY: 300, opacity: 0 }}
            animate={{ translateY: 0, opacity: 1 }}
            transition={{ type: 'spring', damping: 20 }}
            style={styles.shareModal}
          >
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Invite Friends</Text>
              <TouchableOpacity onPress={() => setShowShareModal(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Invite Code Display */}
            <View style={styles.inviteCodeContainer}>
              <Text style={styles.inviteCodeLabel}>INVITE CODE</Text>
              <View style={styles.inviteCodeBox}>
                <Text style={styles.inviteCodeText}>{currentTrip.invite_code}</Text>
              </View>
              <Text style={styles.inviteCodeHint}>Share this code with friends to join your trip</Text>
            </View>

            {/* Action Buttons */}
            <View style={styles.shareActions}>
              <TouchableOpacity style={styles.shareActionButton} onPress={handleCopyCode}>
                <LinearGradient
                  colors={['#3B82F6', '#2563EB']}
                  style={styles.shareActionGradient}
                >
                  <Ionicons name="copy-outline" size={20} color="#FFFFFF" />
                  <Text style={styles.shareActionText}>Copy Code</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity style={styles.shareActionButton} onPress={handleCopyLink}>
                <View style={styles.shareActionSecondary}>
                  <Ionicons name="link-outline" size={20} color="#3B82F6" />
                  <Text style={styles.shareActionSecondaryText}>Copy Link</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.shareActionButton} onPress={handleShareInvite}>
                <View style={styles.shareActionSecondary}>
                  <Ionicons name="share-outline" size={20} color="#3B82F6" />
                  <Text style={styles.shareActionSecondaryText}>Share...</Text>
                </View>
              </TouchableOpacity>
            </View>
          </MotiView>
        </View>
      )}
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
    alignItems: 'center',
    gap: 12,
  },
  railBottomButton: {
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
  headerActionButton: {
    marginLeft: 12,
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

  // Share Modal Styles
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    zIndex: 1000,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  shareModal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
  },
  inviteCodeContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  inviteCodeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    letterSpacing: 1,
    marginBottom: 12,
  },
  inviteCodeBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    marginBottom: 8,
  },
  inviteCodeText: {
    fontSize: 32,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 4,
  },
  inviteCodeHint: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 8,
  },
  shareActions: {
    gap: 12,
  },
  shareActionButton: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  shareActionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 10,
  },
  shareActionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  shareActionSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 10,
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
  },
  shareActionSecondaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3B82F6',
  },
});
