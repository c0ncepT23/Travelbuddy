import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Linking,
  Image,
} from 'react-native';
import { SavedItem, ItemCategory } from '../types';
import { StarRating } from './StarRating';

interface PlaceDetailCardProps {
  place: SavedItem;
  onClose: () => void;
  onCheckIn?: (place: SavedItem) => void;
  isCheckedIn?: boolean;
  addedByName?: string;
}

const CATEGORY_EMOJIS: Record<ItemCategory, string> = {
  [ItemCategory.FOOD]: '🍽️',
  [ItemCategory.ACCOMMODATION]: '🏨',
  [ItemCategory.PLACE]: '📍',
  [ItemCategory.SHOPPING]: '🛍️',
  [ItemCategory.ACTIVITY]: '🎯',
  [ItemCategory.TIP]: '💡',
};

const CATEGORY_LABELS: Record<ItemCategory, string> = {
  [ItemCategory.FOOD]: 'Restaurant',
  [ItemCategory.ACCOMMODATION]: 'Hotel',
  [ItemCategory.PLACE]: 'Place',
  [ItemCategory.SHOPPING]: 'Shopping',
  [ItemCategory.ACTIVITY]: 'Activity',
  [ItemCategory.TIP]: 'Tip',
};

const SOURCE_EMOJIS: Record<string, string> = {
  youtube: '▶️',
  reddit: '💬',
  instagram: '📷',
  url: '🔗',
  photo: '📷',
  voice: '🎤',
  text: '📝',
};

export const PlaceDetailCard: React.FC<PlaceDetailCardProps> = ({
  place,
  onClose,
  onCheckIn,
  isCheckedIn = false,
  addedByName = 'Someone',
}) => {
  const openInGoogleMaps = () => {
    if (place.location_lat && place.location_lng) {
      const url = `https://www.google.com/maps/search/?api=1&query=${place.location_lat},${place.location_lng}`;
      Linking.openURL(url);
    }
  };

  const getPhotos = (): string[] => {
    if (!place.photos_json) return [];
    try {
      const photos = Array.isArray(place.photos_json) 
        ? place.photos_json 
        : JSON.parse(place.photos_json);
      
      return photos
        .slice(0, 3)
        .map((photo: any) => 
          `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${photo.photo_reference}&key=AIzaSyAiWhzrvdNb2NKSyzWpvNrhImz72I395Qo`
        );
    } catch {
      return [];
    }
  };

  const photos = getPhotos();

  return (
    <View style={styles.container}>
      {/* Close Button */}
      <TouchableOpacity style={styles.closeButton} onPress={onClose}>
        <Text style={styles.closeButtonText}>✕</Text>
      </TouchableOpacity>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Place Name */}
        <Text style={styles.placeName}>{place.name}</Text>

        {/* Rating Row */}
        {place.rating && place.rating > 0 && (
          <View style={styles.ratingRow}>
            <StarRating 
              rating={place.rating} 
              reviewCount={place.user_ratings_total}
              size="medium"
            />
          </View>
        )}

        {/* Tags Row */}
        <View style={styles.tagsRow}>
          {/* Category Tag */}
          <View style={styles.tag}>
            <Text style={styles.tagEmoji}>{CATEGORY_EMOJIS[place.category]}</Text>
            <Text style={styles.tagText}>{CATEGORY_LABELS[place.category]}</Text>
          </View>

          {/* Source Tag */}
          {place.original_source_type && (
            <View style={[styles.tag, styles.sourceTag]}>
              <Text style={styles.tagEmoji}>
                {SOURCE_EMOJIS[place.original_source_type] || '🔗'}
              </Text>
              <Text style={styles.tagText}>
                Saved from {place.original_source_type}
              </Text>
            </View>
          )}
        </View>

        {/* Photos */}
        {photos.length > 0 && (
          <ScrollView 
            horizontal 
            style={styles.photosScroll}
            showsHorizontalScrollIndicator={false}
          >
            {photos.map((photoUrl, index) => (
              <Image 
                key={index}
                source={{ uri: photoUrl }}
                style={styles.photo}
                resizeMode="cover"
              />
            ))}
          </ScrollView>
        )}

        {/* Location & Address */}
        {place.formatted_address && (
          <Text style={styles.address}>{place.formatted_address}</Text>
        )}
        {!place.formatted_address && place.location_name && (
          <Text style={styles.address}>{place.location_name}</Text>
        )}

        {/* Description */}
        {place.description && (
          <Text style={styles.description}>{place.description}</Text>
        )}

        {/* Added By */}
        <Text style={styles.addedBy}>Added by {addedByName}</Text>
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.actionBar}>
        {/* Saved Button */}
        <TouchableOpacity style={styles.savedButton}>
          <Text style={styles.savedIcon}>📌</Text>
          <Text style={styles.savedText}>Saved</Text>
        </TouchableOpacity>

        {/* Direction Button */}
        <TouchableOpacity 
          style={styles.directionButton}
          onPress={openInGoogleMaps}
        >
          <Text style={styles.directionIcon}>🧭</Text>
          <Text style={styles.directionText}>Direction</Text>
        </TouchableOpacity>
      </View>

      {/* Check-in Button (if callback provided) */}
      {onCheckIn && (
        <View style={styles.checkInContainer}>
          {isCheckedIn ? (
            <View style={styles.checkedInBadge}>
              <Text style={styles.checkedInText}>✓ Checked In</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.checkInButton}
              onPress={() => onCheckIn(place)}
            >
              <Text style={styles.checkInButtonText}>✓ Check In</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  closeButtonText: {
    fontSize: 18,
    color: '#8E8E93',
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  placeName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
    marginBottom: 12,
    paddingRight: 40,
  },
  ratingRow: {
    marginBottom: 12,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  sourceTag: {
    backgroundColor: '#E3F2FD',
  },
  tagEmoji: {
    fontSize: 14,
    marginRight: 4,
  },
  tagText: {
    fontSize: 13,
    color: '#000',
    fontWeight: '600',
  },
  photosScroll: {
    marginBottom: 16,
  },
  photo: {
    width: 200,
    height: 150,
    borderRadius: 12,
    marginRight: 12,
  },
  address: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 12,
    lineHeight: 20,
  },
  description: {
    fontSize: 15,
    color: '#000',
    lineHeight: 22,
    marginBottom: 12,
  },
  addedBy: {
    fontSize: 13,
    color: '#8E8E93',
    marginBottom: 20,
  },
  actionBar: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    gap: 12,
  },
  savedButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFD60A',
    paddingVertical: 14,
    borderRadius: 12,
  },
  savedIcon: {
    fontSize: 18,
    marginRight: 6,
  },
  savedText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  directionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F2F2F7',
    paddingVertical: 14,
    borderRadius: 12,
  },
  directionIcon: {
    fontSize: 18,
    marginRight: 6,
  },
  directionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  checkInContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  checkInButton: {
    backgroundColor: '#34C759',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  checkInButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  checkedInBadge: {
    backgroundColor: '#E8F5E9',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#34C759',
  },
  checkedInText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#34C759',
  },
});

