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
} from 'react-native';
import { useTripStore } from '../../stores/tripStore';

export default function JoinTripScreen({ navigation }: any) {
  const [inviteCode, setInviteCode] = useState('');
  const { joinTrip, isLoading } = useTripStore();

  const handleJoin = async () => {
    if (!inviteCode.trim()) {
      Alert.alert('Error', 'Please enter an invite code');
      return;
    }

    if (inviteCode.trim().length !== 6) {
      Alert.alert('Error', 'Invite code must be 6 characters');
      return;
    }

    try {
      const trip = await joinTrip(inviteCode.trim().toUpperCase());
      Alert.alert('Success', `Joined ${trip.name}!`, [
        {
          text: 'OK',
          onPress: () => navigation.navigate('TripHome', { tripId: trip.id }),
        },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        <Text style={styles.icon}>🔗</Text>
        <Text style={styles.title}>Join a Trip</Text>
        <Text style={styles.subtitle}>
          Enter the 6-character invite code shared by your travel buddy
        </Text>

        <TextInput
          style={styles.input}
          placeholder="ABC123"
          value={inviteCode}
          onChangeText={(text) => setInviteCode(text.toUpperCase())}
          autoCapitalize="characters"
          maxLength={6}
        />

        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handleJoin}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>
            {isLoading ? 'Joining...' : 'Join Trip'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    alignItems: 'center',
  },
  icon: {
    fontSize: 64,
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 32,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  input: {
    height: 60,
    width: '100%',
    borderWidth: 2,
    borderColor: '#007AFF',
    borderRadius: 8,
    paddingHorizontal: 20,
    marginBottom: 20,
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 4,
  },
  button: {
    height: 50,
    width: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
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

