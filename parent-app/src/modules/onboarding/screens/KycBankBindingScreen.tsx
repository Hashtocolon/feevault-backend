// ─────────────────────────────────────────────────────────────────────────────
//  KycBankBindingScreen.tsx
//  Step 2 of 3 — KYC & Refund Bank Account Binding
//  Static design: solid white, COLORS tokens only, no animation,
//  no gradient, no glass. Logic, validation flow and navigation unchanged.
// ─────────────────────────────────────────────────────────────────────────────
import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  StatusBar,
  Alert,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useNavigation} from '@react-navigation/native';
import Svg, {Path} from 'react-native-svg';

import {COLORS} from '../../../theme/colors';
import {CustomButton} from '../../../components/CustomButton';
import {CustomInput} from '../../../components/CustomInput';
import {ROUTES} from '../../../constants/routes';
import {RootStackParamList} from '../../../navigation/AppNavigator';
import {getAuthToken} from '../../../api/apiClient';
import {submitKycAndBank, getKycAndBank} from '../api/kycApi';

/* ---------- Icons ---------- */
const ArrowRightIcon = ({
  color = COLORS.textWhite,
  size = 18,
}: {
  color?: string;
  size?: number;
}) => (
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

const ShieldCheckIcon = ({
  color = COLORS.vaultGreen,
  size = 20,
}: {
  color?: string;
  size?: number;
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M9 12l2 2 4-4"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const BankCoinIcon = ({
  color = COLORS.feeBlue,
  size = 20,
}: {
  color?: string;
  size?: number;
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M3 21h18M3 10h18M5 10v11M19 10v11M9 10v11M15 10v11M12 2L2 7h20L12 2z"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

// ─── Types ───────────────────────────────────────────────────────────────────
type NavProp = NativeStackNavigationProp<
  RootStackParamList,
  typeof ROUTES.KYC_BANK_BINDING
>;

type VerificationStatus = 'idle' | 'verifying' | 'verified';

// ─── Component ───────────────────────────────────────────────────────────────
const KycBankBindingScreen: React.FC = () => {
  const navigation = useNavigation<NavProp>();

  // — PAN
  const [pan, setPan] = useState('');

  // — Bank fields
  const [holderName, setHolderName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifsc, setIfsc] = useState('');

  // Auto-detect Bank Name from IFSC
  const getDetectedBank = (code: string) => {
    if (!code || code.length < 4) return null;
    const prefix = code.slice(0, 4).toUpperCase();
    const bankMap: Record<string, string> = {
      SBIN: 'State Bank of India',
      HDFC: 'HDFC Bank',
      ICIC: 'ICICI Bank',
      UTIB: 'Axis Bank',
      KKBK: 'Kotak Mahindra Bank',
      PUNB: 'Punjab National Bank',
      BARB: 'Bank of Baroda',
      CNRB: 'Canara Bank',
      UBIN: 'Union Bank of India',
      IDFB: 'IDFC FIRST Bank',
      YESB: 'Yes Bank',
      INDB: 'IndusInd Bank',
    };
    return bankMap[prefix] || (code.length === 11 ? 'Verified RBI Commercial Bank' : null);
  };

  const detectedBank = getDetectedBank(ifsc);

  // — Penny-drop status
  const [verificationStatus, setVerificationStatus] =
    useState<VerificationStatus>('idle');

  // Load existing KYC & Bank status if already verified
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        if (!getAuthToken()) return;
        const existing = await getKycAndBank();
        if (existing && isMounted) {
          if (existing.pan_number) setPan(existing.pan_number);
          if (existing.account_holder_name) setHolderName(existing.account_holder_name);
          if (existing.bank_account_number) setAccountNumber(existing.bank_account_number);
          if (existing.ifsc_code) setIfsc(existing.ifsc_code);
          if (existing.is_bank_verified) setVerificationStatus('verified');
        }
      } catch {
        // Silent catch on initial fetch
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleVerifyAndBind = async () => {
    if (verificationStatus === 'verified') {
      navigation.navigate(ROUTES.ADD_CHILD);
      return;
    }

    const cleanPan = pan.trim().toUpperCase();
    if (!cleanPan) {
      Alert.alert('Required Field', 'Please enter your PAN number.');
      return;
    }
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    if (!panRegex.test(cleanPan)) {
      Alert.alert(
        'Invalid PAN',
        'Please enter a valid 10-character PAN number (e.g. ABCDE1234F).',
      );
      return;
    }

    const cleanHolder = holderName.trim();
    if (!cleanHolder) {
      Alert.alert(
        'Required Field',
        'Please enter the Account Holder Name as per bank records.',
      );
      return;
    }

    const cleanAcc = accountNumber.trim();
    if (!cleanAcc || cleanAcc.length < 9 || cleanAcc.length > 18) {
      Alert.alert(
        'Invalid Account',
        'Please enter a valid bank account number (9 to 18 digits).',
      );
      return;
    }

    const cleanIfsc = ifsc.trim().toUpperCase();
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    if (!cleanIfsc || !ifscRegex.test(cleanIfsc)) {
      Alert.alert(
        'Invalid IFSC',
        'Please enter a valid 11-character IFSC code (e.g. HDFC0001234).',
      );
      return;
    }

    if (!getAuthToken()) {
      Alert.alert(
        'Sign In Required',
        'Please complete registration or log in first to bind your bank account.',
      );
      return;
    }

    setVerificationStatus('verifying');
    try {
      const response = await submitKycAndBank({
        pan_number: cleanPan,
        bank_account_number: cleanAcc,
        ifsc_code: cleanIfsc,
        account_holder_name: cleanHolder,
      });

      setVerificationStatus('verified');
      Alert.alert(
        'Bank Account Verified',
        response.message ||
          '₹1 Penny-Drop verification successful! Your refund bank is securely linked.',
        [
          {
            text: 'Continue',
            onPress: () => {
              navigation.navigate(ROUTES.ADD_CHILD);
            },
          },
        ],
      );
    } catch (err: any) {
      setVerificationStatus('idle');
      Alert.alert(
        'Verification Failed',
        err.message ||
          'Could not verify bank account. Please check the details and try again.',
      );
    }
  };

  // ── Penny-drop status pill ─────────────────────────────────────────────────
  const renderVerificationPill = () => {
    if (verificationStatus === 'verifying') {
      return (
        <View style={[styles.statusPill, styles.statusPillPending]}>
          <ActivityIndicator
            size="small"
            color={COLORS.warning}
            style={styles.statusSpinner}
          />
          <Text style={[styles.statusPillText, {color: COLORS.warning}]}>
            Verifying…
          </Text>
        </View>
      );
    }
    if (verificationStatus === 'verified') {
      return (
        <View style={[styles.statusPill, styles.statusPillVerified]}>
          <Text style={[styles.statusPillText, {color: COLORS.pillText}]}>
            Verified ✓
          </Text>
        </View>
      );
    }
    return (
      <View style={[styles.statusPill, styles.statusPillPending]}>
        <Text style={[styles.statusPillText, {color: COLORS.warning}]}>
          Pending Verification
        </Text>
      </View>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {/* ── Title block ── */}
          <Text style={styles.title}>Link Your Bank</Text>

          <View style={styles.divider}>
            <View style={styles.dividerBlue} />
            <View style={styles.dividerGreen} />
          </View>

          <Text style={styles.subtitle}>
            Verify once, and your money stays protected.
          </Text>

          {/* ── Progress: Step 2 of 3 ── */}
          <View style={styles.progressContainer}>
            {[1, 2, 3].map(step => (
              <View
                key={step}
                style={[
                  styles.progressDot,
                  step === 2 && styles.progressDotActive,
                  step < 2 && styles.progressDotDone,
                ]}
              />
            ))}
          </View>
          <Text style={styles.progressLabel}>STEP 2 OF 3</Text>

          {/* ══════════════ Card 1 — PAN Verification ══════════════ */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.iconTile}>
                <Text style={styles.cardHeaderIcon}>🪪</Text>
              </View>
              <View style={styles.cardHeaderTitles}>
                <Text style={styles.cardTitle}>PAN Verification</Text>
                <Text style={styles.cardSubtitle}>Identity & tax compliance</Text>
              </View>
            </View>

            <CustomInput
              label="PAN Number"
              value={pan}
              onChangeText={t => setPan(t.toUpperCase())}
              autoCapitalize="characters"
              maxLength={10}
            />

            <View style={styles.helperRow}>
              <Text style={styles.helperIcon}>ℹ️</Text>
              <Text style={styles.helperText}>
                Required for TDS tax compliance &amp; identity verification
              </Text>
            </View>
          </View>

          {/* ══════════════ Card 2 — Refund Bank Account ══════════════ */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.iconTile}>
                <Text style={styles.cardHeaderIcon}>🏦</Text>
              </View>
              <View style={styles.cardHeaderTitles}>
                <Text style={styles.cardTitle}>Refund Bank Account</Text>
                <Text style={styles.cardSubtitle}>
                  Where your refunds will be sent
                </Text>
              </View>
            </View>

            <CustomInput
              label="Account Holder Name"
              value={holderName}
              onChangeText={setHolderName}
              autoCapitalize="words"
            />
            <CustomInput
              label="Bank Account Number"
              value={accountNumber}
              onChangeText={setAccountNumber}
              keyboardType="numeric"
            />
            <CustomInput
              label="IFSC Code"
              value={ifsc}
              onChangeText={t => setIfsc(t.toUpperCase())}
              autoCapitalize="characters"
              maxLength={11}
              containerStyle={{marginBottom: detectedBank ? 6 : 14}}
            />

            {/* Auto-detected bank badge */}
            {detectedBank ? (
              <View style={styles.detectedBankPill}>
                <View style={styles.bankDot} />
                <Text style={styles.detectedBankText}>
                  Bank Identified:{' '}
                  <Text style={styles.detectedBankName}>{detectedBank}</Text>
                </Text>
              </View>
            ) : null}
          </View>

          {/* ══════════════ Card 3 — Penny Drop Verification ══════════════ */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.iconTile}>
                <BankCoinIcon color={COLORS.feeBlue} size={20} />
              </View>
              <View style={styles.cardHeaderTitles}>
                <Text style={styles.cardTitle}>₹1 Penny-Drop Verification</Text>
                <Text style={styles.cardSubtitle}>Direct IMPS Account Handshake</Text>
              </View>
            </View>

            {/* Process flow */}
            <View style={styles.pennyProcessCard}>
              <View style={styles.pennyStep}>
                <View style={styles.pennyBadge}>
                  <Text style={styles.pennyBadgeText}>₹1</Text>
                </View>
                <View style={styles.pennyStepTextWrap}>
                  <Text style={styles.pennyStepTitle}>Instant ₹1 Test Deposit</Text>
                  <Text style={styles.pennyStepSub}>
                    FeeVault deposits ₹1 into your account via IMPS to verify active
                    status.
                  </Text>
                </View>
              </View>

              <View style={styles.pennyDivider} />

              <View style={styles.pennyStep}>
                <View style={[styles.pennyBadge, styles.pennyBadgeGreen]}>
                  <ShieldCheckIcon color={COLORS.vaultGreen} size={16} />
                </View>
                <View style={styles.pennyStepTextWrap}>
                  <Text style={styles.pennyStepTitle}>Automatic Name Match</Text>
                  <Text style={styles.pennyStepSub}>
                    Confirms your name with bank records for secure returns & refunds.
                  </Text>
                </View>
              </View>
            </View>

            {/* Live status row */}
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Verification Status</Text>
              {renderVerificationPill()}
            </View>
          </View>

          {/* ── CTA ── */}
          <CustomButton
            label={
              verificationStatus === 'verified'
                ? 'Continue'
                : 'Verify Bank Account'
            }
            icon={<ArrowRightIcon color={COLORS.textWhite} size={18} />}
            iconPosition="right"
            onPress={handleVerifyAndBind}
            loading={verificationStatus === 'verifying'}
            style={styles.ctaButton}
          />

          {/* Footer */}
          <View style={styles.footerRow}>
            <View style={styles.footerRule} />
            <Text style={styles.footerText}>SECURE • SIMPLE • SMART</Text>
            <View style={styles.footerRule} />
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.cardBg,
  },
  safe: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 28,
  },

  // Title
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.feeBlue,
    textAlign: 'center',
    letterSpacing: -0.2,
    marginTop: 22,
  },
  divider: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 12,
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
  subtitle: {
    fontSize: 14,
    color: COLORS.textMid,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 24,
    marginBottom: 20,
  },

  // Progress
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressDot: {
    width: 32,
    height: 6,
    borderRadius: 3,
    marginHorizontal: 3,
    backgroundColor: COLORS.progressTrack,
  },
  progressDotDone: {
    backgroundColor: COLORS.vaultGreen,
  },
  progressDotActive: {
    backgroundColor: COLORS.progressFill,
    width: 44,
  },
  progressLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    color: COLORS.textMid,
    textAlign: 'center',
    letterSpacing: 1.6,
    marginTop: 10,
    marginBottom: 24,
  },

  // Card – solid white, thin border, soft shadow
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.divider,
    padding: 20,
    marginBottom: 16,
    shadowColor: COLORS.navy,
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 14,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: COLORS.divider,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardHeaderIcon: {
    fontSize: 20,
  },
  cardHeaderTitles: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.feeBlue,
    letterSpacing: 0.1,
  },
  cardSubtitle: {
    fontSize: 11.5,
    color: COLORS.textMid,
    marginTop: 2,
    fontWeight: '500',
  },

  // Helper under PAN
  helperRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.inputBg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.divider,
    padding: 10,
    marginTop: 4,
  },
  helperIcon: {
    fontSize: 13,
    marginRight: 6,
    marginTop: 1,
  },
  helperText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.text,
    lineHeight: 17,
    fontWeight: '500',
  },

  // Detected bank
  detectedBankPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: COLORS.pillBg,
    marginTop: 2,
    marginBottom: 4,
  },
  bankDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.pillDot,
    marginRight: 8,
  },
  detectedBankText: {
    fontSize: 12,
    color: COLORS.pillText,
    fontWeight: '500',
  },
  detectedBankName: {
    fontWeight: '800',
    color: COLORS.pillText,
  },

  // Penny process flow
  pennyProcessCard: {
    backgroundColor: COLORS.inputBg,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.divider,
    marginBottom: 16,
  },
  pennyStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  pennyBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.feeBlue,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 1,
  },
  pennyBadgeGreen: {
    backgroundColor: COLORS.pillBg,
  },
  pennyBadgeText: {
    color: COLORS.textWhite,
    fontSize: 12,
    fontWeight: '800',
  },
  pennyStepTextWrap: {
    flex: 1,
  },
  pennyStepTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textDark,
    marginBottom: 2,
  },
  pennyStepSub: {
    fontSize: 11.5,
    color: COLORS.textMid,
    lineHeight: 16,
  },
  pennyDivider: {
    height: 1,
    backgroundColor: COLORS.divider,
    marginVertical: 10,
    marginLeft: 40,
  },

  // Status row
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMid,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusPillPending: {
    backgroundColor: COLORS.cardBg,
    borderColor: COLORS.warning,
  },
  statusPillVerified: {
    backgroundColor: COLORS.pillBg,
    borderColor: COLORS.pillBg,
  },
  statusSpinner: {
    marginRight: 6,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // CTA
  ctaButton: {
    marginTop: 8,
    marginBottom: 18,
  },

  // Footer
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

export default KycBankBindingScreen;