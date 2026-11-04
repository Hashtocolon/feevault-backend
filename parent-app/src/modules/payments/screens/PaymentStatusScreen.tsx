// ─────────────────────────────────────────────
//  FeeVault Parent App — Payment Status Screen
//  Stalled Payment Safety (Auto-Reconciliation & Ticket Desk)
// ─────────────────────────────────────────────

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
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
import { CustomButton } from '../../../components/CustomButton';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export const PaymentStatusScreen: React.FC = () => {
  const navigation = useNavigation<NavProp>();
  const [checking, setChecking] = useState(false);

  const handleRefresh = () => {
    setChecking(true);
    setTimeout(() => {
      setChecking(false);
      Alert.alert(
        'Reconciliation Status',
        'Bank query in progress. Expected final status confirmation within 15 minutes.',
      );
    }, 1200);
  };

  const handleRaiseTicket = () => {
    // Navigate to File Exception Screen with prefilled topic
    navigation.navigate(ROUTES.FILE_EXCEPTION);
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
        <Header title="Payment Processing" showBack />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>

          {/* Pending Spinner Card */}
          <View style={styles.pendingCard}>
            <View style={styles.spinnerWrap}>
              <ActivityIndicator size="large" color={COLORS.feeBlue} />
            </View>

            <Text style={styles.statusTitle}>Checking Bank Confirmation</Text>
            <Text style={styles.statusSub}>
              If money was debited from your bank account, your funds are 100% safe.
            </Text>

            <View style={styles.timerBadge}>
              <Text style={styles.timerText}>
                ⏳ Auto-Sync Check: Next attempt in 8m 42s
              </Text>
            </View>
          </View>

          {/* Transaction Metadata Card */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Transaction Details</Text>

            <View style={styles.rowBetween}>
              <Text style={styles.detailLabel}>Reference ID</Text>
              <Text style={styles.detailValMono}>TXN-FV-20261104-PENDING</Text>
            </View>
            <View style={styles.rowBetween}>
              <Text style={styles.detailLabel}>Amount Initiated</Text>
              <Text style={styles.detailValBold}>₹10,000.00</Text>
            </View>
            <View style={styles.rowBetween}>
              <Text style={styles.detailLabel}>Payment Method</Text>
              <Text style={styles.detailVal}>UPI Intent (Google Pay)</Text>
            </View>
            <View style={[styles.rowBetween, { borderBottomWidth: 0 }]}>
              <Text style={styles.detailLabel}>Bank Switch</Text>
              <Text style={styles.detailVal}>Awaiting NPCI Webhook</Text>
            </View>
          </View>

          {/* Stalled Payment Safety Guarantees */}
          <View style={styles.safetyCard}>
            <Text style={styles.safetyHeader}>🛡️ Stalled Payment Safety Rules</Text>

            <View style={styles.bulletItem}>
              <Text style={styles.bulletDot}>•</Text>
              <Text style={styles.bulletText}>
                <Text style={{ fontWeight: '800' }}>Every 15-Minute Polling:</Text> FeeVault backend
                automatically verifies bank switch APIs without you having to do anything.
              </Text>
            </View>

            <View style={styles.bulletItem}>
              <Text style={styles.bulletDot}>•</Text>
              <Text style={styles.bulletText}>
                <Text style={{ fontWeight: '800' }}>24-Hour Guarantee:</Text> Confirmed payments are
                credited to child vault; unconfirmed debits are auto-reversed to your bank account within 24 hours.
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <CustomButton
            label={checking ? 'Polling Bank...' : 'Refresh Status Now 🔄'}
            loading={checking}
            onPress={handleRefresh}
            variant="outline"
            style={styles.refreshBtn}
          />

          <TouchableOpacity
            style={styles.ticketBtn}
            onPress={handleRaiseTicket}
            activeOpacity={0.8}>
            <Text style={styles.ticketBtnText}>🚨 1-Tap Support Ticket Raise</Text>
          </TouchableOpacity>
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
    paddingTop: 16,
    paddingBottom: 30,
  },
  pendingCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 22,
    padding: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#EDF1F8',
    elevation: 4,
  },
  spinnerWrap: {
    marginBottom: 16,
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textDark,
    marginBottom: 6,
  },
  statusSub: {
    fontSize: 12.5,
    color: COLORS.textMid,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
    paddingHorizontal: 10,
  },
  timerBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  timerText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#EDF1F8',
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  detailLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  detailVal: {
    fontSize: 12.5,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  detailValBold: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.feeBlue,
  },
  detailValMono: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    fontFamily: 'monospace',
  },
  safetyCard: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 18,
    padding: 16,
    marginBottom: 20,
  },
  safetyHeader: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E40AF',
    marginBottom: 10,
  },
  bulletItem: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  bulletDot: {
    fontSize: 14,
    color: COLORS.feeBlue,
    marginRight: 8,
    lineHeight: 18,
  },
  bulletText: {
    flex: 1,
    fontSize: 11.5,
    lineHeight: 17,
    color: '#1E3A8A',
  },
  refreshBtn: {
    marginBottom: 12,
  },
  ticketBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
  },
  ticketBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#DC2626',
  },
});

export default PaymentStatusScreen;

