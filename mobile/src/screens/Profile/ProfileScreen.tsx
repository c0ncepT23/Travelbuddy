import React, { useEffect, useState, useRef, useMemo } from 'react';
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
import { MotiView, AnimatePresence } from 'moti';
import { useAuthStore } from '../../stores/authStore';
import { useTripStore } from '../../stores/tripStore';
import { useLocationStore } from '../../stores/locationStore';
import api from '../../config/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Midnight Discovery palette
const COLORS = {
  background: '#0F1115',
  surface: '#17191F',
  surfaceLight: '#23252F',
  primary: '#06B6D4',
  secondary: '#22D3EE',
  accent: '#22C55E',
  text: '#FFFFFF',
  textSecondary: '#94A3B8',
  danger: '#EF4444',
  border: 'rgba(6, 182, 212, 0.1)',
};

interface ProfileScreenProps {
  navigation: any;
  embedded?: boolean;
}

type ExpandedSection = null | 'total' | 'active' | 'completed';

export default function ProfileScreen({ navigation, embedded = false }: ProfileScreenProps) {
  const { user, logout, updateUser } = useAuthStore();
  const { trips, fetchTrips } = useTripStore();
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
  const [expandedSection, setExpandedSection] = useState<ExpandedSection>(null);
  
  const nameInputRef = useRef<TextInput>(null);
  
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

  const tripStats = useMemo(() => {
    const now = new Date();
    const active = trips.filter((trip) => {
      if (!trip.end_date) return true;
      return new Date(trip.end_date) >= now;
    });
    const completed = trips.filter((trip) => {
      if (!trip.end_date) return false;
      return new Date(trip.end_date) < now;
    });

    return {
      total: trips,
      active,
      completed,
    };
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
        updateUser({ ...user, name: editedName.trim() } as any);
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
          updateUser({ ...user, avatar_url: base64 } as any);
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
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: () => logout() },
    ]);
  };

  const handleBackgroundTrackingToggle = async (enabled: boolean) => {
    if (enabled && !hasBackgroundPermission) {
      Alert.alert(
        'Location Permission',
        'Yori needs background location access to notify you when you\'re near saved places.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Enable',
            onPress: async () => {
              const granted = await requestBackgroundPermission();
              if (granted) {
                await setBackgroundTrackingEnabled(true);
                await startBackgroundTracking();
              }
            },
          },
        ]
      );
    } else {
      await setBackgroundTrackingEnabled(enabled);
    }
  };

  const toggleSection = (section: ExpandedSection) => {
    setExpandedSection(prev => prev === section ? null : section);
  };

  const renderTripCard = (trip: any) => (
    <TouchableOpacity
      key={trip.id}
      style={styles.tripCard}
      onPress={() => navigation.navigate('CountryBubbles', { 
        tripId: trip.id,
        countryName: trip.destination,
      })}
      activeOpacity={0.8}
    >
      <View style={styles.tripCardEmoji}>
        <Text style={styles.tripEmojiText}>🌍</Text>
      </View>
      <View style={styles.tripCardInfo}>
        <Text style={styles.tripCardName} numberOfLines={1}>{trip.name}</Text>
        <Text style={styles.tripCardDest} numberOfLines={1}>{trip.destination}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      {/* Absolute Header for Back Button */}
      {!embedded && (
        <View style={styles.topHeader}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="chevron-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
        </View>
      )}

      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Info Section */}
        <View style={styles.profileHeader}>
          <TouchableOpacity 
            style={styles.avatarWrapper}
            onPress={handleAvatarPress}
            activeOpacity={0.9}
          >
            <View style={styles.avatarContainer}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarText}>{user?.name?.charAt(0).toUpperCase() || '?'}</Text>
                </View>
              )}
              {isUploadingAvatar && (
                <View style={styles.avatarUploadingOverlay}>
                  <ActivityIndicator size="small" color={COLORS.primary} />
                </View>
              )}
            </View>
            <View style={styles.cameraBadge}>
              <Ionicons name="camera" size={14} color="#FFFFFF" />
            </View>
          </TouchableOpacity>

          {isEditingName ? (
            <View style={styles.nameEditContainer}>
              <TextInput
                ref={nameInputRef}
                style={styles.nameInput}
                value={editedName}
                onChangeText={setEditedName}
                onBlur={handleNameSave}
                onSubmitEditing={handleNameSave}
                autoFocus
              />
            </View>
          ) : (
            <TouchableOpacity onPress={handleNamePress} style={styles.nameContainer}>
              <Text style={styles.name}>{user?.name || 'Explorer'}</Text>
              <Ionicons name="pencil" size={14} color={COLORS.textSecondary} style={{ marginLeft: 8 }} />
            </TouchableOpacity>
          )}
          
          <Text style={styles.number}>{user?.phone_number || 'No number set'}</Text>
        </View>

        {/* Your Journey Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Journey</Text>
          
          <View style={styles.journeyGrid}>
            <TouchableOpacity 
              style={[styles.statItem, expandedSection === 'total' && styles.statItemActive]}
              onPress={() => toggleSection('total')}
            >
              <Text style={[styles.statValue, expandedSection === 'total' && styles.statValueActive]}>
                {tripStats.total.length}
              </Text>
              <Text style={styles.statLabel}>Total</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.statItem, expandedSection === 'active' && styles.statItemActive]}
              onPress={() => toggleSection('active')}
            >
              <Text style={[styles.statValue, expandedSection === 'active' && styles.statValueActive]}>
                {tripStats.active.length}
              </Text>
              <Text style={styles.statLabel}>Active</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.statItem, expandedSection === 'completed' && styles.statItemActive]}
              onPress={() => toggleSection('completed')}
            >
              <Text style={[styles.statValue, expandedSection === 'completed' && styles.statValueActive]}>
                {tripStats.completed.length}
              </Text>
              <Text style={styles.statLabel}>Done</Text>
            </TouchableOpacity>
          </View>

          {/* Expanded List */}
          <AnimatePresence>
            {expandedSection && (
              <MotiView
                from={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ type: 'timing', duration: 300 }}
                style={styles.expandedContent}
              >
                <View style={styles.tripList}>
                  {tripStats[expandedSection === 'total' ? 'total' : expandedSection === 'active' ? 'active' : 'completed'].map(renderTripCard)}
                  {tripStats[expandedSection === 'total' ? 'total' : expandedSection === 'active' ? 'active' : 'completed'].length === 0 && (
                    <Text style={styles.emptyText}>No trips here yet 🌍</Text>
                  )}
                </View>
              </MotiView>
            )}
          </AnimatePresence>
        </View>

        {/* Settings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>
          
          <View style={styles.settingsList}>
            <View style={styles.settingItem}>
              <View style={styles.settingIcon}>
                <Ionicons name="location" size={20} color={COLORS.primary} />
              </View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Nearby Alerts</Text>
                <Text style={styles.settingDesc}>Notify when near saved spots</Text>
              </View>
              <Switch
                value={isBackgroundTrackingEnabled}
                onValueChange={handleBackgroundTrackingToggle}
                trackColor={{ false: '#334155', true: COLORS.primary }}
                thumbColor="#FFFFFF"
              />
            </View>

            <TouchableOpacity style={styles.settingItem} onPress={handleLogout}>
              <View style={[styles.settingIcon, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
                <Ionicons name="log-out" size={20} color={COLORS.danger} />
              </View>
              <View style={styles.settingInfo}>
                <Text style={[styles.settingTitle, { color: COLORS.danger }]}>Log Out</Text>
                <Text style={styles.settingDesc}>Sign out of your account</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  topHeader: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    left: 0,
    right: 0,
    height: 60,
    zIndex: 100,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: Platform.OS === 'ios' ? 120 : 90,
  },
  profileHeader: {
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 40,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 20,
  },
  avatarContainer: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: COLORS.surface,
    borderWidth: 2,
    borderColor: COLORS.primary,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: COLORS.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 36,
    fontWeight: '700',
    color: COLORS.primary,
  },
  avatarUploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 34,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    borderWidth: 3,
    borderColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  name: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  nameEditContainer: {
    marginBottom: 6,
  },
  nameInput: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.primary,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.primary,
    textAlign: 'center',
    paddingVertical: 4,
    minWidth: 180,
  },
  number: {
    fontSize: 15,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 16,
    letterSpacing: -0.2,
  },
  journeyGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statItem: {
    flex: 1,
    backgroundColor: COLORS.surface,
    paddingVertical: 18,
    paddingHorizontal: 12,
    borderRadius: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statItemActive: {
    borderColor: COLORS.primary,
    backgroundColor: 'rgba(6, 182, 212, 0.05)',
  },
  statValue: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.primary,
    marginBottom: 2,
  },
  statValueActive: {
    color: COLORS.secondary,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
  },
  expandedContent: {
    marginTop: 16,
    overflow: 'hidden',
  },
  tripList: {
    gap: 10,
  },
  tripCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tripCardEmoji: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: COLORS.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  tripEmojiText: {
    fontSize: 22,
  },
  tripCardInfo: {
    flex: 1,
  },
  tripCardName: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 2,
  },
  tripCardDest: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  emptyText: {
    textAlign: 'center',
    color: COLORS.textSecondary,
    paddingVertical: 20,
    fontSize: 14,
  },
  settingsList: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 18,
  },
  settingIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  settingInfo: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 2,
  },
  settingDesc: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
});
