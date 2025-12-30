import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ScrollView,
} from 'react-native';
import { SavedItem } from '../../types';
import { useCheckInStore } from '../../stores/checkInStore';
import { BouncyPressable } from '../../components/BouncyPressable';
import theme from '../../config/theme';
import { Ionicons } from '@expo/vector-icons';
import { GlassCard } from '../../components/GlassCard';

interface CheckInButtonProps {
  item: SavedItem;
  onCheckInComplete?: () => void;
}

export const CheckInButton: React.FC<CheckInButtonProps> = ({ item, onCheckInComplete }) => {
// ...
  const [showModal, setShowModal] = useState(false);
  const [rating, setRating] = useState<number>(0);
  const [note, setNote] = useState('');
  const [cost, setCost] = useState('');
  const [hasCheckedIn, setHasCheckedIn] = useState(false);
  
  const { createCheckIn, isLoading, checkIns, fetchTimeline } = useCheckInStore();

  // Check if already checked in today
  useEffect(() => {
    const today = new Date().toDateString();
    const alreadyCheckedIn = checkIns.some(checkIn => 
      checkIn.saved_item_id === item.id && 
      new Date(checkIn.checked_in_at).toDateString() === today
    );
    setHasCheckedIn(alreadyCheckedIn);
  }, [checkIns, item.id]);

  const handleQuickCheckIn = async () => {
    console.log('[CheckIn] Attempting check-in for:', item.name, item.id);
    try {
      const checkIn = await createCheckIn(item.trip_group_id, {
        savedItemId: item.id,
      });

      if (checkIn) {
        setHasCheckedIn(true);
        Alert.alert('✅ Checked In!', `You're now at ${item.name}`);
        onCheckInComplete?.();
        // Refresh timeline
        fetchTimeline(item.trip_group_id);
      } else {
        console.error('[CheckIn] Failed - no checkIn returned');
        Alert.alert('Error', 'Failed to check in. Please try again.');
      }
    } catch (error) {
      console.error('[CheckIn] Error:', error);
      Alert.alert('Error', 'Failed to check in. Please check your connection.');
    }
  };

  const handleDetailedCheckIn = async () => {
    const checkIn = await createCheckIn(item.trip_group_id, {
      savedItemId: item.id,
      rating: rating || undefined,
      note: note || undefined,
      cost: cost ? parseFloat(cost) : undefined,
      currency: 'JPY', // TODO: Make this dynamic based on trip destination
    });

    if (checkIn) {
      setShowModal(false);
      setHasCheckedIn(true);
      Alert.alert('🎉 Added to Timeline!', 'Your check-in has been saved');
      onCheckInComplete?.();
      
      // Reset form
      setRating(0);
      setNote('');
      setCost('');
      
      // Refresh timeline
      fetchTimeline(item.trip_group_id);
    }
  };

  const renderStars = () => {
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map(star => (
          <TouchableOpacity
            key={star}
            onPress={() => setRating(star)}
            style={styles.starButton}
          >
            <Text style={styles.star}>
              {star <= rating ? '⭐' : '☆'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <>
      <BouncyPressable
        style={[
          styles.checkInButton,
          hasCheckedIn && styles.checkInButtonChecked
        ]}
        onPress={hasCheckedIn ? undefined : handleQuickCheckIn}
        onLongPress={hasCheckedIn ? undefined : () => setShowModal(true)}
        disabled={isLoading || hasCheckedIn}
      >
        <Ionicons 
          name={hasCheckedIn ? "checkmark-circle" : "location"} 
          size={18} 
          color="#FFFFFF" 
        />
        <Text style={[
          styles.checkInText,
          hasCheckedIn && styles.checkInTextChecked
        ]}>
          {hasCheckedIn ? 'Checked In' : 'Check In'}
        </Text>
      </BouncyPressable>

      <Modal
        visible={showModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Check In</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              <View style={styles.placeInfo}>
                <Text style={styles.placeName}>{item.name}</Text>
                <Text style={styles.placeLocation}>{item.location_name}</Text>
              </View>

              {/* Rating */}
              <View style={styles.section}>
                <Text style={styles.label}>How was it?</Text>
                {renderStars()}
              </View>

              {/* Note */}
              <View style={styles.section}>
                <Text style={styles.label}>Quick note (optional)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Amazing food! Must try the..."
                  value={note}
                  onChangeText={setNote}
                  multiline
                  numberOfLines={3}
                />
              </View>

              {/* Cost */}
              <View style={styles.section}>
                <Text style={styles.label}>Cost (optional)</Text>
                <View style={styles.costInput}>
                  <Text style={styles.currencySymbol}>¥</Text>
                  <TextInput
                    style={styles.costField}
                    placeholder="0"
                    value={cost}
                    onChangeText={setCost}
                    keyboardType="numeric"
                  />
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <BouncyPressable
                style={styles.skipButton}
                onPress={handleQuickCheckIn}
              >
                <Text style={styles.skipText}>Skip Details</Text>
              </BouncyPressable>
              
              <BouncyPressable
                style={styles.saveButton}
                onPress={handleDetailedCheckIn}
                disabled={isLoading}
              >
                <Text style={styles.saveText}>
                  {isLoading ? 'Saving...' : 'Save'}
                </Text>
              </BouncyPressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  checkInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.xl,
    gap: 8,
    ...theme.shadows.neopop.sm,
    borderWidth: 2,
    borderColor: theme.colors.borderDark,
  },
  checkInButtonChecked: {
    backgroundColor: theme.colors.success,
    borderColor: theme.colors.borderDark,
  },
  checkInText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  checkInTextChecked: {
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)', // Slate-900 with alpha
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    maxHeight: '85%',
    ...theme.shadows.soft.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  closeButton: {
    fontSize: 20,
    color: theme.colors.textSecondary,
    backgroundColor: theme.colors.backgroundAlt,
    width: 36,
    height: 36,
    borderRadius: 18,
    textAlign: 'center',
    lineHeight: 34,
    overflow: 'hidden',
  },
  modalContent: {
    padding: 24,
  },
  placeInfo: {
    marginBottom: 28,
  },
  placeName: {
    fontSize: 24,
    fontWeight: '900',
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  placeLocation: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  section: {
    marginBottom: 28,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 12,
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  starButton: {
    padding: 4,
  },
  star: {
    fontSize: 36,
  },
  textInput: {
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: theme.colors.border,
    borderRadius: 16,
    padding: 16,
    fontSize: 16,
    color: theme.colors.textPrimary,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  costInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: theme.colors.border,
    borderRadius: 16,
    paddingHorizontal: 16,
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    marginRight: 8,
  },
  costField: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    paddingVertical: 16,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  skipButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: theme.colors.borderDark,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    ...theme.shadows.neopop.sm,
  },
  skipText: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  saveButton: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: theme.colors.borderDark,
    alignItems: 'center',
    ...theme.shadows.neopop.md,
  },
  saveText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});

