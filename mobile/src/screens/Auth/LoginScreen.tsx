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
            <YoriLogo size="large" />
            <Text style={styles.title}>Welcome back!</Text>
            <Text style={styles.subtitle}>Your travel companion awaits</Text>
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
                  style={[styles.loginButton, isLoadingOTP && styles.buttonDisabled]}
                  onPress={handleSendOTP}
                  disabled={isLoadingOTP}
                  activeOpacity={0.9}
                >
                  <Text style={styles.loginButtonText}>
                    {isLoadingOTP ? 'Sending OTP...' : 'Send OTP'}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
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
                    editable={!isLoading}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.loginButton, isLoading && styles.buttonDisabled]}
                  onPress={handleLogin}
                  disabled={isLoading}
                  activeOpacity={0.9}
                >
                  <Text style={styles.loginButtonText}>
                    {isLoading ? 'Logging in...' : "Let's Go! 🚀"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.backButton}
                  onPress={() => setStep('phone')}
                  disabled={isLoading}
                >
                  <Text style={styles.backButtonText}>← Change phone number</Text>
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
              activeOpacity={0.9}
            >
              <Text style={styles.signupButtonText}>Create Account</Text>
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

  // Login Button
  loginButton: {
    height: 56,
    backgroundColor: '#1F2937',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  loginButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  buttonDisabled: {
    opacity: 0.5,
  },

  // Sign Up Section
  signupSection: {
    alignItems: 'center',
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  signupText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#6B7280',
    marginBottom: 16,
  },
  signupButton: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
  },
  signupButtonText: {
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
