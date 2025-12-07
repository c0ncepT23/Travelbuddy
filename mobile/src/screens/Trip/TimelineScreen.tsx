import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Platform,
  StatusBar,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCheckInStore } from '../../stores/checkInStore';
import { CATEGORY_EMOJIS } from '../../config/maps';
import { format } from 'date-fns';
import { ShareStoryModal } from './ShareStoryModal';

const STATUS_BAR_HEIGHT = Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 0;

interface TimelineScreenProps {
  route?: any;
  navigation?: any;
  tripId?: string;
  tripName?: string;
  destination?: string;
  onClose?: () => void;
}

export const TimelineScreen: React.FC<TimelineScreenProps> = ({ 
  route,
  navigation,
  tripId: propTripId, 
  tripName = 'My Trip', 
  destination = 'Adventure',
  onClose 
}) => {
  // Support both standalone and navigation usage
  const tripId = propTripId || route?.params?.tripId;
  const { timeline, fetchTimeline, isLoading, stats, fetchStats } = useCheckInStore();
  const [showShareModal, setShowShareModal] = useState(false);

  useEffect(() => {
    fetchTimeline(tripId);
    fetchStats(tripId);
  }, [tripId]);

  const formatTime = (dateString: string) => {
    try {
      return format(new Date(dateString), 'h:mm a');
    } catch (e) {
      return '';
    }
  };

  const formatDuration = (minutes?: number) => {
    if (!minutes) return '';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins} min`;
  };

  const renderStars = (rating?: number) => {
    if (!rating) return null;
    return (
      <View style={styles.rating}>
        <Text style={styles.ratingText}>
          {'⭐'.repeat(rating)}
        </Text>
      </View>
    );
  };

  const getTimeOfDay = (hour: number) => {
    if (hour < 12) return { icon: '🌅', label: 'MORNING' };
    if (hour < 17) return { icon: '🌞', label: 'AFTERNOON' };
    if (hour < 21) return { icon: '🌆', label: 'EVENING' };
    return { icon: '🌙', label: 'NIGHT' };
  };

  const groupByTimeOfDay = (checkIns: any[]) => {
    const grouped: { [key: string]: any[] } = {
      MORNING: [],
      AFTERNOON: [],
      EVENING: [],
      NIGHT: [],
    };

    checkIns.forEach(checkIn => {
      const hour = new Date(checkIn.checked_in_at).getHours();
      const timeOfDay = getTimeOfDay(hour).label;
      grouped[timeOfDay].push(checkIn);
    });

    return Object.entries(grouped).filter(([_, items]) => items.length > 0);
  };

  const handleBack = () => {
    if (onClose) {
      onClose();
    } else if (navigation) {
      navigation.goBack();
    }
  };

  if (timeline.length === 0 && !isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <Ionicons name="chevron-back" size={24} color="#0F172A" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Timeline</Text>
            <View style={styles.headerSpacer} />
          </View>
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📍</Text>
            <Text style={styles.emptyTitle}>No Check-Ins Yet</Text>
            <Text style={styles.emptyText}>
              Start checking in at places to build your travel timeline!
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Ionicons name="chevron-back" size={24} color="#0F172A" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Timeline</Text>
            {stats && stats.total_checkins > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{stats.total_checkins}</Text>
              </View>
            )}
          </View>
          <TouchableOpacity 
            style={styles.shareButton}
            onPress={() => setShowShareModal(true)}
          >
            <Ionicons name="share-outline" size={22} color="#3B82F6" />
          </TouchableOpacity>
        </View>

      {/* Timeline Content */}
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={() => fetchTimeline(tripId)}
          />
        }
      >
        {timeline.map((day, dayIndex) => {
          const dayDate = new Date(day.date);
          const timeGroups = groupByTimeOfDay(day.check_ins);

          return (
            <View key={day.date} style={styles.dayContainer}>
              {/* Day Header */}
              <View style={styles.dayHeader}>
                <View style={styles.dayInfo}>
                  <Text style={styles.dayNumber}>Day {day.day_number}</Text>
                  <Text style={styles.dayDate}>
                    {format(dayDate, 'MMMM d, yyyy')}
                  </Text>
                </View>
                <View style={styles.dayStats}>
                  <Text style={styles.dayStatsText}>
                    {day.stats.total_places} places
                  </Text>
                </View>
              </View>

              {/* Time of Day Groups */}
              {timeGroups.map(([timeOfDay, checkIns]) => {
                const timeInfo = getTimeOfDay(new Date(checkIns[0].checked_in_at).getHours());
                
                return (
                  <View key={timeOfDay} style={styles.timeOfDaySection}>
                    {/* Time of Day Header */}
                    <View style={styles.timeOfDayHeader}>
                      <Text style={styles.timeOfDayIcon}>{timeInfo.icon}</Text>
                      <Text style={styles.timeOfDayLabel}>{timeOfDay}</Text>
                    </View>

                    {/* Check-ins */}
                    {checkIns.map((checkIn, index) => {
                      const isLast = index === checkIns.length - 1 && 
                                     timeGroups[timeGroups.length - 1][0] === timeOfDay &&
                                     dayIndex === timeline.length - 1;

                      return (
                        <View key={checkIn.checkin_id} style={styles.checkInItem}>
                          {/* Timeline Dot and Line */}
                          <View style={styles.timelineDot} />
                          {!isLast && <View style={styles.timelineLine} />}

                          {/* Check-in Card */}
                          <View style={styles.checkInCard}>
                            {/* Time */}
                            <Text style={styles.checkInTime}>
                              {formatTime(checkIn.checked_in_at)}
                              {checkIn.duration_minutes && 
                                ` • ${formatDuration(checkIn.duration_minutes)}`
                              }
                            </Text>

                            {/* Place Info */}
                            <View style={styles.placeRow}>
                              <Text style={styles.categoryEmoji}>
                                {CATEGORY_EMOJIS[checkIn.place_category] || '📍'}
                              </Text>
                              <Text style={styles.placeName}>{checkIn.place_name}</Text>
                            </View>

                            {/* Rating */}
                            {renderStars(checkIn.rating)}

                            {/* Note */}
                            {checkIn.note && (
                              <Text style={styles.checkInNote}>"{checkIn.note}"</Text>
                            )}

                            {/* Cost */}
                            {checkIn.cost && (
                              <Text style={styles.checkInCost}>
                                💰 ¥{checkIn.cost.toLocaleString()}
                              </Text>
                            )}

                            {/* Location */}
                            {checkIn.location_name && (
                              <Text style={styles.checkInLocation}>
                                📍 {checkIn.location_name}
                              </Text>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                );
              })}

              {/* Day Summary */}
              {day.stats.total_duration_minutes > 0 && (
                <View style={styles.daySummary}>
                  <Text style={styles.daySummaryText}>
                    Total time: {formatDuration(day.stats.total_duration_minutes)}
                  </Text>
                  {day.stats.total_cost > 0 && (
                    <Text style={styles.daySummaryText}>
                      • Spent: ¥{day.stats.total_cost.toLocaleString()}
                    </Text>
                  )}
                  {typeof day.stats.avg_rating === 'number' && day.stats.avg_rating > 0 && (
                    <Text style={styles.daySummaryText}>
                      • Avg: {Number(day.stats.avg_rating).toFixed(1)}⭐
                    </Text>
                  )}
                </View>
              )}
            </View>
          );
        })}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Share Story Modal */}
        <ShareStoryModal
          visible={showShareModal}
          onClose={() => setShowShareModal(false)}
          tripId={tripId}
          tripName={tripName}
          destination={destination}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingTop: Platform.OS === 'android' ? STATUS_BAR_HEIGHT : 0,
  },
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  headerSpacer: {
    width: 40,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  badge: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  shareButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
  },
  shareButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  closeButton: {
    fontSize: 28,
    color: '#6B7280',
    fontWeight: '300',
  },
  content: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  dayContainer: {
    marginBottom: 24,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  dayInfo: {},
  dayNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#6366F1',
    marginBottom: 2,
  },
  dayDate: {
    fontSize: 14,
    color: '#6B7280',
  },
  dayStats: {},
  dayStatsText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  timeOfDaySection: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  timeOfDayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  timeOfDayIcon: {
    fontSize: 20,
  },
  timeOfDayLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 1,
  },
  checkInItem: {
    position: 'relative',
    marginBottom: 16,
    paddingLeft: 32,
  },
  timelineDot: {
    position: 'absolute',
    left: 0,
    top: 8,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#6366F1',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  timelineLine: {
    position: 'absolute',
    left: 5.5,
    top: 20,
    width: 1,
    bottom: -16,
    backgroundColor: '#E5E7EB',
  },
  checkInCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  checkInTime: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
    marginBottom: 8,
  },
  placeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  categoryEmoji: {
    fontSize: 20,
  },
  placeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  rating: {
    marginBottom: 8,
  },
  ratingText: {
    fontSize: 14,
  },
  checkInNote: {
    fontSize: 14,
    color: '#374151',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  checkInCost: {
    fontSize: 13,
    color: '#10B981',
    fontWeight: '600',
    marginBottom: 4,
  },
  checkInLocation: {
    fontSize: 12,
    color: '#6B7280',
  },
  daySummary: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#F3F4F6',
    marginHorizontal: 20,
    borderRadius: 8,
    marginTop: 8,
    gap: 8,
  },
  daySummaryText: {
    fontSize: 12,
    color: '#6B7280',
  },
  bottomSpacer: {
    height: 40,
  },
});

