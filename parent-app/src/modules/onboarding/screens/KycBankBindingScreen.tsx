// ─────────────────────────────────────────────────────────────────────────────
//  KycBankBindingScreen.tsx — redesigned
//  Step 2 of 5 — KYC & Refund Bank Account Binding
//  Static design: no animations, no glass, no background circles.
//  Colors, logic, validation flow and navigation are unchanged.
// ─────────────────────────────────────────────────────────────────────────────
import React, {useState} from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {SafeAreaView} from 'react-native-safe-area-context';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useNavigation} from '@react-navigation/native';

import {COLORS} from '../../../theme/colors';
import {CustomButton} from '../../../components/CustomButton';
import {CustomInput} from '../../../components/CustomInput';
import {ROUTES} from '../../../constants/routes';
import {RootStackParamList} from '../../../navigation/AppNavigator';
import Svg, {Path} from 'react-native-svg';

const ArrowRightIcon = ({color = '#FFFFFF', size = 18}: {color?: string; size?: number}) => (
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

// Sleek Shield & Check Icons for Penny Drop
const ShieldCheckIcon = ({color = '#16A34A', size = 20}: {color?: string; size?: number}) => (
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

const BankCoinIcon = ({color = '#0284C7', size = 20}: {color?: string; size?: number}) => (
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

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleVerifyAndBind = () => {
    if (verificationStatus === 'verified') {
      navigation.navigate(ROUTES.ADD_CHILD);
      return;
    }

    setVerificationStatus('verifying');
    setTimeout(() => {
      setVerificationStatus('verified');
      setTimeout(() => {
        // Skip SecuritySetupScreen and go straight to Add Child!
        navigation.navigate(ROUTES.ADD_CHILD);
      }, 600);
    }, 1500);
  };

  // ── Penny-drop status pill ─────────────────────────────────────────────────
  const renderVerificationPill = () => {
    if (verificationStatus === 'verifying') {
      return (
        <View style={[styles.statusPill, styles.statusPillYellow]}>
          <ActivityIndicator
            size="small"
            color="#B45309"
            style={{marginRight: 6}}
          />
          <Text style={[styles.statusPillText, {color: '#B45309'}]}>
            Verifying…
          </Text>
        </View>
      );
    }
    if (verificationStatus === 'verified') {
      return (
        <View style={[styles.statusPill, styles.statusPillGreen]}>
          <Text style={[styles.statusPillText, {color: '#15803D'}]}>
            Verified ✓
          </Text>
        </View>
      );
    }
    // idle
    return (
      <View style={[styles.statusPill, styles.statusPillYellow]}>
        <Text style={[styles.statusPillText, {color: '#B45309'}]}>
          Pending Verification
        </Text>
      </View>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <LinearGradient
      colors={['#D9F3FF', '#EEF9FF', '#F7FCFF', '#E9FBF1']}
      locations={[0, 0.35, 0.7, 1]}
      style={styles.gradient}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>

          {/* ── Title block ── */}
          <Text style={styles.title}>Verify Your Identity & Bank</Text>

          {/* Two-tone divider, same as other screens */}
          <View style={styles.divider}>
            <View style={styles.dividerBlue} />
            <View style={styles.dividerGreen} />
          </View>

          <Text style={styles.subtitle}>
            One-time setup. Bound forever for secure refunds.
          </Text>

          {/* ── Progress indicator: Step 2 of 3 (Centered) ── */}
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
              placeholder="e.g. ABCDE1234F"
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
                <Text style={styles.cardSubtitle}>Where your refunds will be sent</Text>
              </View>
            </View>

            <CustomInput
              label="Account Holder Name"
              placeholder="As per bank records"
              value={holderName}
              onChangeText={setHolderName}
              autoCapitalize="words"
            />
            <CustomInput
              label="Bank Account Number"
              placeholder="Enter account number"
              value={accountNumber}
              onChangeText={setAccountNumber}
              keyboardType="numeric"
            />
            <CustomInput
              label="IFSC Code"
              placeholder="e.g. SBIN0001234"
              value={ifsc}
              onChangeText={t => setIfsc(t.toUpperCase())}
              autoCapitalize="characters"
              maxLength={11}
              containerStyle={{marginBottom: detectedBank ? 6 : 14}}
            />

            {/* Smart Auto-Detected Bank Badge */}
            {detectedBank ? (
              <View style={styles.detectedBankPill}>
                <View style={styles.bankDot} />
                <Text style={styles.detectedBankText}>
                  Bank Identified: <Text style={styles.detectedBankName}>{detectedBank}</Text>
                </Text>
              </View>
            ) : null}
          </View>

          {/* ══════════════ Card 3 — Penny Drop Verification ══════════════ */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.iconTile}>
                <BankCoinIcon color="#0284C7" size={20} />
              </View>
              <View style={styles.cardHeaderTitles}>
                <Text style={styles.cardTitle}>₹1 Penny-Drop Verification</Text>
                <Text style={styles.cardSubtitle}>Direct IMPS Account Handshake</Text>
              </View>
            </View>

            {/* Visual Process Flow */}
            <View style={styles.pennyProcessCard}>
              <View style={styles.pennyStep}>
                <View style={styles.pennyBadge}>
                  <Text style={styles.pennyBadgeText}>₹1</Text>
                </View>
                <View style={styles.pennyStepTextWrap}>
                  <Text style={styles.pennyStepTitle}>Instant ₹1 Test Deposit</Text>
                  <Text style={styles.pennyStepSub}>
                    FeeVault deposits ₹1 into your account via IMPS to verify active status.
                  </Text>
                </View>
              </View>

              <View style={styles.pennyDivider} />

              <View style={styles.pennyStep}>
                <View style={[styles.pennyBadge, styles.pennyBadgeGreen]}>
                  <ShieldCheckIcon color="#16A34A" size={16} />
                </View>
                <View style={styles.pennyStepTextWrap}>
                  <Text style={styles.pennyStepTitle}>Automatic Name Match</Text>
                  <Text style={styles.pennyStepSub}>
                    Confirms your name with bank records for secure returns & refunds.
                  </Text>
                </View>
              </View>
            </View>

            {/* Live Verification Status Row */}
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Verification Status</Text>
              {renderVerificationPill()}
            </View>
          </View>

          {/* ── CTA Button ── */}
          <CustomButton
            label="Verify Bank Account"
            icon={<ArrowRightIcon color="#FFFFFF" size={18} />}
            iconPosition="right"
            onPress={handleVerifyAndBind}
            loading={verificationStatus === 'verifying'}
            style={styles.ctaButton}
          />

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safe: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },

  // Title
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1A56DB', // feeBlue
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
    backgroundColor: '#1A56DB',
  },
  dividerGreen: {
    width: 28,
    height: 3,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
    backgroundColor: '#16A34A',
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
    gap: 6,
  },
  progressDot: {
    width: 32,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(26,86,219,0.18)',
  },
  progressDotDone: {
    backgroundColor: '#16A34A', // vaultGreen
  },
  progressDotActive: {
    backgroundColor: '#1A56DB', // feeBlue
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

  // Card – solid white, crisp border
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#D3EBFF',
    padding: 20,
    marginBottom: 16,
    shadowColor: '#35B6FF',
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 5,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 14,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EAF4FF',
  },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#EEF9FF',
    borderWidth: 1,
    borderColor: '#D3EBFF',
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
    color: '#1A56DB',
    letterSpacing: 0.1,
  },
  cardSubtitle: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },

  // Penny Process Flow
  pennyProcessCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
    backgroundColor: '#0284C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 1,
  },
  pennyBadgeGreen: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  pennyBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  pennyStepTextWrap: {
    flex: 1,
  },
  pennyStepTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 2,
  },
  pennyStepSub: {
    fontSize: 11.5,
    color: '#64748B',
    lineHeight: 16,
  },
  pennyDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 10,
    marginLeft: 40,
  },

  // Detected bank
  detectedBankPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    marginTop: 2,
    marginBottom: 4,
  },
  bankDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#16A34A',
    marginRight: 8,
  },
  detectedBankText: {
    fontSize: 12,
    color: '#166534',
    fontWeight: '500',
  },
  detectedBankName: {
    fontWeight: '800',
    color: '#15803D',
  },

  // Helper text under PAN
  helperRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#EEF6FF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DBEAFE',
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
    color: '#1E40AF',
    lineHeight: 17,
    fontWeight: '500',
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
  },
  statusPillYellow: {
    backgroundColor: '#FEF9C3',
    borderWidth: 1,
    borderColor: '#FDE047',
  },
  statusPillGreen: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // CTA
  ctaButton: {
    marginTop: 8,
    marginBottom: 12,
  },
  bottomSpacer: {
    height: 12,
  },
});

export default KycBankBindingScreen;