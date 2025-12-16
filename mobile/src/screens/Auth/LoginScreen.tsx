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
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../../stores/authStore';
import { API_BASE_URL } from '../../config/api';
import YoriLogo from '../../components/YoriLogo';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

function LoginScreenContent({ navigation }: any) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [isLoadingOTP, setIsLoadingOTP] = useState(false);
  const { login, isLoading } = useAuthStore();

  const handleSendOTP = async () => {
    if (!phoneNumber || phoneNumber.length !== 10) {
      Alert.alert('Invalid Phone', 'Please enter a valid 10-digit phone number');
      return;
    }

    const fullPhoneNumber = `+91${phoneNumber}`;

    try {
      setIsLoadingOTP(true);
      const response = await fetch(`${API_BASE_URL}/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: fullPhoneNumber }),
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

    const fullPhoneNumber = `+91${phoneNumber}`;

    try {
      await login({ phoneNumber: fullPhoneNumber, otpCode });
    } catch (error: any) {
      Alert.alert('Login Failed', error.message);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Background Gradient */}
      <LinearGradient
        colors={['#FDF4FF', '#FAF5FF', '#FFFFFF']}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Decorative Stars */}
      <Text style={[styles.star, styles.star1]}>✦</Text>
      <Text style={[styles.star, styles.star2]}>✦</Text>
      <Text style={[styles.star, styles.star3]}>✦</Text>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          {/* Hero Section */}
          <View style={styles.heroSection}>
            <View style={styles.logoContainer}>
              <YoriLogo size="large" />
            </View>
            <Text style={styles.title}>
              {step === 'phone' ? 'Welcome back!' : 'Enter the code'}
            </Text>
            <Text style={styles.subtitle}>
              {step === 'phone' 
                ? 'Your travel companion awaits ✨' 
                : `We sent it to +91 ${phoneNumber}`}
            </Text>
          </View>

          {/* Form Section */}
          <View style={styles.formSection}>
            {step === 'phone' ? (
              <>
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Phone Number</Text>
                  <View style={styles.inputWrapper}>
                    <Text style={styles.countryCode}>+91</Text>
                    <View style={styles.inputDivider} />
                    <TextInput
                      style={styles.input}
                      placeholder="10 digit number"
                      placeholderTextColor="#9CA3AF"
                      value={phoneNumber}
                      onChangeText={(text) => setPhoneNumber(text.replace(/[^0-9]/g, '').slice(0, 10))}
                      keyboardType="number-pad"
                      maxLength={10}
                      editable={!isLoadingOTP}
                    />
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.primaryButton, isLoadingOTP && styles.buttonDisabled]}
                  onPress={handleSendOTP}
                  disabled={isLoadingOTP}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['#8B5CF6', '#7C3AED']}
                    style={styles.buttonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <Text style={styles.primaryButtonText}>
                      {isLoadingOTP ? 'Sending...' : 'Send OTP →'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Enter OTP Code</Text>
                  <View style={styles.inputWrapper}>
                    <Text style={styles.inputIcon}>🔐</Text>
                    <TextInput
                      style={[styles.input, styles.otpInput]}
                      placeholder="• • • •"
                      placeholderTextColor="#9CA3AF"
                      value={otpCode}
                      onChangeText={setOtpCode}
                      keyboardType="number-pad"
                      maxLength={4}
                      editable={!isLoading}
                      autoFocus
                    />
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.primaryButton, isLoading && styles.buttonDisabled]}
                  onPress={handleLogin}
                  disabled={isLoading}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['#8B5CF6', '#7C3AED']}
                    style={styles.buttonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <Text style={styles.primaryButtonText}>
                      {isLoading ? 'Logging in...' : "Let's Go! 🚀"}
                    </Text>
                  </LinearGradient>
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
              activeOpacity={0.8}
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
  gradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  star: {
    position: 'absolute',
    color: '#8B5CF6',
    opacity: 0.15,
    zIndex: 1,
  },
  star1: {
    top: '12%',
    left: '10%',
    fontSize: 24,
  },
  star2: {
    top: '28%',
    right: '12%',
    fontSize: 18,
  },
  star3: {
    bottom: '35%',
    left: '15%',
    fontSize: 20,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  content: {
    padding: 28,
  },
  
  // Hero Section
  heroSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    marginBottom: 16,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#1F2937',
    textAlign: 'center',
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
    marginLeft: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
  },
  inputIcon: {
    fontSize: 18,
    marginRight: 12,
  },
  countryCode: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    paddingRight: 12,
  },
  inputDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E5E7EB',
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: 56,
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
  },
  otpInput: {
    letterSpacing: 8,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },

  // Primary Button
  primaryButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 8,
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonGradient: {
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  buttonDisabled: {
    opacity: 0.6,
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
    marginBottom: 14,
  },
  signupButton: {
    paddingVertical: 14,
    paddingHorizontal: 36,
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
  },
  signupButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#374151',
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
