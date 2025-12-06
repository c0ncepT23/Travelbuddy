import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSegmentStore, CreateSegmentInput } from '../../stores/segmentStore';
import { useTripStore } from '../../stores/tripStore';
import { TripSegment } from '../../types';
import theme from '../../config/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface SegmentDraft {
  id: string;
  city: string;
  startDate: Date | null;
  endDate: Date | null;
  accommodationName: string;
  isNew: boolean;
  existingSegment?: TripSegment;
}

export default function ItinerarySetupScreen({ route, navigation }: any) {
  const { tripId, isInitialSetup = false } = route.params;
  const { currentTrip } = useTripStore();
  const { segments, fetchSegments, addSegment, updateSegment, deleteSegment, isLoading } = useSegmentStore();
  
  const [drafts, setDrafts] = useState<SegmentDraft[]>([]);
  const [showDatePicker, setShowDatePicker] = useState<{ draftId: string; field: 'start' | 'end' } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadExistingSegments();
  }, [tripId]);

  const loadExistingSegments = async () => {
    try {
      const existingSegments = await fetchSegments(tripId);
      
      if (existingSegments.length > 0) {
        // Convert existing segments to drafts
        const existingDrafts: SegmentDraft[] = existingSegments.map(seg => ({
          id: seg.id,
          city: seg.city,
          startDate: new Date(seg.start_date),
          endDate: new Date(seg.end_date),
          accommodationName: seg.accommodation_name || '',
          isNew: false,
          existingSegment: seg,
        }));
        setDrafts(existingDrafts);
      } else {
        // Start with one empty draft
        addNewDraft();
      }
    } catch (error) {
      console.error('Failed to load segments:', error);
      addNewDraft();
    }
  };

  const addNewDraft = () => {
    const newDraft: SegmentDraft = {
      id: `draft-${Date.now()}`,
      city: '',
      startDate: null,
      endDate: null,
      accommodationName: '',
      isNew: true,
    };
    setDrafts(prev => [...prev, newDraft]);
  };

  const updateDraft = (draftId: string, field: keyof SegmentDraft, value: any) => {
    setDrafts(prev => prev.map(d => 
      d.id === draftId ? { ...d, [field]: value } : d
    ));
  };

  const removeDraft = (draftId: string) => {
    const draft = drafts.find(d => d.id === draftId);
    
    if (draft && !draft.isNew && draft.existingSegment) {
      // Confirm deletion of existing segment
      Alert.alert(
        'Delete Segment',
        `Remove ${draft.city} from your itinerary?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await deleteSegment(tripId, draft.existingSegment!.id);
                setDrafts(prev => prev.filter(d => d.id !== draftId));
              } catch (error) {
                Alert.alert('Error', 'Failed to delete segment');
              }
            },
          },
        ]
      );
    } else {
      // Just remove draft
      setDrafts(prev => prev.filter(d => d.id !== draftId));
    }
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(null);
    }
    
    if (selectedDate && showDatePicker) {
      const { draftId, field } = showDatePicker;
      updateDraft(draftId, field === 'start' ? 'startDate' : 'endDate', selectedDate);
    }
  };

  const closeDatePicker = () => {
    setShowDatePicker(null);
  };

  const formatDate = (date: Date | null) => {
    if (!date) return 'Select';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const validateAndSave = async () => {
    // Filter drafts that have at least city and dates
    const validDrafts = drafts.filter(d => d.city && d.startDate && d.endDate);
    
    if (validDrafts.length === 0 && isInitialSetup) {
      Alert.alert('Add at least one city', 'Please add at least one city to your itinerary, or tap Skip.');
      return;
    }

    setIsSaving(true);

    try {
      for (const draft of validDrafts) {
        if (draft.isNew) {
          // Create new segment
          const input: CreateSegmentInput = {
            city: draft.city,
            startDate: draft.startDate!.toISOString().split('T')[0],
            endDate: draft.endDate!.toISOString().split('T')[0],
            accommodationName: draft.accommodationName || undefined,
          };
          await addSegment(tripId, input);
        } else if (draft.existingSegment) {
          // Update existing segment
          const updates: Partial<TripSegment> = {
            city: draft.city,
            start_date: draft.startDate!,
            end_date: draft.endDate!,
            accommodation_name: draft.accommodationName || undefined,
          };
          await updateSegment(tripId, draft.existingSegment.id, updates);
        }
      }

      // Navigate back or to trip home
      if (isInitialSetup) {
        navigation.replace('TripTab', { tripId, tripName: currentTrip?.name });
      } else {
        navigation.goBack();
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save itinerary');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSkip = () => {
    navigation.replace('TripTab', { tripId, tripName: currentTrip?.name });
  };

  const renderSegmentCard = (draft: SegmentDraft, index: number) => {
    const canDelete = drafts.length > 1 || !draft.isNew;

    return (
      <View key={draft.id} style={styles.segmentCard}>
        {/* Card Header */}
        <View style={styles.cardHeader}>
          <View style={styles.cardNumber}>
            <Text style={styles.cardNumberText}>{index + 1}</Text>
          </View>
          <Text style={styles.cardTitle}>
            {draft.city || `City ${index + 1}`}
          </Text>
          {canDelete && (
            <TouchableOpacity 
              style={styles.deleteButton}
              onPress={() => removeDraft(draft.id)}
            >
              <Ionicons name="trash-outline" size={18} color="#EF4444" />
            </TouchableOpacity>
          )}
        </View>

        {/* City Input */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>City / Area</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="location-outline" size={20} color="#6B7280" style={styles.inputIcon} />
            <TextInput
              style={styles.textInput}
              placeholder="e.g., Mumbai, Tokyo, Bangkok..."
              placeholderTextColor="#9CA3AF"
              value={draft.city}
              onChangeText={(text) => updateDraft(draft.id, 'city', text)}
            />
          </View>
        </View>

        {/* Date Row */}
        <View style={styles.dateRow}>
          <View style={styles.dateGroup}>
            <Text style={styles.inputLabel}>From</Text>
            <TouchableOpacity 
              style={styles.dateButton}
              onPress={() => setShowDatePicker({ draftId: draft.id, field: 'start' })}
            >
              <Ionicons name="calendar-outline" size={18} color="#3B82F6" />
              <Text style={[styles.dateText, !draft.startDate && styles.datePlaceholder]}>
                {formatDate(draft.startDate)}
              </Text>
            </TouchableOpacity>
          </View>

          <Ionicons name="arrow-forward" size={20} color="#CBD5E1" style={styles.dateArrow} />

          <View style={styles.dateGroup}>
            <Text style={styles.inputLabel}>To</Text>
            <TouchableOpacity 
              style={styles.dateButton}
              onPress={() => setShowDatePicker({ draftId: draft.id, field: 'end' })}
            >
              <Ionicons name="calendar-outline" size={18} color="#3B82F6" />
              <Text style={[styles.dateText, !draft.endDate && styles.datePlaceholder]}>
                {formatDate(draft.endDate)}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Hotel Input (Optional) */}
        <View style={styles.inputGroup}>
          <View style={styles.labelRow}>
            <Text style={styles.inputLabel}>Where are you staying?</Text>
            <Text style={styles.optionalLabel}>Optional</Text>
          </View>
          <View style={styles.inputContainer}>
            <Ionicons name="bed-outline" size={20} color="#6B7280" style={styles.inputIcon} />
            <TextInput
              style={styles.textInput}
              placeholder="Hotel name (helps with nearby recommendations)"
              placeholderTextColor="#9CA3AF"
              value={draft.accommodationName}
              onChangeText={(text) => updateDraft(draft.id, 'accommodationName', text)}
            />
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={['#0F172A', '#1E293B']}
        style={styles.header}
      >
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>
            {isInitialSetup ? 'Set Up Your Trip' : 'Edit Itinerary'}
          </Text>
          <Text style={styles.headerSubtitle}>
            {currentTrip?.destination || 'Add your cities and dates'}
          </Text>
        </View>

        {isInitialSetup && (
          <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        )}
      </LinearGradient>

      {/* Content */}
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Info Card */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={22} color="#3B82F6" />
          <Text style={styles.infoText}>
            Adding your hotel helps us recommend nearby places and give you morning briefings!
          </Text>
        </View>

        {/* Segment Cards */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3B82F6" />
          </View>
        ) : (
          drafts.map((draft, index) => renderSegmentCard(draft, index))
        )}

        {/* Add Another City Button */}
        <TouchableOpacity style={styles.addCityButton} onPress={addNewDraft}>
          <Ionicons name="add-circle-outline" size={24} color="#3B82F6" />
          <Text style={styles.addCityText}>Add Another City</Text>
        </TouchableOpacity>

        {/* Bottom spacing */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom Action */}
      <View style={styles.bottomBar}>
        <TouchableOpacity 
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          onPress={validateAndSave}
          disabled={isSaving}
        >
          <LinearGradient
            colors={['#3B82F6', '#2563EB']}
            style={styles.saveButtonGradient}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={22} color="#FFFFFF" />
                <Text style={styles.saveButtonText}>
                  {isInitialSetup ? "Let's Go!" : 'Save Changes'}
                </Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Date Picker Modal */}
      {showDatePicker && (
        <View style={styles.datePickerOverlay}>
          <View style={styles.datePickerContainer}>
            <View style={styles.datePickerHeader}>
              <Text style={styles.datePickerTitle}>
                Select {showDatePicker.field === 'start' ? 'Start' : 'End'} Date
              </Text>
              <TouchableOpacity onPress={closeDatePicker}>
                <Ionicons name="close" size={24} color="#1F2937" />
              </TouchableOpacity>
            </View>
            <DateTimePicker
              value={
                showDatePicker.field === 'start'
                  ? drafts.find(d => d.id === showDatePicker.draftId)?.startDate || new Date()
                  : drafts.find(d => d.id === showDatePicker.draftId)?.endDate || new Date()
              }
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleDateChange}
              minimumDate={new Date()}
            />
            {Platform.OS === 'ios' && (
              <TouchableOpacity style={styles.datePickerDone} onPress={closeDatePicker}>
                <Text style={styles.datePickerDoneText}>Done</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },

  // Header
  header: {
    paddingTop: 50,
    paddingBottom: 24,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContent: {
    flex: 1,
    marginLeft: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  skipButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
  },
  skipText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
  },

  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },

  // Info Card
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    padding: 14,
    borderRadius: 12,
    marginBottom: 20,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#1E40AF',
    lineHeight: 18,
  },

  // Loading
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },

  // Segment Card
  segmentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  cardNumber: {
    width: 32,
    height: 32,
    backgroundColor: '#3B82F6',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardNumberText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cardTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  deleteButton: {
    width: 36,
    height: 36,
    backgroundColor: '#FEF2F2',
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Input
  inputGroup: {
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
  },
  optionalLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#9CA3AF',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
  },
  inputIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
    paddingVertical: 14,
  },

  // Date Row
  dateRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  dateGroup: {
    flex: 1,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 8,
  },
  dateText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  datePlaceholder: {
    color: '#9CA3AF',
    fontWeight: '500',
  },
  dateArrow: {
    marginHorizontal: 12,
    marginBottom: 14,
  },

  // Add City Button
  addCityButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    borderRadius: 16,
    gap: 8,
    marginTop: 8,
  },
  addCityText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3B82F6',
  },

  // Bottom Bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 34,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 10,
  },
  saveButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  saveButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Date Picker
  datePickerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  datePickerContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 34,
  },
  datePickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  datePickerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  datePickerDone: {
    alignItems: 'center',
    padding: 16,
  },
  datePickerDoneText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#3B82F6',
  },
});

