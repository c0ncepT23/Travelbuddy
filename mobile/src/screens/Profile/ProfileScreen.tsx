import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
  StatusBar,
  TextInput,
  Image,
  ActivityIndicator,
  Dimensions,
  Switch,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../stores/authStore';
import { useTripStore } from '../../stores/tripStore';
import { useXPStore } from '../../stores/xpStore';
import { useLocationStore } from '../../stores/locationStore';
import api from '../../config/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ProfileScreenProps {
  navigation: any;
  embedded?: boolean;
}

export default function ProfileScreen({ navigation, embedded = false }: ProfileScreenProps) {
  const { user, logout, updateUser } = useAuthStore();
  const { trips, fetchTrips } = useTripStore();
  const { xp: totalXP, level, getLevelTitle, getProgress } = useXPStore();
  const { 
    isBackgroundTrackingEnabled, 
    isBackgroundTracking,
    hasBackgroundPermission,
    setBackgroundTrackingEnabled, 
    loadBackgroundTrackingPreference,
    startBackgroundTracking,
    requestBackgroundPermission,
  } = useLocationStore();
  
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(user?.name || '');
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatar_url || null);
  
  const nameInputRef = useRef<TextInput>(null);
  
  const [stats, setStats] = useState({
    totalTrips: 0,
    activeTrips: 0,
    pastTrips: 0,
  });

  useEffect(() => {
    loadProfileData();
    loadBackgroundTrackingPreference();
  }, []);

  useEffect(() => {
    setEditedName(user?.name || '');
    setAvatarUrl(user?.avatar_url || null);
  }, [user]);

  const loadProfileData = async () => {
    try {
      await fetchTrips();
    } catch (error) {
      console.error('Failed to load profile data:', error);
    }
  };

  useEffect(() => {
    const now = new Date();
    const active = trips.filter((trip) => {
      if (!trip.end_date) return true;
      return new Date(trip.end_date) >= now;
    });
    const past = trips.filter((trip) => {
      if (!trip.end_date) return false;
      return new Date(trip.end_date) < now;
    });

    setStats({
      totalTrips: trips.length,
      activeTrips: active.length,
      pastTrips: past.length,
    });
  }, [trips]);

  const handleNamePress = () => {
    setIsEditingName(true);
    setTimeout(() => nameInputRef.current?.focus(), 100);
  };

  const handleNameSave = async () => {
    if (!editedName.trim()) {
      Alert.alert('Error', 'Name cannot be empty');
      setEditedName(user?.name || '');
      setIsEditingName(false);
      return;
    }

    if (editedName.trim() === user?.name) {
      setIsEditingName(false);
      return;
    }

    try {
      const response = await api.patch('/auth/profile', { name: editedName.trim() });
      if (response.data.success && updateUser) {
        updateUser({ ...user, name: editedName.trim() });
      }
      setIsEditingName(false);
    } catch (error) {
      console.error('Failed to update name:', error);
      Alert.alert('Error', 'Failed to update name. Please try again.');
      setEditedName(user?.name || '');
      setIsEditingName(false);
    }
  };

  const handleAvatarPress = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please grant camera roll permissions to change your profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      setIsUploadingAvatar(true);
      try {
        const base64 = `data:image/jpeg;base64,${result.assets[0].base64}`;
        const response = await api.patch('/auth/profile', { avatar_url: base64 });
        if (response.data.success && updateUser) {
          setAvatarUrl(base64);
          updateUser({ ...user, avatar_url: base64 });
        }
      } catch (error) {
        console.error('Failed to upload avatar:', error);
        Alert.alert('Error', 'Failed to upload profile picture. Please try again.');
      } finally {
        setIsUploadingAvatar(false);
      }
    }
  };

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to log out?')) {
        logout();
      }
    } else {
      Alert.alert('Log Out', 'Are you sure you want to log out?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: () => logout(),
        },
      ]);
    }
  };

  const handleBackgroundTrackingToggle = async (enabled: boolean) => {
    if (enabled && !hasBackgroundPermission) {
      // Need to request permission first
      Alert.alert(
        'Location Permission',
        'Yori needs background location access to notify you when you\'re near saved places. This helps you discover spots from your travel research!',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Enable',
            onPress: async () => {
              const granted = await requestBackgroundPermission();
              if (granted) {
                await setBackgroundTrackingEnabled(true);
                await startBackgroundTracking();
              } else {
                Alert.alert(
                  'Permission Required',
                  'Please enable "Allow all the time" location access in your device settings for Yori.'
                );
              }
            },
          },
        ]
      );
    } else {
      await setBackgroundTrackingEnabled(enabled);
    }
  };

  const getPastTrips = () => {
    const now = new Date();
    return trips.filter((trip) => {
      if (!trip.end_date) return false;
      return new Date(trip.end_date) < now;
    });
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  // Get level color
  const getLevelColor = () => {
    if (level >= 10) return ['#F59E0B', '#EF4444']; // Gold to red
    if (level >= 5) return ['#8B5CF6', '#EC4899']; // Purple to pink
    return ['#3B82F6', '#06B6D4']; // Blue to cyan
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Header with Gradient */}
        <LinearGradient
          colors={['#0F172A', '#1E293B', '#334155']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroSection}
        >
          {/* Decorative circles */}
          <View style={styles.decorCircle1} />
          <View style={styles.decorCircle2} />
          <View style={styles.decorCircle3} />
          
          {/* Back Button - Only show when not embedded in tab */}
          {!embedded && (
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          )}

          {/* Avatar Section */}
          <TouchableOpacity 
            style={styles.avatarWrapper}
            onPress={handleAvatarPress}
            activeOpacity={0.9}
          >
            {/* Glow effect */}
            <LinearGradient
              colors={getLevelColor()}
              style={styles.avatarGlow}
            />
            
            <View style={styles.avatarContainer}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
              ) : (
                <LinearGradient
                  colors={['#E2E8F0', '#F8FAFC']}
                  style={styles.avatarPlaceholder}
                >
                  <Text style={styles.avatarText}>{user ? getInitials(user.name) : '?'}</Text>
                </LinearGradient>
              )}
              
              {isUploadingAvatar && (
                <View style={styles.avatarUploadingOverlay}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                </View>
              )}
            </View>

            {/* Camera badge */}
            <View style={styles.cameraBadge}>
              <Ionicons name="camera" size={14} color="#FFFFFF" />
            </View>

            {/* Level badge */}
            <LinearGradient
              colors={getLevelColor()}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.levelBadge}
            >
              <Text style={styles.levelBadgeText}>Lv.{level}</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Name */}
          {isEditingName ? (
            <View style={styles.nameEditContainer}>
              <TextInput
                ref={nameInputRef}
                style={styles.nameInput}
                value={editedName}
                onChangeText={setEditedName}
                onBlur={handleNameSave}
                onSubmitEditing={handleNameSave}
                placeholder="Your name"
                placeholderTextColor="rgba(255,255,255,0.5)"
                autoFocus
                selectTextOnFocus
              />
              <TouchableOpacity style={styles.saveNameButton} onPress={handleNameSave}>
                <Ionicons name="checkmark" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity onPress={handleNamePress} style={styles.nameContainer}>
              <Text style={styles.name}>{user?.name || 'Unknown User'}</Text>
              <View style={styles.editNameIcon}>
                <Ionicons name="pencil" size={14} color="rgba(255,255,255,0.6)" />
              </View>
            </TouchableOpacity>
          )}

          {/* Contact Info */}
          <Text style={styles.contactInfo}>{user?.phone_number || user?.email || ''}</Text>

          {/* Level Title with gradient text effect */}
          <View style={styles.levelTitleContainer}>
            <LinearGradient
              colors={getLevelColor()}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.levelTitleBg}
            >
              <Text style={styles.levelTitle}>{getLevelTitle()}</Text>
            </LinearGradient>
          </View>

          {/* XP Progress */}
          <View style={styles.xpSection}>
            <View style={styles.xpBarContainer}>
              <View style={styles.xpBarBackground}>
                <LinearGradient
                  colors={getLevelColor()}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.xpBarFill, { width: `${getProgress() * 100}%` }]}
                />
              </View>
            </View>
            <Text style={styles.xpText}>{totalXP} XP</Text>
          </View>
        </LinearGradient>

        {/* Stats Section */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Your Journey</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{stats.totalTrips}</Text>
              <Text style={styles.statLabel}>Total Trips</Text>
            </View>
            <LinearGradient
              colors={['#3B82F6', '#2563EB']}
              style={[styles.statCard, styles.statCardActive]}
            >
              <Text style={styles.statNumberActive}>{stats.activeTrips}</Text>
              <Text style={styles.statLabelActive}>Active</Text>
            </LinearGradient>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{stats.pastTrips}</Text>
              <Text style={styles.statLabel}>Completed</Text>
            </View>
          </View>
        </View>

        {/* Past Trips Section */}
        <View style={styles.pastTripsSection}>
          <Text style={styles.sectionTitle}>Travel History</Text>
          {getPastTrips().length > 0 ? (
            <View style={styles.tripsContainer}>
              {getPastTrips().map((trip) => (
                <TouchableOpacity
                  key={trip.id}
                  style={styles.tripCard}
                  onPress={() =>
                    navigation.navigate('TripDetail', {
                      tripId: trip.id,
                      tripName: trip.name,
                    })
                  }
                  activeOpacity={0.8}
                >
                  <View style={styles.tripCardContent}>
                    <View style={styles.tripEmoji}>
                      <Text style={styles.tripEmojiText}>
                        {trip.destination?.includes('Japan') ? '🇯🇵' : 
                         trip.destination?.includes('India') ? '🇮🇳' :
                         trip.destination?.includes('France') ? '🇫🇷' : '🌍'}
                      </Text>
                    </View>
                    <View style={styles.tripInfo}>
                      <Text style={styles.tripName}>{trip.name}</Text>
                      <View style={styles.tripDestinationRow}>
                        <Ionicons name="location" size={14} color="#6B7280" />
                        <Text style={styles.tripDestination}>{trip.destination}</Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <Ionicons name="airplane-outline" size={40} color="#3B82F6" />
              </View>
              <Text style={styles.emptyText}>No trips yet</Text>
              <Text style={styles.emptySubtext}>Your travel history will appear here</Text>
            </View>
          )}
        </View>

        {/* Settings Section */}
        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>Settings</Text>
          
          {/* Background Location Tracking */}
          <View style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingIconContainer}>
                <Ionicons name="location" size={22} color="#3B82F6" />
              </View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Nearby Place Alerts</Text>
                <Text style={styles.settingDescription}>
                  Get notified when you're near saved places from any of your trips
                </Text>
              </View>
              <Switch
                value={isBackgroundTrackingEnabled}
                onValueChange={handleBackgroundTrackingToggle}
                trackColor={{ false: '#E2E8F0', true: '#93C5FD' }}
                thumbColor={isBackgroundTrackingEnabled ? '#3B82F6' : '#F1F5F9'}
                ios_backgroundColor="#E2E8F0"
              />
            </View>
            {isBackgroundTracking && (
              <View style={styles.settingStatus}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>Location tracking active</Text>
              </View>
            )}
          </View>

          {/* Notification Preferences Link */}
          <TouchableOpacity 
            style={styles.settingCard}
            onPress={() => {
              // Future: Navigate to notification preferences
              Alert.alert('Coming Soon', 'Fine-grained notification controls coming soon!');
            }}
            activeOpacity={0.8}
          >
            <View style={styles.settingRow}>
              <View style={[styles.settingIconContainer, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="notifications" size={22} color="#F59E0B" />
              </View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Notification Preferences</Text>
                <Text style={styles.settingDescription}>
                  Customize when and how you receive alerts
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={20} color="#EF4444" />
          <Text style={styles.logoutButtonText}>Log Out</Text>
        </TouchableOpacity>

        <View style={styles.footer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },

  // Hero Section
  heroSection: {
    paddingTop: 60,
    paddingBottom: 40,
    alignItems: 'center',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: 'hidden',
    position: 'relative',
  },
  decorCircle1: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  decorCircle2: {
    position: 'absolute',
    bottom: -30,
    left: -30,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(139, 92, 246, 0.08)',
  },
  decorCircle3: {
    position: 'absolute',
    top: 100,
    left: 30,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(6, 182, 212, 0.06)',
  },

  backButton: {
    position: 'absolute',
    top: 50,
    left: 16,
    width: 40,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Avatar
  avatarWrapper: {
    marginTop: 20,
    marginBottom: 20,
    position: 'relative',
  },
  avatarGlow: {
    position: 'absolute',
    top: -8,
    left: -8,
    right: -8,
    bottom: -8,
    borderRadius: 70,
    opacity: 0.4,
  },
  avatarContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 42,
    fontWeight: '700',
    color: '#475569',
  },
  avatarUploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 32,
    height: 32,
    backgroundColor: '#3B82F6',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#1E293B',
  },
  levelBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  levelBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  // Name
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  editNameIcon: {
    width: 28,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nameEditContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  nameInput: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 16,
    minWidth: 200,
    textAlign: 'center',
  },
  saveNameButton: {
    width: 40,
    height: 40,
    backgroundColor: '#10B981',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },

  contactInfo: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.6)',
    marginTop: 4,
    marginBottom: 12,
  },

  levelTitleContainer: {
    marginBottom: 20,
  },
  levelTitleBg: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  levelTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // XP
  xpSection: {
    width: '75%',
    alignItems: 'center',
  },
  xpBarContainer: {
    width: '100%',
    marginBottom: 8,
  },
  xpBarBackground: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  xpBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  xpText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },

  // Stats Section
  statsSection: {
    padding: 20,
    paddingTop: 28,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  statCardActive: {
    transform: [{ scale: 1.02 }],
  },
  statNumber: {
    fontSize: 32,
    fontWeight: '800',
    color: '#3B82F6',
    marginBottom: 4,
  },
  statNumberActive: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
  },
  statLabelActive: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
  },

  // Past Trips Section
  pastTripsSection: {
    padding: 20,
    paddingTop: 8,
  },
  tripsContainer: {
    gap: 12,
  },
  tripCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
    overflow: 'hidden',
  },
  tripCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  tripEmoji: {
    width: 52,
    height: 52,
    backgroundColor: '#F1F5F9',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  tripEmojiText: {
    fontSize: 26,
  },
  tripInfo: {
    flex: 1,
  },
  tripName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  tripDestinationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tripDestination: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748B',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    backgroundColor: '#EFF6FF',
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    fontWeight: '500',
    color: '#94A3B8',
    textAlign: 'center',
  },

  // Settings Section
  settingsSection: {
    padding: 20,
    paddingTop: 8,
  },
  settingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingIconContainer: {
    width: 44,
    height: 44,
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  settingInfo: {
    flex: 1,
    marginRight: 12,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748B',
    lineHeight: 18,
  },
  settingStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 8,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#10B981',
  },

  // Logout Button
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 24,
    padding: 16,
    backgroundColor: '#FEF2F2',
    borderRadius: 16,
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#EF4444',
  },

  footer: {
    height: 20,
  },
});
