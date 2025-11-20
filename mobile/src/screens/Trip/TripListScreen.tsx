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
import { format } from 'date-fns';
import { AnimatedCard } from '../../components/AnimatedCard';
import { FadeIn } from '../../components/FadeIn';

export default function TripListScreen({ navigation }: any) {
  const { trips, isLoading, fetchTrips } = useTripStore();
  const { user } = useAuthStore();

  useEffect(() => {
    fetchTrips();
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
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      {/* HEADER */}
      <FadeIn delay={0} style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.greeting}>Hello, {user?.name}! 👋</Text>
          <Text style={styles.subtitle}>Your travel adventures</Text>
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
    backgroundColor: '#FFFBEB', // Cream background
  },
  
  // HEADER
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#fff',
    borderBottomWidth: 4,
    borderBottomColor: '#000',
    zIndex: 10,
  },
  headerContent: {
    flex: 1,
  },
  greeting: {
    fontSize: 28,
    fontWeight: '900',
    color: '#000',
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 4,
  },
  profileButton: {
    width: 48,
    height: 48,
    backgroundColor: '#3B82F6', // Electric Blue
    borderRadius: 24,
    borderWidth: 3,
    borderColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
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

  // CHUNKY TRIP CARDS
  chunkyTripCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 4,
    borderColor: '#000',
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 6,
  },
  tripIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#BFDBFE', // Light blue
    borderWidth: 3,
    borderColor: '#000',
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
    color: '#000',
  },
  tripDestination: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E40AF', // Deep Blue
    marginBottom: 4,
  },
  tripDate: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  arrow: {
    fontSize: 28,
    fontWeight: '900',
    color: '#000',
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
    color: '#000',
  },
  emptySubtext: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
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
    backgroundColor: '#FFFBEB',
    borderTopWidth: 4,
    borderTopColor: '#000',
  },
  chunkyCreateButton: {
    height: 56,
    backgroundColor: '#3B82F6', // Electric Blue
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
