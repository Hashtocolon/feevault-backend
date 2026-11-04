// ─────────────────────────────────────────────
//  Onboarding Screen: Security Setup
//  Biometric toggle + 4-digit MPIN setup
// ─────────────────────────────────────────────
import React, {useRef, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useNavigation} from '@react-navigation/native';

import {COLORS} from '../../../theme/colors';
import {CustomButton} from '../../../components/CustomButton';
import {PillBadge} from '../../../components/PillBadge';
import Header from '../../../components/Header';
import {ROUTES} from '../../../constants/routes';
import {RootStackParamList} from '../../../navigation/AppNavigator';

type NavProp = NativeStackNavigationProp<
  RootStackParamList,
  typeof ROUTES.SECURITY_SETUP
>;

// ── Progress Step Indicator ───────────────────
const StepIndicator: React.FC<{current: number; total: number}> = ({
  current,
  total,
}) => (
  <View style={styles.stepRow}>
    {Array.from({length: total}).map((_, i) => {
      const active = i < current;
      const isCurrent = i === current - 1;
      return (
        <View
          key={i}
          style={[
            styles.stepDot,
            active && styles.stepDotActive,
            isCurrent && styles.stepDotCurrent,
          ]}
        />
      );
    })}
    <Text style={styles.stepLabel}>
      Step {current} of {total}
    </Text>
  </View>
);

// ── MPIN Input Row ────────────────────────────
type TInputRef = React.RefObject<any>;

interface MpinRowProps {
  value: string[];
  refs: TInputRef[];
  nextRefs?: TInputRef[];
  onChange: (val: string[]) => void;
  label: string;
}

const MpinRow: React.FC<MpinRowProps> = ({
  value,
  refs,
  nextRefs,
  onChange,
  label,
}) => {
  const handleChange = (text: string, idx: number) => {
    const digit = text.replace(/[^0-9]/g, '').slice(-1);
    const updated = [...value];
    updated[idx] = digit;
    onChange(updated);

    if (digit && idx < 3) {
      refs[idx + 1]?.current?.focus();
    } else if (digit && idx === 3 && nextRefs && nextRefs[0]) {
      nextRefs[0]?.current?.focus();
    }
  };

  const handleKeyPress = (key: string, idx: number) => {
    if (key === 'Backspace' && !value[idx] && idx > 0) {
      refs[idx - 1]?.current?.focus();
    }
  };

  return (
    <View style={styles.mpinSection}>
      <Text style={styles.mpinLabel}>{label}</Text>
      <View style={styles.mpinRow}>
        {[0, 1, 2, 3].map(idx => (
          <TextInput
            key={idx}
            ref={refs[idx] as any}
            style={[
              styles.mpinBox,
              value[idx] ? styles.mpinBoxFilled : styles.mpinBoxEmpty,
            ]}
            value={value[idx] ? '●' : ''}
            onChangeText={text => handleChange(text, idx)}
            onKeyPress={({nativeEvent}) =>
              handleKeyPress(nativeEvent.key, idx)
            }
            keyboardType="numeric"
            maxLength={1}
            secureTextEntry={false}
            textAlign="center"
            caretHidden
            selectTextOnFocus
          />
        ))}
      </View>
    </View>
  );
};

// ── Main Screen ───────────────────────────────
const SecuritySetupScreen: React.FC = () => {
  const navigation = useNavigation<NavProp>();

  // Biometric
  const [biometricEnabled, setBiometricEnabled] = useState(false);

  // MPIN state
  const [mpin, setMpin] = useState<string[]>(['', '', '', '']);
  const [confirmMpin, setConfirmMpin] = useState<string[]>(['', '', '', '']);

  // Refs for MPIN boxes
  const mpinRefs: TInputRef[] = [
    useRef<React.ElementRef<typeof TextInput>>(null),
    useRef<React.ElementRef<typeof TextInput>>(null),
    useRef<React.ElementRef<typeof TextInput>>(null),
    useRef<React.ElementRef<typeof TextInput>>(null),
  ];
  const confirmRefs: TInputRef[] = [
    useRef<React.ElementRef<typeof TextInput>>(null),
    useRef<React.ElementRef<typeof TextInput>>(null),
    useRef<React.ElementRef<typeof TextInput>>(null),
    useRef<React.ElementRef<typeof TextInput>>(null),
  ];

  // Validation
  const mpinComplete = mpin.every(d => d !== '');
  const confirmComplete = confirmMpin.every(d => d !== '');
  const mpinMatch = mpin.join('') === confirmMpin.join('');
  const canProceed = mpinComplete && confirmComplete && mpinMatch;

  const handleSetUp = () => {
    if (canProceed) {
      navigation.navigate(ROUTES.DEVICE_BOUND);
    }
  };

  // Mismatch hint
  const showMismatch = mpinComplete && confirmComplete && !mpinMatch;

  return (
    <LinearGradient
      colors={['#D9F3FF', '#EEF9FF', '#F7FCFF', '#E9FBF1']}
      locations={[0, 0.35, 0.7, 1]}
      style={styles.gradient}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        {/* Header */}
        <Header
          title="Security Setup"
          showBack
          onBackPress={() => navigation.goBack()}
        />

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>

          {/* Pill Badge */}
          <PillBadge label="DEVICE PROTECTION" style={styles.pill} />

          {/* Title Block */}
          <Text style={styles.title}>Secure Your FeeVault Account</Text>
          <Text style={styles.subtitle}>
            Set up biometric or MPIN to protect your savings
          </Text>

          {/* Progress Indicator */}
          <StepIndicator current={3} total={5} />

          {/* ── Biometric Card ── */}
          <View style={styles.card}>
            {/* Lock Icon */}
            <Text style={styles.lockIcon}>🔐</Text>

            <Text style={styles.cardTitle}>Biometric Authentication</Text>
            <Text style={styles.cardSubtitle}>
              Use your fingerprint or face ID for fast, secure access
            </Text>

            {/* Toggle */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setBiometricEnabled(prev => !prev)}
              style={[
                styles.toggleRow,
                biometricEnabled
                  ? styles.toggleRowEnabled
                  : styles.toggleRowDisabled,
              ]}>
              <Text style={styles.toggleLabel}>
                Biometric Sign In:{' '}
                <Text
                  style={[
                    styles.toggleState,
                    {
                      color: biometricEnabled
                        ? COLORS.vaultGreen
                        : COLORS.textLight,
                    },
                  ]}>
                  {biometricEnabled ? 'Enabled' : 'Disabled'}
                </Text>
              </Text>
              {/* Custom pill toggle switch */}
              <View
                style={[
                  styles.pillTrack,
                  biometricEnabled
                    ? styles.pillTrackOn
                    : styles.pillTrackOff,
                ]}>
                <View
                  style={[
                    styles.pillThumb,
                    biometricEnabled
                      ? styles.pillThumbOn
                      : styles.pillThumbOff,
                  ]}
                />
              </View>
            </TouchableOpacity>
          </View>

          {/* ── MPIN Card ── */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>4-Digit Backup MPIN</Text>
            <Text style={styles.cardSubtitle}>
              Used when biometric is unavailable
            </Text>

            <View style={styles.mpinDivider} />

            <MpinRow
              label="Enter MPIN"
              value={mpin}
              refs={mpinRefs}
              nextRefs={confirmRefs}
              onChange={setMpin}
            />

            <View style={styles.mpinDivider} />

            <MpinRow
              label="Confirm MPIN"
              value={confirmMpin}
              refs={confirmRefs}
              onChange={setConfirmMpin}
            />

            {showMismatch && (
              <Text style={styles.mismatchText}>
                ⚠️ MPINs do not match. Please try again.
              </Text>
            )}

            {mpinComplete && confirmComplete && mpinMatch && (
              <Text style={styles.matchText}>✅ MPINs match!</Text>
            )}
          </View>

          {/* CTA Button */}
          <CustomButton
            label="Set Up Security →"
            onPress={handleSetUp}
            disabled={!canProceed}
            style={styles.ctaBtn}
          />

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
};

// ── Styles ────────────────────────────────────
const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safe: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },

  // Pill
  pill: {
    marginTop: 8,
    marginBottom: 16,
  },

  // Title
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.textDark,
    textAlign: 'center',
    letterSpacing: 0.2,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textMid,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
    paddingHorizontal: 8,
  },

  // Step Indicator
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    gap: 6,
  },
  stepDot: {
    width: 28,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.progressTrack,
  },
  stepDotActive: {
    backgroundColor: COLORS.feeBlue,
  },
  stepDotCurrent: {
    backgroundColor: COLORS.feeBlue,
    width: 36,
  },
  stepLabel: {
    fontSize: 12,
    color: COLORS.textMid,
    fontWeight: '600',
    marginLeft: 10,
  },

  // Glass Card
  card: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 24,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 3},
    shadowOpacity: 0.08,
    shadowRadius: 12,
    padding: 24,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
  },

  // Biometric
  lockIcon: {
    fontSize: 56,
    textAlign: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textDark,
    textAlign: 'center',
    marginBottom: 6,
  },
  cardSubtitle: {
    fontSize: 13,
    color: COLORS.textMid,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20,
  },

  // Toggle
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1.5,
  },
  toggleRowEnabled: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  toggleRowDisabled: {
    backgroundColor: '#F8FAFC',
    borderColor: COLORS.inputBorder,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textDark,
    flex: 1,
  },
  toggleState: {
    fontWeight: '700',
  },

  // Custom pill toggle switch
  pillTrack: {
    width: 48,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    paddingHorizontal: 3,
    marginLeft: 12,
  },
  pillTrackOn: {
    backgroundColor: COLORS.vaultGreen,
  },
  pillTrackOff: {
    backgroundColor: '#CBD5E1',
  },
  pillThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  pillThumbOn: {
    alignSelf: 'flex-end',
  },
  pillThumbOff: {
    alignSelf: 'flex-start',
  },

  // MPIN
  mpinDivider: {
    height: 1,
    backgroundColor: COLORS.divider,
    marginVertical: 16,
  },
  mpinSection: {
    alignItems: 'center',
  },
  mpinLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textMid,
    marginBottom: 14,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  mpinRow: {
    flexDirection: 'row',
    gap: 14,
  },
  mpinBox: {
    width: 56,
    height: 56,
    borderRadius: 14,
    borderWidth: 2,
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.feeBlue,
    backgroundColor: '#F8FAFC',
  },
  mpinBoxFilled: {
    borderColor: COLORS.feeBlue,
    backgroundColor: '#EEF4FF',
  },
  mpinBoxEmpty: {
    borderColor: COLORS.inputBorder,
    backgroundColor: '#F8FAFC',
  },

  // Validation
  mismatchText: {
    fontSize: 13,
    color: COLORS.error,
    textAlign: 'center',
    marginTop: 14,
    fontWeight: '600',
  },
  matchText: {
    fontSize: 13,
    color: COLORS.vaultGreen,
    textAlign: 'center',
    marginTop: 14,
    fontWeight: '600',
  },

  // CTA
  ctaBtn: {
    marginTop: 4,
  },
  bottomSpacer: {
    height: 16,
  },
});

export default SecuritySetupScreen;
