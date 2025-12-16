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

export default function RegisterScreen({ navigation }: any) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [step, setStep] = useState<'phone' | 'otp' | 'name'>('phone');
  const [isLoadingOTP, setIsLoadingOTP] = useState(false);
  const { register, isLoading } = useAuthStore();

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
    const fullPhoneNumber = `+91${phoneNumber}`;

    try {
      await register({ name: fullName, phoneNumber: fullPhoneNumber, otpCode });
    } catch (error: any) {
      Alert.alert('Registration Failed', error.message);
    }
  };

  const getStepInfo = () => {
    switch (step) {
      case 'phone':
        return { title: 'Join Yori!', subtitle: 'Start your travel journey today ✨' };
      case 'otp':
        return { title: 'Verify Phone', subtitle: 'Almost there! Enter the magic code' };
      case 'name':
        return { title: 'Nice to meet you!', subtitle: "What should we call you?" };
    }
  };

  const stepInfo = getStepInfo();

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Background Gradient */}
      <LinearGradient
        colors={['#F0F9FF', '#E0F2FE', '#FFFFFF']}
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
            <Text style={styles.title}>{stepInfo.title}</Text>
            <Text style={styles.subtitle}>{stepInfo.subtitle}</Text>
            
            {/* Progress Indicator */}
            <View style={styles.progressContainer}>
              <View style={[styles.progressDot, step === 'phone' && styles.progressDotActive]} />
              <View style={[styles.progressLine, step !== 'phone' && styles.progressLineActive]} />
              <View style={[styles.progressDot, step === 'otp' && styles.progressDotActive]} />
              <View style={[styles.progressLine, step === 'name' && styles.progressLineActive]} />
              <View style={[styles.progressDot, step === 'name' && styles.progressDotActive]} />
            </View>
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
                    colors={['#10B981', '#059669']}
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
            ) : step === 'otp' ? (
              <>
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Enter OTP Code</Text>
                  <Text style={styles.otpHint}>We sent a 4-digit code to +91 {phoneNumber}</Text>
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
                      autoFocus
                    />
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={handleVerifyOTP}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['#10B981', '#059669']}
                    style={styles.buttonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <Text style={styles.primaryButtonText}>Verify →</Text>
                  </LinearGradient>
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
                  <View style={styles.inputWrapper}>
                    <Text style={styles.inputIcon}>👤</Text>
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
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Last Name</Text>
                  <View style={styles.inputWrapper}>
                    <Text style={styles.inputIcon}>👤</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Doe"
                      placeholderTextColor="#9CA3AF"
                      value={lastName}
                      onChangeText={setLastName}
                      editable={!isLoading}
                    />
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.primaryButton, isLoading && styles.buttonDisabled]}
                  onPress={handleRegister}
                  disabled={isLoading}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['#10B981', '#059669']}
                    style={styles.buttonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <Text style={styles.primaryButtonText}>
                      {isLoading ? 'Creating...' : "Let's Go! 🚀"}
                    </Text>
                  </LinearGradient>
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
              activeOpacity={0.8}
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
  gradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  star: {
    position: 'absolute',
    color: '#3B82F6',
    opacity: 0.15,
    zIndex: 1,
  },
  star1: {
    top: '12%',
    right: '10%',
    fontSize: 24,
  },
  star2: {
    top: '25%',
    left: '8%',
    fontSize: 18,
  },
  star3: {
    bottom: '30%',
    right: '15%',
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
    marginBottom: 36,
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
    marginBottom: 20,
  },
  
  // Progress Indicator
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#E5E7EB',
  },
  progressDotActive: {
    backgroundColor: '#10B981',
    transform: [{ scale: 1.2 }],
  },
  progressLine: {
    width: 40,
    height: 3,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 4,
  },
  progressLineActive: {
    backgroundColor: '#10B981',
  },

  // Form Section
  formSection: {
    marginBottom: 28,
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
  otpHint: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
    marginBottom: 12,
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
    shadowColor: '#10B981',
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
    marginBottom: 14,
  },
  loginButton: {
    paddingVertical: 14,
    paddingHorizontal: 36,
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
  },
  loginButtonText: {
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
