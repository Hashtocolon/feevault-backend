// ─────────────────────────────────────────────
//  FeeVault Parent App — Payment Route Screen
//  Modular Architecture using VirtualAccountCard
// ─────────────────────────────────────────────

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
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

// Modular Sub-Component
import { VirtualAccountCard } from '../components/VirtualAccountCard';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export const PaymentRouteScreen: React.FC = () => {
  const navigation = useNavigation<NavProp>();
  const [selectedRoute, setSelectedRoute] = useState<'upi' | 'virtual'>('upi');
  const [selectedUpiApp, setSelectedUpiApp] = useState<'gpay' | 'phonepe' | 'paytm' | 'cred'>('gpay');
  const [loading, setLoading] = useState(false);

  const handlePayNow = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      // Simulate webhook received & ledger updated -> Go to success
      navigation.navigate(ROUTES.PAYMENT_SUCCESS);
    }, 1200);
  };

  const handleSimulateStalled = () => {
    // Navigate to Stalled Payment Safety screen
    navigation.navigate(ROUTES.PAYMENT_STATUS);
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
        <Header title="Select Payment Method" showBack />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>

          {/* Amount Due Bar */}
          <View style={styles.amountBar}>
            <Text style={styles.amountBarLabel}>Total Deposit to Fee Vault</Text>
            <Text style={styles.amountBarVal}>₹10,000.00</Text>
          </View>

          {/* Route Option Tabs */}
          <View style={styles.routeTabs}>
            <TouchableOpacity
              style={[styles.routeTab, selectedRoute === 'upi' && styles.routeTabActive]}
              onPress={() => setSelectedRoute('upi')}>
              <Text style={styles.tabIcon}>⚡</Text>
              <Text style={[styles.tabTitle, selectedRoute === 'upi' && styles.tabTitleActive]}>
                UPI Intent
              </Text>
              <Text style={styles.tabSub}>Instant (Up to ₹1L)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.routeTab, selectedRoute === 'virtual' && styles.routeTabActive]}
              onPress={() => setSelectedRoute('virtual')}>
              <Text style={styles.tabIcon}>🏦</Text>
              <Text style={[styles.tabTitle, selectedRoute === 'virtual' && styles.tabTitleActive]}>
                Virtual Account
              </Text>
              <Text style={styles.tabSub}>NEFT / IMPS (&gt; ₹1L)</Text>
            </TouchableOpacity>
          </View>

          {/* ── OPTION A: UPI INTENT ── */}
          {selectedRoute === 'upi' && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Choose UPI Application</Text>
              <Text style={styles.sectionSub}>Tap to launch your preferred UPI app directly</Text>

              {/* UPI App Options */}
              <TouchableOpacity
                style={[styles.upiAppRow, selectedUpiApp === 'gpay' && styles.upiAppRowActive]}
                onPress={() => setSelectedUpiApp('gpay')}>
                <View style={[styles.appIconWrap, { backgroundColor: '#EA4335' }]}>
                  <Text style={styles.appIconText}>G</Text>
                </View>
                <View style={styles.appInfo}>
                  <Text style={styles.appName}>Google Pay</Text>
                  <Text style={styles.appDesc}>Fast UPI Intent Checkout</Text>
                </View>
                <View style={[styles.radio, selectedUpiApp === 'gpay' && styles.radioActive]} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.upiAppRow, selectedUpiApp === 'phonepe' && styles.upiAppRowActive]}
                onPress={() => setSelectedUpiApp('phonepe')}>
                <View style={[styles.appIconWrap, { backgroundColor: '#5F259F' }]}>
                  <Text style={styles.appIconText}>Pe</Text>
                </View>
                <View style={styles.appInfo}>
                  <Text style={styles.appName}>PhonePe</Text>
                  <Text style={styles.appDesc}>Direct Bank Payment</Text>
                </View>
                <View style={[styles.radio, selectedUpiApp === 'phonepe' && styles.radioActive]} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.upiAppRow, selectedUpiApp === 'paytm' && styles.upiAppRowActive]}
                onPress={() => setSelectedUpiApp('paytm')}>
                <View style={[styles.appIconWrap, { backgroundColor: '#00BAF2' }]}>
                  <Text style={styles.appIconText}>P</Text>
                </View>
                <View style={styles.appInfo}>
                  <Text style={styles.appName}>Paytm UPI</Text>
                  <Text style={styles.appDesc}>Instant Bank Transfer</Text>
                </View>
                <View style={[styles.radio, selectedUpiApp === 'paytm' && styles.radioActive]} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.upiAppRow, selectedUpiApp === 'cred' && styles.upiAppRowActive]}
                onPress={() => setSelectedUpiApp('cred')}>
                <View style={[styles.appIconWrap, { backgroundColor: '#1E293B' }]}>
                  <Text style={styles.appIconText}>C</Text>
                </View>
                <View style={styles.appInfo}>
                  <Text style={styles.appName}>CRED UPI</Text>
                  <Text style={styles.appDesc}>UPI on Credit / Savings</Text>
                </View>
                <View style={[styles.radio, selectedUpiApp === 'cred' && styles.radioActive]} />
              </TouchableOpacity>
            </View>
          )}

          {/* ── OPTION B: MODULAR VIRTUAL ACCOUNT COMPONENT ── */}
          {selectedRoute === 'virtual' && (
            <VirtualAccountCard
              beneficiaryName="FeeVault Escrow - Ramesh Kumar"
              accountNumber="FVLT2026884920"
              ifsc="ICIC0000104"
              bankBranch="ICICI Bank, CMS Branch"
            />
          )}

          {/* Pay Button */}
          <CustomButton
            label={loading ? 'Processing Transaction...' : 'Authorize & Pay ₹10,000 →'}
            loading={loading}
            onPress={handlePayNow}
            style={styles.payBtn}
          />

          {/* Test Stalled State Link */}
          <TouchableOpacity
            style={styles.stalledLink}
            onPress={handleSimulateStalled}>
            <Text style={styles.stalledLinkText}>
              Simulate Stalled Payment Safety Screen (Test Mode) ⚠️
            </Text>
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
    paddingTop: 10,
    paddingBottom: 30,
  },
  amountBar: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  amountBarLabel: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '700',
  },
  amountBarVal: {
    fontSize: 22,
    fontWeight: '900',
    color: '#38BDF8',
  },
  routeTabs: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  routeTab: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  routeTabActive: {
    borderColor: COLORS.feeBlue,
    backgroundColor: '#EFF6FF',
  },
  tabIcon: {
    fontSize: 22,
    marginBottom: 6,
  },
  tabTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#334155',
  },
  tabTitleActive: {
    color: COLORS.feeBlue,
  },
  tabSub: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: '#EDF1F8',
    marginBottom: 20,
    elevation: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textDark,
  },
  sectionSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
    marginBottom: 16,
  },
  upiAppRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  upiAppRowActive: {
    borderColor: COLORS.feeBlue,
    backgroundColor: '#F8FAFC',
  },
  appIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  appIconText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  appInfo: {
    flex: 1,
  },
  appName: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textDark,
  },
  appDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#CBD5E1',
  },
  radioActive: {
    borderColor: COLORS.feeBlue,
    borderWidth: 6,
  },
  payBtn: {
    marginBottom: 14,
  },
  stalledLink: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  stalledLinkText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D97706',
  },
});

export default PaymentRouteScreen;
