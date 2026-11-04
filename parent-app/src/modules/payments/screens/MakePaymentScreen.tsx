// ─────────────────────────────────────────────
//  FeeVault Parent App — Make Payment (Add Savings)
//  Modular Architecture using ChildSplitSelector & LockedWarningBox
// ─────────────────────────────────────────────

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  TextInput,
  Alert,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { COLORS } from '../../../theme/colors';
import { ROUTES } from '../../../constants/routes';
import { RootStackParamList } from '../../../navigation/AppNavigator';
import Header from '../../../components/Header';
import { PillBadge } from '../../../components/PillBadge';
import { CustomButton } from '../../../components/CustomButton';

// Modular Sub-Components
import { ChildSplitSelector } from '../components/ChildSplitSelector';
import { LockedWarningBox } from '../components/LockedWarningBox';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

const PRESET_AMOUNTS = [500, 2500, 5000, 10000, 25000, 50000];

export const MakePaymentScreen: React.FC = () => {
  const navigation = useNavigation<NavProp>();

  const [totalAmount, setTotalAmount] = useState<string>('10000');
  const [splitMode, setSplitMode] = useState<'auto' | 'manual'>('auto');

  // Kids data
  const [kid1Amount, setKid1Amount] = useState<string>('6500'); // 65% for Aarav
  const [kid2Amount, setKid2Amount] = useState<string>('3500'); // 35% for Ira

  const handleAmountChange = (val: string) => {
    const numeric = val.replace(/[^0-9]/g, '');
    setTotalAmount(numeric);

    const num = parseInt(numeric, 10) || 0;
    if (splitMode === 'auto') {
      const k1 = Math.round(num * 0.65);
      const k2 = num - k1;
      setKid1Amount(k1.toString());
      setKid2Amount(k2.toString());
    }
  };

  const handlePresetSelect = (preset: number) => {
    handleAmountChange(preset.toString());
  };

  const handleSplitModeChange = (mode: 'auto' | 'manual') => {
    setSplitMode(mode);
    const num = parseInt(totalAmount, 10) || 0;
    if (mode === 'auto') {
      const k1 = Math.round(num * 0.65);
      const k2 = num - k1;
      setKid1Amount(k1.toString());
      setKid2Amount(k2.toString());
    }
  };

  const handleProceed = () => {
    const total = parseInt(totalAmount, 10) || 0;
    if (total < 100) {
      Alert.alert('Invalid Amount', 'Minimum deposit to fee vault is ₹100.');
      return;
    }

    const k1 = parseInt(kid1Amount, 10) || 0;
    const k2 = parseInt(kid2Amount, 10) || 0;

    if (splitMode === 'manual' && k1 + k2 !== total) {
      Alert.alert(
        'Split Mismatch',
        `The sum of child allocations (₹${k1 + k2}) must equal total deposit (₹${total}).`,
      );
      return;
    }

    // Navigate to Payment Route Screen (Option A: UPI, Option B: Virtual Account)
    navigation.navigate(ROUTES.PAYMENT_ROUTE);
  };

  const formattedTotal = parseInt(totalAmount, 10) || 0;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" />

      {/* Background Gradient */}
      <LinearGradient
        colors={['#D9F3FF', '#EEF9FF', '#F7FCFF', '#E9FBF1']}
        locations={[0, 0.35, 0.7, 1]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safe}>
        <Header title="Add Money / Save" showBack />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">

          <PillBadge label="ESCROW PROTECTED SAVINGS" style={styles.badge} />

          <Text style={styles.title}>Deposit to Fee Vault</Text>
          <Text style={styles.subtitle}>
            Funds earn 7.5% compounding daily interest until school fee payout date.
          </Text>

          {/* Amount Input Card */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Enter Deposit Amount (₹)</Text>
            <View style={styles.amountInputRow}>
              <Text style={styles.rupeeSymbol}>₹</Text>
              <TextInput
                style={styles.amountInput}
                value={totalAmount}
                onChangeText={handleAmountChange}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor="#94A3B8"
              />
            </View>

            {/* Quick Presets */}
            <Text style={styles.presetLabel}>Quick Amounts</Text>
            <View style={styles.presetGrid}>
              {PRESET_AMOUNTS.map((amt) => {
                const isSelected = formattedTotal === amt;
                return (
                  <TouchableOpacity
                    key={amt}
                    style={[styles.presetChip, isSelected && styles.presetChipActive]}
                    onPress={() => handlePresetSelect(amt)}>
                    <Text
                      style={[styles.presetChipText, isSelected && styles.presetChipTextActive]}>
                      ₹{amt.toLocaleString('en-IN')}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Modular Child Split Selector Component */}
          <ChildSplitSelector
            splitMode={splitMode}
            onSplitModeChange={handleSplitModeChange}
            kid1Amount={kid1Amount}
            kid2Amount={kid2Amount}
            onKid1AmountChange={setKid1Amount}
            onKid2AmountChange={setKid2Amount}
          />

          {/* Modular Locked Savings Notice Box Component */}
          <LockedWarningBox />

          {/* Action CTA */}
          <CustomButton
            label={`Confirm & Proceed with ₹${formattedTotal.toLocaleString('en-IN')} →`}
            onPress={handleProceed}
            style={styles.proceedBtn}
          />
        </ScrollView>
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 32,
  },
  badge: {
    marginBottom: 12,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.textDark,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textMid,
    lineHeight: 19,
    marginBottom: 20,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: '#EDF1F8',
    shadowColor: '#123B78',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
    marginBottom: 16,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: COLORS.feeBlue,
    paddingBottom: 8,
    marginBottom: 16,
  },
  rupeeSymbol: {
    fontSize: 34,
    fontWeight: '900',
    color: COLORS.feeBlue,
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 36,
    fontWeight: '900',
    color: COLORS.textDark,
    padding: 0,
  },
  presetLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 10,
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  presetChipActive: {
    backgroundColor: '#EFF6FF',
    borderColor: COLORS.feeBlue,
  },
  presetChipText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#475569',
  },
  presetChipTextActive: {
    color: COLORS.feeBlue,
    fontWeight: '800',
  },
  proceedBtn: {
    marginBottom: 10,
  },
});

export default MakePaymentScreen;
