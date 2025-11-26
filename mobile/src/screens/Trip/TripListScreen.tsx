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
import theme from '../../config/theme';

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
      <View style={styles.arrowContainer}>
        <Text style={styles.arrow}>→</Text>
      </View>
    </AnimatedCard>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.background} />
      
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

      {/* TITLE SECTION */}
      <FadeIn delay={100} style={styles.titleSection}>
        <Text style={styles.pageTitle}>YOUR TRIPS</Text>
        <View style={styles.titleUnderline} />
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
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
        ListEmptyComponent={
          <FadeIn delay={300} style={styles.emptyState}>
            <View style={styles.emptyIconBox}>
              <Text style={styles.emptyIcon}>🌍</Text>
            </View>
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
          style={styles.createButton}
          onPress={() => navigation.navigate('CreateTrip')}
          activeOpacity={0.8}
        >
          <Text style={styles.createButtonText}>✨ CREATE TRIP</Text>
        </TouchableOpacity>
        
        {/* Join Trip Button */}
        <TouchableOpacity
          style={styles.joinButton}
          onPress={() => navigation.navigate('JoinTrip')}
          activeOpacity={0.8}
        >
          <Text style={styles.joinButtonText}>🔗 JOIN TRIP</Text>
        </TouchableOpacity>
      </FadeIn>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  
  // HEADER
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.border,
  },
  headerContent: {
    flex: 1,
  },
  greeting: {
    fontSize: 28,
    fontWeight: '900',
    color: theme.colors.textPrimary,
    letterSpacing: -0.5,
  },
  levelBadge: {
    backgroundColor: theme.colors.secondary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 0,
    borderWidth: 2,
    borderColor: theme.colors.borderDark,
    marginTop: 8,
    alignSelf: 'flex-start',
    ...theme.shadows.neopop.sm,
  },
  levelText: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  profileButton: {
    width: 52,
    height: 52,
    backgroundColor: theme.colors.primary,
    borderWidth: 3,
    borderColor: theme.colors.borderDark,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.neopop.sm,
  },
  profileInitials: {
    color: theme.colors.textInverse,
    fontSize: 18,
    fontWeight: '900',
  },

  // TITLE SECTION
  titleSection: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 8,
  },
  pageTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: theme.colors.textSecondary,
    letterSpacing: 2,
  },
  titleUnderline: {
    width: 40,
    height: 4,
    backgroundColor: theme.colors.primary,
    marginTop: 8,
  },

  // TRIP LIST
  list: {
    padding: 16,
    paddingBottom: 180,
  },

  // TRIP CARDS - NeoPOP Style
  tripCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 3,
    borderColor: theme.colors.borderDark,
    padding: 16,
    marginBottom: 16,
    ...theme.shadows.neopop.md,
  },
  tripIconContainer: {
    width: 56,
    height: 56,
    backgroundColor: theme.colors.primary,
    borderWidth: 2,
    borderColor: theme.colors.borderDark,
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
    fontWeight: '800',
    marginBottom: 4,
    color: theme.colors.textPrimary,
  },
  tripDestination: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.primary,
    marginBottom: 4,
  },
  tripDate: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  arrowContainer: {
    width: 40,
    height: 40,
    backgroundColor: theme.colors.backgroundAlt,
    borderWidth: 2,
    borderColor: theme.colors.borderDark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrow: {
    fontSize: 20,
    fontWeight: '900',
    color: theme.colors.textPrimary,
  },

  // EMPTY STATE
  emptyState: {
    alignItems: 'center',
    marginTop: 80,
    paddingHorizontal: 40,
  },
  emptyIconBox: {
    width: 120,
    height: 120,
    backgroundColor: theme.colors.primary,
    borderWidth: 4,
    borderColor: theme.colors.borderDark,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    ...theme.shadows.neopop.lg,
  },
  emptyIcon: {
    fontSize: 60,
  },
  emptyText: {
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 12,
    color: theme.colors.textPrimary,
  },
  emptySubtext: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },

  // BOTTOM BUTTONS
  buttonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 2,
    borderTopColor: theme.colors.border,
    flexDirection: 'row',
    gap: 12,
  },
  createButton: {
    flex: 2,
    height: 56,
    backgroundColor: theme.colors.primary,
    borderWidth: 3,
    borderColor: theme.colors.borderDark,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.neopop.md,
  },
  createButtonText: {
    color: theme.colors.textInverse,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
  },
  joinButton: {
    flex: 1,
    height: 56,
    backgroundColor: theme.colors.surface,
    borderWidth: 3,
    borderColor: theme.colors.borderDark,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.neopop.sm,
  },
  joinButtonText: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
