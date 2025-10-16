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

export default function CreateTripScreen({ navigation }: any) {
  const [name, setName] = useState('');
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const { createTrip, isLoading } = useTripStore();

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
        startDate: startDate || undefined,
        endDate: endDate || undefined,
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
          <Text style={styles.title}>Create New Trip ✈️</Text>
          <Text style={styles.subtitle}>Plan your next adventure</Text>

          <Text style={styles.label}>Trip Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Japan Adventure 2024"
            value={name}
            onChangeText={setName}
          />

          <Text style={styles.label}>Destination *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Tokyo, Japan"
            value={destination}
            onChangeText={setDestination}
          />

          <Text style={styles.label}>Start Date (Optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="YYYY-MM-DD (e.g., 2024-06-15)"
            value={startDate}
            onChangeText={setStartDate}
          />

          <Text style={styles.label}>End Date (Optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="YYYY-MM-DD (e.g., 2024-06-25)"
            value={endDate}
            onChangeText={setEndDate}
          />

          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleCreate}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>
              {isLoading ? 'Creating...' : 'Create Trip'}
            </Text>
          </TouchableOpacity>

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
    backgroundColor: '#fff',
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    padding: 24,
    paddingTop: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 32,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 16,
    marginBottom: 20,
    fontSize: 16,
  },
  button: {
    height: 50,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 16,
    color: '#666',
  },
});

