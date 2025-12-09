import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTripStore } from '../../stores/tripStore';

// For mobile, we'll use conditional import
const DateTimePicker = Platform.OS !== 'web' 
  ? require('@react-native-community/datetimepicker').default 
  : null;

export default function CreateTripScreen({ navigation }: any) {
  const [name, setName] = useState('');
  const [destination, setDestination] = useState('');
  const [knowsDates, setKnowsDates] = useState(false);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const { createTrip, isLoading } = useTripStore();

  const formatDate = (date: Date | null) => {
    if (!date) return '';
    return date.toISOString().split('T')[0];
  };

  const formatDisplayDate = (date: Date | null) => {
    if (!date) return 'Select date';
    return date.toLocaleDateString('en-US', { 
      weekday: 'short',
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const handleCreate = async () => {
    if (!name.trim() || !destination.trim()) {
      if (Platform.OS === 'web') {
        window.alert('Please fill in trip name and destination');
      } else {
        Alert.alert('Missing Info', 'Please add a trip name and destination');
      }
      return;
    }

    try {
      const trip = await createTrip({
        name: name.trim(),
        destination: destination.trim(),
        startDate: knowsDates && startDate ? formatDate(startDate) : undefined,
        endDate: knowsDates && endDate ? formatDate(endDate) : undefined,
      });

      if (Platform.OS === 'web') {
        navigation.navigate('TripHome', { tripId: trip.id });
      } else {
        // Go straight to the trip - no itinerary prompt
        navigation.replace('TripHome', { tripId: trip.id });
      }
    } catch (error: any) {
      if (Platform.OS === 'web') {
        window.alert(error.message);
      } else {
        Alert.alert('Error', error.message);
      }
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          {/* Icon */}
          <View style={styles.iconContainer}>
            <View style={styles.iconBox}>
              <Text style={styles.icon}>✈️</Text>
            </View>
            <Text style={styles.subtitle}>Start planning your adventure</Text>
          </View>

          {/* Trip Name */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Trip Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Thailand Adventure"
              value={name}
              onChangeText={setName}
              placeholderTextColor="#9CA3AF"
            />
          </View>

          {/* Destination */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Destination</Text>
            <View style={styles.inputWithIcon}>
              <Ionicons name="location" size={20} color="#3B82F6" style={styles.inputIcon} />
              <TextInput
                style={styles.inputWithIconField}
                placeholder="e.g., Bangkok, Thailand"
                value={destination}
                onChangeText={setDestination}
                placeholderTextColor="#9CA3AF"
              />
            </View>
          </View>

          {/* Dates Toggle Section */}
          <View style={styles.datesSection}>
            <Text style={styles.label}>Travel Dates</Text>
            <Text style={styles.labelHint}>You can always add or change dates later</Text>
            
            {/* Toggle Options */}
            <View style={styles.dateToggleContainer}>
              <TouchableOpacity 
                style={[
                  styles.dateToggleOption, 
                  !knowsDates && styles.dateToggleOptionActive
                ]}
                onPress={() => setKnowsDates(false)}
              >
                <Ionicons 
                  name={!knowsDates ? "checkmark-circle" : "ellipse-outline"} 
                  size={22} 
                  color={!knowsDates ? "#3B82F6" : "#94A3B8"} 
                />
                <Text style={[
                  styles.dateToggleText,
                  !knowsDates && styles.dateToggleTextActive
                ]}>
                  I'll add dates later
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[
                  styles.dateToggleOption, 
                  knowsDates && styles.dateToggleOptionActive
                ]}
                onPress={() => setKnowsDates(true)}
              >
                <Ionicons 
                  name={knowsDates ? "checkmark-circle" : "ellipse-outline"} 
                  size={22} 
                  color={knowsDates ? "#3B82F6" : "#94A3B8"} 
                />
                <Text style={[
                  styles.dateToggleText,
                  knowsDates && styles.dateToggleTextActive
                ]}>
                  I know my dates
                </Text>
              </TouchableOpacity>
            </View>
            
            {/* Date Pickers - Only show if user knows dates */}
            {knowsDates && (
              <View style={styles.datePickersContainer}>
                <View style={styles.dateRow}>
                  {/* Start Date */}
                  <View style={styles.dateInputGroup}>
                    <Text style={styles.dateLabel}>Start</Text>
                    <TouchableOpacity
                      style={styles.datePicker}
                      onPress={() => setShowStartPicker(true)}
                    >
                      <Ionicons name="calendar-outline" size={18} color="#3B82F6" />
                      <Text style={[styles.dateText, !startDate && styles.dateTextPlaceholder]}>
                        {formatDisplayDate(startDate)}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* End Date */}
                  <View style={styles.dateInputGroup}>
                    <Text style={styles.dateLabel}>End</Text>
                    <TouchableOpacity
                      style={styles.datePicker}
                      onPress={() => setShowEndPicker(true)}
                    >
                      <Ionicons name="calendar-outline" size={18} color="#3B82F6" />
                      <Text style={[styles.dateText, !endDate && styles.dateTextPlaceholder]}>
                        {formatDisplayDate(endDate)}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {startDate && endDate && (
                  <View style={styles.durationBadge}>
                    <Ionicons name="time-outline" size={16} color="#059669" />
                    <Text style={styles.durationText}>
                      {Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1} days
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Date Pickers - Native */}
          {Platform.OS !== 'web' && (
            <>
              {showStartPicker && DateTimePicker && (
                <DateTimePicker
                  value={startDate || new Date()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(event: any, selectedDate: Date | undefined) => {
                    setShowStartPicker(Platform.OS === 'ios');
                    if (selectedDate) {
                      setStartDate(selectedDate);
                      if (!endDate) {
                        const defaultEndDate = new Date(selectedDate);
                        defaultEndDate.setDate(defaultEndDate.getDate() + 7);
                        setEndDate(defaultEndDate);
                      }
                    }
                  }}
                  minimumDate={new Date()}
                />
              )}

              {showEndPicker && DateTimePicker && (
                <DateTimePicker
                  value={endDate || startDate || new Date()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(event: any, selectedDate: Date | undefined) => {
                    setShowEndPicker(Platform.OS === 'ios');
                    if (selectedDate) setEndDate(selectedDate);
                  }}
                  minimumDate={startDate || new Date()}
                />
              )}
            </>
          )}

          {/* Create Button */}
          <TouchableOpacity
            style={[styles.createButton, isLoading && styles.createButtonDisabled]}
            onPress={handleCreate}
            disabled={isLoading}
            activeOpacity={0.9}
          >
            <Text style={styles.createButtonText}>
              {isLoading ? 'Creating...' : 'Create Trip'}
            </Text>
            <Ionicons name="arrow-forward" size={20} color="#FFFFFF" style={{ marginLeft: 8 }} />
          </TouchableOpacity>

          {/* Helper text */}
          <Text style={styles.helperText}>
            💡 Tip: You can save places from YouTube guides without knowing your travel dates!
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    padding: 20,
    paddingTop: 20,
  },

  // Icon
  iconContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconBox: {
    width: 80,
    height: 80,
    backgroundColor: '#EEF2FF',
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  icon: {
    fontSize: 40,
  },
  subtitle: {
    fontSize: 15,
    color: '#64748B',
    fontWeight: '500',
  },

  // Inputs
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#374151',
  },
  labelHint: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 12,
    marginTop: -4,
  },
  input: {
    height: 52,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#1F2937',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 52,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  inputIcon: {
    marginRight: 10,
  },
  inputWithIconField: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
    height: '100%',
  },

  // Dates Section
  datesSection: {
    marginBottom: 24,
  },
  dateToggleContainer: {
    gap: 10,
  },
  dateToggleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 12,
  },
  dateToggleOptionActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#3B82F6',
  },
  dateToggleText: {
    fontSize: 15,
    color: '#64748B',
    fontWeight: '500',
  },
  dateToggleTextActive: {
    color: '#1F2937',
    fontWeight: '600',
  },
  datePickersContainer: {
    marginTop: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  dateRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dateInputGroup: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    color: '#64748B',
  },
  datePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  dateText: {
    flex: 1,
    fontSize: 13,
    color: '#1F2937',
    fontWeight: '500',
  },
  dateTextPlaceholder: {
    color: '#9CA3AF',
  },
  durationBadge: {
    marginTop: 16,
    backgroundColor: '#ECFDF5',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  durationText: {
    color: '#059669',
    fontSize: 14,
    fontWeight: '600',
  },

  // Create Button
  createButton: {
    height: 56,
    backgroundColor: '#3B82F6',
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },

  // Helper Text
  helperText: {
    textAlign: 'center',
    fontSize: 13,
    color: '#64748B',
    marginTop: 20,
    paddingHorizontal: 20,
    lineHeight: 20,
  },
});
