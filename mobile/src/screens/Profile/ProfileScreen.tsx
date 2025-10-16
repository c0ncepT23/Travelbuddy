import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { useAuthStore } from '../../stores/authStore';
import { useTripStore } from '../../stores/tripStore';

export default function ProfileScreen({ navigation }: any) {
  const { user, logout } = useAuthStore();
  const { trips, fetchTrips } = useTripStore();
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
      if (!trip.endDate) return true;
      return new Date(trip.endDate) >= now;
    });
    const past = trips.filter((trip) => {
      if (!trip.endDate) return false;
      return new Date(trip.endDate) < now;
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
      if (!trip.endDate) return false;
      return new Date(trip.endDate) < now;
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
      {/* Header Section */}
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user ? getInitials(user.name) : '?'}</Text>
          </View>
        </View>
        <Text style={styles.name}>{user?.name || 'Unknown User'}</Text>
        <Text style={styles.email}>{user?.email || ''}</Text>
      </View>

      {/* Stats Section */}
      <View style={styles.statsSection}>
        <Text style={styles.sectionTitle}>YOUR STATS 📊</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.totalTrips}</Text>
            <Text style={styles.statLabel}>TOTAL TRIPS</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.activeTrips}</Text>
            <Text style={styles.statLabel}>ACTIVE</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.pastTrips}</Text>
            <Text style={styles.statLabel}>COMPLETED</Text>
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
              >
                <View style={styles.tripCardHeader}>
                  <View style={styles.tripEmoji}>
                    <Text style={styles.tripEmojiText}>
                      {trip.destination?.includes('Japan') ? '🇯🇵' : '🌍'}
                    </Text>
                  </View>
                  <View style={styles.tripInfo}>
                    <Text style={styles.tripName}>{trip.name}</Text>
                    <Text style={styles.tripDestination}>{trip.destination}</Text>
                  </View>
                </View>
                {trip.endDate && (
                  <Text style={styles.tripDate}>
                    Ended: {new Date(trip.endDate).toLocaleDateString()}
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🌟</Text>
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
        >
          <Text style={styles.settingButtonText}>✏️ EDIT PROFILE</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.settingButton}
          onPress={() =>
            Alert.alert('Coming Soon', 'Notification settings coming soon!')
          }
        >
          <Text style={styles.settingButtonText}>🔔 NOTIFICATIONS</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.settingButton}
          onPress={() => Alert.alert('Coming Soon', 'Privacy settings coming soon!')}
        >
          <Text style={styles.settingButtonText}>🔒 PRIVACY</Text>
        </TouchableOpacity>
      </View>

      {/* Logout Button */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutButtonText}>LOG OUT</Text>
      </TouchableOpacity>

      {/* Footer Spacing */}
      <View style={styles.footer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFBEB', // Cream background
  },
  scrollContent: {
    paddingBottom: 40,
  },

  // Header Section
  header: {
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 32,
    backgroundColor: '#3B82F6', // Electric Blue
    borderBottomWidth: 4,
    borderBottomColor: '#000',
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    backgroundColor: '#FFFFFF',
    borderWidth: 4,
    borderColor: '#000',
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 6,
  },
  avatarText: {
    fontSize: 40,
    fontWeight: '900',
    color: '#3B82F6',
  },
  name: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 4,
    letterSpacing: 1,
  },
  email: {
    fontSize: 14,
    fontWeight: '600',
    color: '#DBEAFE',
  },

  // Stats Section
  statsSection: {
    padding: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#000',
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderWidth: 3,
    borderColor: '#000',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  statNumber: {
    fontSize: 36,
    fontWeight: '900',
    color: '#3B82F6',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#6B7280',
    textAlign: 'center',
    letterSpacing: 0.5,
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
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderWidth: 3,
    borderColor: '#000',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  tripCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  tripEmoji: {
    width: 48,
    height: 48,
    backgroundColor: '#DBEAFE',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 24,
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
    fontWeight: '900',
    color: '#000',
    marginBottom: 2,
  },
  tripDestination: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  tripDate: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
    marginTop: 4,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#000',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    textAlign: 'center',
  },

  // Settings Section
  settingsSection: {
    padding: 16,
    marginBottom: 8,
  },
  settingButton: {
    backgroundColor: '#FFFFFF',
    padding: 18,
    borderWidth: 3,
    borderColor: '#000',
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  settingButtonText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 0.5,
  },

  // Logout Button
  logoutButton: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: '#EF4444', // Red border
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#EF4444',
    letterSpacing: 0.5,
  },

  // Footer
  footer: {
    height: 20,
  },
});

