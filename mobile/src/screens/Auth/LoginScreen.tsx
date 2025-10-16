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

function LoginScreenContent({ navigation }: any) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [isLoadingOTP, setIsLoadingOTP] = useState(false);
  const { login, isLoading } = useAuthStore();

  const handleSendOTP = async () => {
    if (!phoneNumber || phoneNumber.length < 10) {
      Alert.alert('Invalid Phone', 'Please enter a valid phone number (min 10 digits)');
      return;
    }

    try {
      setIsLoadingOTP(true);
      // Call backend to send OTP
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

  const handleLogin = async () => {
    if (!otpCode || otpCode.length !== 4) {
      Alert.alert('Invalid OTP', 'Please enter the 4-digit OTP code');
      return;
    }

    try {
      // Call the new phone-based login
      await login({ phoneNumber, otpCode });
    } catch (error: any) {
      Alert.alert('Login Failed', error.message);
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
            <View style={styles.logoBox}>
              <Text style={styles.logoEmoji}>✈️</Text>
            </View>
            <Text style={styles.title}>WELCOME BACK!</Text>
            <Text style={styles.subtitle}>Your travel squad is waiting</Text>
          </View>

          {/* Form Section */}
          <View style={styles.formSection}>
            {step === 'phone' ? (
              <>
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>PHONE NUMBER</Text>
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
                  style={[styles.loginButton, isLoadingOTP && styles.buttonDisabled]}
                  onPress={handleSendOTP}
                  disabled={isLoadingOTP}
                  activeOpacity={0.8}
                >
                  <Text style={styles.loginButtonText}>
                    {isLoadingOTP ? 'SENDING OTP...' : 'SEND OTP 📱'}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>ENTER OTP CODE</Text>
                  <Text style={styles.otpHint}>We sent a 4-digit code to {phoneNumber}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0000"
                    placeholderTextColor="#9CA3AF"
                    value={otpCode}
                    onChangeText={setOtpCode}
                    keyboardType="number-pad"
                    maxLength={4}
                    editable={!isLoading}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.loginButton, isLoading && styles.buttonDisabled]}
                  onPress={handleLogin}
                  disabled={isLoading}
                  activeOpacity={0.8}
                >
                  <Text style={styles.loginButtonText}>
                    {isLoading ? 'LOGGING IN...' : 'LET\'S GO! 🚀'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.backButton}
                  onPress={() => setStep('phone')}
                  disabled={isLoading}
                >
                  <Text style={styles.backButtonText}>← CHANGE PHONE NUMBER</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Sign Up Link */}
          <View style={styles.signupSection}>
            <Text style={styles.signupText}>New here?</Text>
            <TouchableOpacity
              style={styles.signupButton}
              onPress={() => navigation.navigate('Register')}
              disabled={isLoading}
            >
              <Text style={styles.signupButtonText}>CREATE ACCOUNT</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// Error boundary wrapper
export default function LoginScreen(props: any) {
  try {
    return <LoginScreenContent {...props} />;
  } catch (err) {
    console.error('LoginScreen crash:', err);
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Text style={{ fontSize: 18, marginBottom: 10, color: '#000' }}>⚠️ Login Screen Error</Text>
        <Text style={{ textAlign: 'center', color: '#666' }}>
          {err instanceof Error ? err.message : 'Failed to render login screen'}
        </Text>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFBEB', // Cream background
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
    marginBottom: 48,
  },
  logoBox: {
    width: 100,
    height: 100,
    backgroundColor: '#3B82F6', // Electric Blue
    borderWidth: 4,
    borderColor: '#000',
    borderRadius: 0,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 8, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8,
  },
  logoEmoji: {
    fontSize: 56,
  },
  title: {
    fontSize: 36,
    fontWeight: '900',
    color: '#000',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '600',
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
    fontSize: 12,
    fontWeight: '900',
    color: '#000',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  otpHint: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 12,
  },
  input: {
    height: 56,
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: '#000',
    paddingHorizontal: 16,
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },

  // Login Button
  loginButton: {
    height: 60,
    backgroundColor: '#3B82F6', // Electric Blue
    borderWidth: 4,
    borderColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 6,
  },
  loginButtonText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  buttonDisabled: {
    opacity: 0.5,
  },

  // Sign Up Section
  signupSection: {
    alignItems: 'center',
    paddingTop: 24,
    borderTopWidth: 3,
    borderTopColor: '#E5E7EB',
  },
  signupText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 16,
  },
  signupButton: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: '#000',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  signupButtonText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 0.5,
  },

  // Back Button
  backButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6B7280',
  },
});

