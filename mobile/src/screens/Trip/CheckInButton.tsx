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

interface CheckInButtonProps {
  item: SavedItem;
  onCheckInComplete?: () => void;
}

export const CheckInButton: React.FC<CheckInButtonProps> = ({ item, onCheckInComplete }) => {
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
      <TouchableOpacity
        style={[
          styles.checkInButton,
          hasCheckedIn && styles.checkInButtonChecked
        ]}
        onPress={hasCheckedIn ? undefined : handleQuickCheckIn}
        onLongPress={hasCheckedIn ? undefined : () => setShowModal(true)}
        disabled={isLoading || hasCheckedIn}
      >
        <Text style={styles.checkInIcon}>
          {hasCheckedIn ? '✅' : '📍'}
        </Text>
        <Text style={[
          styles.checkInText,
          hasCheckedIn && styles.checkInTextChecked
        ]}>
          {hasCheckedIn ? 'Checked In' : 'Check In'}
        </Text>
      </TouchableOpacity>

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
              <TouchableOpacity
                style={styles.skipButton}
                onPress={handleQuickCheckIn}
              >
                <Text style={styles.skipText}>Skip Details</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleDetailedCheckIn}
                disabled={isLoading}
              >
                <Text style={styles.saveText}>
                  {isLoading ? 'Saving...' : 'Save'}
                </Text>
              </TouchableOpacity>
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
    backgroundColor: '#6366F1',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  checkInButtonChecked: {
    backgroundColor: '#10B981',
    opacity: 0.8,
  },
  checkInIcon: {
    fontSize: 16,
  },
  checkInText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  checkInTextChecked: {
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  closeButton: {
    fontSize: 24,
    color: '#6B7280',
  },
  modalContent: {
    padding: 20,
  },
  placeInfo: {
    marginBottom: 24,
  },
  placeName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  placeLocation: {
    fontSize: 14,
    color: '#6B7280',
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  starButton: {
    padding: 4,
  },
  star: {
    fontSize: 32,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#111827',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  costInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  currencySymbol: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
    marginRight: 8,
  },
  costField: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
    paddingVertical: 12,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  skipButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
  },
  skipText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#6366F1',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

