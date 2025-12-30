/**
 * PlaceDetailSheet - Google Maps style bottom sheet for single place detail
 * Uses @gorhom/bottom-sheet v4 with footerComponent for fixed action buttons
 */

import React, { useCallback, useMemo, useRef, forwardRef, useImperativeHandle, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Dimensions,
  ScrollView as RNScrollView,
  Platform,
} from 'react-native';
import BottomSheet, { 
  BottomSheetScrollView, 
  BottomSheetFooter, 
  BottomSheetFooterProps
} from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { SavedItem } from '../types';
import { getGooglePhotoUrl } from '../config/maps';
import theme from '../config/theme';
import { BouncyPressable } from './BouncyPressable';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export interface PlaceDetailSheetRef {
  expand: () => void;
  collapse: () => void;
  close: () => void;
  peek: () => void;
  snapToIndex: (index: number) => void;
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

  // Snap points: Peek (25%) and Default (55%)
  const snapPoints = useMemo(() => ['25%', '55%', '90%'], []);

  // Expose methods to parent
  useImperativeHandle(ref, () => ({
    expand: () => bottomSheetRef.current?.expand(),
    collapse: () => bottomSheetRef.current?.collapse(),
    close: () => bottomSheetRef.current?.close(),
    peek: () => bottomSheetRef.current?.snapToIndex(0),
    snapToIndex: (index: number) => bottomSheetRef.current?.snapToIndex(index),
  }), []);

  const isSheetReady = useRef(false);

  // Open/close based on visibility
  useEffect(() => {
    if (isVisible && place) {
      if (isSheetReady.current) {
        bottomSheetRef.current?.snapToIndex(1);
      } else {
        setTimeout(() => {
          bottomSheetRef.current?.snapToIndex(1);
        }, 50);
      }
    } else {
      bottomSheetRef.current?.close();
    }
  }, [isVisible, place]);

  const handleSheetChange = useCallback((index: number) => {
    isSheetReady.current = true;
    if (index === -1) {
      onClose();
    }
  }, [onClose]);

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

  const renderFooter = useCallback(
    (props: BottomSheetFooterProps) => (
      <BottomSheetFooter {...props} bottomInset={0}>
        <View style={styles.footerContainer}>
          <BouncyPressable 
            style={styles.actionButton}
            onPress={() => place && onDirections?.(place)}
          >
            <View style={styles.actionIconWrap}>
              <Ionicons name="navigate" size={20} color={theme.colors.primary} />
            </View>
            <Text style={styles.actionText}>Directions</Text>
          </BouncyPressable>

          <BouncyPressable 
            style={styles.actionButton}
            onPress={() => place && onCheckIn?.(place)}
          >
            <View style={[styles.actionIconWrap, { backgroundColor: theme.colors.success + '15' }]}>
              <Ionicons name="checkmark-circle" size={20} color={theme.colors.success} />
            </View>
            <Text style={styles.actionText}>Visited</Text>
          </BouncyPressable>

          <BouncyPressable style={styles.actionButton}>
            <View style={styles.actionIconWrap}>
              <Ionicons name="share-outline" size={20} color={theme.colors.primary} />
            </View>
            <Text style={styles.actionText}>Share</Text>
          </BouncyPressable>

          <BouncyPressable style={styles.actionButton}>
            <View style={styles.actionIconWrap}>
              <Ionicons name="bookmark-outline" size={20} color={theme.colors.primary} />
            </View>
            <Text style={styles.actionText}>Save</Text>
          </BouncyPressable>
        </View>
      </BottomSheetFooter>
    ),
    [place, onDirections, onCheckIn]
  );

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={-1}
      snapPoints={snapPoints}
      onChange={handleSheetChange}
      footerComponent={place ? renderFooter : undefined}
      backdropComponent={null}
      enablePanDownToClose={true}
      backgroundStyle={styles.sheetBackground}
      handleIndicatorStyle={styles.handleIndicator}
      handleStyle={styles.handleStyle}
    >
      {place && (
        <View style={styles.fixedHeader}>
          <View style={styles.headerRow}>
            <Text style={styles.placeName} numberOfLines={1}>{place.name}</Text>
            <BouncyPressable style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
            </BouncyPressable>
          </View>
        </View>
      )}

      <BottomSheetScrollView style={styles.scrollContent}>
        {place ? (
          <>
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

            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={16} color={theme.colors.textSecondary} />
              <Text style={styles.locationText}>
                {place.area_name || place.location_name || 'Unknown location'}
              </Text>
            </View>

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
                  <Ionicons name="image-outline" size={40} color={theme.colors.textSecondary} />
                </View>
              )}
            </RNScrollView>

            {place.description && (
              <View style={styles.insights}>
                <View style={styles.insightsHeader}>
                  <Ionicons name="bookmark" size={16} color={theme.colors.primary} />
                  <Text style={styles.insightsLabel}>
                    {place.source_title ? `Saved from ${place.source_title}` : 'Why you saved this'}
                  </Text>
                </View>
                <Text style={styles.insightsQuote}>"{place.description}"</Text>
              </View>
            )}

            <View style={{ height: 120 }} />
          </>
        ) : null}
      </BottomSheetScrollView>
    </BottomSheet>
  );
});

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: theme.colors.background,
  },
  handleIndicator: {
    backgroundColor: theme.colors.border,
    width: 40,
    height: 5,
    borderRadius: 3,
  },
  handleStyle: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },
  fixedHeader: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 8,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  placeName: {
    fontSize: 24,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    flex: 1,
    marginRight: 12,
  },
  closeButton: {
    padding: 4,
    backgroundColor: theme.colors.backgroundAlt,
    borderRadius: 20,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    flexWrap: 'wrap',
  },
  rating: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginRight: 4,
  },
  metaDot: {
    fontSize: 15,
    color: theme.colors.textTertiary,
    marginHorizontal: 6,
  },
  metaText: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  locationText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginLeft: 6,
    fontWeight: '500',
  },
  photoCarousel: {
    marginBottom: 20,
    marginHorizontal: -20,
  },
  photoCarouselContent: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    gap: 12,
  },
  photo: {
    width: 200,
    height: 140,
    borderRadius: 20,
    backgroundColor: theme.colors.backgroundAlt,
  },
  photoFirst: {
    width: 240,
  },
  photoPlaceholder: {
    width: 240,
    height: 140,
    borderRadius: 20,
    backgroundColor: theme.colors.backgroundAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  insights: {
    backgroundColor: theme.colors.backgroundAlt,
    borderRadius: 24,
    padding: 18,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary,
  },
  insightsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  insightsLabel: {
    fontSize: 14,
    color: theme.colors.textPrimary,
    marginLeft: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  insightsQuote: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
    lineHeight: 22,
    fontWeight: '500',
  },
  footerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    paddingHorizontal: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    backgroundColor: theme.colors.background,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  actionButton: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    minWidth: 80,
  },
  actionIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.backgroundAlt,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: '700',
  },
});

export default PlaceDetailSheet;
