/**
 * Share Trip Selector Modal
 * Shows when user shares content from another app (YouTube, Instagram, etc.)
 * Allows user to select which trip to add the shared content to
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  Linking,
} from 'react-native';
import { MotiView } from 'moti';
import { HapticFeedback } from '../utils/haptics';
import { useTripStore } from '../stores/tripStore';
import { SharedContent } from '../services/shareIntent.service';
import shareIntentService from '../services/shareIntent.service';
import api from '../config/api';
import theme from '../config/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ShareTripSelectorModalProps {
  sharedContent: SharedContent;
  onClose: () => void;
  onSuccess: (tripId: string) => void;
}

export const ShareTripSelectorModal: React.FC<ShareTripSelectorModalProps> = ({
  sharedContent,
  onClose,
  onSuccess,
}) => {
  const { trips, fetchTrips, isLoading: tripsLoading } = useTripStore();
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Detect platform from shared URL
  const platform = shareIntentService.constructor.prototype.constructor.name === 'ShareIntentService' 
    ? 'unknown' 
    : 'web';
  const detectedPlatform = sharedContent.type === 'url' 
    ? (shareIntentService as any).constructor.detectPlatform?.(sharedContent.data) || detectPlatformFromUrl(sharedContent.data)
    : 'unknown';
  
  const platformIcon = getPlatformIcon(detectedPlatform);
  const platformName = getPlatformName(detectedPlatform);

  useEffect(() => {
    fetchTrips();
  }, []);

  // Auto-select first trip if only one exists
  useEffect(() => {
    if (trips.length === 1 && !selectedTripId) {
      setSelectedTripId(trips[0].id);
    }
  }, [trips]);

  const handleProcessLink = async () => {
    if (!selectedTripId) {
      setError('Please select a trip first');
      return;
    }

    HapticFeedback.medium();
    setIsProcessing(true);
    setError(null);

    try {
      // Send message to the trip chat to process the link
      const response = await api.post(`/trips/${selectedTripId}/chat`, {
        content: sharedContent.data,
        messageType: 'text',
      });

      if (response.data.success) {
        HapticFeedback.success();
        onSuccess(selectedTripId);
      } else {
        throw new Error(response.data.error || 'Failed to process link');
      }
    } catch (err: any) {
      console.error('[ShareModal] Process error:', err);
      setError(err.response?.data?.error || err.message || 'Failed to process link');
      HapticFeedback.error();
    } finally {
      setIsProcessing(false);
    }
  };

  const truncateUrl = (url: string, maxLength: number = 50) => {
    if (url.length <= maxLength) return url;
    return url.substring(0, maxLength - 3) + '...';
  };

  return (
    <View style={styles.overlay}>
      <TouchableOpacity 
        style={styles.backdrop} 
        activeOpacity={1} 
        onPress={onClose}
      />
      
      <MotiView
        from={{ translateY: SCREEN_HEIGHT, opacity: 0 }}
        animate={{ translateY: 0, opacity: 1 }}
        exit={{ translateY: SCREEN_HEIGHT, opacity: 0 }}
        transition={{ type: 'spring', damping: 20 }}
        style={styles.modal}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.platformIcon}>{platformIcon}</Text>
            <View>
              <Text style={styles.headerTitle}>Save to Trip</Text>
              <Text style={styles.headerSubtitle}>{platformName} content</Text>
            </View>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Shared Link Preview */}
        <View style={styles.linkPreview}>
          <Text style={styles.linkLabel}>SHARED LINK</Text>
          <TouchableOpacity 
            style={styles.linkBox}
            onPress={() => Linking.openURL(sharedContent.data)}
          >
            <Text style={styles.linkText} numberOfLines={2}>
              {truncateUrl(sharedContent.data, 80)}
            </Text>
            <Text style={styles.linkAction}>↗</Text>
          </TouchableOpacity>
        </View>

        {/* Trip Selection */}
        <View style={styles.tripSection}>
          <Text style={styles.sectionTitle}>Select Trip</Text>
          
          {tripsLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
              <Text style={styles.loadingText}>Loading trips...</Text>
            </View>
          ) : trips.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyText}>No trips yet</Text>
              <Text style={styles.emptySubtext}>Create a trip first to save places</Text>
            </View>
          ) : (
            <ScrollView 
              style={styles.tripList}
              showsVerticalScrollIndicator={false}
            >
              {trips.map((trip) => (
                <TouchableOpacity
                  key={trip.id}
                  style={[
                    styles.tripItem,
                    selectedTripId === trip.id && styles.tripItemSelected,
                  ]}
                  onPress={() => {
                    HapticFeedback.light();
                    setSelectedTripId(trip.id);
                    setError(null);
                  }}
                  activeOpacity={0.8}
                >
                  <View style={styles.tripItemLeft}>
                    <Text style={styles.tripEmoji}>✈️</Text>
                    <View>
                      <Text style={[
                        styles.tripName,
                        selectedTripId === trip.id && styles.tripNameSelected,
                      ]}>
                        {trip.name}
                      </Text>
                      <Text style={styles.tripDestination}>{trip.destination}</Text>
                    </View>
                  </View>
                  {selectedTripId === trip.id && (
                    <View style={styles.checkmark}>
                      <Text style={styles.checkmarkText}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Error Message */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>⚠️ {error}</Text>
          </View>
        )}

        {/* Action Button */}
        <TouchableOpacity
          style={[
            styles.processButton,
            (!selectedTripId || isProcessing) && styles.processButtonDisabled,
          ]}
          onPress={handleProcessLink}
          disabled={!selectedTripId || isProcessing}
          activeOpacity={0.8}
        >
          {isProcessing ? (
            <View style={styles.processingContent}>
              <ActivityIndicator size="small" color={theme.colors.textInverse} />
              <Text style={styles.processButtonText}>Processing...</Text>
            </View>
          ) : (
            <Text style={styles.processButtonText}>
              ✨ Add to Trip
            </Text>
          )}
        </TouchableOpacity>

        {/* Info Text */}
        <Text style={styles.infoText}>
          The AI will extract places from this link and add them to your trip
        </Text>
      </MotiView>
    </View>
  );
};

// Helper functions
function detectPlatformFromUrl(url: string): string {
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) return 'youtube';
  if (lowerUrl.includes('instagram.com')) return 'instagram';
  if (lowerUrl.includes('reddit.com')) return 'reddit';
  if (lowerUrl.includes('tiktok.com')) return 'tiktok';
  return 'web';
}

function getPlatformIcon(platform: string): string {
  switch (platform) {
    case 'youtube': return '📺';
    case 'instagram': return '📷';
    case 'reddit': return '💬';
    case 'tiktok': return '🎵';
    case 'web': return '🌐';
    default: return '🔗';
  }
}

function getPlatformName(platform: string): string {
  switch (platform) {
    case 'youtube': return 'YouTube';
    case 'instagram': return 'Instagram';
    case 'reddit': return 'Reddit';
    case 'tiktok': return 'TikTok';
    case 'web': return 'Web Link';
    default: return 'Link';
  }
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    zIndex: 9999,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  modal: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    paddingHorizontal: 20,
    paddingBottom: 40,
    maxHeight: SCREEN_HEIGHT * 0.85,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderRightWidth: 3,
    borderColor: theme.colors.borderDark,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.border,
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  platformIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: theme.colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  closeButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  linkPreview: {
    marginBottom: 20,
  },
  linkLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.colors.textSecondary,
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  linkBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    padding: 12,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  linkText: {
    flex: 1,
    fontSize: 13,
    color: theme.colors.primary,
    fontWeight: '500',
  },
  linkAction: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    marginLeft: 8,
  },
  tripSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    marginBottom: 12,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginLeft: 12,
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: theme.colors.background,
    borderRadius: 12,
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  tripList: {
    maxHeight: 200,
  },
  tripItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.background,
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  tripItemSelected: {
    backgroundColor: theme.colors.primaryLight,
    borderColor: theme.colors.primary,
  },
  tripItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  tripEmoji: {
    fontSize: 24,
    marginRight: 12,
  },
  tripName: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  tripNameSelected: {
    color: theme.colors.primary,
  },
  tripDestination: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  checkmark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkText: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.textInverse,
  },
  errorContainer: {
    backgroundColor: '#FEE2E2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 13,
    color: '#DC2626',
    fontWeight: '600',
    textAlign: 'center',
  },
  processButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: theme.colors.borderDark,
    ...theme.shadows.neopop.sm,
  },
  processButtonDisabled: {
    backgroundColor: theme.colors.border,
    borderColor: theme.colors.border,
  },
  processingContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  processButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.textInverse,
    marginLeft: 8,
  },
  infoText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 12,
    fontWeight: '500',
  },
});

export default ShareTripSelectorModal;

