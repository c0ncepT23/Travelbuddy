import React, { useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { useTripStore } from '../../stores/tripStore';
import { useAuthStore } from '../../stores/authStore';
import { useXPStore } from '../../stores/xpStore';
import { format } from 'date-fns';
import { AnimatedCard } from '../../components/AnimatedCard';
import { FadeIn } from '../../components/FadeIn';

export default function TripListScreen({ navigation }: any) {
  const { trips, isLoading, fetchTrips } = useTripStore();
  const { user } = useAuthStore();
  const { level, getProgress, getLevelTitle, loadStoredXP } = useXPStore();

  useEffect(() => {
    fetchTrips();
    loadStoredXP();
  }, []);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const renderTrip = ({ item, index }: any) => (
    <AnimatedCard
      style={styles.chunkyTripCard}
      onPress={() => navigation.navigate('TripDetail', { tripId: item.id, tripName: item.name })}
      delay={index * 100}
    >
      <View style={styles.tripIconContainer}>
        <Text style={styles.tripIconText}>✈️</Text>
      </View>
      <View style={styles.tripInfo}>
        <Text style={styles.tripName}>{item.name}</Text>
        <Text style={styles.tripDestination}>📍 {item.destination}</Text>
        {item.start_date && (
          <Text style={styles.tripDate}>
            {format(new Date(item.start_date), 'MMM dd, yyyy')}
            {item.end_date && ` - ${format(new Date(item.end_date), 'MMM dd, yyyy')}`}
          </Text>
        )}
      </View>
      <Text style={styles.arrow}>→</Text>
    </AnimatedCard>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
      
      {/* HEADER */}
      <FadeIn delay={0} style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.greeting}>Hello, {user?.name}! 👋</Text>
          <View style={styles.levelBadge}>
            <Text style={styles.levelText}>⭐ {getLevelTitle()}</Text>
          </View>
        </View>
        <TouchableOpacity 
          style={styles.profileButton}
          onPress={() => navigation.navigate('Profile')}
        >
          <Text style={styles.profileInitials}>{user ? getInitials(user.name) : '?'}</Text>
        </TouchableOpacity>
      </FadeIn>

      <FlatList
        data={trips}
        renderItem={renderTrip}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={fetchTrips} />
        }
        ListEmptyComponent={
          <FadeIn delay={300} style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🌍</Text>
            <Text style={styles.emptyText}>No trips yet!</Text>
            <Text style={styles.emptySubtext}>
              Time to start planning your next adventure! ✨
            </Text>
          </FadeIn>
        }
      />

      {/* CREATE BUTTON */}
      <FadeIn delay={500} style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.chunkyCreateButton}
          onPress={() => navigation.navigate('CreateTrip')}
          activeOpacity={0.8}
        >
          <Text style={styles.createButtonText}>✨ Create Trip</Text>
        </TouchableOpacity>
      </FadeIn>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A', // Dark neon background (consistent!)
  },
  
  // HEADER
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(139, 92, 246, 0.3)',
    zIndex: 10,
  },
  headerContent: {
    flex: 1,
  },
  greeting: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  levelBadge: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  levelText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  profileButton: {
    width: 48,
    height: 48,
    backgroundColor: '#8B5CF6',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'rgba(167, 139, 250, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  profileInitials: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
  },

  // TRIP LIST
  list: {
    padding: 16,
    paddingBottom: 100,
  },

  // NEON TRIP CARDS
  chunkyTripCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(139, 92, 246, 0.3)',
    padding: 16,
    marginBottom: 16,
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  tripIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(139, 92, 246, 0.3)',
    borderWidth: 2,
    borderColor: 'rgba(167, 139, 250, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  tripIconText: {
    fontSize: 28,
  },
  tripInfo: {
    flex: 1,
  },
  tripName: {
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 4,
    color: '#FFFFFF',
  },
  tripDestination: {
    fontSize: 14,
    fontWeight: '600',
    color: '#A78BFA',
    marginBottom: 4,
  },
  tripDate: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  arrow: {
    fontSize: 28,
    fontWeight: '900',
    color: '#A78BFA',
  },

  // EMPTY STATE
  emptyState: {
    alignItems: 'center',
    marginTop: 100,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 80,
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 12,
    color: '#FFFFFF',
  },
  emptySubtext: {
    fontSize: 16,
    fontWeight: '600',
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 24,
  },

  // CREATE BUTTON
  buttonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: '#0F172A',
    borderTopWidth: 1,
    borderTopColor: 'rgba(139, 92, 246, 0.3)',
  },
  chunkyCreateButton: {
    height: 56,
    backgroundColor: '#8B5CF6',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
