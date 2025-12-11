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
import { useAuthStore } from '../../stores/authStore';
import { API_BASE_URL } from '../../config/api';
import YoriLogo from '../../components/YoriLogo';

export default function RegisterScreen({ navigation }: any) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [step, setStep] = useState<'phone' | 'otp' | 'name'>('phone');
  const [isLoadingOTP, setIsLoadingOTP] = useState(false);
  const { register, isLoading } = useAuthStore();

  const handleSendOTP = async () => {
    if (!phoneNumber || phoneNumber.length < 10) {
      Alert.alert('Invalid Phone', 'Please enter a valid phone number (min 10 digits)');
      return;
    }

    try {
      setIsLoadingOTP(true);
      const response = await fetch(`${API_BASE_URL}/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber }),
      });

      const data = await response.json();

      if (data.success) {
        setStep('otp');
        Alert.alert('OTP Sent!', `Enter the OTP: ${data.data.otpCode || '0000'}`);
      } else {
        Alert.alert('Error', data.error || 'Failed to send OTP');
      }
    } catch (error: any) {
      Alert.alert('Error', 'Failed to send OTP. Please try again.');
    } finally {
      setIsLoadingOTP(false);
    }
  };

  const handleVerifyOTP = () => {
    if (!otpCode || otpCode.length !== 4) {
      Alert.alert('Invalid OTP', 'Please enter the 4-digit OTP code');
      return;
    }
    setStep('name');
  };

  const handleRegister = async () => {
    if (!firstName.trim()) {
      Alert.alert('Missing Info', 'Please enter your first name');
      return;
    }

    if (!lastName.trim()) {
      Alert.alert('Missing Info', 'Please enter your last name');
      return;
    }

    const fullName = `${firstName.trim()} ${lastName.trim()}`;

    try {
      await register({ name: fullName, phoneNumber, otpCode });
    } catch (error: any) {
      Alert.alert('Registration Failed', error.message);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          {/* Hero Section */}
          <View style={styles.heroSection}>
            <YoriLogo size="large" />
            <Text style={styles.title}>Join Yori!</Text>
            <Text style={styles.subtitle}>Start your travel journey today</Text>
          </View>

          {/* Form Section */}
          <View style={styles.formSection}>
            {step === 'phone' ? (
              <>
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Phone Number</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="+1 234 567 8900"
                    placeholderTextColor="#9CA3AF"
                    value={phoneNumber}
                    onChangeText={setPhoneNumber}
                    keyboardType="phone-pad"
                    editable={!isLoadingOTP}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.signupButton, isLoadingOTP && styles.buttonDisabled]}
                  onPress={handleSendOTP}
                  disabled={isLoadingOTP}
                  activeOpacity={0.9}
                >
                  <Text style={styles.signupButtonText}>
                    {isLoadingOTP ? 'Sending OTP...' : 'Send OTP'}
                  </Text>
                </TouchableOpacity>
              </>
            ) : step === 'otp' ? (
              <>
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Enter OTP Code</Text>
                  <Text style={styles.otpHint}>We sent a 4-digit code to {phoneNumber}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0000"
                    placeholderTextColor="#9CA3AF"
                    value={otpCode}
                    onChangeText={setOtpCode}
                    keyboardType="number-pad"
                    maxLength={4}
                    autoFocus
                  />
                </View>

                <TouchableOpacity
                  style={styles.signupButton}
                  onPress={handleVerifyOTP}
                  activeOpacity={0.9}
                >
                  <Text style={styles.signupButtonText}>Verify OTP</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.backButton}
                  onPress={() => setStep('phone')}
                >
                  <Text style={styles.backButtonText}>← Change phone number</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>First Name</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="John"
                    placeholderTextColor="#9CA3AF"
                    value={firstName}
                    onChangeText={setFirstName}
                    editable={!isLoading}
                    autoFocus
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Last Name</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Doe"
                    placeholderTextColor="#9CA3AF"
                    value={lastName}
                    onChangeText={setLastName}
                    editable={!isLoading}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.signupButton, isLoading && styles.buttonDisabled]}
                  onPress={handleRegister}
                  disabled={isLoading}
                  activeOpacity={0.9}
                >
                  <Text style={styles.signupButtonText}>
                    {isLoading ? 'Creating Account...' : "Sign Me Up! 🎉"}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Login Link */}
          <View style={styles.loginSection}>
            <Text style={styles.loginText}>Already have an account?</Text>
            <TouchableOpacity
              style={styles.loginButton}
              onPress={() => navigation.navigate('Login')}
              disabled={isLoading}
              activeOpacity={0.9}
            >
              <Text style={styles.loginButtonText}>Log In</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  content: {
    padding: 24,
  },

  // Hero Section
  heroSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6B7280',
    textAlign: 'center',
  },

  // Form Section
  formSection: {
    marginBottom: 32,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  otpHint: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
    marginBottom: 12,
  },
  input: {
    height: 56,
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

  // Sign Up Button
  signupButton: {
    height: 56,
    backgroundColor: '#10B981',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  signupButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  buttonDisabled: {
    opacity: 0.5,
  },

  // Login Section
  loginSection: {
    alignItems: 'center',
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  loginText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#6B7280',
    marginBottom: 16,
  },
  loginButton: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
  },
  loginButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
  },

  // Back Button
  backButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
});
