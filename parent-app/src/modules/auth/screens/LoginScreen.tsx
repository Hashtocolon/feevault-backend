// ─────────────────────────────────────────────
//  FeeVault Parent App — Login Screen (Email + Password)
//  Phase 1 Auth: Email & Password (No OTP)
// ─────────────────────────────────────────────

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Alert,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/AppNavigator';
import { ROUTES } from '../../../constants/routes';
import { COLORS } from '../../../theme/colors';
import { CustomInput } from '../../../components/CustomInput';
import { CustomButton } from '../../../components/CustomButton';
import { PillBadge } from '../../../components/PillBadge';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const LoginScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();

  // Mode: Sign In vs Sign Up
  const [isSignUp, setIsSignUp] = useState(false);

  // Form fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Errors & Loading
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [loading, setLoading] = useState(false);

  const validate = () => {
    let isValid = true;
    setEmailError('');
    setPasswordError('');

    if (!email.trim()) {
      setEmailError('Please enter your email address');
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      setEmailError('Enter a valid email address');
      isValid = false;
    }

    if (!password) {
      setPasswordError('Please enter your password');
      isValid = false;
    } else if (password.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      isValid = false;
    }

    if (isSignUp && password !== confirmPassword) {
      setPasswordError('Passwords do not match');
      isValid = false;
    }

    return isValid;
  };

  const handleSubmit = () => {
    if (!validate()) return;

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      // Navigate to next onboarding step: Parental Consent Screen
      navigation.navigate(ROUTES.PARENTAL_CONSENT);
    }, 800);
  };

  const handleBiometricLogin = () => {
    Alert.alert(
      'Biometric Sign In',
      'Use Fingerprint or Face ID to quickly unlock your FeeVault account.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Verify',
          onPress: () => {
            navigation.navigate(ROUTES.PARENTAL_CONSENT);
          },
        },
      ],
    );
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" />

      {/* Background Gradient */}
      <LinearGradient
        colors={['#D9F3FF', '#EEF9FF', '#F7FCFF', '#E9FBF1']}
        locations={[0, 0.35, 0.7, 1]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardView}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">
            {/* Top Badge */}
            <PillBadge
              label={isSignUp ? 'NEW PARENT ACCOUNT' : 'SECURE PARENT LOGIN'}
              style={styles.topBadge}
            />

            {/* Header Titles */}
            <Text style={styles.mainTitle}>
              {isSignUp ? 'Create your ' : 'Welcome to '}
              <Text style={styles.brandFee}>Fee</Text>
              <Text style={styles.brandVault}>Vault</Text>
            </Text>
            <Text style={styles.subTitle}>
              {isSignUp
                ? 'Start disciplining and saving for your child’s school fees today.'
                : 'Sign in to access your locked fee vaults & interest earnings.'}
            </Text>

            {/* Form Card */}
            <View style={styles.formCard}>
              {isSignUp ? (
                <CustomInput
                  label="Parent / Guardian Full Name"
                  placeholder="e.g. Ramesh Kumar"
                  value={fullName}
                  onChangeText={setFullName}
                  autoCapitalize="words"
                />
              ) : null}

              <CustomInput
                label="Email Address"
                placeholder="parent@example.com"
                value={email}
                onChangeText={(val) => {
                  setEmail(val);
                  if (emailError) setEmailError('');
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                error={emailError}
              />

              <CustomInput
                label="Password"
                placeholder="Enter your password"
                value={password}
                onChangeText={(val) => {
                  setPassword(val);
                  if (passwordError) setPasswordError('');
                }}
                secureTextEntry={!showPassword}
                error={passwordError}
                rightIcon={
                  <Text style={styles.eyeIconText}>
                    {showPassword ? '🙈' : '👁️'}
                  </Text>
                }
                onRightIconPress={() => setShowPassword(!showPassword)}
              />

              {isSignUp ? (
                <CustomInput
                  label="Confirm Password"
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showPassword}
                />
              ) : (
                <TouchableOpacity
                  style={styles.forgotPassBtn}
                  onPress={() =>
                    Alert.alert(
                      'Reset Password',
                      'Password reset instructions will be sent to your registered email address.',
                    )
                  }>
                  <Text style={styles.forgotPassText}>Forgot Password?</Text>
                </TouchableOpacity>
              )}

              {/* Submit CTA Button */}
              <CustomButton
                label={
                  loading
                    ? 'Authenticating...'
                    : isSignUp
                    ? 'Create Account →'
                    : 'Sign In →'
                }
                loading={loading}
                onPress={handleSubmit}
                style={styles.submitBtn}
              />

              {/* Biometric Shortcut (Only on Sign In) */}
              {!isSignUp ? (
                <TouchableOpacity
                  style={styles.biometricBtn}
                  onPress={handleBiometricLogin}
                  activeOpacity={0.7}>
                  <Text style={styles.bioIcon}>👆</Text>
                  <Text style={styles.bioText}>Quick Sign in with Biometrics</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Switch Sign In / Sign Up */}
            <View style={styles.toggleRow}>
              <Text style={styles.togglePrompt}>
                {isSignUp
                  ? 'Already have an account? '
                  : "Don't have an account yet? "}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setIsSignUp(!isSignUp);
                  setEmailError('');
                  setPasswordError('');
                }}>
                <Text style={styles.toggleAction}>
                  {isSignUp ? 'Sign In' : 'Sign Up'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Trust Footer */}
            <View style={styles.trustFooter}>
              <Text style={styles.trustText}>
                🛡️ DPDP 2023 Compliant • 256-Bit Bank Grade Encryption
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#EEF9FF',
  },
  safe: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingTop: 16,
    paddingBottom: 28,
  },
  topBadge: {
    marginBottom: 16,
  },
  mainTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.textDark,
    textAlign: 'center',
    marginBottom: 8,
  },
  brandFee: {
    color: COLORS.feeBlue,
  },
  brandVault: {
    color: COLORS.vaultGreen,
  },
  subTitle: {
    fontSize: 14,
    color: COLORS.textMid,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    paddingHorizontal: 12,
  },
  formCard: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
    borderWidth: 1.2,
    borderColor: 'rgba(255,255,255,0.95)',
    shadowColor: '#35B6FF',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
    marginBottom: 20,
  },
  eyeIconText: {
    fontSize: 16,
  },
  forgotPassBtn: {
    alignSelf: 'flex-end',
    marginBottom: 18,
    marginTop: -6,
  },
  forgotPassText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.feeBlue,
  },
  submitBtn: {
    marginTop: 6,
    marginBottom: 8,
  },
  biometricBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(26,86,219,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(26,86,219,0.15)',
  },
  bioIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  bioText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.feeBlue,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  togglePrompt: {
    fontSize: 14,
    color: COLORS.textMid,
  },
  toggleAction: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.feeBlue,
  },
  trustFooter: {
    alignItems: 'center',
  },
  trustText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: COLORS.textLight,
    textAlign: 'center',
  },
});

export default LoginScreen;

