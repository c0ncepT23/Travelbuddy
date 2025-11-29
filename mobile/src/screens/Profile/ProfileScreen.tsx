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
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '../../stores/authStore';
import { useTripStore } from '../../stores/tripStore';
import { useXPStore } from '../../stores/xpStore';
import api from '../../config/api';

export default function ProfileScreen({ navigation }: any) {
  const { user, logout, updateUser } = useAuthStore();
  const { trips, fetchTrips } = useTripStore();
  const { totalXP, level, getLevelTitle, getProgress } = useXPStore();
  
  // Edit states
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(user?.name || '');
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatar_url || null);
  const [coverUrl, setCoverUrl] = useState<string | null>(user?.cover_url || null);
  
  const nameInputRef = useRef<TextInput>(null);
  
  const [stats, setStats] = useState({
    totalTrips: 0,
    activeTrips: 0,
    pastTrips: 0,
  });

  useEffect(() => {
    loadProfileData();
  }, []);

  useEffect(() => {
    setEditedName(user?.name || '');
    setAvatarUrl(user?.avatar_url || null);
    setCoverUrl(user?.cover_url || null);
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

  // Name editing
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

  // Avatar/Profile Picture
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

  // Cover Photo
  const handleCoverPress = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please grant camera roll permissions to change your cover photo.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      setIsUploadingCover(true);
      try {
        const base64 = `data:image/jpeg;base64,${result.assets[0].base64}`;
        const response = await api.patch('/auth/profile', { cover_url: base64 });
        if (response.data.success && updateUser) {
          setCoverUrl(base64);
          updateUser({ ...user, cover_url: base64 });
        }
      } catch (error) {
        console.error('Failed to upload cover:', error);
        Alert.alert('Error', 'Failed to upload cover photo. Please try again.');
      } finally {
        setIsUploadingCover(false);
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <StatusBar barStyle="light-content" backgroundColor="#1F2937" />
      
      {/* Header Section with Cover Photo */}
      <TouchableOpacity 
        style={styles.header} 
        onPress={handleCoverPress}
        activeOpacity={0.9}
      >
        {/* Cover Image */}
        {coverUrl ? (
          <Image source={{ uri: coverUrl }} style={styles.coverImage} />
        ) : (
          <View style={styles.coverPlaceholder}>
            <Text style={styles.coverPlaceholderText}>📷 Tap to add cover photo</Text>
          </View>
        )}
        
        {/* Cover Overlay */}
        <View style={styles.coverOverlay} />
        
        {/* Upload Indicator for Cover */}
        {isUploadingCover && (
          <View style={styles.uploadingOverlay}>
            <ActivityIndicator size="large" color="#FFFFFF" />
            <Text style={styles.uploadingText}>Uploading...</Text>
          </View>
        )}
        
        {/* Edit Cover Icon */}
        <View style={styles.editCoverButton}>
          <Text style={styles.editCoverIcon}>📷</Text>
        </View>

        {/* Back Button */}
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        
        {/* Avatar */}
        <TouchableOpacity 
          style={styles.avatarContainer}
          onPress={handleAvatarPress}
          activeOpacity={0.8}
        >
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{user ? getInitials(user.name) : '?'}</Text>
            </View>
          )}
          
          {/* Upload Indicator for Avatar */}
          {isUploadingAvatar && (
            <View style={styles.avatarUploadingOverlay}>
              <ActivityIndicator size="small" color="#FFFFFF" />
            </View>
          )}
          
          {/* Edit Avatar Icon */}
          <View style={styles.editAvatarButton}>
            <Text style={styles.editAvatarIcon}>✏️</Text>
          </View>
          
          {/* Level Badge */}
          <View style={styles.levelBadge}>
            <Text style={styles.levelBadgeText}>Lv.{level}</Text>
          </View>
        </TouchableOpacity>
        
        {/* Name - Editable */}
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
              <Text style={styles.saveNameText}>✓</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity onPress={handleNamePress} style={styles.nameContainer}>
            <Text style={styles.name}>{user?.name || 'Unknown User'}</Text>
            <Text style={styles.editNameHint}>✏️</Text>
          </TouchableOpacity>
        )}
        
        <Text style={styles.email}>{user?.phone_number || user?.email || ''}</Text>
        <Text style={styles.levelTitle}>{getLevelTitle()}</Text>
        
        {/* XP Progress Bar */}
        <View style={styles.xpContainer}>
          <View style={styles.xpBarBackground}>
            <View style={[styles.xpBarFill, { width: `${getProgress() * 100}%` }]} />
          </View>
          <Text style={styles.xpText}>{totalXP} XP</Text>
        </View>
      </TouchableOpacity>

      {/* Stats Section */}
      <View style={styles.statsSection}>
        <Text style={styles.sectionTitle}>Your Stats</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.totalTrips}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={[styles.statCard, styles.statCardActive]}>
            <Text style={[styles.statNumber, styles.statNumberActive]}>{stats.activeTrips}</Text>
            <Text style={[styles.statLabel, styles.statLabelActive]}>Active</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.pastTrips}</Text>
            <Text style={styles.statLabel}>Done</Text>
          </View>
        </View>
      </View>

      {/* Past Trips Section */}
      <View style={styles.pastTripsSection}>
        <Text style={styles.sectionTitle}>Past Trips</Text>
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
                <View style={styles.tripCardHeader}>
                  <View style={styles.tripEmoji}>
                    <Text style={styles.tripEmojiText}>
                      {trip.destination?.includes('Japan') ? '🇯🇵' : '🌍'}
                    </Text>
                  </View>
                  <View style={styles.tripInfo}>
                    <Text style={styles.tripName}>{trip.name}</Text>
                    <Text style={styles.tripDestination}>📍 {trip.destination}</Text>
                  </View>
                  <View style={styles.tripArrow}>
                    <Text style={styles.tripArrowText}>›</Text>
                  </View>
                </View>
                {trip.end_date && (
                  <Text style={styles.tripDate}>
                    Ended: {new Date(trip.end_date).toLocaleDateString()}
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconBox}>
              <Text style={styles.emptyIcon}>🌟</Text>
            </View>
            <Text style={styles.emptyText}>No past trips yet!</Text>
            <Text style={styles.emptySubtext}>Your completed trips will show up here</Text>
          </View>
        )}
      </View>

      {/* Logout Button */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.9}>
        <Text style={styles.logoutButtonText}>Log Out</Text>
      </TouchableOpacity>

      {/* Footer Spacing */}
      <View style={styles.footer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollContent: {
    paddingBottom: 40,
  },

  // Header Section
  header: {
    alignItems: 'center',
    paddingTop: 120,
    paddingBottom: 32,
    backgroundColor: '#1F2937',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    position: 'relative',
    minHeight: 320,
  },
  coverImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  coverPlaceholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 140,
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverPlaceholderText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '500',
  },
  coverOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(31, 41, 55, 0.7)',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    zIndex: 100,
  },
  uploadingText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
  editCoverButton: {
    position: 'absolute',
    top: 50,
    right: 16,
    width: 40,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editCoverIcon: {
    fontSize: 18,
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 16,
    width: 44,
    height: 44,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  backButtonText: {
    fontSize: 20,
    color: '#FFFFFF',
  },
  
  // Avatar
  avatarContainer: {
    marginBottom: 16,
    position: 'relative',
  },
  avatar: {
    width: 100,
    height: 100,
    backgroundColor: '#FFFFFF',
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#1F2937',
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: '#FFFFFF',
  },
  avatarText: {
    fontSize: 36,
    fontWeight: '700',
    color: '#1F2937',
  },
  avatarUploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    backgroundColor: '#3B82F6',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#1F2937',
  },
  editAvatarIcon: {
    fontSize: 14,
  },
  levelBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#FCD34D',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  levelBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400E',
  },
  
  // Name editing
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  editNameHint: {
    fontSize: 16,
    opacity: 0.6,
  },
  nameEditContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  nameInput: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    minWidth: 200,
    textAlign: 'center',
  },
  saveNameButton: {
    width: 36,
    height: 36,
    backgroundColor: '#10B981',
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveNameText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  
  email: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 8,
  },
  levelTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FCD34D',
    marginBottom: 16,
  },
  xpContainer: {
    width: '70%',
    marginTop: 8,
  },
  xpBarBackground: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  xpBarFill: {
    height: '100%',
    backgroundColor: '#FCD34D',
    borderRadius: 4,
  },
  xpText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginTop: 6,
  },

  // Stats Section
  statsSection: {
    padding: 20,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statCardActive: {
    backgroundColor: '#3B82F6',
  },
  statNumber: {
    fontSize: 28,
    fontWeight: '800',
    color: '#3B82F6',
    marginBottom: 4,
  },
  statNumberActive: {
    color: '#FFFFFF',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    textAlign: 'center',
  },
  statLabelActive: {
    color: 'rgba(255,255,255,0.9)',
  },

  // Past Trips Section
  pastTripsSection: {
    padding: 20,
    marginBottom: 8,
  },
  tripsContainer: {
    gap: 12,
  },
  tripCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  tripCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tripEmoji: {
    width: 48,
    height: 48,
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  tripEmojiText: {
    fontSize: 24,
  },
  tripInfo: {
    flex: 1,
  },
  tripName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 2,
  },
  tripDestination: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  tripArrow: {
    width: 32,
    height: 32,
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tripArrowText: {
    fontSize: 18,
    color: '#9CA3AF',
  },
  tripDate: {
    fontSize: 12,
    fontWeight: '500',
    color: '#9CA3AF',
    marginTop: 8,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyIconBox: {
    width: 80,
    height: 80,
    backgroundColor: '#FEF3C7',
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyIcon: {
    fontSize: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
    textAlign: 'center',
  },

  // Logout Button
  logoutButton: {
    marginHorizontal: 20,
    marginTop: 8,
    padding: 16,
    backgroundColor: '#FEF2F2',
    borderRadius: 14,
    alignItems: 'center',
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#DC2626',
  },

  // Footer
  footer: {
    height: 20,
  },
});
