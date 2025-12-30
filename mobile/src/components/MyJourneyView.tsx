import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ScrollView,
  Platform,
} from 'react-native';
import { MotiView } from 'moti';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import FastImage from 'react-native-fast-image';
import { SavedItem } from '../types';
import { BouncyPressable } from './BouncyPressable';
import { getPlacePhotoUrl } from '../config/maps';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface MyJourneyViewProps {
  items: SavedItem[];
  tripName: string;
}

// Polaroid Card Component
const PolaroidCard = ({ 
  item, 
  index, 
  isLeft 
}: { 
  item: SavedItem; 
  index: number; 
  isLeft: boolean 
}) => {
  const photoUrl = useMemo(() => getPlacePhotoUrl(item.photos_json, 600), [item.photos_json]);
  const date = new Date(item.updated_at || item.created_at);
  const month = date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  const day = date.getDate();
  const year = date.getFullYear();
  const time = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  return (
    <MotiView
      from={{ opacity: 0, translateX: isLeft ? -50 : 50, scale: 0.9 }}
      animate={{ opacity: 1, translateX: 0, scale: 1 }}
      transition={{ delay: index * 100, type: 'spring', damping: 15 }}
      style={[
        styles.timelineItem,
        isLeft ? styles.timelineItemLeft : styles.timelineItemRight
      ]}
    >
      {/* Central Timeline Dot (Desktop-style for Mobile) */}
      <View style={styles.timelineDotContainer}>
        <MotiView
          from={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: index * 100 + 200, type: 'spring' }}
          style={styles.timelineDot}
        >
          <View style={styles.dotInner}>
            <Ionicons name="camera" size={12} color="#8B5CF6" />
          </View>
          <MotiView
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 2000, loop: true, type: 'timing' }}
            style={styles.dotPulse}
          />
        </MotiView>
      </View>

      {/* The Polaroid Card */}
      <BouncyPressable
        style={[
          styles.polaroidCard,
          { transform: [{ rotate: isLeft ? '-2deg' : '2deg' }] }
        ]}
      >
        {/* Decorative Tape */}
        <View style={styles.tape} />

        {/* Image Section */}
        <View style={styles.imageContainer}>
          {photoUrl ? (
            <FastImage
              source={{ uri: photoUrl }}
              style={styles.image}
              resizeMode={FastImage.resizeMode.cover}
            />
          ) : (
            <View style={styles.placeholderImage}>
              <Ionicons name="image-outline" size={40} color="rgba(255,255,255,0.3)" />
            </View>
          )}
          
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.6)']}
            style={styles.imageOverlay}
          />

          {/* Category Badge */}
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{item.category || 'Place'}</Text>
          </View>

          {/* Date Stamp */}
          <View style={styles.dateStamp}>
            <Text style={styles.stampMonth}>{month}</Text>
            <Text style={styles.stampDay}>{day}</Text>
            <Text style={styles.stampYear}>{year}</Text>
          </View>
        </View>

        {/* Details Section */}
        <View style={styles.details}>
          <Text style={styles.placeName} numberOfLines={1}>{item.name}</Text>
          <View style={styles.locationRow}>
            <Ionicons name="location" size={14} color="#EF4444" />
            <Text style={styles.locationText} numberOfLines={1}>
              {item.area_name || item.location_name || 'Nearby'}
            </Text>
          </View>
          
          <Text style={styles.description} numberOfLines={2}>
            {item.description || "No description provided yet..."}
          </Text>

          {/* Card Footer */}
          <View style={styles.cardFooter}>
            <View style={styles.timeRow}>
              <Ionicons name="time-outline" size={12} color="#94A3B8" />
              <Text style={styles.timeText}>{time}</Text>
            </View>
            <BouncyPressable>
              <Ionicons name="heart" size={20} color="#F87171" />
            </BouncyPressable>
          </View>
        </View>

        {/* Memory Number Tag */}
        <View style={styles.memoryTag}>
          <Text style={styles.memoryText}>Memory #{index + 1}</Text>
        </View>
      </BouncyPressable>
    </MotiView>
  );
};

export const MyJourneyView: React.FC<MyJourneyViewProps> = ({ items, tripName }) => {
  const visitedItems = useMemo(() => {
    return items
      .filter(item => item.status === 'visited')
      .sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime());
  }, [items]);

  if (visitedItems.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <MotiView
          from={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          style={styles.emptyIcon}
        >
          <LinearGradient
            colors={['#DBEAFE', '#F3E8FF']}
            style={styles.emptyGradient}
          >
            <Ionicons name="sparkles" size={32} color="#9333EA" />
          </LinearGradient>
        </MotiView>
        <Text style={styles.emptyTitle}>Your Journey Awaits</Text>
        <Text style={styles.emptySubtitle}>
          Check in to saved spots to start building your travel story
        </Text>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero Header */}
      <MotiView
        from={{ opacity: 0, translateY: -20 }}
        animate={{ opacity: 1, translateY: 0 }}
        style={styles.hero}
      >
        <MotiView
          animate={{ rotate: ['0deg', '10deg', '-10deg', '0deg'] }}
          transition={{ duration: 3000, loop: true, type: 'timing' }}
          style={styles.planeIcon}
        >
          <Ionicons name="airplane" size={48} color="rgba(96, 165, 250, 0.2)" />
        </MotiView>
        
        <Text style={styles.heroTitle}>My Travel Story</Text>
        <Text style={styles.heroSubtitle}>{visitedItems.length} Unforgettable Adventures</Text>
        
        <View style={styles.emojiRow}>
          {['🌍', '✈️', '📸', '❤️'].map((emoji, i) => (
            <MotiView
              key={i}
              from={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: i * 100, type: 'spring' }}
            >
              <Text style={styles.emoji}>{emoji}</Text>
            </MotiView>
          ))}
        </View>
      </MotiView>

      {/* Timeline Content */}
      <View style={styles.timelineContainer}>
        {/* Vertical Line */}
        <LinearGradient
          colors={['#93C5FD', '#C084FC', '#F472B6']}
          style={styles.timelineLine}
        />

        {/* Cards */}
        {visitedItems.map((item, index) => (
          <PolaroidCard
            key={item.id}
            item={item}
            index={index}
            isLeft={index % 2 === 0}
          />
        ))}
      </View>

      {/* Celebratory Footer */}
      <MotiView
        from={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: visitedItems.length * 100 + 500 }}
        style={styles.footer}
      >
        <LinearGradient
          colors={['#2563EB', '#9333EA', '#DB2777']}
          style={styles.footerBorder}
        >
          <View style={styles.footerInner}>
            <MotiView
              animate={{ translateY: [0, -10, 0] }}
              transition={{ duration: 2000, loop: true, type: 'timing' }}
              style={styles.footerSparkles}
            >
              <Ionicons name="sparkles" size={40} color="#9333EA" />
            </MotiView>
            <Text style={styles.footerTitle}>What an incredible journey!</Text>
            <Text style={styles.footerText}>
              You've created {visitedItems.length} beautiful {visitedItems.length === 1 ? 'memory' : 'memories'} across {tripName}. 
              Each destination is a chapter in your unique adventure story. Keep exploring! 🌟
            </Text>
          </View>
        </LinearGradient>
      </MotiView>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 120,
  },
  hero: {
    alignItems: 'center',
    marginBottom: 40,
    paddingHorizontal: 20,
  },
  planeIcon: {
    position: 'absolute',
    top: -20,
    opacity: 0.5,
  },
  heroTitle: {
    fontSize: 36,
    fontWeight: '900',
    color: '#1E293B',
    textAlign: 'center',
    marginTop: 20,
  },
  heroSubtitle: {
    fontSize: 18,
    color: '#64748B',
    marginTop: 8,
    fontWeight: '600',
  },
  emojiRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 20,
  },
  emoji: {
    fontSize: 28,
  },
  timelineContainer: {
    position: 'relative',
    paddingHorizontal: 20,
  },
  timelineLine: {
    position: 'absolute',
    left: SCREEN_WIDTH / 2,
    top: 0,
    bottom: 0,
    width: 2,
    marginLeft: -1,
    opacity: 0.5,
  },
  timelineItem: {
    width: '100%',
    marginVertical: 20,
  },
  timelineItemLeft: {
    alignItems: 'flex-start',
    paddingRight: '50%',
  },
  timelineItemRight: {
    alignItems: 'flex-end',
    paddingLeft: '50%',
  },
  timelineDotContainer: {
    position: 'absolute',
    left: SCREEN_WIDTH / 2 - 20,
    top: '50%',
    marginTop: -15,
    zIndex: 10,
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#8B5CF6',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  dotInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotPulse: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#A78BFA',
    opacity: 0.3,
    zIndex: 1,
  },
  polaroidCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 12,
    width: SCREEN_WIDTH * 0.44,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  tape: {
    position: 'absolute',
    top: -12,
    left: '50%',
    marginLeft: -30,
    width: 60,
    height: 24,
    backgroundColor: 'rgba(254, 249, 195, 0.8)',
    borderRadius: 2,
    transform: [{ rotate: '2deg' }],
    zIndex: 5,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F1F5F9',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '40%',
  },
  categoryBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1E293B',
    textTransform: 'capitalize',
  },
  dateStamp: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 8,
    padding: 6,
    alignItems: 'center',
    minWidth: 45,
  },
  stampMonth: {
    fontSize: 8,
    color: '#64748B',
    fontWeight: '700',
  },
  stampDay: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
    lineHeight: 20,
  },
  stampYear: {
    fontSize: 8,
    color: '#64748B',
  },
  details: {
    marginTop: 12,
  },
  placeName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  locationText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    flex: 1,
  },
  description: {
    fontSize: 11,
    color: '#334155',
    marginTop: 8,
    lineHeight: 15,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '600',
  },
  memoryTag: {
    position: 'absolute',
    bottom: -15,
    right: -10,
    backgroundColor: '#FEF08A',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    transform: [{ rotate: '6deg' }],
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  memoryText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#713F12',
    fontStyle: 'italic',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    paddingTop: 100,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    marginBottom: 20,
  },
  emptyGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 24,
  },
  footer: {
    marginTop: 60,
    paddingHorizontal: 20,
  },
  footerBorder: {
    borderRadius: 32,
    padding: 2,
  },
  footerInner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    padding: 32,
    alignItems: 'center',
  },
  footerSparkles: {
    marginBottom: 16,
  },
  footerTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: 12,
  },
  footerText: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
  },
});

