/**
 * PlaceDetailSheet - Google Maps style bottom sheet for single place detail
 * Uses @gorhom/bottom-sheet v4 with footerComponent for fixed action buttons
 */

import React, { useCallback, useMemo, useRef, forwardRef, useImperativeHandle, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  ScrollView as RNScrollView,
} from 'react-native';
import BottomSheet, { 
  BottomSheetScrollView, 
  BottomSheetFooter, 
  BottomSheetBackdrop,
  BottomSheetFooterProps
} from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { SavedItem } from '../types';
import { getGooglePhotoUrl } from '../config/maps';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Dark theme colors (matching Google Maps dark mode)
const COLORS = {
  background: '#0F172A',
  surface: '#1E293B',
  text: '#F8FAFC',
  textSecondary: '#94A3B8',
  accent: '#8B5CF6',
  border: 'rgba(148, 163, 184, 0.2)',
};

export interface PlaceDetailSheetRef {
  expand: () => void;
  collapse: () => void;
  close: () => void;
}

interface PlaceDetailSheetProps {
  place: SavedItem | null;
  isVisible: boolean;
  onClose: () => void;
  onDirections?: (place: SavedItem) => void;
  onCheckIn?: (place: SavedItem) => void;
}

export const PlaceDetailSheet = forwardRef<PlaceDetailSheetRef, PlaceDetailSheetProps>(({
  place,
  isVisible,
  onClose,
  onDirections,
  onCheckIn,
}, ref) => {
  const bottomSheetRef = useRef<BottomSheet>(null);

  // Snap points for v4
  const snapPoints = useMemo(() => ['40%', '70%', '90%'], []);

  // Handle sheet changes
  const handleSheetChanges = useCallback((index: number) => {
    if (index === -1) {
      onClose();
    }
  }, [onClose]);

  // Expose methods to parent
  useImperativeHandle(ref, () => ({
    expand: () => bottomSheetRef.current?.expand(),
    collapse: () => bottomSheetRef.current?.collapse(),
    close: () => bottomSheetRef.current?.close(),
  }), []);

  // Open/close based on visibility
  useEffect(() => {
    if (isVisible && place) {
      bottomSheetRef.current?.snapToIndex(1); // Start at 70%
    } else {
      bottomSheetRef.current?.close();
    }
  }, [isVisible, place]);

  // Parse photos
  const photoUrls = useMemo(() => {
    if (!place?.photos_json) return [];
    try {
      const parsed = typeof place.photos_json === 'string'
        ? JSON.parse(place.photos_json)
        : place.photos_json;
      if (Array.isArray(parsed)) {
        return parsed.map((p: any) => {
          if (typeof p === 'string') return p;
          if (p?.photo_reference) return getGooglePhotoUrl(p.photo_reference, 400);
          if (p?.url) return p.url;
          return null;
        }).filter(Boolean).slice(0, 5);
      }
    } catch {}
    return [];
  }, [place?.photos_json]);

  // FIXED FOOTER with action buttons
  const renderFooter = useCallback(
    (props: BottomSheetFooterProps) => (
      <BottomSheetFooter {...props} bottomInset={24}>
        <View style={styles.footerContainer}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => place && onDirections?.(place)}
          >
            <View style={styles.actionIconWrap}>
              <Ionicons name="navigate" size={20} color="#4285F4" />
            </View>
            <Text style={styles.actionText}>Directions</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => place && onCheckIn?.(place)}
          >
            <View style={[styles.actionIconWrap, { backgroundColor: 'rgba(52, 168, 83, 0.15)' }]}>
              <Ionicons name="checkmark-circle" size={20} color="#34A853" />
            </View>
            <Text style={styles.actionText}>Visited</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton}>
            <View style={styles.actionIconWrap}>
              <Ionicons name="share-outline" size={20} color="#4285F4" />
            </View>
            <Text style={styles.actionText}>Share</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton}>
            <View style={styles.actionIconWrap}>
              <Ionicons name="bookmark-outline" size={20} color="#4285F4" />
            </View>
            <Text style={styles.actionText}>Save</Text>
          </TouchableOpacity>
        </View>
      </BottomSheetFooter>
    ),
    [place, onDirections, onCheckIn]
  );

  // Backdrop
  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
      />
    ),
    []
  );

  if (!place) return null;

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={-1}
      snapPoints={snapPoints}
      onChange={handleSheetChanges}
      footerComponent={renderFooter}
      backdropComponent={renderBackdrop}
      enablePanDownToClose={true}
      backgroundStyle={styles.sheetBackground}
      handleIndicatorStyle={styles.handleIndicator}
    >
      <BottomSheetScrollView style={styles.scrollContent}>
        {/* Header: Name + Close */}
        <View style={styles.headerRow}>
          <Text style={styles.placeName}>{place.name}</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Meta: Rating · Category · Cuisine */}
        <View style={styles.metaRow}>
          {place.rating && (
            <>
              <Text style={styles.rating}>
                {typeof place.rating === 'number' ? place.rating.toFixed(1) : place.rating}
              </Text>
              <Ionicons name="star" size={14} color="#FBBF24" />
              <Text style={styles.metaDot}>·</Text>
            </>
          )}
          {place.category && (
            <>
              <Text style={styles.metaText}>{place.category}</Text>
              {place.cuisine_type && <Text style={styles.metaDot}>·</Text>}
            </>
          )}
          {place.cuisine_type && (
            <Text style={styles.metaText}>{place.cuisine_type}</Text>
          )}
        </View>

        {/* Location */}
        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={16} color={COLORS.textSecondary} />
          <Text style={styles.locationText}>
            {place.area_name || place.location_name || 'Unknown location'}
          </Text>
        </View>

        {/* Photo Carousel */}
        <RNScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          style={styles.photoCarousel}
          contentContainerStyle={styles.photoCarouselContent}
        >
          {photoUrls.length > 0 ? (
            photoUrls.map((url, i) => (
              <Image
                key={i}
                source={{ uri: url }}
                style={[styles.photo, i === 0 && styles.photoFirst]}
                resizeMode="cover"
              />
            ))
          ) : (
            <View style={styles.photoPlaceholder}>
              <Ionicons name="image-outline" size={40} color={COLORS.textSecondary} />
            </View>
          )}
        </RNScrollView>

        {/* Creator Insights */}
        {place.description && (
          <View style={styles.insights}>
            <View style={styles.insightsHeader}>
              <Ionicons name="bookmark" size={16} color={COLORS.accent} />
              <Text style={styles.insightsLabel}>
                {place.source_title ? `Saved from ${place.source_title}` : 'Why you saved this'}
              </Text>
            </View>
            <Text style={styles.insightsQuote}>"{place.description}"</Text>
          </View>
        )}

        {/* Extra bottom padding for footer */}
        <View style={{ height: 140 }} />
      </BottomSheetScrollView>
    </BottomSheet>
  );
});

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: COLORS.background,
  },
  handleIndicator: {
    backgroundColor: '#5F6368',
    width: 40,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  placeName: {
    fontSize: 24,
    fontWeight: '600',
    color: COLORS.text,
    flex: 1,
    marginRight: 12,
  },
  closeButton: {
    padding: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  rating: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginRight: 4,
  },
  metaDot: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginHorizontal: 6,
  },
  metaText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  locationText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginLeft: 6,
  },
  photoCarousel: {
    marginBottom: 16,
    marginHorizontal: -16,
  },
  photoCarouselContent: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    gap: 8,
  },
  photo: {
    width: 180,
    height: 130,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
  },
  photoFirst: {
    width: 220,
  },
  photoPlaceholder: {
    width: 220,
    height: 130,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  insights: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.accent,
  },
  insightsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  insightsLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginLeft: 8,
    fontWeight: '500',
  },
  insightsQuote: {
    fontSize: 14,
    color: '#CBD5E1',
    fontStyle: 'italic',
    lineHeight: 20,
  },
  // Footer styles
  footerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  actionButton: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    minWidth: 70,
  },
  actionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(66, 133, 244, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  actionText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
});

export default PlaceDetailSheet;
