// ─────────────────────────────────────────────
//  FeeVault Parent App — Login Screen (Email + Password)
//  Phase 1 Auth: Email & Password (No OTP)
//  Static design: solid white, COLORS tokens only, no animation,
//  no gradient, no glass. Validation & navigation unchanged.
// ─────────────────────────────────────────────

import React, { useState, useRef } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Svg, { Path, Circle } from 'react-native-svg';
import { RootStackParamList } from '../../../navigation/AppNavigator';
import { ROUTES } from '../../../constants/routes';
import { COLORS } from '../../../theme/colors';
import { CustomInput } from '../../../components/CustomInput';
import { CustomButton } from '../../../components/CustomButton';
import { registerParent, loginParent } from '../api/authApi';

/* ---------- Icons ---------- */
const EyeOpenIcon = ({ color = COLORS.muted, size = 20 }: { color?: string; size?: number }) => (
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

const EyeClosedIcon = ({ color = COLORS.muted, size = 20 }: { color?: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M17.94 17.94A10.07 10.07 0 0112 20C5 20 1 12 1 12A18.45 18.45 0 015.06 6.06M9.9 4.24A9.12 9.12 0 0112 4C19 4 23 12 23 12A18.5 18.5 0 0119.82 16.14"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path d="M1 1L23 23" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <Path
      d="M9.88 9.88A3 3 0 1014.12 14.12"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const FingerprintIcon = ({ color = COLORS.feeBlue, size = 22 }: { color?: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M14 13.12c0 2.38 0 6.38-1 8.88" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M17.29 21.02c.12-.6.43-2.3.5-3.02" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M2 12a10 10 0 0 1 18-6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M2 16h.01" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M21.8 16c.2-2 .131-5.354 0-6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M8.65 22c.21-.66.45-1.32.57-2" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M9 6.8a6 6 0 0 1 9 5.2v2" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const ArrowRightIcon = ({ color = COLORS.textWhite, size = 18 }: { color?: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M5 12H19M19 12L12 5M19 12L12 19" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RelationType = 'Father' | 'Mother' | 'Guardian';

export const LoginScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const scrollViewRef = useRef<any>(null);

  // Mode: Sign In vs Sign Up
  const [isSignUp, setIsSignUp] = useState(false);

  // Form fields
  const [relation, setRelation] = useState<RelationType>('Father');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [alternatePhone, setAlternatePhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Errors & Loading
  const [fullNameError, setFullNameError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [loading, setLoading] = useState(false);

  const clearErrors = () => {
    setFullNameError('');
    setPhoneError('');
    setEmailError('');
    setPasswordError('');
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

  const handleSubmit = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      if (isSignUp) {
        await registerParent({
          relation,
          full_name: fullName.trim(),
          phone: phone.trim(),
          alternate_phone: alternatePhone.trim() || undefined,
          email: email.trim() || undefined,
          password,
        });
        setLoading(false);
        // Navigate to Step 2: KYC & Bank Binding
        navigation.navigate(ROUTES.KYC_BANK_BINDING);
      } else {
        await loginParent({
          username: email.trim(), // Accepts email or mobile number
          password,
        });
        setLoading(false);
        // Navigate directly to Home dashboard on login
        navigation.navigate(ROUTES.HOME);
      }
    } catch (err: any) {
      setLoading(false);
      Alert.alert(isSignUp ? 'Registration Failed' : 'Sign In Failed', err.message);
    }
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

  const eyeIcon = showPassword ? (
    <EyeOpenIcon color={COLORS.feeBlue} size={20} />
  ) : (
    <EyeClosedIcon color={COLORS.muted} size={20} />
  );

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" />

      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardView}>
          <ScrollView
            ref={scrollViewRef}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets={true}>
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
                  : 'Sign in to access your child’s FeeVault and track school fee savings.'}
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
                  <Text style={[styles.segmentText, !isSignUp && styles.segmentTextActive]}>
                    Sign In
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.segmentBtn, isSignUp && styles.segmentBtnActive]}
                  onPress={() => switchMode(true)}
                  activeOpacity={0.85}>
                  <Text style={[styles.segmentText, isSignUp && styles.segmentTextActive]}>
                    Sign Up
                  </Text>
                </TouchableOpacity>
              </View>

              {isSignUp ? (
                <>
                  {/* 1. Relation Selection First */}
                  <View style={styles.relationContainer}>
                    <Text style={styles.inputLabel}>You are the child's</Text>
                    <View style={styles.relationRow}>
                      {(['Father', 'Mother', 'Guardian'] as RelationType[]).map((rel) => {
                        const selected = relation === rel;
                        return (
                          <TouchableOpacity
                            key={rel}
                            style={[styles.relationChip, selected && styles.relationChipActive]}
                            onPress={() => setRelation(rel)}
                            activeOpacity={0.8}>
                            <Text
                              style={[
                                styles.relationChipText,
                                selected && styles.relationChipTextActive,
                              ]}>
                              {rel}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {/* 2. Full Name */}
                  <CustomInput
                    label={`${relation}'s Full Name`}
                    value={fullName}
                    onChangeText={(val) => {
                      setFullName(val);
                      if (fullNameError) setFullNameError('');
                    }}
                    autoCapitalize="words"
                    error={fullNameError}
                  />

                  {/* 3. Primary Mobile Number */}
                  <CustomInput
                    label="Primary Contact Number"
                    value={phone}
                    onChangeText={(val) => {
                      setPhone(val);
                      if (phoneError) setPhoneError('');
                    }}
                    keyboardType="phone-pad"
                    maxLength={10}
                    error={phoneError}
                  />

                  {/* 4. Alternate Contact Number */}
                  <CustomInput
                    label="Alternate Contact Number (Optional)"
                    value={alternatePhone}
                    onChangeText={setAlternatePhone}
                    keyboardType="phone-pad"
                    maxLength={10}
                  />
                </>
              ) : null}

              <CustomInput
                label="Email Address"
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
                value={password}
                onChangeText={(val) => {
                  setPassword(val);
                  if (passwordError) setPasswordError('');
                }}
                onFocus={() => {
                  setTimeout(() => {
                    scrollViewRef.current?.scrollToEnd({ animated: true });
                  }, 200);
                }}
                secureTextEntry={!showPassword}
                error={passwordError}
                rightIcon={eyeIcon}
                onRightIconPress={() => setShowPassword(!showPassword)}
              />

              {isSignUp ? (
                <>
                  <CustomInput
                    label="Confirm Password"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    onFocus={() => {
                      setTimeout(() => {
                        scrollViewRef.current?.scrollToEnd({ animated: true });
                      }, 200);
                    }}
                    secureTextEntry={!showPassword}
                    rightIcon={eyeIcon}
                    onRightIconPress={() => setShowPassword(!showPassword)}
                  />

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
                label={loading ? 'Authenticating...' : isSignUp ? 'Create Account' : 'Sign In'}
                loading={loading}
                icon={!loading ? <ArrowRightIcon color={COLORS.textWhite} size={17} /> : undefined}
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

            {/* Footer */}
            <View style={styles.footerRow}>
              <View style={styles.footerRule} />
              <Text style={styles.footerText}>SECURE • SIMPLE • SMART</Text>
              <View style={styles.footerRule} />
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
    backgroundColor: COLORS.cardBg,
  },
  safe: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 160,
  },

  /* Header */
  header: {
    alignItems: 'center',
    marginTop: 26,
    marginBottom: 26,
  },
  mainTitle: {
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

  /* Form card – solid white, crisp border, soft shadow */
  formCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.divider,
    shadowColor: COLORS.navy,
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
    marginBottom: 20,
  },

  /* Sign In / Sign Up switch */
  segment: {
    flexDirection: 'row',
    padding: 4,
    marginBottom: 20,
    borderRadius: 14,
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: COLORS.divider,
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
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textMid,
  },
  segmentTextActive: {
    color: COLORS.textWhite,
    fontWeight: '800',
  },

  /* Relation Selector */
  relationContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textDark,
    marginBottom: 8,
  },
  relationRow: {
    flexDirection: 'row',
  },
  relationChip: {
    flex: 1,
    paddingVertical: 10,
    marginHorizontal: 3,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.inputBg,
    borderWidth: 1.5,
    borderColor: COLORS.divider,
  },
  relationChipActive: {
    backgroundColor: '#EFF6FF',
    borderColor: COLORS.feeBlue,
  },
  relationChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textMid,
  },
  relationChipTextActive: {
    color: COLORS.feeBlue,
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
    backgroundColor: COLORS.divider,
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
    backgroundColor: COLORS.inputBg,
    borderWidth: 1.2,
    borderColor: COLORS.inputBorder,
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

  /* Footer */
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerRule: {
    width: 22,
    height: 1,
    backgroundColor: COLORS.textLight,
    opacity: 0.5,
  },
  footerText: {
    marginHorizontal: 10,
    fontSize: 9.5,
    letterSpacing: 2.4,
    fontWeight: '800',
    color: COLORS.textLight,
  },
});

export default LoginScreen;