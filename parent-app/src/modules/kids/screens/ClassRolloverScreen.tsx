// ─────────────────────────────────────────────
//  FeeVault Parent App — Class Rollover Screen
//  Year-End Promotion & Carried Forward Balance Setup
// ─────────────────────────────────────────────

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  Alert,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COLORS } from '../../../theme/colors';
import Header from '../../../components/Header';
import { CustomInput } from '../../../components/CustomInput';
import { CustomButton } from '../../../components/CustomButton';
import { PillBadge } from '../../../components/PillBadge';

export const ClassRolloverScreen: React.FC = () => {
  const [newTarget, setNewTarget] = useState('75000');
  const [loading, setLoading] = useState(false);

  const handleConfirmRollover = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      Alert.alert(
        'Class Rollover Complete',
        'Aarav Sharma has been promoted to Class 5 for Academic Year 2027-28. Carried forward surplus has been allocated to the new vault.',
      );
    }, 1200);
  };

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
        <Header title="Class Rollover" showBack />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>

          <PillBadge label="ACADEMIC YEAR PROMOTION" style={styles.badge} />

          <Text style={styles.title}>Year-End Class Rollover</Text>
          <Text style={styles.subtitle}>
            Seamlessly roll your child into the next academic class with full balance carry-forward.
          </Text>

          {/* Promotion Path Card */}
          <View style={styles.promoCard}>
            <View style={styles.promoCol}>
              <Text style={styles.promoBadge}>CURRENT</Text>
              <Text style={styles.promoClass}>Class 4</Text>
              <Text style={styles.promoYear}>AY 2026-27</Text>
            </View>

            <View style={styles.promoArrowWrap}>
              <Text style={styles.promoArrow}>➔</Text>
              <Text style={styles.rolloverTag}>Rollover</Text>
            </View>

            <View style={[styles.promoCol, styles.promoColActive]}>
              <Text style={[styles.promoBadge, { color: COLORS.vaultGreen }]}>UPCOMING</Text>
              <Text style={[styles.promoClass, { color: COLORS.feeBlue }]}>Class 5</Text>
              <Text style={styles.promoYear}>AY 2027-28</Text>
            </View>
          </View>

          {/* Carry Forward Explanation Card */}
          <View style={styles.card}>
            <Text style={styles.cardHeader}>Carried Forward Balance Rules</Text>

            <View style={styles.infoRow}>
              <Text style={styles.infoIcon}>💰</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.infoTitle}>Surplus Auto-Roll</Text>
                <Text style={styles.infoDesc}>
                  Any remaining balance or excess interest from Class 4 is never lost. It automatically
                  becomes the opening deposit for Class 5.
                </Text>
              </View>
            </View>

            <View style={[styles.infoRow, { borderBottomWidth: 0, paddingBottom: 0 }]}>
              <Text style={styles.infoIcon}>🏫</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.infoTitle}>Zero Re-Verification Needed</Text>
                <Text style={styles.infoDesc}>
                  Your linked school code and bound refund bank account remain active without re-doing KYC.
                </Text>
              </View>
            </View>
          </View>

          {/* New Target Setup */}
          <View style={styles.card}>
            <Text style={styles.cardHeader}>Set Class 5 Target Fee</Text>
            <CustomInput
              label="Expected Annual Fee Target (₹)"
              placeholder="e.g. 75000"
              value={newTarget}
              onChangeText={setNewTarget}
              keyboardType="numeric"
            />

            <CustomButton
              label={loading ? 'Configuring Class 5 Vault...' : 'Confirm Class 5 Rollover →'}
              loading={loading}
              onPress={handleConfirmRollover}
              style={{ marginTop: 8 }}
            />
          </View>
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
    paddingBottom: 30,
  },
  badge: {
    marginBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.textDark,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12.5,
    color: COLORS.textMid,
    lineHeight: 18,
    marginBottom: 16,
  },
  promoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: '#EDF1F8',
    elevation: 3,
    marginBottom: 16,
  },
  promoCol: {
    alignItems: 'center',
    flex: 1,
  },
  promoColActive: {
    backgroundColor: '#EFF6FF',
    borderRadius: 16,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
  },
  promoBadge: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  promoClass: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.textDark,
  },
  promoYear: {
    fontSize: 11,
    color: '#8997AE',
    marginTop: 2,
  },
  promoArrowWrap: {
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  promoArrow: {
    fontSize: 22,
    color: COLORS.feeBlue,
  },
  rolloverTag: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.feeBlue,
    marginTop: 2,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: '#EDF1F8',
    elevation: 3,
    marginBottom: 16,
  },
  cardHeader: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textDark,
    marginBottom: 14,
  },
  infoRow: {
    flexDirection: 'row',
    paddingBottom: 14,
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  infoIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textDark,
  },
  infoDesc: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 16,
    marginTop: 3,
  },
});

export default ClassRolloverScreen;

