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
import { useTripStore } from '../../stores/tripStore';

// For mobile, we'll use conditional import
const DateTimePicker = Platform.OS !== 'web' 
  ? require('@react-native-community/datetimepicker').default 
  : null;

export default function CreateTripScreen({ navigation }: any) {
  const [name, setName] = useState('');
  const [destination, setDestination] = useState('');
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
        Alert.alert('Error', 'Please fill in trip name and destination');
      }
      return;
    }

    try {
      const trip = await createTrip({
        name: name.trim(),
        destination: destination.trim(),
        startDate: formatDate(startDate) || undefined,
        endDate: formatDate(endDate) || undefined,
      });

      if (Platform.OS === 'web') {
        window.alert('Trip created successfully!');
        navigation.navigate('TripDetail', { tripId: trip.id });
      } else {
        Alert.alert('Success', 'Trip created successfully!', [
          {
            text: 'OK',
            onPress: () => navigation.navigate('TripDetail', { tripId: trip.id }),
          },
        ]);
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
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <Text style={styles.icon}>✈️</Text>
            </View>
            <Text style={styles.title}>Create New Trip</Text>
            <Text style={styles.subtitle}>Plan your next adventure together</Text>
          </View>

          {/* Trip Name */}
          <View style={styles.inputGroup}>
          <Text style={styles.label}>Trip Name *</Text>
          <TextInput
            style={styles.input}
              placeholder="e.g., Japan Adventure 2025"
            value={name}
            onChangeText={setName}
              placeholderTextColor="#999"
          />
          </View>

          {/* Destination */}
          <View style={styles.inputGroup}>
          <Text style={styles.label}>Destination *</Text>
            <View style={styles.inputWithIcon}>
              <Text style={styles.inputIcon}>📍</Text>
          <TextInput
                style={styles.inputWithIconField}
            placeholder="e.g., Tokyo, Japan"
            value={destination}
            onChangeText={setDestination}
                placeholderTextColor="#999"
              />
            </View>
          </View>

          {/* Dates Section */}
          <View style={styles.datesSection}>
            <Text style={styles.sectionTitle}>When are you going?</Text>
            
            <View style={styles.dateRow}>
              {/* Start Date */}
              <View style={styles.dateInputGroup}>
                <Text style={styles.dateLabel}>Start Date</Text>
                <TouchableOpacity
                  style={styles.datePicker}
                  onPress={() => setShowStartPicker(true)}
                >
                  <Text style={styles.dateIcon}>📅</Text>
                  <Text style={[styles.dateText, !startDate && styles.dateTextPlaceholder]}>
                    {formatDisplayDate(startDate)}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* End Date */}
              <View style={styles.dateInputGroup}>
                <Text style={styles.dateLabel}>End Date</Text>
                <TouchableOpacity
                  style={styles.datePicker}
                  onPress={() => setShowEndPicker(true)}
                >
                  <Text style={styles.dateIcon}>📅</Text>
                  <Text style={[styles.dateText, !endDate && styles.dateTextPlaceholder]}>
                    {formatDisplayDate(endDate)}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {startDate && endDate && (
              <View style={styles.durationBadge}>
                <Text style={styles.durationText}>
                  {Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))} days
                </Text>
              </View>
            )}
          </View>

          {/* Date Pickers - Web uses HTML input, mobile uses native picker */}
          {Platform.OS === 'web' ? (
            <>
              {/* Hidden HTML inputs for web */}
              <input
                type="date"
                style={{ position: 'absolute', opacity: 0, pointerEvents: showStartPicker ? 'auto' : 'none' }}
                onChange={(e) => {
                  const date = new Date(e.target.value);
                  setStartDate(date);
                  setShowStartPicker(false);
                  if (!endDate) {
                    const defaultEndDate = new Date(date);
                    defaultEndDate.setDate(defaultEndDate.getDate() + 7);
                    setEndDate(defaultEndDate);
                  }
                }}
                onBlur={() => setShowStartPicker(false)}
                autoFocus={showStartPicker}
              />
              <input
                type="date"
                style={{ position: 'absolute', opacity: 0, pointerEvents: showEndPicker ? 'auto' : 'none' }}
                onChange={(e) => {
                  const date = new Date(e.target.value);
                  setEndDate(date);
                  setShowEndPicker(false);
                }}
                onBlur={() => setShowEndPicker(false)}
                autoFocus={showEndPicker}
              />
            </>
          ) : (
            <>
              {showStartPicker && DateTimePicker && (
                <DateTimePicker
                  value={startDate || new Date()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(event, selectedDate) => {
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
                  onChange={(event, selectedDate) => {
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
          >
            <Text style={styles.createButtonText}>
              {isLoading ? 'Creating...' : '✨ Create Trip'}
            </Text>
          </TouchableOpacity>

          {/* Cancel Button */}
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  content: {
    flex: 1,
    padding: 24,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#8B5CF6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  icon: {
    fontSize: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
    color: '#111827',
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    height: 56,
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#111827',
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56,
  },
  inputIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  inputWithIconField: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
    height: '100%',
  },
  datesSection: {
    marginBottom: 24,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
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
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  datePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    minHeight: 48,
  },
  dateIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  dateText: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
  },
  dateTextPlaceholder: {
    color: '#9CA3AF',
    fontWeight: '400',
  },
  durationBadge: {
    marginTop: 12,
    backgroundColor: '#8B5CF6',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
  },
  durationText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  createButton: {
    height: 56,
    backgroundColor: '#8B5CF6',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  cancelButton: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 12,
  },
  cancelText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '600',
  },
});

