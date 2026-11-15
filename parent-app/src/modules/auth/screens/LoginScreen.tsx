// ─────────────────────────────────────────────
//  FeeVault Parent App — Login Screen (Email + Password) — redesigned
//  Phase 1 Auth: Email & Password (No OTP)
//  Static design: no animations, no glass, no background circles.
//  Colors, validation, navigation and components are unchanged.
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
import Svg, { Path, Circle } from 'react-native-svg';

// Professional Fintech Eye Icons
const EyeOpenIcon = ({ color = '#5B7399', size = 20 }: { color?: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M1 12C1 12 5 4 12 4C19 4 23 12 23 12C23 12 19 20 12 20C5 20 1 12 1 12Z"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Circle
      cx="12"
      cy="12"
      r="3"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const EyeClosedIcon = ({ color = '#5B7399', size = 20 }: { color?: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M17.94 17.94A10.07 10.07 0 0112 20C5 20 1 12 1 12A18.45 18.45 0 015.06 6.06M9.9 4.24A9.12 9.12 0 0112 4C19 4 23 12 23 12A18.5 18.5 0 0119.82 16.14"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M1 1L23 23"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M9.88 9.88A3 3 0 1014.12 14.12"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

// Complete, 100% full-frame Lucide / Feather Fingerprint Vector Icon
const FingerprintIcon = ({ color = '#1A56DB', size = 22 }: { color?: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M14 13.12c0 2.38 0 6.38-1 8.88"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M17.29 21.02c.12-.6.43-2.3.5-3.02"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M2 12a10 10 0 0 1 18-6"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M2 16h.01"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M21.8 16c.2-2 .131-5.354 0-6"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M8.65 22c.21-.66.45-1.32.57-2"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M9 6.8a6 6 0 0 1 9 5.2v2"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

// Sleek Forward Arrow for Primary CTA
const ArrowRightIcon = ({ color = '#FFFFFF', size = 18 }: { color?: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M5 12H19M19 12L12 5M19 12L12 19"
      stroke={color}
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const LoginScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();

  // Mode: Sign In vs Sign Up
  const [isSignUp, setIsSignUp] = useState(false);

  // Form fields
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);

  // Errors & Loading
  const [fullNameError, setFullNameError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [consentError, setConsentError] = useState('');
  const [loading, setLoading] = useState(false);

  const clearErrors = () => {
    setFullNameError('');
    setPhoneError('');
    setEmailError('');
    setPasswordError('');
    setConsentError('');
  };

  const switchMode = (signUp: boolean) => {
    if (signUp === isSignUp) return;
    setIsSignUp(signUp);
    clearErrors();
  };

  const validate = () => {
    let isValid = true;
    clearErrors();

    if (isSignUp) {
      if (!fullName.trim()) {
        setFullNameError('Please enter parent or guardian full name');
        isValid = false;
      }
      if (!phone.trim()) {
        setPhoneError('Please enter 10-digit mobile number');
        isValid = false;
      } else if (!/^[6-9]\d{9}$/.test(phone.trim())) {
        setPhoneError('Enter a valid 10-digit Indian mobile number');
        isValid = false;
      }
      if (!consentAccepted) {
        setConsentError('Please accept the parental consent & terms to continue');
        isValid = false;
      }
    }

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
      // Skip the separate consent screen and navigate directly to KYC & Bank Binding
      navigation.navigate(ROUTES.KYC_BANK_BINDING);
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
            navigation.navigate(ROUTES.HOME);
          },
        },
      ],
    );
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" />

      {/* Background – same gradient, nothing else */}
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
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.mainTitle}>
                {isSignUp ? 'Create your ' : 'Welcome to '}
                <Text style={styles.brandFee}>Fee</Text>
                <Text style={styles.brandVault}>Vault</Text>
              </Text>

              {/* Two-tone divider, same as splash */}
              <View style={styles.divider}>
                <View style={styles.dividerBlue} />
                <View style={styles.dividerGreen} />
              </View>

              <Text style={styles.subTitle}>
                {isSignUp
                  ? 'Start disciplining and saving for your child’s school fees today.'
                  : 'Sign in to access your locked fee vaults & interest earnings.'}
              </Text>
            </View>

            {/* Form Card */}
            <View style={styles.formCard}>
              {/* Sign In / Sign Up switch */}
              <View style={styles.segment}>
                <TouchableOpacity
                  style={[styles.segmentBtn, !isSignUp && styles.segmentBtnActive]}
                  onPress={() => switchMode(false)}
                  activeOpacity={0.85}>
                  <Text
                    style={[styles.segmentText, !isSignUp && styles.segmentTextActive]}>
                    Sign In
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.segmentBtn, isSignUp && styles.segmentBtnActive]}
                  onPress={() => switchMode(true)}
                  activeOpacity={0.85}>
                  <Text
                    style={[styles.segmentText, isSignUp && styles.segmentTextActive]}>
                    Sign Up
                  </Text>
                </TouchableOpacity>
              </View>

              {isSignUp ? (
                <>
                  <CustomInput
                    label="Parent / Guardian Full Name"
                    placeholder="e.g. Ramesh Kumar"
                    value={fullName}
                    onChangeText={(val) => {
                      setFullName(val);
                      if (fullNameError) setFullNameError('');
                    }}
                    autoCapitalize="words"
                    error={fullNameError}
                  />

                  <CustomInput
                    label="Mobile Number (for SMS & WhatsApp alerts)"
                    placeholder="e.g. 9876543210"
                    value={phone}
                    onChangeText={(val) => {
                      setPhone(val);
                      if (phoneError) setPhoneError('');
                    }}
                    keyboardType="phone-pad"
                    maxLength={10}
                    error={phoneError}
                  />
                </>
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
                  showPassword ? (
                    <EyeOpenIcon color={COLORS.feeBlue} size={20} />
                  ) : (
                    <EyeClosedIcon color="#718BAF" size={20} />
                  )
                }
                onRightIconPress={() => setShowPassword(!showPassword)}
              />

              {isSignUp ? (
                <>
                  <CustomInput
                    label="Confirm Password"
                    placeholder="Re-enter your password"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showPassword}
                    rightIcon={
                      showPassword ? (
                        <EyeOpenIcon color={COLORS.feeBlue} size={20} />
                      ) : (
                        <EyeClosedIcon color="#718BAF" size={20} />
                      )
                    }
                    onRightIconPress={() => setShowPassword(!showPassword)}
                  />

                  {/* Unified Master DPDP & Parental Consent Checkbox */}
                  <TouchableOpacity
                    style={[
                      styles.consentContainer,
                      consentError ? styles.consentContainerError : null,
                    ]}
                    onPress={() => {
                      setConsentAccepted(!consentAccepted);
                      if (consentError) setConsentError('');
                    }}
                    activeOpacity={0.8}>
                    <View
                      style={[
                        styles.checkbox,
                        consentAccepted ? styles.checkboxActive : null,
                      ]}>
                      {consentAccepted ? (
                        <Text style={styles.checkmark}>✓</Text>
                      ) : null}
                    </View>
                    <View style={styles.consentTextWrap}>
                      <Text style={styles.consentText}>
                        I confirm I am the <Text style={styles.consentBold}>legal parent / guardian</Text>, accept FeeVault{' '}
                        <Text style={styles.consentLink}>Terms & DPDP Privacy Policy</Text>, and acknowledge that savings are{' '}
                        <Text style={styles.consentBold}>locked in bank escrow</Text> for direct school fee payment.
                      </Text>
                    </View>
                  </TouchableOpacity>
                  {consentError ? (
                    <Text style={styles.consentErrorText}>{consentError}</Text>
                  ) : null}
                </>
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
                    ? 'Create Account'
                    : 'Sign In'
                }
                loading={loading}
                icon={!loading ? <ArrowRightIcon color="#FFFFFF" size={17} /> : undefined}
                iconPosition="right"
                onPress={handleSubmit}
                style={styles.submitBtn}
              />

              {/* Biometric Shortcut (Only on Sign In) */}
              {!isSignUp ? (
                <>
                  <View style={styles.orRow}>
                    <View style={styles.orLine} />
                    <Text style={styles.orText}>OR</Text>
                    <View style={styles.orLine} />
                  </View>

                  <TouchableOpacity
                    style={styles.biometricBtn}
                    onPress={handleBiometricLogin}
                    activeOpacity={0.7}>
                    <View style={styles.bioIconWrap}>
                      <FingerprintIcon color={COLORS.feeBlue} size={24} />
                    </View>
                    <Text style={styles.bioText}>Quick Sign in with Biometrics</Text>
                  </TouchableOpacity>
                </>
              ) : null}
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
    paddingTop: 14,
    paddingBottom: 28,
  },

  /* Header */
  header: {
    alignItems: 'center',
    marginBottom: 22,
  },
  mainTitle: {
    marginTop: 8,
    fontSize: 30,
    fontWeight: '800',
    color: COLORS.textDark,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  brandFee: {
    color: COLORS.feeBlue,
  },
  brandVault: {
    color: COLORS.vaultGreen,
  },
  divider: {
    marginTop: 10,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dividerBlue: {
    width: 28,
    height: 3,
    borderTopLeftRadius: 2,
    borderBottomLeftRadius: 2,
    backgroundColor: COLORS.feeBlue,
  },
  dividerGreen: {
    width: 28,
    height: 3,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
    backgroundColor: COLORS.vaultGreen,
  },
  subTitle: {
    fontSize: 14,
    color: COLORS.textMid,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 12,
  },

  /* Form card – solid white, crisp border */
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    borderWidth: 1.5,
    borderColor: '#BFE6FF',
    shadowColor: '#35B6FF',
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
    marginBottom: 20,
  },

  /* Sign In / Sign Up switch */
  segment: {
    flexDirection: 'row',
    padding: 4,
    marginBottom: 20,
    borderRadius: 14,
    backgroundColor: '#EEF9FF',
    borderWidth: 1,
    borderColor: '#D3EBFF',
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentBtnActive: {
    backgroundColor: COLORS.feeBlue,
    shadowColor: COLORS.feeBlue,
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textMid,
  },
  segmentTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
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

  /* Unified Consent Styles */
  consentContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#F7FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 6,
    marginBottom: 14,
  },
  consentContainerError: {
    borderColor: COLORS.error,
    backgroundColor: '#FEF2F2',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.8,
    borderColor: '#94A3B8',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  checkboxActive: {
    borderColor: COLORS.feeBlue,
    backgroundColor: COLORS.feeBlue,
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 16,
  },
  consentTextWrap: {
    flex: 1,
  },
  consentText: {
    fontSize: 11.5,
    lineHeight: 17,
    color: COLORS.textMid,
  },
  consentBold: {
    fontWeight: '700',
    color: COLORS.textDark,
  },
  consentLink: {
    fontWeight: '700',
    color: COLORS.feeBlue,
    textDecorationLine: 'underline',
  },
  consentErrorText: {
    color: COLORS.error,
    fontSize: 11.5,
    fontWeight: '600',
    marginTop: -10,
    marginBottom: 14,
    paddingLeft: 4,
  },

  submitBtn: {
    marginTop: 4,
    marginBottom: 4,
  },

  /* OR divider + biometric */
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 14,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#D3EBFF',
  },
  orText: {
    marginHorizontal: 12,
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: COLORS.textLight,
  },
  biometricBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: '#F0F6FF',
    borderWidth: 1.2,
    borderColor: '#D4E4FA',
  },
  bioIconWrap: {
    marginRight: 10,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bioText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.feeBlue,
  },
});

export default LoginScreen;