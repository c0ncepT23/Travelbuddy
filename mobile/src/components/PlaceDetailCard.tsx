import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Linking,
  Image,
  Dimensions,
  Modal,
  Share,
  TextInput,
  Alert,
} from 'react-native';
import { SavedItem, ItemCategory, Trip } from '../types';
import theme from '../config/theme';
import { HapticFeedback } from '../utils/haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface PlaceDetailCardProps {
  place: SavedItem;
  onClose: () => void;
  onCheckIn?: (place: SavedItem) => void;
  isCheckedIn?: boolean;
  addedByName?: string;
  onToggleFavorite?: (place: SavedItem) => void;
  onToggleMustVisit?: (place: SavedItem) => void;
  // Day planner props
  trip?: Trip;
  onAssignToDay?: (place: SavedItem, day: number | null) => void;
  // Notes
  onUpdateNotes?: (place: SavedItem, notes: string) => void;
}

// Generate trip days from start_date to end_date
const generateTripDays = (trip: Trip | undefined): { dayNumber: number; date: Date }[] => {
  const days: { dayNumber: number; date: Date }[] = [];
  
  if (trip?.start_date && trip?.end_date) {
    const startDate = new Date(trip.start_date);
    const endDate = new Date(trip.end_date);
    
    let currentDate = new Date(startDate);
    let dayNumber = 1;
    
    while (currentDate <= endDate) {
      days.push({ dayNumber, date: new Date(currentDate) });
      currentDate.setDate(currentDate.getDate() + 1);
      dayNumber++;
    }
  } else {
    // If no dates set, create 7 default days
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      days.push({ dayNumber: i + 1, date });
    }
  }
  
  return days;
};

// Format date for display
const formatDate = (date: Date): string => {
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return date.toLocaleDateString('en-US', options);
};

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

const SOURCE_ICONS: Record<string, { icon: string; color: string }> = {
  youtube: { icon: '▶️', color: '#FF0000' },
  reddit: { icon: '💬', color: '#FF4500' },
  instagram: { icon: '📷', color: '#E1306C' },
  url: { icon: '🔗', color: '#6B7280' },
  photo: { icon: '📷', color: '#6B7280' },
  voice: { icon: '🎤', color: '#6B7280' },
  text: { icon: '📝', color: '#6B7280' },
};

export const PlaceDetailCard: React.FC<PlaceDetailCardProps> = ({
  place,
  onClose,
  onCheckIn,
  isCheckedIn = false,
  addedByName = 'Someone',
  onToggleFavorite,
  onToggleMustVisit,
  trip,
  onAssignToDay,
  onUpdateNotes,
}) => {
  const [showDayPicker, setShowDayPicker] = useState(false);
  const tripDays = generateTripDays(trip);

  // Share place function
  const handleShare = async () => {
    try {
      HapticFeedback.light();
      const message = `${CATEGORY_EMOJIS[place.category]} ${place.name}\n${
        place.rating ? `⭐ ${Number(place.rating).toFixed(1)}` : ''
      }${place.formatted_address ? ` | ${place.formatted_address}` : place.location_name ? ` | ${place.location_name}` : ''}\n${
        place.description ? `\n${place.description}\n` : ''
      }\n📍 ${place.location_lat && place.location_lng 
        ? `https://www.google.com/maps/search/?api=1&query=${place.location_lat},${place.location_lng}`
        : 'Location not available'}`;

      await Share.share({
        message,
        title: place.name,
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

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
        .slice(0, 5)
        .map((photo: any) => 
          `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${photo.photo_reference}&key=AIzaSyAiWhzrvdNb2NKSyzWpvNrhImz72I395Qo`
        );
    } catch {
      return [];
    }
  };

  const renderStars = (rating: number | string | undefined) => {
    const numericRating = typeof rating === 'number' ? rating : parseFloat(String(rating)) || 0;
    const stars = [];
    const fullStars = Math.floor(numericRating);
    const hasHalfStar = numericRating % 1 >= 0.5;
    
    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(<Text key={i} style={styles.starFull}>★</Text>);
      } else if (i === fullStars && hasHalfStar) {
        stars.push(<Text key={i} style={styles.starFull}>★</Text>);
      } else {
        stars.push(<Text key={i} style={styles.starEmpty}>★</Text>);
      }
    }
    return stars;
  };

  const photos = getPhotos();
  const sourceInfo = SOURCE_ICONS[place.original_source_type] || SOURCE_ICONS.url;

  return (
    <View style={styles.container}>
      {/* Header Row - Clean with just close button */}
      <View style={styles.headerRow}>
        <View style={styles.headerSpacer} />
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Place Name */}
        <Text style={styles.placeName}>{place.name}</Text>
        
        {/* Must-Visit Badge */}
        {place.is_must_visit && (
          <View style={styles.mustVisitBadge}>
            <Text style={styles.mustVisitIcon}>🎯</Text>
            <Text style={styles.mustVisitText}>Must Visit</Text>
          </View>
        )}

        {/* Cloned From Badge */}
        {place.cloned_from_owner_name && (
          <View style={styles.clonedFromBadge}>
            <Text style={styles.clonedFromIcon}>🔗</Text>
            <Text style={styles.clonedFromText}>
              From {place.cloned_from_owner_name}'s Journey
            </Text>
          </View>
        )}

        {/* Rating Row - PROMINENT like reference */}
        {place.rating ? (
          <View style={styles.ratingRow}>
            <Text style={styles.ratingNumber}>
              {(typeof place.rating === 'number' ? place.rating : parseFloat(String(place.rating)) || 0).toFixed(1)}
            </Text>
            <View style={styles.starsRow}>
              {renderStars(place.rating)}
            </View>
            {place.user_ratings_total && Number(place.user_ratings_total) > 0 && (
              <Text style={styles.reviewCount}>({place.user_ratings_total})</Text>
            )}
          </View>
        ) : null}

        {/* Tags Row */}
        <View style={styles.tagsRow}>
          {/* Category Tag */}
          <View style={styles.tag}>
            <Text style={styles.tagIcon}>{CATEGORY_EMOJIS[place.category]}</Text>
            <Text style={styles.tagText}>{CATEGORY_LABELS[place.category]}</Text>
          </View>

          {/* Source Tag */}
          {place.original_source_type && (
            <View style={[styles.tag, styles.sourceTag]}>
              <Text style={styles.tagIcon}>{sourceInfo.icon}</Text>
              <Text style={styles.tagText}>
                You saved this place 1x ↗
              </Text>
            </View>
          )}
        </View>

        {/* Photos Gallery - Like reference with placeholder if no photos */}
        <View style={styles.photoSection}>
          {photos.length > 0 ? (
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.photosContainer}
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
          ) : (
            <View style={styles.photoPlaceholder}>
              <Text style={styles.photoPlaceholderEmoji}>{CATEGORY_EMOJIS[place.category]}</Text>
            </View>
          )}
        </View>

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

        {/* Assign to Day Button */}
        {onAssignToDay && (
          <TouchableOpacity
            style={styles.assignDayButton}
            onPress={() => setShowDayPicker(true)}
          >
            <Text style={styles.assignDayIcon}>📅</Text>
            <View style={styles.assignDayTextContainer}>
              <Text style={styles.assignDayLabel}>
                {place.planned_day ? `Day ${place.planned_day}` : 'Not scheduled'}
              </Text>
              <Text style={styles.assignDayHint}>Tap to assign to a day</Text>
            </View>
            <Text style={styles.assignDayArrow}>▼</Text>
          </TouchableOpacity>
        )}

        {/* Added By */}
        <Text style={styles.addedBy}>Added by {addedByName}</Text>
      </ScrollView>

      {/* Day Picker Modal */}
      <Modal
        visible={showDayPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDayPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowDayPicker(false)}
        >
          <View style={styles.dayPickerModal}>
            <View style={styles.dayPickerHeader}>
              <Text style={styles.dayPickerTitle}>📅 Assign to Day</Text>
              <TouchableOpacity onPress={() => setShowDayPicker(false)}>
                <Text style={styles.dayPickerClose}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.dayPickerList}>
              {/* Unassign Option */}
              <TouchableOpacity
                style={[
                  styles.dayPickerItem,
                  place.planned_day === null && styles.dayPickerItemActive,
                ]}
                onPress={() => {
                  onAssignToDay?.(place, null);
                  setShowDayPicker(false);
                }}
              >
                <Text style={styles.dayPickerItemIcon}>📦</Text>
                <Text style={styles.dayPickerItemText}>Unassigned</Text>
                {place.planned_day === null && (
                  <Text style={styles.dayPickerItemCheck}>✓</Text>
                )}
              </TouchableOpacity>

              {/* Day Options */}
              {tripDays.map(({ dayNumber, date }) => (
                <TouchableOpacity
                  key={dayNumber}
                  style={[
                    styles.dayPickerItem,
                    place.planned_day === dayNumber && styles.dayPickerItemActive,
                  ]}
                  onPress={() => {
                    onAssignToDay?.(place, dayNumber);
                    setShowDayPicker(false);
                  }}
                >
                  <Text style={styles.dayPickerItemIcon}>📅</Text>
                  <View style={styles.dayPickerItemTextContainer}>
                    <Text style={styles.dayPickerItemText}>Day {dayNumber}</Text>
                    <Text style={styles.dayPickerItemDate}>{formatDate(date)}</Text>
                  </View>
                  {place.planned_day === dayNumber && (
                    <Text style={styles.dayPickerItemCheck}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Action Buttons */}
      <View style={styles.actionBar}>
        {/* Check-in Button - Primary Action */}
        {onCheckIn ? (
          isCheckedIn ? (
            <View style={styles.checkedInButton}>
              <Text style={styles.checkedInIcon}>✓</Text>
              <Text style={styles.checkedInText}>Checked In</Text>
            </View>
          ) : (
            <TouchableOpacity 
              style={styles.checkInButton}
              onPress={() => onCheckIn(place)}
            >
              <Text style={styles.checkInIcon}>📍</Text>
              <Text style={styles.checkInButtonText}>Check In</Text>
            </TouchableOpacity>
          )
        ) : (
          <View style={styles.savedBadge}>
            <Text style={styles.savedIcon}>✓</Text>
            <Text style={styles.savedText}>Saved</Text>
          </View>
        )}

        {/* Direction Button */}
        <TouchableOpacity 
          style={styles.directionButton}
          onPress={openInGoogleMaps}
        >
          <Text style={styles.directionIcon}>↗</Text>
          <Text style={styles.directionText}>Directions</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderRightWidth: 3,
    borderColor: theme.colors.borderDark,
  },
  // Header row with favorite and close buttons
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerSpacer: {
    flex: 1,
  },
  closeButton: {
    width: 36,
    height: 36,
    backgroundColor: theme.colors.backgroundAlt,
    borderWidth: 2,
    borderColor: theme.colors.borderDark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  // Favorite button
  favoriteButton: {
    width: 44,
    height: 44,
    backgroundColor: theme.colors.backgroundAlt,
    borderWidth: 2,
    borderColor: theme.colors.borderDark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  favoriteIcon: {
    fontSize: 22,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  
  // Place Name - Large and bold NeoPOP style
  placeName: {
    fontSize: 26,
    fontWeight: '900',
    color: theme.colors.textPrimary,
    marginBottom: 8,
    lineHeight: 32,
    letterSpacing: -0.5,
  },
  
  // Must Visit Badge
  mustVisitBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.categoryColors.activity.bg,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 2,
    borderColor: theme.colors.success,
    marginBottom: 12,
  },
  mustVisitIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  mustVisitText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.success,
  },
  
  // Cloned From Badge
  clonedFromBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 6,
    marginBottom: 12,
  },
  clonedFromIcon: {
    fontSize: 12,
    marginRight: 6,
  },
  clonedFromText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  
  // Rating Row - NeoPOP style
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  ratingNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    marginRight: 8,
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starFull: {
    fontSize: 18,
    color: theme.colors.secondary,
  },
  starEmpty: {
    fontSize: 18,
    color: theme.colors.border,
  },
  reviewCount: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    marginLeft: 8,
    fontWeight: '600',
  },
  
  // Tags Row - NeoPOP style
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.backgroundAlt,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 2,
    borderColor: theme.colors.borderDark,
    marginRight: 10,
    marginBottom: 8,
  },
  sourceTag: {
    backgroundColor: theme.categoryColors.shopping.bg,
    borderColor: theme.colors.borderDark,
  },
  tagIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  tagText: {
    fontSize: 13,
    color: theme.colors.textPrimary,
    fontWeight: '700',
  },
  
  // Photo Section - NeoPOP style
  photoSection: {
    marginBottom: 16,
  },
  photosContainer: {
    gap: 10,
  },
  photo: {
    width: SCREEN_WIDTH * 0.55,
    height: 180,
    borderWidth: 2,
    borderColor: theme.colors.borderDark,
    marginRight: 10,
  },
  photoPlaceholder: {
    height: 140,
    backgroundColor: theme.colors.backgroundAlt,
    borderWidth: 2,
    borderColor: theme.colors.borderDark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoPlaceholderEmoji: {
    fontSize: 48,
    opacity: 0.3,
  },
  
  // Address
  address: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    marginBottom: 12,
    lineHeight: 22,
    fontWeight: '500',
  },
  
  // Description
  description: {
    fontSize: 16,
    color: theme.colors.textPrimary,
    lineHeight: 24,
    marginBottom: 12,
  },
  
  // Added By
  addedBy: {
    fontSize: 14,
    color: theme.colors.textTertiary,
    marginBottom: 20,
    fontWeight: '600',
  },
  
  // Action Buttons - NeoPOP style
  actionBar: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 2,
    borderTopColor: theme.colors.border,
    gap: 12,
  },
  savedButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.secondary,
    paddingVertical: 14,
    borderWidth: 2,
    borderColor: theme.colors.borderDark,
    ...theme.shadows.neopop.sm,
  },
  mustVisitActiveButton: {
    backgroundColor: theme.colors.success,
    borderColor: theme.colors.borderDark,
  },
  savedIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  savedText: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  mustVisitActiveText: {
    color: theme.colors.textInverse,
  },
  directionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    borderWidth: 2,
    borderColor: theme.colors.borderDark,
    ...theme.shadows.neopop.sm,
  },
  directionIcon: {
    fontSize: 18,
    marginRight: 8,
    color: theme.colors.textInverse,
  },
  directionText: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.textInverse,
  },
  
  // Check-in Button - Primary Action
  checkInButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    paddingVertical: 14,
    borderWidth: 2,
    borderColor: theme.colors.borderDark,
    marginRight: 12,
    ...theme.shadows.neopop.sm,
  },
  checkInIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  checkInButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  checkedInButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D1FAE5',
    paddingVertical: 14,
    borderWidth: 2,
    borderColor: '#10B981',
    marginRight: 12,
  },
  checkedInIcon: {
    fontSize: 18,
    marginRight: 8,
    color: '#10B981',
  },
  checkedInText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#10B981',
  },
  savedBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    paddingVertical: 14,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    marginRight: 12,
  },
  
  // Assign to Day Button
  assignDayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.backgroundAlt,
    padding: 14,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: theme.colors.borderDark,
    ...theme.shadows.neopop.sm,
  },
  assignDayIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  assignDayTextContainer: {
    flex: 1,
  },
  assignDayLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  assignDayHint: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: '500',
    marginTop: 2,
  },
  assignDayArrow: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginLeft: 8,
  },
  
  // Day Picker Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayPickerModal: {
    width: SCREEN_WIDTH * 0.85,
    maxHeight: '70%',
    backgroundColor: theme.colors.surface,
    borderWidth: 3,
    borderColor: theme.colors.borderDark,
    ...theme.shadows.neopop.lg,
  },
  dayPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.backgroundAlt,
  },
  dayPickerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: theme.colors.textPrimary,
  },
  dayPickerClose: {
    fontSize: 22,
    color: theme.colors.textSecondary,
    fontWeight: '700',
  },
  dayPickerList: {
    maxHeight: 350,
  },
  dayPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  dayPickerItemActive: {
    backgroundColor: theme.colors.primary + '15',
  },
  dayPickerItemIcon: {
    fontSize: 20,
    marginRight: 14,
  },
  dayPickerItemTextContainer: {
    flex: 1,
  },
  dayPickerItemText: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  dayPickerItemDate: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontWeight: '500',
    marginTop: 2,
  },
  dayPickerItemCheck: {
    fontSize: 18,
    color: theme.colors.success,
    fontWeight: '800',
    marginLeft: 10,
  },
  // Share Button
  shareButton: {
    width: 44,
    height: 44,
    backgroundColor: theme.colors.backgroundAlt,
    borderWidth: 2,
    borderColor: theme.colors.borderDark,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  shareIcon: {
    fontSize: 20,
  },
  // Notes Section
  notesSection: {
    backgroundColor: theme.colors.backgroundAlt,
    padding: 14,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: theme.colors.borderDark,
  },
  notesSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  notesSectionIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  notesSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    flex: 1,
  },
  notesSectionEdit: {
    fontSize: 12,
    color: theme.colors.primary,
    fontWeight: '700',
  },
  notesText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  notesPlaceholder: {
    fontSize: 14,
    color: theme.colors.textTertiary,
    fontStyle: 'italic',
  },
  // Notes Modal
  notesModal: {
    width: SCREEN_WIDTH * 0.9,
    backgroundColor: theme.colors.surface,
    borderWidth: 3,
    borderColor: theme.colors.borderDark,
    ...theme.shadows.neopop.lg,
  },
  notesModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.backgroundAlt,
  },
  notesModalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: theme.colors.textPrimary,
  },
  notesModalClose: {
    fontSize: 22,
    color: theme.colors.textSecondary,
    fontWeight: '700',
  },
  notesInput: {
    margin: 16,
    padding: 14,
    fontSize: 15,
    lineHeight: 22,
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.backgroundAlt,
    borderWidth: 2,
    borderColor: theme.colors.borderDark,
    minHeight: 120,
  },
  notesHint: {
    fontSize: 12,
    color: theme.colors.textTertiary,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  notesModalActions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  notesCancelButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.borderDark,
    backgroundColor: theme.colors.backgroundAlt,
  },
  notesCancelText: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  notesSaveButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.borderDark,
    backgroundColor: theme.colors.primary,
    ...theme.shadows.neopop.sm,
  },
  notesSaveText: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.textInverse,
  },
});

