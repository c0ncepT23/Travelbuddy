/**
 * Itinerary Setup Modal
 * Shown when user first creates a trip to set up their cities and dates
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { MotiView } from 'moti';
import api from '../config/api';

interface CitySegment {
  city: string;
  country: string;
  startDate: string;
  endDate: string;
  accommodation: string;
}

interface Props {
  visible: boolean;
  tripId: string;
  tripDestination: string;
  tripStartDate?: string;
  tripEndDate?: string;
  onComplete: () => void;
  onSkip: () => void;
}

export default function ItinerarySetupModal({
  visible,
  tripId,
  tripDestination,
  tripStartDate,
  tripEndDate,
  onComplete,
  onSkip,
}: Props) {
  const [step, setStep] = useState<'intro' | 'cities' | 'details'>('intro');
  const [cityCount, setCityCount] = useState(1);
  const [cities, setCities] = useState<CitySegment[]>([
    {
      city: tripDestination?.split(',')[0]?.trim() || '',
      country: tripDestination?.split(',')[1]?.trim() || '',
      startDate: tripStartDate || '',
      endDate: tripEndDate || '',
      accommodation: '',
    },
  ]);
  const [currentCityIndex, setCurrentCityIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const handleCityCountSelect = (count: number) => {
    setCityCount(count);
    
    // Initialize cities array
    const newCities: CitySegment[] = [];
    for (let i = 0; i < count; i++) {
      if (i === 0) {
        newCities.push({
          city: tripDestination?.split(',')[0]?.trim() || '',
          country: tripDestination?.split(',')[1]?.trim() || '',
          startDate: tripStartDate || '',
          endDate: count === 1 ? (tripEndDate || '') : '',
          accommodation: '',
        });
      } else {
        newCities.push({
          city: '',
          country: '',
          startDate: '',
          endDate: i === count - 1 ? (tripEndDate || '') : '',
          accommodation: '',
        });
      }
    }
    setCities(newCities);
    setStep('details');
  };

  const updateCity = (index: number, field: keyof CitySegment, value: string) => {
    const updated = [...cities];
    updated[index] = { ...updated[index], [field]: value };
    setCities(updated);
  };

  const handleNext = () => {
    if (currentCityIndex < cityCount - 1) {
      setCurrentCityIndex(currentCityIndex + 1);
    } else {
      handleSave();
    }
  };

  const handleBack = () => {
    if (currentCityIndex > 0) {
      setCurrentCityIndex(currentCityIndex - 1);
    } else {
      setStep('intro');
    }
  };

  const handleSave = async () => {
    // Validate
    for (const city of cities) {
      if (!city.city.trim()) {
        Alert.alert('Missing Info', 'Please enter city names for all segments');
        return;
      }
    }

    setIsLoading(true);
    try {
      // Create segments via API
      for (const city of cities) {
        await api.post(`/trips/${tripId}/segments`, {
          city: city.city.trim(),
          country: city.country.trim() || undefined,
          startDate: city.startDate || undefined,
          endDate: city.endDate || undefined,
          accommodationName: city.accommodation.trim() || undefined,
        });
      }

      Alert.alert(
        '🎉 Itinerary Set!',
        `${cityCount} ${cityCount === 1 ? 'city' : 'cities'} added to your trip. I'll help you plan each day!`,
        [{ text: 'Let\'s Go!', onPress: onComplete }]
      );
    } catch (error: any) {
      console.error('[ItinerarySetup] Error saving segments:', error);
      Alert.alert('Error', error.response?.data?.error || 'Failed to save itinerary');
    } finally {
      setIsLoading(false);
    }
  };

  const renderIntro = () => (
    <MotiView
      from={{ opacity: 0, translateY: 20 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 300 }}
    >
      <View style={styles.introContainer}>
        <Text style={styles.introEmoji}>🗺️</Text>
        <Text style={styles.introTitle}>Let's plan your trip!</Text>
        <Text style={styles.introSubtitle}>
          Tell me about your itinerary so I can give you better recommendations
        </Text>

        <Text style={styles.questionText}>How many cities are you visiting?</Text>

        <View style={styles.cityCountOptions}>
          {[1, 2, 3, 4].map((count) => (
            <TouchableOpacity
              key={count}
              style={styles.cityCountButton}
              onPress={() => handleCityCountSelect(count)}
            >
              <Text style={styles.cityCountNumber}>{count}</Text>
              <Text style={styles.cityCountLabel}>
                {count === 1 ? 'city' : count === 4 ? '4+' : 'cities'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.skipButton} onPress={onSkip}>
          <Text style={styles.skipText}>Skip for now</Text>
        </TouchableOpacity>
      </View>
    </MotiView>
  );

  const renderCityDetails = () => {
    const city = cities[currentCityIndex];
    const isFirst = currentCityIndex === 0;
    const isLast = currentCityIndex === cityCount - 1;

    return (
      <MotiView
        key={currentCityIndex}
        from={{ opacity: 0, translateX: 20 }}
        animate={{ opacity: 1, translateX: 0 }}
        transition={{ type: 'timing', duration: 200 }}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.detailsContainer}>
            <View style={styles.progressIndicator}>
              {cities.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.progressDot,
                    i === currentCityIndex && styles.progressDotActive,
                    i < currentCityIndex && styles.progressDotCompleted,
                  ]}
                />
              ))}
            </View>

            <Text style={styles.cityNumber}>
              City {currentCityIndex + 1} of {cityCount}
            </Text>

            {/* City Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>City Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Bangkok"
                value={city.city}
                onChangeText={(v) => updateCity(currentCityIndex, 'city', v)}
                placeholderTextColor="#9CA3AF"
              />
            </View>

            {/* Country */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Country</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Thailand"
                value={city.country}
                onChangeText={(v) => updateCity(currentCityIndex, 'country', v)}
                placeholderTextColor="#9CA3AF"
              />
            </View>

            {/* Dates Row */}
            <View style={styles.dateRow}>
              <View style={styles.dateInputGroup}>
                <Text style={styles.inputLabel}>From</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Dec 15"
                  value={city.startDate}
                  onChangeText={(v) => updateCity(currentCityIndex, 'startDate', v)}
                  placeholderTextColor="#9CA3AF"
                />
              </View>
              <View style={styles.dateInputGroup}>
                <Text style={styles.inputLabel}>To</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Dec 18"
                  value={city.endDate}
                  onChangeText={(v) => updateCity(currentCityIndex, 'endDate', v)}
                  placeholderTextColor="#9CA3AF"
                />
              </View>
            </View>

            {/* Hotel */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Where are you staying?</Text>
              <TextInput
                style={styles.input}
                placeholder="Hotel name or area (optional)"
                value={city.accommodation}
                onChangeText={(v) => updateCity(currentCityIndex, 'accommodation', v)}
                placeholderTextColor="#9CA3AF"
              />
              <Text style={styles.inputHint}>
                This helps me suggest places near your hotel
              </Text>
            </View>

            {/* Navigation Buttons */}
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.backButtonSmall}
                onPress={handleBack}
              >
                <Text style={styles.backButtonSmallText}>← Back</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.nextButton, isLoading && styles.nextButtonDisabled]}
                onPress={handleNext}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={styles.nextButtonText}>
                    {isLast ? 'Save Itinerary' : 'Next City →'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.skipButton} onPress={onSkip}>
              <Text style={styles.skipText}>Skip for now</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </MotiView>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onSkip}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {step === 'intro' && renderIntro()}
          {step === 'details' && renderCityDetails()}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },

  // Intro
  introContainer: {
    padding: 24,
    alignItems: 'center',
  },
  introEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  introTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  introSubtitle: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  questionText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 20,
  },
  cityCountOptions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  cityCountButton: {
    width: 72,
    height: 72,
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cityCountNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
  },
  cityCountLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },

  // Details
  detailsContainer: {
    padding: 24,
  },
  progressIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E5E7EB',
  },
  progressDotActive: {
    backgroundColor: '#2563EB',
    width: 24,
  },
  progressDotCompleted: {
    backgroundColor: '#10B981',
  },
  cityNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 20,
  },

  // Inputs
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    height: 48,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#1F2937',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  inputHint: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 6,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  dateInputGroup: {
    flex: 1,
  },

  // Buttons
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  backButtonSmall: {
    flex: 1,
    height: 52,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonSmallText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  nextButton: {
    flex: 2,
    height: 52,
    backgroundColor: '#1F2937',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextButtonDisabled: {
    opacity: 0.6,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  skipButton: {
    marginTop: 16,
    padding: 12,
    alignSelf: 'center',
  },
  skipText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
});

