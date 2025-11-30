import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MotiView } from 'moti';
import theme from '../config/theme';
import { MorningBriefing } from '../types';
import { getTimeIcon } from '../stores/briefingStore';

interface SegmentContextHeaderProps {
  briefing: MorningBriefing | null;
  isLoading?: boolean;
  onPress?: () => void;
}

/**
 * SegmentContextHeader - Shows current trip segment context
 * Displays: "OSAKA · Day 2 of 5" with time-of-day icon
 * Tappable to show more details
 */
export function SegmentContextHeader({ briefing, isLoading, onPress }: SegmentContextHeaderProps) {
  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingBar} />
      </View>
    );
  }

  if (!briefing) {
    return null;
  }

  const { segment, timeOfDay, stats } = briefing;
  const timeIcon = getTimeIcon(timeOfDay);

  // No segment - show general trip status
  if (!segment) {
    return (
      <TouchableOpacity 
        style={styles.container} 
        onPress={onPress}
        activeOpacity={0.8}
      >
        <MotiView
          from={{ opacity: 0, translateY: -10 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 300 }}
          style={styles.content}
        >
          <View style={styles.iconBox}>
            <Text style={styles.icon}>{timeIcon}</Text>
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.title}>Ready to explore!</Text>
            <Text style={styles.subtitle}>
              {stats.remaining} places to discover
            </Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{stats.remaining}</Text>
          </View>
        </MotiView>
      </TouchableOpacity>
    );
  }

  const { city, dayNumber, totalDays, daysRemaining, hotel } = segment;
  const isLastDay = daysRemaining === 0;

  return (
    <TouchableOpacity 
      style={styles.container} 
      onPress={onPress}
      activeOpacity={0.8}
    >
      <MotiView
        from={{ opacity: 0, translateY: -10 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 300 }}
        style={styles.content}
      >
        <View style={[styles.iconBox, isLastDay && styles.iconBoxWarning]}>
          <Text style={styles.icon}>{isLastDay ? '🎯' : timeIcon}</Text>
        </View>
        <View style={styles.textContainer}>
          <View style={styles.titleRow}>
            <Text style={styles.cityName}>{city.toUpperCase()}</Text>
            <Text style={styles.separator}>·</Text>
            <Text style={styles.dayInfo}>Day {dayNumber} of {totalDays}</Text>
          </View>
          <Text style={styles.subtitle}>
            {isLastDay 
              ? `🚨 Last day in ${city}!` 
              : hotel?.name 
                ? `📍 ${hotel.name}`
                : `${daysRemaining} day${daysRemaining > 1 ? 's' : ''} remaining`
            }
          </Text>
        </View>
        <View style={[styles.badge, isLastDay && styles.badgeWarning]}>
          <Text style={[styles.badgeText, isLastDay && styles.badgeTextWarning]}>
            {stats.remaining}
          </Text>
          <Text style={[styles.badgeLabel, isLastDay && styles.badgeLabelWarning]}>
            left
          </Text>
        </View>
      </MotiView>

      {/* Progress bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressTrack}>
          <MotiView
            from={{ width: '0%' }}
            animate={{ width: `${(dayNumber / totalDays) * 100}%` }}
            transition={{ type: 'timing', duration: 500 }}
            style={[
              styles.progressBar,
              isLastDay && styles.progressBarWarning
            ]}
          />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.borderDark,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  loadingBar: {
    height: 48,
    backgroundColor: theme.colors.backgroundAlt,
    borderRadius: 4,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    width: 44,
    height: 44,
    backgroundColor: theme.colors.primary,
    borderWidth: 2,
    borderColor: theme.colors.borderDark,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    ...theme.shadows.neopop.sm,
  },
  iconBoxWarning: {
    backgroundColor: theme.colors.warning,
  },
  icon: {
    fontSize: 22,
  },
  textContainer: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  cityName: {
    fontSize: 16,
    fontWeight: '900',
    color: theme.colors.textPrimary,
    letterSpacing: 1,
  },
  separator: {
    fontSize: 16,
    fontWeight: '900',
    color: theme.colors.textTertiary,
    marginHorizontal: 6,
  },
  dayInfo: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  title: {
    fontSize: 16,
    fontWeight: '900',
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  badge: {
    backgroundColor: theme.colors.primary,
    borderWidth: 2,
    borderColor: theme.colors.borderDark,
    paddingVertical: 4,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeWarning: {
    backgroundColor: theme.colors.warning,
  },
  badgeText: {
    fontSize: 18,
    fontWeight: '900',
    color: theme.colors.textInverse,
  },
  badgeTextWarning: {
    color: theme.colors.textPrimary,
  },
  badgeLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.textInverse,
    opacity: 0.9,
    textTransform: 'uppercase',
  },
  badgeLabelWarning: {
    color: theme.colors.textPrimary,
  },
  progressContainer: {
    marginTop: 10,
    marginBottom: 4,
  },
  progressTrack: {
    height: 4,
    backgroundColor: theme.colors.backgroundAlt,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: 2,
  },
  progressBarWarning: {
    backgroundColor: theme.colors.warning,
  },
});

export default SegmentContextHeader;

