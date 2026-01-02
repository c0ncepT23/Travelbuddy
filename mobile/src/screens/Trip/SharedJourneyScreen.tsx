import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ScrollView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { MotiView } from 'moti';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import FastImage from 'react-native-fast-image';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { useRoute, useNavigation } from '@react-navigation/native';
import api from '../../config/api';
import { SavedItem, ItemStatus } from '../../types';
import { BouncyPressable } from '../../components/BouncyPressable';
import { getPlacePhotoUrl } from '../../config/maps';
import { useTripStore } from '../../stores/tripStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Shared Polaroid Card Component
const SharedPolaroidCard = ({ 
  item, 
  index, 
  isLeft,
  onSave
}: { 
  item: SavedItem; 
  index: number; 
  isLeft: boolean;
  onSave: (item: SavedItem) => void;
}) => {
  const photoUrl = useMemo(() => getPlacePhotoUrl(item.photos_json, 600), [item.photos_json]);
  
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
      <BouncyPressable
        style={[
          styles.polaroidCard,
          { transform: [{ rotate: isLeft ? '-2deg' : '2deg' }] }
        ]}
      >
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

          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{item.category || 'Place'}</Text>
          </View>
        </View>

        <View style={styles.details}>
          <Text style={styles.placeName} numberOfLines={1}>{item.name}</Text>
          <View style={styles.locationRow}>
            <Ionicons name="location" size={14} color="#EF4444" />
            <Text style={styles.locationText} numberOfLines={1}>
              {item.area_name || item.location_name || 'Nearby'}
            </Text>
          </View>
          
          <Text style={styles.description} numberOfLines={2}>
            {item.description || "A beautiful spot discovered on this journey."}
          </Text>

          <View style={styles.cardFooter}>
            <BouncyPressable 
              onPress={() => onSave(item)}
              style={styles.saveItemButton}
            >
              <Ionicons name="add-circle" size={20} color="#7FFF00" />
              <Text style={styles.saveItemText}>Save to My Map</Text>
            </BouncyPressable>
          </View>
        </View>
      </BouncyPressable>
    </MotiView>
  );
};

export const SharedJourneyScreen = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { tripId } = route.params;
  
  const [loading, setLoading] = useState(true);
  const [tripInfo, setTripInfo] = useState<any>(null);
  const [items, setItems] = useState<SavedItem[]>([]);
  const [cloning, setCloning] = useState(false);
  
  const { trips, fetchTrips } = useTripStore();

  useEffect(() => {
    const loadSharedJourney = async () => {
      try {
        const [summaryRes, itemsRes] = await Promise.all([
          api.get(`/public/trips/${tripId}/summary`),
          api.get(`/public/trips/${tripId}/items`)
        ]);
        
        setTripInfo(summaryRes.data.data);
        setItems(itemsRes.data.data);
      } catch (error) {
        console.error('Error loading shared journey:', error);
        Alert.alert('Error', 'Failed to load this shared journey.');
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    };

    loadSharedJourney();
  }, [tripId]);

  const handleCloneEntireMap = async () => {
    if (cloning) return;
    
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      
      // 1. Find a target trip or create one
      let targetTripId = trips[0]?.id;
      
      if (!targetTripId) {
        const newTripRes = await api.post('/trips', {
          name: `My ${tripInfo.country || 'Travel'} Map`,
          destination: tripInfo.country || 'World'
        });
        targetTripId = newTripRes.data.data.id;
        await fetchTrips();
      }

      setCloning(true);
      
      const res = await api.post('/saved-items/clone', {
        sourceTripId: tripId,
        targetTripId: targetTripId
      });

      if (res.data.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          'Success! 🚀',
          `Cloned ${items.length} spots to your map.`,
          [
            { 
              text: 'View My Map', 
              onPress: () => navigation.navigate('WorldMap') 
            },
            { text: 'Stay Here', style: 'cancel' }
          ]
        );
      }
    } catch (error) {
      console.error('Error cloning journey:', error);
      Alert.alert('Oops', 'Failed to clone this journey. Try again later.');
    } finally {
      setCloning(false);
    }
  };

  const handleSaveIndividual = async (item: SavedItem) => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      let targetTripId = trips[0]?.id;
      
      if (!targetTripId) {
        const newTripRes = await api.post('/trips', {
          name: `My ${item.destination || 'Travel'} Map`,
          destination: item.destination || 'World'
        });
        targetTripId = newTripRes.data.data.id;
        await fetchTrips();
      }

      const res = await api.post('/saved-items', {
        tripGroupId: targetTripId,
        name: item.name,
        category: item.category,
        description: item.description,
        sourceType: item.original_source_type || 'url',
        locationName: item.location_name,
        locationLat: item.location_lat,
        locationLng: item.location_lng,
        sourceUrl: item.original_source_url,
        sourceTitle: item.source_title,
        clonedFromJourneyId: tripId,
        clonedFromOwnerName: tripInfo.ownerName || 'A Friend',
        destination: item.destination
      });

      if (res.data.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        // Maybe show a toast or a small animation instead of an Alert
      }
    } catch (error) {
      console.error('Error saving item:', error);
      Alert.alert('Oops', 'Failed to save this spot.');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#7FFF00" />
      </View>
    );
  }

  const visitedItems = items.filter(i => i.status === 'visited');
  const savedItems = items.filter(i => i.status === 'saved');

  return (
    <View style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Section */}
        <LinearGradient
          colors={['#1E293B', '#0F172A']}
          style={styles.hero}
        >
          <BouncyPressable 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </BouncyPressable>

          <MotiView
            from={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            style={styles.heroContent}
          >
            <Text style={styles.heroTitle}>{tripInfo.title}</Text>
            <Text style={styles.heroSubtitle}>
              {tripInfo.visitedCount} Memories • {tripInfo.discoveriesCount} Discoveries
            </Text>

            <BouncyPressable 
              style={styles.cloneButton}
              onPress={handleCloneEntireMap}
              disabled={cloning}
            >
              {cloning ? (
                <ActivityIndicator size="small" color="#0F1115" />
              ) : (
                <>
                  <Ionicons name="copy" size={20} color="#0F1115" />
                  <Text style={styles.cloneButtonText}>Clone Entire Map</Text>
                </>
              )}
            </BouncyPressable>
            <Text style={styles.cloneSubtext}>Add all {items.length} spots to your collection</Text>
          </MotiView>
        </LinearGradient>

        {/* Timeline Content */}
        <View style={styles.timelineContainer}>
          <LinearGradient
            colors={['#7FFF00', '#22C55E']}
            style={styles.timelineLine}
          />

          {items.map((item, index) => (
            <SharedPolaroidCard
              key={item.id}
              item={item}
              index={index}
              isLeft={index % 2 === 0}
              onSave={handleSaveIndividual}
            />
          ))}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            This journey was shared by {tripInfo.ownerName || 'a traveler'}.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F1115',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F1115',
  },
  scrollContent: {
    paddingBottom: 60,
  },
  hero: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 40,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  heroContent: {
    alignItems: 'center',
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 8,
    fontWeight: '600',
  },
  cloneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7FFF00',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 25,
    marginTop: 24,
    gap: 8,
    shadowColor: '#7FFF00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  cloneButtonText: {
    color: '#0F1115',
    fontSize: 16,
    fontWeight: '800',
  },
  cloneSubtext: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 8,
  },
  timelineContainer: {
    position: 'relative',
    paddingHorizontal: 20,
    marginTop: 20,
  },
  timelineLine: {
    position: 'absolute',
    left: SCREEN_WIDTH / 2,
    top: 0,
    bottom: 0,
    width: 2,
    marginLeft: -1,
    opacity: 0.2,
  },
  timelineItem: {
    width: '100%',
    marginVertical: 15,
  },
  timelineItemLeft: {
    alignItems: 'flex-start',
    paddingRight: '50%',
  },
  timelineItemRight: {
    alignItems: 'flex-end',
    paddingLeft: '50%',
  },
  polaroidCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 10,
    width: SCREEN_WIDTH * 0.44,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#2D3748',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
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
    top: 6,
    right: 6,
    backgroundColor: 'rgba(15,17,21,0.8)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
  },
  categoryText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  details: {
    marginTop: 10,
  },
  placeName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  locationText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '600',
    flex: 1,
  },
  description: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 6,
    lineHeight: 14,
  },
  cardFooter: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  saveItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  saveItemText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#7FFF00',
  },
  footer: {
    marginTop: 40,
    paddingHorizontal: 40,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

