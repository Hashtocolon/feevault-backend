// ─────────────────────────────────────────────
//  FeeVault Parent App — Payment Success Screen
//  Ref ID, Split Summary, Receipt Download & Alerts
// ─────────────────────────────────────────────

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { COLORS } from '../../../theme/colors';
import { ROUTES } from '../../../constants/routes';
import { RootStackParamList } from '../../../navigation/AppNavigator';
import { CustomButton } from '../../../components/CustomButton';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export const PaymentSuccessScreen: React.FC = () => {
  const navigation = useNavigation<NavProp>();

  const handleDownloadReceipt = () => {
    Alert.alert(
      'Receipt Downloaded',
      'FeeVault Payment Receipt #FV10294 has been saved to your downloads folder.',
    );
  };

  const handleReturnHome = () => {
    navigation.navigate(ROUTES.HOME);
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
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>

          {/* Success Checkmark Hero */}
          <View style={styles.heroSection}>
            <LinearGradient
              colors={['#10BD59', '#08BDB4']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.checkCircle}>
              <Text style={styles.checkIcon}>✓</Text>
            </LinearGradient>

            <Text style={styles.successTitle}>Payment Successful!</Text>
            <Text style={styles.successSub}>
              Bank webhook verified. Escrow ledger updated with double-entry safety.
            </Text>

            <Text style={styles.amountText}>₹10,000.00</Text>
            <Text style={styles.refText}>Ref ID: TXN-FV-20261104-94281</Text>
          </View>

          {/* Allocation Breakdown Card */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Child Vault Allocation</Text>

            <View style={styles.allocRow}>
              <View style={styles.avatarWrap}>
                <Text style={styles.avatarText}>AS</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.kidName}>Aarav Sharma</Text>
                <Text style={styles.kidMeta}>Grade 7 • 65% Auto Split</Text>
              </View>
              <Text style={styles.allocVal}>+₹6,500.00</Text>
            </View>

            <View style={[styles.allocRow, { borderBottomWidth: 0, paddingBottom: 0 }]}>
              <View style={[styles.avatarWrap, { backgroundColor: '#E0F2FE' }]}>
                <Text style={[styles.avatarText, { color: '#0284C7' }]}>IS</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.kidName}>Ira Sharma</Text>
                <Text style={styles.kidMeta}>Grade 3 • 35% Auto Split</Text>
              </View>
              <Text style={styles.allocVal}>+₹3,500.00</Text>
            </View>
          </View>

          {/* Notification Alerts Confirmation */}
          <View style={styles.alertCard}>
            <Text style={styles.alertHeader}>Multi-Channel Alerts Dispatched 📲</Text>
            <View style={styles.alertItem}>
              <Text style={styles.alertDot}>🟢</Text>
              <Text style={styles.alertItemText}>
                WhatsApp confirmation sent to +91 9876543210
              </Text>
            </View>
            <View style={styles.alertItem}>
              <Text style={styles.alertDot}>🟢</Text>
              <Text style={styles.alertItemText}>
                SMS transaction alert delivered instantly
              </Text>
            </View>
            <View style={styles.alertItem}>
              <Text style={styles.alertDot}>🟢</Text>
              <Text style={styles.alertItemText}>
                In-app notification ledger synchronized
              </Text>
            </View>
          </View>

          {/* Download Receipt CTA */}
          <TouchableOpacity
            style={styles.downloadBtn}
            onPress={handleDownloadReceipt}
            activeOpacity={0.8}>
            <Text style={styles.downloadBtnIcon}>📄</Text>
            <Text style={styles.downloadBtnText}>Download Payment Receipt (PDF)</Text>
          </TouchableOpacity>

          {/* Return Home Button */}
          <CustomButton
            label="Return to Dashboard →"
            onPress={handleReturnHome}
            style={styles.homeBtn}
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
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 32,
    alignItems: 'center',
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  checkCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#10BD59',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  checkIcon: {
    fontSize: 42,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  successTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: COLORS.textDark,
    marginBottom: 6,
  },
  successSub: {
    fontSize: 13,
    color: COLORS.textMid,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  amountText: {
    fontSize: 34,
    fontWeight: '900',
    color: COLORS.feeBlue,
    letterSpacing: -0.5,
  },
  refText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 4,
    fontFamily: 'monospace',
  },
  card: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: '#EDF1F8',
    marginBottom: 16,
    elevation: 4,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  allocRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  avatarWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#D9FAFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0757C9',
  },
  kidName: {
    fontSize: 13.5,
    fontWeight: '800',
    color: COLORS.textDark,
  },
  kidMeta: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  allocVal: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.vaultGreen,
  },
  alertCard: {
    width: '100%',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 18,
    padding: 16,
    marginBottom: 20,
  },
  alertHeader: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#15803D',
    marginBottom: 10,
  },
  alertItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  alertDot: {
    fontSize: 10,
    marginRight: 8,
  },
  alertItemText: {
    fontSize: 11.5,
    color: '#166534',
    fontWeight: '600',
  },
  downloadBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: COLORS.feeBlue,
    borderRadius: 14,
    paddingVertical: 13,
    marginBottom: 12,
  },
  downloadBtnIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  downloadBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.feeBlue,
  },
  homeBtn: {
    width: '100%',
  },
});

export default PaymentSuccessScreen;

