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
import theme from '../../config/theme';

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
    // Calculate stats from trips
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
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.primary} />
      
      {/* Header Section */}
      <View style={styles.header}>
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
        <Text style={styles.sectionTitle}>YOUR STATS 📊</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.totalTrips}</Text>
            <Text style={styles.statLabel}>TOTAL</Text>
          </View>
          <View style={[styles.statCard, styles.statCardActive]}>
            <Text style={[styles.statNumber, styles.statNumberActive]}>{stats.activeTrips}</Text>
            <Text style={[styles.statLabel, styles.statLabelActive]}>ACTIVE</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.pastTrips}</Text>
            <Text style={styles.statLabel}>DONE</Text>
          </View>
        </View>
      </View>

      {/* Past Trips Section */}
      <View style={styles.pastTripsSection}>
        <Text style={styles.sectionTitle}>PAST TRIPS 🗺️</Text>
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
                    <Text style={styles.tripArrowText}>→</Text>
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
        <Text style={styles.sectionTitle}>SETTINGS ⚙️</Text>
        
        <TouchableOpacity
          style={styles.settingButton}
          onPress={() => Alert.alert('Coming Soon', 'Edit profile feature coming soon!')}
          activeOpacity={0.8}
        >
          <Text style={styles.settingButtonText}>✏️ EDIT PROFILE</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.settingButton}
          onPress={() =>
            Alert.alert('Coming Soon', 'Notification settings coming soon!')
          }
          activeOpacity={0.8}
        >
          <Text style={styles.settingButtonText}>🔔 NOTIFICATIONS</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.settingButton}
          onPress={() => Alert.alert('Coming Soon', 'Privacy settings coming soon!')}
          activeOpacity={0.8}
        >
          <Text style={styles.settingButtonText}>🔒 PRIVACY</Text>
        </TouchableOpacity>
      </View>

      {/* Logout Button */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.8}>
        <Text style={styles.logoutButtonText}>🚪 LOG OUT</Text>
      </TouchableOpacity>

      {/* Footer Spacing */}
      <View style={styles.footer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    paddingBottom: 40,
  },

  // Header Section
  header: {
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 32,
    backgroundColor: theme.colors.primary,
    borderBottomWidth: 4,
    borderBottomColor: theme.colors.borderDark,
  },
  avatarContainer: {
    marginBottom: 16,
    position: 'relative',
  },
  avatar: {
    width: 100,
    height: 100,
    backgroundColor: theme.colors.surface,
    borderWidth: 4,
    borderColor: theme.colors.borderDark,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.neopop.lg,
  },
  avatarText: {
    fontSize: 40,
    fontWeight: '900',
    color: theme.colors.primary,
  },
  levelBadge: {
    position: 'absolute',
    bottom: -8,
    right: -8,
    backgroundColor: theme.colors.secondary,
    borderWidth: 2,
    borderColor: theme.colors.borderDark,
    paddingHorizontal: 10,
    paddingVertical: 4,
    ...theme.shadows.neopop.sm,
  },
  levelBadgeText: {
    fontSize: 12,
    fontWeight: '900',
    color: theme.colors.textPrimary,
  },
  name: {
    fontSize: 28,
    fontWeight: '900',
    color: theme.colors.textInverse,
    marginBottom: 4,
    letterSpacing: 1,
  },
  email: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 8,
  },
  levelTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.secondary,
    marginBottom: 16,
  },
  xpContainer: {
    width: '80%',
    marginTop: 8,
  },
  xpBarBackground: {
    height: 12,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: 2,
    borderColor: theme.colors.borderDark,
    overflow: 'hidden',
  },
  xpBarFill: {
    height: '100%',
    backgroundColor: theme.colors.secondary,
  },
  xpText: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.textInverse,
    textAlign: 'center',
    marginTop: 6,
  },

  // Stats Section
  statsSection: {
    padding: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: theme.colors.textPrimary,
    marginBottom: 16,
    letterSpacing: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    padding: 20,
    borderWidth: 3,
    borderColor: theme.colors.borderDark,
    alignItems: 'center',
    ...theme.shadows.neopop.sm,
  },
  statCardActive: {
    backgroundColor: theme.colors.primary,
  },
  statNumber: {
    fontSize: 32,
    fontWeight: '900',
    color: theme.colors.primary,
    marginBottom: 4,
  },
  statNumberActive: {
    color: theme.colors.textInverse,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: theme.colors.textSecondary,
    textAlign: 'center',
    letterSpacing: 1,
  },
  statLabelActive: {
    color: 'rgba(255,255,255,0.9)',
  },

  // Past Trips Section
  pastTripsSection: {
    padding: 16,
    marginBottom: 8,
  },
  tripsContainer: {
    gap: 12,
  },
  tripCard: {
    backgroundColor: theme.colors.surface,
    padding: 16,
    borderWidth: 3,
    borderColor: theme.colors.borderDark,
    ...theme.shadows.neopop.sm,
  },
  tripCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  tripEmoji: {
    width: 48,
    height: 48,
    backgroundColor: theme.categoryColors.place.bg,
    borderWidth: 2,
    borderColor: theme.colors.borderDark,
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
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  tripDestination: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  tripArrow: {
    width: 32,
    height: 32,
    backgroundColor: theme.colors.backgroundAlt,
    borderWidth: 2,
    borderColor: theme.colors.borderDark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tripArrowText: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  tripDate: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textTertiary,
    marginTop: 4,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyIconBox: {
    width: 80,
    height: 80,
    backgroundColor: theme.colors.secondary,
    borderWidth: 3,
    borderColor: theme.colors.borderDark,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    ...theme.shadows.neopop.md,
  },
  emptyIcon: {
    fontSize: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '900',
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },

  // Settings Section
  settingsSection: {
    padding: 16,
    marginBottom: 8,
  },
  settingButton: {
    backgroundColor: theme.colors.surface,
    padding: 18,
    borderWidth: 3,
    borderColor: theme.colors.borderDark,
    marginBottom: 12,
    alignItems: 'center',
    ...theme.shadows.neopop.sm,
  },
  settingButtonText: {
    fontSize: 14,
    fontWeight: '900',
    color: theme.colors.textPrimary,
    letterSpacing: 0.5,
  },

  // Logout Button
  logoutButton: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 18,
    backgroundColor: theme.colors.surface,
    borderWidth: 3,
    borderColor: theme.colors.error,
    alignItems: 'center',
    ...theme.shadows.neopop.sm,
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: '900',
    color: theme.colors.error,
    letterSpacing: 0.5,
  },

  // Footer
  footer: {
    height: 20,
  },
});
