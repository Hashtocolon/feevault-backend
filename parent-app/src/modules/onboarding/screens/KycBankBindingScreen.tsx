// ─────────────────────────────────────────────────────────────────────────────
//  KycBankBindingScreen.tsx
//  Step 2 of 5 — KYC & Refund Bank Account Binding
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
import {PillBadge} from '../../../components/PillBadge';
import Header from '../../../components/Header';
import {ROUTES} from '../../../constants/routes';
import {RootStackParamList} from '../../../navigation/AppNavigator';

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
  const [bankName, setBankName] = useState('');

  // — Penny-drop status
  const [verificationStatus, setVerificationStatus] =
    useState<VerificationStatus>('idle');

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleVerifyAndBind = () => {
    if (verificationStatus === 'verified') {
      navigation.navigate(ROUTES.SECURITY_SETUP);
      return;
    }

    setVerificationStatus('verifying');
    setTimeout(() => {
      setVerificationStatus('verified');
      setTimeout(() => {
        navigation.navigate(ROUTES.SECURITY_SETUP);
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
        {/* ── Header ── */}
        <Header
          title="KYC & Bank Binding"
          showBack
          onBackPress={() => navigation.goBack()}
        />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>

          {/* ── Badge ── */}
          <PillBadge label="IDENTITY VERIFICATION" style={styles.badge} />

          {/* ── Title block ── */}
          <Text style={styles.title}>Verify Your Identity & Bank</Text>
          <Text style={styles.subtitle}>
            One-time setup. Bound forever for secure refunds.
          </Text>

          {/* ── Progress indicator: Step 2 of 5 ── */}
          <View style={styles.progressContainer}>
            {[1, 2, 3, 4, 5].map(step => (
              <View
                key={step}
                style={[
                  styles.progressDot,
                  step === 2 && styles.progressDotActive,
                  step < 2 && styles.progressDotDone,
                ]}
              />
            ))}
            <Text style={styles.progressLabel}>Step 2 of 5</Text>
          </View>

          {/* ══════════════════════════════════════════════════
              Glass Card 1 — PAN Verification
          ══════════════════════════════════════════════════ */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardHeaderIcon}>🪪</Text>
              <Text style={styles.cardTitle}>PAN Verification</Text>
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

          {/* ══════════════════════════════════════════════════
              Glass Card 2 — Refund Bank Account
          ══════════════════════════════════════════════════ */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardHeaderIcon}>🏦</Text>
              <Text style={styles.cardTitle}>Refund Bank Account</Text>
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
            />
            <CustomInput
              label="Bank Name"
              placeholder="e.g. State Bank of India"
              value={bankName}
              onChangeText={setBankName}
              autoCapitalize="words"
              containerStyle={{marginBottom: 0}}
            />
          </View>

          {/* ══════════════════════════════════════════════════
              Glass Card 3 — Penny Drop Verification
          ══════════════════════════════════════════════════ */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardHeaderIcon}>💳</Text>
              <Text style={styles.cardTitle}>Penny Drop Verification</Text>
            </View>

            {/* Info box */}
            <View style={styles.infoBox}>
              <Text style={styles.infoBoxIcon}>💳</Text>
              <Text style={styles.infoBoxText}>
                We will credit{' '}
                <Text style={styles.infoBoxBold}>₹1</Text> to your account
                to verify it. This amount is returned instantly.
              </Text>
            </View>

            {/* Status row */}
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Verification Status</Text>
              {renderVerificationPill()}
            </View>
          </View>

          {/* ── CTA Button ── */}
          <CustomButton
            label="Verify & Bind Account →"
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

  // Badge
  badge: {
    marginTop: 8,
    marginBottom: 16,
  },

  // Title
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1A56DB', // feeBlue
    textAlign: 'center',
    letterSpacing: 0.1,
    marginBottom: 6,
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
    marginBottom: 24,
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
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMid,
    marginLeft: 10,
    letterSpacing: 0.3,
  },

  // Glass Card
  card: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 24,
    elevation: 6,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#1A56DB',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardHeaderIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1A56DB',
    letterSpacing: 0.2,
  },

  // Helper text under PAN
  helperRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(219,234,254,0.5)',
    borderRadius: 10,
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

  // Info box (penny drop)
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(219,234,254,0.45)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(147,197,253,0.6)',
  },
  infoBoxIcon: {
    fontSize: 18,
    marginRight: 10,
    marginTop: 1,
  },
  infoBoxText: {
    flex: 1,
    fontSize: 13,
    color: '#1E3A5F',
    lineHeight: 19,
    fontWeight: '400',
  },
  infoBoxBold: {
    fontWeight: '800',
    color: '#1A56DB',
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
  },
  bottomSpacer: {
    height: 12,
  },
});

export default KycBankBindingScreen;
