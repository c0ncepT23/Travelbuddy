import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
  StatusBar,
} from 'react-native';
import { useAuthStore } from '../../stores/authStore';
import { useTripStore } from '../../stores/tripStore';
import { useXPStore } from '../../stores/xpStore';

export default function ProfileScreen({ navigation }: any) {
  const { user, logout } = useAuthStore();
  const { trips, fetchTrips } = useTripStore();
  const { totalXP, level, getLevelTitle, getProgress } = useXPStore();
  const [stats, setStats] = useState({
    totalTrips: 0,
    activeTrips: 0,
    pastTrips: 0,
  });

  useEffect(() => {
    loadProfileData();
  }, []);

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
      
      {/* Header Section */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user ? getInitials(user.name) : '?'}</Text>
          </View>
          <View style={styles.levelBadge}>
            <Text style={styles.levelBadgeText}>Lv.{level}</Text>
          </View>
        </View>
        <Text style={styles.name}>{user?.name || 'Unknown User'}</Text>
        <Text style={styles.email}>{user?.email || ''}</Text>
        <Text style={styles.levelTitle}>{getLevelTitle()}</Text>
        
        {/* XP Progress Bar */}
        <View style={styles.xpContainer}>
          <View style={styles.xpBarBackground}>
            <View style={[styles.xpBarFill, { width: `${getProgress() * 100}%` }]} />
          </View>
          <Text style={styles.xpText}>{totalXP} XP</Text>
        </View>
      </View>

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

      {/* Settings Section */}
      <View style={styles.settingsSection}>
        <Text style={styles.sectionTitle}>Settings</Text>
        
        <TouchableOpacity
          style={styles.settingButton}
          onPress={() => Alert.alert('Coming Soon', 'Edit profile feature coming soon!')}
          activeOpacity={0.8}
        >
          <Text style={styles.settingIcon}>✏️</Text>
          <Text style={styles.settingButtonText}>Edit Profile</Text>
          <Text style={styles.settingArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.settingButton}
          onPress={() => Alert.alert('Coming Soon', 'Notification settings coming soon!')}
          activeOpacity={0.8}
        >
          <Text style={styles.settingIcon}>🔔</Text>
          <Text style={styles.settingButtonText}>Notifications</Text>
          <Text style={styles.settingArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.settingButton}
          onPress={() => Alert.alert('Coming Soon', 'Privacy settings coming soon!')}
          activeOpacity={0.8}
        >
          <Text style={styles.settingIcon}>🔒</Text>
          <Text style={styles.settingButtonText}>Privacy</Text>
          <Text style={styles.settingArrow}>›</Text>
        </TouchableOpacity>
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
    paddingTop: 60,
    paddingBottom: 32,
    backgroundColor: '#1F2937',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 16,
    width: 44,
    height: 44,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 20,
    color: '#FFFFFF',
  },
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
  },
  avatarText: {
    fontSize: 36,
    fontWeight: '700',
    color: '#1F2937',
  },
  levelBadge: {
    position: 'absolute',
    bottom: -4,
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
  name: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
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

  // Settings Section
  settingsSection: {
    padding: 20,
    marginBottom: 8,
  },
  settingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  settingIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  settingButtonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  settingArrow: {
    fontSize: 18,
    color: '#9CA3AF',
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
