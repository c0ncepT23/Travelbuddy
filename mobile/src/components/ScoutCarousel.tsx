import React, { useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Dimensions, 
  TouchableOpacity, 
  FlatList 
} from 'react-native';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import FastImage from 'react-native-fast-image';
import { getPlacePhotoUrl } from '../config/maps';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export interface ScoutResult {
  place_id: string;
  name: string;
  address: string;
  rating?: number;
  user_rating_count?: number;
  generative_summary?: string;
  vibe_match_score: number;
  social_label: string;
  photos?: any[];
  location: {
    lat: number;
    lng: number;
  };
}

interface ScoutCarouselProps {
  scouts: ScoutResult[];
  intentItem: string;
  intentCity: string;
  onSelect: (result: ScoutResult) => void;
  onClose?: () => void;
  title?: string;
}

export const ScoutCarousel: React.FC<ScoutCarouselProps> = ({ 
  scouts, 
  intentItem, 
  intentCity, 
  onSelect,
  onClose,
  title
}) => {
  return (
    <MotiView 
      from={{ opacity: 0, scale: 0.9, translateY: 20 }}
      animate={{ opacity: 1, scale: 1, translateY: 0 }}
      style={styles.scoutSection}
    >
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={styles.scoutTitle}>
            {title || `Matched ${intentItem || 'places'} in ${intentCity}! 🗺️`}
          </Text>
          <Text style={styles.scoutSubtitle}>Tap a spot to add it to your trip:</Text>
        </View>
        {onClose && (
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close-circle" size={28} color="rgba(255,255,255,0.4)" />
          </TouchableOpacity>
        )}
      </View>
      
      <FlatList
        data={scouts}
        keyExtractor={(item) => item.place_id}
        renderItem={({ item }) => <ScoutCard result={item} onSelect={onSelect} />}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scoutList}
        snapToInterval={260}
        decelerationRate="fast"
        nestedScrollEnabled
        scrollEnabled
      />
    </MotiView>
  );
};

const ScoutCard: React.FC<{ result: ScoutResult; onSelect: (result: ScoutResult) => void }> = ({ result, onSelect }) => {
  const photoUrl = useMemo(() => getPlacePhotoUrl(result.photos, 400), [result.photos]);
  
  return (
    <TouchableOpacity 
      style={styles.scoutCard} 
      activeOpacity={0.9}
      onPress={() => onSelect(result)}
    >
      <View style={styles.scoutImageContainer}>
        {photoUrl ? (
          <FastImage source={{ uri: photoUrl }} style={styles.scoutImage} resizeMode="cover" />
        ) : (
          <View style={styles.scoutPlaceholder}>
            <Ionicons name="restaurant" size={32} color="rgba(255,255,255,0.3)" />
          </View>
        )}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.8)']}
          style={styles.scoutImageOverlay}
        />
        <View style={styles.scoutLabelBadge}>
          <Text style={styles.scoutLabelText}>{result.social_label}</Text>
        </View>
      </View>
      
      <View style={styles.scoutInfo}>
        <Text style={styles.scoutName} numberOfLines={1}>{result.name}</Text>
        <View style={styles.scoutMeta}>
          <View style={styles.scoutRating}>
            <Ionicons name="star" size={12} color="#FFD700" />
            <Text style={styles.scoutRatingText}>{result.rating?.toFixed(1) || 'N/A'}</Text>
          </View>
          <Text style={styles.scoutMatchScore}>{Math.round(result.vibe_match_score * 10)}% Vibe Match</Text>
        </View>
        <Text style={styles.scoutSummary} numberOfLines={2}>
          {result.generative_summary || "Checking details..."}
        </Text>
      </View>
      
      <View style={styles.scoutButton}>
        <Text style={styles.scoutButtonText}>Add to Trip</Text>
        <Ionicons name="add-circle" size={20} color="#FFFFFF" />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  scoutSection: {
    width: SCREEN_WIDTH,
    marginTop: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    marginBottom: 4,
  },
  titleContainer: {
    flex: 1,
  },
  closeButton: {
    marginLeft: 10,
    marginTop: -4,
  },
  scoutTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  scoutSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 20,
  },
  scoutList: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  scoutCard: {
    width: 240,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    marginRight: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  scoutImageContainer: {
    width: '100%',
    height: 120,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  scoutImage: {
    width: '100%',
    height: '100%',
  },
  scoutImageOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  scoutPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoutLabelBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: '#06B6D4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  scoutLabelText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  scoutInfo: {
    padding: 12,
  },
  scoutName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  scoutMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  scoutRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  scoutRatingText: {
    fontSize: 12,
    color: '#FFD700',
    fontWeight: '600',
  },
  scoutMatchScore: {
    fontSize: 11,
    color: '#22D3EE',
    fontWeight: '600',
  },
  scoutSummary: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 16,
  },
  scoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingVertical: 10,
    gap: 8,
  },
  scoutButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

