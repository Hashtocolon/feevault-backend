// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  FeeVault — ParentalConsentScreen
//  DPDP 2023 Parental Consent Gate (Onboarding Step 1)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
import React, {useState, useCallback} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {SafeAreaView} from 'react-native-safe-area-context';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useNavigation} from '@react-navigation/native';

import {COLORS} from '../../../theme/colors';
import {CustomButton} from '../../../components/CustomButton';
import {PillBadge} from '../../../components/PillBadge';
import Header from '../../../components/Header';
import {ROUTES} from '../../../constants/routes';
import {RootStackParamList} from '../../../navigation/AppNavigator';

// ─── Types ──────────────────────────────────────
type NavProp = NativeStackNavigationProp<
  RootStackParamList,
  typeof ROUTES.PARENTAL_CONSENT
>;

// ─── Consent items ──────────────────────────────
const CONSENT_ITEMS: {id: number; text: string}[] = [
  {
    id: 0,
    text: 'I confirm I am the legal parent/guardian of the minor child being enrolled',
  },
  {
    id: 1,
    text: 'I accept FeeVault Terms of Service and Privacy Policy under DPDP Act 2023',
  },
  {
    id: 2,
    text: "I consent to collection & processing of my child's educational data for fee management purposes",
  },
  {
    id: 3,
    text: 'I understand FeeVault deposits are locked in SEBI-regulated escrow until school fee payout',
  },
  {
    id: 4,
    text: 'I confirm the refund bank account I will provide is valid for excess amount returns',
  },
];

// ─── Component ──────────────────────────────────
const ParentalConsentScreen: React.FC = () => {
  const navigation = useNavigation<NavProp>();

  // 5 independent checkbox states
  const [checked, setChecked] = useState<boolean[]>([
    false,
    false,
    false,
    false,
    false,
  ]);

  const allChecked = checked.every(Boolean);

  // Toggle a single item
  const toggleItem = useCallback((index: number) => {
    setChecked(prev => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  }, []);

  // Select All / Deselect All
  const handleSelectAll = useCallback(() => {
    setChecked(
      allChecked
        ? [false, false, false, false, false]
        : [true, true, true, true, true],
    );
  }, [allChecked]);

  const handleAccept = useCallback(() => {
    if (allChecked) {
      navigation.navigate(ROUTES.KYC_BANK_BINDING);
    }
  }, [allChecked, navigation]);

  return (
    <LinearGradient
      colors={['#D9F3FF', '#EEF9FF', '#F7FCFF', '#E9FBF1']}
      locations={[0, 0.35, 0.7, 1]}
      style={styles.gradient}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        {/* ── Header ── */}
        <Header
          title="Parental Consent"
          showBack
          onBackPress={() => navigation.goBack()}
        />

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">

          {/* ── DPDP Badge ── */}
          <PillBadge label="DPDP 2023 COMPLIANT" style={styles.badge} />

          {/* ── Title block ── */}
          <Text style={styles.title}>Digital Parental Consent</Text>
          <Text style={styles.subtitle}>
            Under the Digital Personal Data Protection Act 2023, your explicit
            consent is required before we process any data related to your child.
          </Text>

          {/* ── Glass consent card ── */}
          <View style={styles.card}>
            {/* Select All row */}
            <View style={styles.selectAllRow}>
              <Text style={styles.selectAllHint}>
                {checked.filter(Boolean).length} / 5 selected
              </Text>
              <TouchableOpacity onPress={handleSelectAll} activeOpacity={0.75}>
                <Text style={styles.selectAllLink}>
                  {allChecked ? 'Deselect All' : 'Select All'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.divider} />

            {/* Consent checkboxes */}
            {CONSENT_ITEMS.map((item, idx) => (
              <TouchableOpacity
                key={item.id}
                style={styles.checkRow}
                onPress={() => toggleItem(idx)}
                activeOpacity={0.8}>
                {/* Custom checkbox */}
                <View
                  style={[
                    styles.checkbox,
                    checked[idx] && styles.checkboxChecked,
                  ]}>
                  {checked[idx] ? (
                    <Text style={styles.checkmark}>✓</Text>
                  ) : null}
                </View>

                <Text style={styles.checkText}>{item.text}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── CTA Button ── */}
          <CustomButton
            label="Accept & Continue →"
            onPress={handleAccept}
            disabled={!allChecked}
            style={styles.ctaBtn}
          />

          {/* ── Trust footer ── */}
          <View style={styles.trustRow}>
            <Text style={styles.trustText}>
              🛡️ Your consent is encrypted and stored per DPDP Act 2023
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
};

// ─── Styles ─────────────────────────────────────
const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safe: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 32,
  },

  // ── Badge
  badge: {
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 20,
  },

  // ── Title block
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.textDark,
    textAlign: 'center',
    letterSpacing: 0.1,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textMid,
    textAlign: 'center',
    lineHeight: 21,
    paddingHorizontal: 8,
    marginBottom: 24,
  },

  // ── Glass card
  card: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 24,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 3},
    shadowOpacity: 0.08,
    shadowRadius: 12,
    padding: 20,
    marginBottom: 28,
  },

  // ── Select All row
  selectAllRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  selectAllHint: {
    fontSize: 12,
    color: COLORS.textLight,
    fontWeight: '600',
  },
  selectAllLink: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.feeBlue,
    textDecorationLine: 'underline',
  },

  // ── Divider
  divider: {
    height: 1,
    backgroundColor: COLORS.divider,
    marginBottom: 16,
  },

  // ── Checkbox row
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: COLORS.inputBorder,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    flexShrink: 0,
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: COLORS.vaultGreen,
    borderColor: COLORS.vaultGreen,
  },
  checkmark: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '800',
    lineHeight: Platform.OS === 'android' ? 16 : undefined,
  },
  checkText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textDark,
    lineHeight: 21,
    fontWeight: '500',
  },

  // ── CTA
  ctaBtn: {
    marginBottom: 20,
  },

  // ── Trust footer
  trustRow: {
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  trustText: {
    fontSize: 12,
    color: COLORS.vaultGreen,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
  },
});

export default ParentalConsentScreen;
