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
        navigation.navigate('ItinerarySetup', { tripId: trip.id, isInitialSetup: true });
      } else {
        Alert.alert(
          '✈️ Trip Created!', 
          'Now let\'s set up your itinerary - add cities, dates, and hotels!', 
          [
            {
              text: 'Set Up Itinerary',
              onPress: () => navigation.navigate('ItinerarySetup', { tripId: trip.id, isInitialSetup: true }),
            },
            {
              text: 'Skip for Now',
              style: 'cancel',
              onPress: () => navigation.navigate('TripHome', { tripId: trip.id }),
            },
          ]
        );
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
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.backButtonText}>←</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>New Trip</Text>
            <View style={styles.backButton} />
          </View>

          {/* Icon */}
          <View style={styles.iconContainer}>
            <View style={styles.iconBox}>
              <Text style={styles.icon}>✈️</Text>
            </View>
            <Text style={styles.subtitle}>Plan your next adventure</Text>
          </View>

          {/* Trip Name */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Trip Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Japan Adventure 2025"
              value={name}
              onChangeText={setName}
              placeholderTextColor="#9CA3AF"
            />
          </View>

          {/* Destination */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Destination</Text>
            <View style={styles.inputWithIcon}>
              <Text style={styles.inputIcon}>📍</Text>
              <TextInput
                style={styles.inputWithIconField}
                placeholder="e.g., Tokyo, Japan"
                value={destination}
                onChangeText={setDestination}
                placeholderTextColor="#9CA3AF"
              />
            </View>
          </View>

          {/* Dates Section */}
          <View style={styles.datesSection}>
            <Text style={styles.label}>When are you going?</Text>
            
            <View style={styles.dateRow}>
              {/* Start Date */}
              <View style={styles.dateInputGroup}>
                <Text style={styles.dateLabel}>Start</Text>
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
                <Text style={styles.dateLabel}>End</Text>
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
                  🗓️ {Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))} days
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
  },
  content: {
    flex: 1,
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  backButton: {
    width: 44,
    height: 44,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  backButtonText: {
    fontSize: 20,
    color: '#1F2937',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },

  // Icon
  iconContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconBox: {
    width: 80,
    height: 80,
    backgroundColor: '#EFF6FF',
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
    color: '#6B7280',
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
  input: {
    height: 52,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#1F2937',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 52,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  inputIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  inputWithIconField: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
    height: '100%',
  },

  // Dates
  datesSection: {
    marginBottom: 24,
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
  },
  datePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  dateIcon: {
    fontSize: 16,
    marginRight: 8,
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
  },
  durationText: {
    color: '#059669',
    fontSize: 14,
    fontWeight: '600',
  },

  // Create Button
  createButton: {
    height: 56,
    backgroundColor: '#1F2937',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
});
