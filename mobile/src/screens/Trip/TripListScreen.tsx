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
      style={styles.tripCard}
      onPress={() => navigation.navigate('TripHome', { tripId: item.id, tripName: item.name })}
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
      <View style={styles.arrowContainer}>
        <Text style={styles.arrow}>›</Text>
      </View>
    </AnimatedCard>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* HEADER */}
      <FadeIn delay={0} style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.greeting}>Hello, {user?.name?.split(' ')[0]}! 👋</Text>
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

      {/* TITLE SECTION */}
      <FadeIn delay={100} style={styles.titleSection}>
        <Text style={styles.pageTitle}>Your Trips</Text>
      </FadeIn>

      <FlatList
        data={trips}
        renderItem={renderTrip}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl 
            refreshing={isLoading} 
            onRefresh={fetchTrips}
            colors={['#3B82F6']}
            tintColor="#3B82F6"
          />
        }
        ListEmptyComponent={
          <FadeIn delay={300} style={styles.emptyState}>
            <View style={styles.emptyIconBox}>
              <Text style={styles.emptyIcon}>🌍</Text>
            </View>
            <Text style={styles.emptyText}>No trips yet!</Text>
            <Text style={styles.emptySubtext}>
              Time to start planning your next adventure
            </Text>
          </FadeIn>
        }
      />

      {/* CREATE BUTTON */}
      <FadeIn delay={500} style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => navigation.navigate('CreateTrip')}
          activeOpacity={0.9}
        >
          <Text style={styles.createButtonText}>+ Create Trip</Text>
        </TouchableOpacity>
        
        {/* Join Trip Button */}
        <TouchableOpacity
          style={styles.joinButton}
          onPress={() => navigation.navigate('JoinTrip')}
          activeOpacity={0.9}
        >
          <Text style={styles.joinButtonText}>🔗 Join</Text>
        </TouchableOpacity>
      </FadeIn>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  
  // HEADER
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#FFFFFF',
  },
  headerContent: {
    flex: 1,
  },
  greeting: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  levelBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  levelText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#92400E',
  },
  profileButton: {
    width: 48,
    height: 48,
    backgroundColor: '#3B82F6',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInitials: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  // TITLE SECTION
  titleSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },

  // TRIP LIST
  list: {
    padding: 16,
    paddingBottom: 160,
  },

  // TRIP CARDS - Clean Modern Style
  tripCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  tripIconContainer: {
    width: 52,
    height: 52,
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  tripIconText: {
    fontSize: 26,
  },
  tripInfo: {
    flex: 1,
  },
  tripName: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
    color: '#1F2937',
  },
  tripDestination: {
    fontSize: 14,
    fontWeight: '500',
    color: '#3B82F6',
    marginBottom: 4,
  },
  tripDate: {
    fontSize: 12,
    fontWeight: '500',
    color: '#9CA3AF',
  },
  arrowContainer: {
    width: 32,
    height: 32,
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrow: {
    fontSize: 20,
    fontWeight: '300',
    color: '#9CA3AF',
  },

  // EMPTY STATE
  emptyState: {
    alignItems: 'center',
    marginTop: 80,
    paddingHorizontal: 40,
  },
  emptyIconBox: {
    width: 100,
    height: 100,
    backgroundColor: '#EFF6FF',
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyIcon: {
    fontSize: 50,
  },
  emptyText: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
    color: '#1F2937',
  },
  emptySubtext: {
    fontSize: 15,
    fontWeight: '500',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
  },

  // BOTTOM BUTTONS
  buttonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 32,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 10,
  },
  createButton: {
    flex: 2,
    height: 54,
    backgroundColor: '#1F2937',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  joinButton: {
    flex: 1,
    height: 54,
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  joinButtonText: {
    color: '#1F2937',
    fontSize: 15,
    fontWeight: '600',
  },
});
