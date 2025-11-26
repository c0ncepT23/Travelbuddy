import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  Image,
  Dimensions,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SavedItem } from '../types';
import { useCheckInStore } from '../stores/checkInStore';
import { useXPStore, XP_REWARDS } from '../stores/xpStore';
import theme from '../config/theme';
import { HapticFeedback } from '../utils/haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface EnhancedCheckInModalProps {
  visible: boolean;
  place: SavedItem | null;
  onClose: () => void;
  onCheckInComplete?: (checkIn: any) => void;
}

// Quick review suggestions
const REVIEW_SUGGESTIONS = [
  { label: '🎯 Must try!', text: 'Must try!' },
  { label: '💎 Hidden gem', text: 'Hidden gem!' },
  { label: '⏰ Worth the wait', text: 'Worth the wait!' },
  { label: '🔥 Amazing', text: 'Amazing experience!' },
  { label: '📸 Instagrammable', text: 'Super Instagrammable!' },
  { label: '👎 Overrated', text: 'A bit overrated' },
];

export const EnhancedCheckInModal: React.FC<EnhancedCheckInModalProps> = ({
  visible,
  place,
  onClose,
  onCheckInComplete,
}) => {
  const [step, setStep] = useState<'photo' | 'rating' | 'review' | 'success'>('photo');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { createCheckIn, fetchTimeline } = useCheckInStore();
  const { addXP } = useXPStore();

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setStep('photo');
      setPhotoUri(null);
      setRating(0);
      setReviewText('');
    }
  }, [visible]);

  const requestPermissions = async () => {
    if (Platform.OS !== 'web') {
      const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
      const { status: libraryStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (cameraStatus !== 'granted' || libraryStatus !== 'granted') {
        Alert.alert(
          'Permissions Required',
          'Please grant camera and photo library permissions to add photos to your check-in.'
        );
        return false;
      }
    }
    return true;
  };

  const takePhoto = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setPhotoUri(result.assets[0].uri);
        HapticFeedback.light();
      }
    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('Error', 'Failed to open camera');
    }
  };

  const pickFromGallery = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setPhotoUri(result.assets[0].uri);
        HapticFeedback.light();
      }
    } catch (error) {
      console.error('Gallery error:', error);
      Alert.alert('Error', 'Failed to open gallery');
    }
  };

  const handleSkipPhoto = () => {
    setStep('rating');
  };

  const handlePhotoNext = () => {
    setStep('rating');
  };

  const handleSkipRating = () => {
    setStep('review');
  };

  const handleRatingNext = () => {
    setStep('review');
  };

  const handleSuggestionPress = (suggestion: string) => {
    setReviewText((prev) => {
      if (prev) return prev + ' ' + suggestion;
      return suggestion;
    });
    HapticFeedback.light();
  };

  const handleSubmit = async () => {
    if (!place) return;

    setIsSubmitting(true);
    HapticFeedback.medium();

    try {
      // TODO: Upload photo to storage and get URL
      // For now, we'll pass the local URI
      const photos = photoUri ? [photoUri] : undefined;

      const checkIn = await createCheckIn(place.trip_group_id, {
        savedItemId: place.id,
        rating: rating || undefined,
        note: reviewText || undefined,
        photos,
      });

      if (checkIn) {
        // Award XP
        let xpEarned = XP_REWARDS.VISIT_PLACE;
        if (photoUri) xpEarned += 10; // Bonus for photo
        if (rating) xpEarned += 5; // Bonus for rating
        if (reviewText) xpEarned += 5; // Bonus for review
        addXP(xpEarned);

        // Show success
        setStep('success');
        HapticFeedback.success();

        // Refresh timeline
        fetchTimeline(place.trip_group_id);

        // Callback after delay
        setTimeout(() => {
          onCheckInComplete?.(checkIn);
          onClose();
        }, 2000);
      } else {
        Alert.alert('Error', 'Failed to check in. Please try again.');
        setIsSubmitting(false);
      }
    } catch (error) {
      console.error('Check-in error:', error);
      Alert.alert('Error', 'Failed to check in. Please try again.');
      setIsSubmitting(false);
    }
  };

  const handleQuickCheckIn = async () => {
    if (!place) return;

    setIsSubmitting(true);
    HapticFeedback.medium();

    try {
      const checkIn = await createCheckIn(place.trip_group_id, {
        savedItemId: place.id,
      });

      if (checkIn) {
        addXP(XP_REWARDS.VISIT_PLACE);
        setStep('success');
        HapticFeedback.success();
        fetchTimeline(place.trip_group_id);

        setTimeout(() => {
          onCheckInComplete?.(checkIn);
          onClose();
        }, 2000);
      } else {
        Alert.alert('Error', 'Failed to check in. Please try again.');
        setIsSubmitting(false);
      }
    } catch (error) {
      console.error('Check-in error:', error);
      Alert.alert('Error', 'Failed to check in. Please try again.');
      setIsSubmitting(false);
    }
  };

  const renderStars = () => {
    return (
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            onPress={() => {
              setRating(star);
              HapticFeedback.light();
            }}
            style={styles.starButton}
          >
            <Text style={[styles.star, star <= rating && styles.starActive]}>
              {star <= rating ? '★' : '☆'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderPhotoStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>📸 Add a Photo</Text>
      <Text style={styles.stepSubtitle}>Capture this moment!</Text>

      {photoUri ? (
        <View style={styles.photoPreviewContainer}>
          <Image source={{ uri: photoUri }} style={styles.photoPreview} />
          <TouchableOpacity
            style={styles.removePhotoButton}
            onPress={() => setPhotoUri(null)}
          >
            <Text style={styles.removePhotoText}>✕</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.photoPlaceholder}>
          <Text style={styles.placeholderEmoji}>📷</Text>
          <Text style={styles.placeholderText}>No photo yet</Text>
        </View>
      )}

      <View style={styles.photoButtons}>
        <TouchableOpacity style={styles.cameraButton} onPress={takePhoto}>
          <Text style={styles.buttonIcon}>📸</Text>
          <Text style={styles.buttonText}>Camera</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.galleryButton} onPress={pickFromGallery}>
          <Text style={styles.buttonIcon}>🖼️</Text>
          <Text style={styles.buttonText}>Gallery</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.navigationButtons}>
        <TouchableOpacity style={styles.skipButton} onPress={handleSkipPhoto}>
          <Text style={styles.skipButtonText}>Skip</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.nextButton, !photoUri && styles.nextButtonDisabled]}
          onPress={handlePhotoNext}
          disabled={!photoUri}
        >
          <Text style={styles.nextButtonText}>Next →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderRatingStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>⭐ How was it?</Text>
      <Text style={styles.stepSubtitle}>Rate your experience</Text>

      {renderStars()}

      <Text style={styles.ratingLabel}>
        {rating === 0 && 'Tap to rate'}
        {rating === 1 && '😞 Not great'}
        {rating === 2 && '😐 Okay'}
        {rating === 3 && '🙂 Good'}
        {rating === 4 && '😊 Great!'}
        {rating === 5 && '🤩 Amazing!'}
      </Text>

      <View style={styles.navigationButtons}>
        <TouchableOpacity style={styles.skipButton} onPress={handleSkipRating}>
          <Text style={styles.skipButtonText}>Skip</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.nextButton, rating === 0 && styles.nextButtonDisabled]}
          onPress={handleRatingNext}
          disabled={rating === 0}
        >
          <Text style={styles.nextButtonText}>Next →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderReviewStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>💬 Quick Thoughts</Text>
      <Text style={styles.stepSubtitle}>Share your experience (optional)</Text>

      <TextInput
        style={styles.reviewInput}
        placeholder="What did you think?"
        value={reviewText}
        onChangeText={setReviewText}
        multiline
        numberOfLines={3}
        maxLength={200}
        placeholderTextColor={theme.colors.textTertiary}
      />
      <Text style={styles.charCount}>{reviewText.length}/200</Text>

      <Text style={styles.suggestionsLabel}>💡 Quick suggestions:</Text>
      <View style={styles.suggestionsRow}>
        {REVIEW_SUGGESTIONS.map((suggestion, index) => (
          <TouchableOpacity
            key={index}
            style={styles.suggestionChip}
            onPress={() => handleSuggestionPress(suggestion.text)}
          >
            <Text style={styles.suggestionText}>{suggestion.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.navigationButtons}>
        <TouchableOpacity style={styles.skipButton} onPress={handleSubmit}>
          <Text style={styles.skipButtonText}>Skip & Save</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.submitButton}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color={theme.colors.textInverse} />
          ) : (
            <Text style={styles.submitButtonText}>✓ Check In</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderSuccessStep = () => (
    <View style={styles.successContainer}>
      <Text style={styles.successEmoji}>🎉</Text>
      <Text style={styles.successTitle}>Checked In!</Text>
      <Text style={styles.successSubtitle}>at {place?.name}</Text>

      {photoUri && (
        <Image source={{ uri: photoUri }} style={styles.successPhoto} />
      )}

      <View style={styles.xpBadge}>
        <Text style={styles.xpText}>
          +{XP_REWARDS.VISIT_PLACE + (photoUri ? 10 : 0) + (rating ? 5 : 0) + (reviewText ? 5 : 0)} XP
        </Text>
      </View>
    </View>
  );

  if (!place) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerInfo}>
              <Text style={styles.headerLabel}>CHECK IN AT</Text>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {place.name}
              </Text>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Progress indicator */}
          {step !== 'success' && (
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width:
                      step === 'photo'
                        ? '33%'
                        : step === 'rating'
                        ? '66%'
                        : '100%',
                  },
                ]}
              />
            </View>
          )}

          {/* Content */}
          <View style={styles.contentWrapper}>
            <ScrollView
              style={styles.content}
              contentContainerStyle={styles.contentInner}
              showsVerticalScrollIndicator={false}
            >
              {step === 'photo' && renderPhotoStep()}
              {step === 'rating' && renderRatingStep()}
              {step === 'review' && renderReviewStep()}
              {step === 'success' && renderSuccessStep()}
            </ScrollView>
          </View>

          {/* Quick check-in option */}
          {step !== 'success' && (
            <TouchableOpacity
              style={styles.quickCheckInButton}
              onPress={handleQuickCheckIn}
              disabled={isSubmitting}
            >
              <Text style={styles.quickCheckInText}>
                ⚡ Quick check-in (skip all)
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderRightWidth: 3,
    borderColor: theme.colors.borderDark,
    maxHeight: '85%',
    minHeight: 500,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.border,
  },
  headerInfo: {
    flex: 1,
  },
  headerLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textTertiary,
    letterSpacing: 1,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: theme.colors.textPrimary,
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
  progressBar: {
    height: 4,
    backgroundColor: theme.colors.border,
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
  },
  contentWrapper: {
    flex: 1,
    minHeight: 350,
  },
  content: {
    flex: 1,
  },
  contentInner: {
    padding: 20,
    paddingBottom: 40,
    flexGrow: 1,
  },
  stepContainer: {
    alignItems: 'center',
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: theme.colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  stepSubtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    marginBottom: 24,
    textAlign: 'center',
  },

  // Photo step
  photoPreviewContainer: {
    position: 'relative',
    marginBottom: 20,
  },
  photoPreview: {
    width: SCREEN_WIDTH - 80,
    height: (SCREEN_WIDTH - 80) * 0.75,
    borderWidth: 3,
    borderColor: theme.colors.borderDark,
  },
  removePhotoButton: {
    position: 'absolute',
    top: -12,
    right: -12,
    width: 32,
    height: 32,
    backgroundColor: theme.colors.error,
    borderWidth: 2,
    borderColor: theme.colors.borderDark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removePhotoText: {
    color: theme.colors.textInverse,
    fontSize: 16,
    fontWeight: '700',
  },
  photoPlaceholder: {
    width: SCREEN_WIDTH - 80,
    height: (SCREEN_WIDTH - 80) * 0.75,
    backgroundColor: theme.colors.backgroundAlt,
    borderWidth: 3,
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  placeholderEmoji: {
    fontSize: 48,
    marginBottom: 8,
    opacity: 0.5,
  },
  placeholderText: {
    fontSize: 16,
    color: theme.colors.textTertiary,
  },
  photoButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  cameraButton: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    paddingVertical: 16,
    borderWidth: 3,
    borderColor: theme.colors.borderDark,
    alignItems: 'center',
    ...theme.shadows.neopop.sm,
  },
  galleryButton: {
    flex: 1,
    backgroundColor: theme.colors.secondary,
    paddingVertical: 16,
    borderWidth: 3,
    borderColor: theme.colors.borderDark,
    alignItems: 'center',
    ...theme.shadows.neopop.sm,
  },
  buttonIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },

  // Rating step
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  starButton: {
    padding: 8,
  },
  star: {
    fontSize: 40,
    color: theme.colors.border,
  },
  starActive: {
    color: theme.colors.secondary,
  },
  ratingLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    marginBottom: 32,
  },

  // Review step
  reviewInput: {
    width: '100%',
    minHeight: 100,
    backgroundColor: theme.colors.backgroundAlt,
    borderWidth: 2,
    borderColor: theme.colors.borderDark,
    padding: 16,
    fontSize: 16,
    color: theme.colors.textPrimary,
    textAlignVertical: 'top',
    marginBottom: 8,
  },
  charCount: {
    fontSize: 12,
    color: theme.colors.textTertiary,
    alignSelf: 'flex-end',
    marginBottom: 16,
  },
  suggestionsLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  suggestionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  suggestionChip: {
    backgroundColor: theme.colors.backgroundAlt,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  suggestionText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },

  // Navigation buttons
  navigationButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  skipButton: {
    flex: 1,
    paddingVertical: 16,
    borderWidth: 2,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  skipButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  nextButton: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    paddingVertical: 16,
    borderWidth: 3,
    borderColor: theme.colors.borderDark,
    alignItems: 'center',
    ...theme.shadows.neopop.sm,
  },
  nextButtonDisabled: {
    opacity: 0.5,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.textInverse,
  },
  submitButton: {
    flex: 1,
    backgroundColor: theme.colors.success,
    paddingVertical: 16,
    borderWidth: 3,
    borderColor: theme.colors.borderDark,
    alignItems: 'center',
    ...theme.shadows.neopop.sm,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.textInverse,
  },

  // Success step
  successContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  successEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    marginBottom: 24,
  },
  successPhoto: {
    width: SCREEN_WIDTH - 120,
    height: (SCREEN_WIDTH - 120) * 0.75,
    borderWidth: 3,
    borderColor: theme.colors.borderDark,
    marginBottom: 24,
  },
  xpBadge: {
    backgroundColor: theme.colors.secondary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderWidth: 3,
    borderColor: theme.colors.borderDark,
    ...theme.shadows.neopop.sm,
  },
  xpText: {
    fontSize: 20,
    fontWeight: '900',
    color: theme.colors.textPrimary,
  },

  // Quick check-in
  quickCheckInButton: {
    paddingVertical: 16,
    borderTopWidth: 2,
    borderTopColor: theme.colors.border,
    alignItems: 'center',
  },
  quickCheckInText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textTertiary,
  },
});

