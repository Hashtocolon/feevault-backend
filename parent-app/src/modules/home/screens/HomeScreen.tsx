// ─────────────────────────────────────────────
//  FeeVault Parent App — Home Dashboard (STEP 2)
//  Modular Architecture using VaultOverviewCard, AnnualPayoutBanner & KidVaultCard
// ─────────────────────────────────────────────

import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
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

// Modular Sub-Components
import { VaultOverviewCard } from '../components/VaultOverviewCard';
import { AnnualPayoutBanner } from '../components/AnnualPayoutBanner';
import { KidVaultCard } from '../components/KidVaultCard';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<NavProp>();

  const handleNotify = (msg: string) => {
    Alert.alert('FeeVault', msg);
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" />

      {/* Top Application Bar */}
      <SafeAreaView edges={['top']} style={styles.topBarSafe}>
        <View style={styles.topbar}>
          {/* Brandmark */}
          <View style={styles.brandmark}>
            <LinearGradient
              colors={['#EAFFFF', '#C8EFFF']}
              style={styles.miniicon}>
              <Text style={styles.miniiconText}>🎓</Text>
            </LinearGradient>
            <Text style={styles.brandText}>
              <Text style={styles.brandFee}>Fee</Text>
              <Text style={styles.brandVault}>Vault</Text>
            </Text>
          </View>

          {/* Action icons */}
          <View style={styles.topActions}>
            <TouchableOpacity
              style={styles.iconbtn}
              onPress={() => handleNotify('You are all caught up! No new notifications.')}
              activeOpacity={0.7}>
              <Text style={styles.iconbtnText}>🔔</Text>
              <View style={styles.notifBadge} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.topAvatar}
              onPress={() => navigation.navigate(ROUTES.CHILD_DETAIL)}
              activeOpacity={0.8}>
              <LinearGradient
                colors={['#D9FAFF', '#CBDCFF']}
                style={styles.avatarGradient}>
                <Text style={styles.avatarText}>AS</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      {/* Main Scroll Content */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>

        {/* Header Greeting Row */}
        <View style={styles.headerRow}>
          <View style={styles.greetingCol}>
            <Text style={styles.eyebrow}>TUESDAY, 03 NOVEMBER</Text>
            <Text style={styles.heading}>Good morning, Ananya 👋</Text>
            <Text style={styles.sub}>Here's your family's fee overview & locked vaults.</Text>
          </View>
        </View>

        {/* ── 1. Hero Overview Component ── */}
        <VaultOverviewCard
          totalSavings="₹93,000.00"
          totalInterest="+₹2,220.75"
          onAddMoney={() => navigation.navigate(ROUTES.MAKE_PAYMENT)}
        />

        {/* ── 2. Annual Payout Banner Component ── */}
        <AnnualPayoutBanner
          payoutDate="15 May 2027"
          statusText="Target on track (78% Funded)"
        />

        {/* ── 3. Quick Action Buttons (4 Grid) ── */}
        <View style={styles.quickGrid}>
          <TouchableOpacity
            style={styles.quickBtn}
            onPress={() => navigation.navigate(ROUTES.MAKE_PAYMENT)}
            activeOpacity={0.75}>
            <View style={[styles.quickIconWrap, { backgroundColor: '#EFF6FF' }]}>
              <Text style={styles.quickIcon}>💳</Text>
            </View>
            <Text style={styles.quickLabel}>Make Payment</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickBtn}
            onPress={() => navigation.navigate(ROUTES.CHILD_DETAIL)}
            activeOpacity={0.75}>
            <View style={[styles.quickIconWrap, { backgroundColor: '#FEF3C7' }]}>
              <Text style={styles.quickIcon}>👨‍👧‍👦</Text>
            </View>
            <Text style={styles.quickLabel}>My Kids</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickBtn}
            onPress={() => navigation.navigate(ROUTES.STATEMENTS_HUB)}
            activeOpacity={0.75}>
            <View style={[styles.quickIconWrap, { backgroundColor: '#F0FDF4' }]}>
              <Text style={styles.quickIcon}>📜</Text>
            </View>
            <Text style={styles.quickLabel}>Statements & Tax</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickBtn}
            onPress={() => navigation.navigate(ROUTES.HELP_DESK)}
            activeOpacity={0.75}>
            <View style={[styles.quickIconWrap, { backgroundColor: '#F5F3FF' }]}>
              <Text style={styles.quickIcon}>💬</Text>
            </View>
            <Text style={styles.quickLabel}>Support & Help</Text>
          </TouchableOpacity>
        </View>

        {/* ── 4. Quick Child Vault Cards Components ── */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Child Vault Progress</Text>
          <TouchableOpacity onPress={() => navigation.navigate(ROUTES.CHILD_DETAIL)}>
            <Text style={styles.sectionLink}>Manage all</Text>
          </TouchableOpacity>
        </View>

        {/* Kid 1: Aarav */}
        <KidVaultCard
          name="Aarav Sharma"
          grade="Class 4"
          school="Green Valley School"
          saved={45000}
          target={60000}
          avatar="AS"
          onPress={() => navigation.navigate(ROUTES.CHILD_DETAIL)}
        />

        {/* Kid 2: Ira */}
        <KidVaultCard
          name="Ira Sharma"
          grade="Class 3"
          school="Green Valley School"
          saved={48000}
          target={48000}
          avatar="IS"
          isCompleted={true}
          onPress={() => navigation.navigate(ROUTES.CHILD_DETAIL)}
        />

        {/* ── 5. Recent Activity Preview ── */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <TouchableOpacity onPress={() => navigation.navigate(ROUTES.STATEMENTS_HUB)}>
            <Text style={styles.sectionLink}>View statement</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <View style={styles.activityRow}>
            <View style={styles.activitySymbol}>
              <Text style={styles.activitySymbolText}>💰</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.activityTitle}>Monthly Vault Deposit</Text>
              <Text style={styles.activityMeta}>04 Nov 2026 • Split UPI Intent</Text>
            </View>
            <Text style={styles.activityAmountPositive}>+₹10,000.00</Text>
          </View>

          <View style={[styles.activityRow, { borderBottomWidth: 0, paddingBottom: 2 }]}>
            <View style={[styles.activitySymbol, { backgroundColor: '#DCFCE7' }]}>
              <Text style={styles.activitySymbolText}>📈</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.activityTitle}>Daily Compounding Yield</Text>
              <Text style={styles.activityMeta}>01 Nov 2026 • 7.5% Accrual</Text>
            </View>
            <Text style={styles.activityAmountCredit}>+₹187.50</Text>
          </View>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* ── Fixed Bottom Navigation Bar ── */}
      <View style={styles.bottomNavContainer}>
        <View style={styles.bottomNav}>
          {/* 1. Home */}
          <TouchableOpacity
            style={styles.navItem}
            activeOpacity={0.7}>
            <View style={styles.navIconContainer}>
              <Text style={styles.navEmojiActive}>🏠</Text>
              <View style={styles.activeGlowDot} />
            </View>
            <Text style={styles.navTextActive}>Home</Text>
          </TouchableOpacity>

          {/* 2. My Kids */}
          <TouchableOpacity
            style={styles.navItem}
            onPress={() => navigation.navigate(ROUTES.CHILD_DETAIL)}
            activeOpacity={0.7}>
            <View style={styles.navIconContainer}>
              <Text style={styles.navEmoji}>👨‍👧‍👦</Text>
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>2</Text>
              </View>
            </View>
            <Text style={styles.navText}>My Kids</Text>
          </TouchableOpacity>

          {/* 3. Center Elevated Action: Make Payment */}
          <TouchableOpacity
            style={styles.centerPayWrap}
            onPress={() => navigation.navigate(ROUTES.MAKE_PAYMENT)}
            activeOpacity={0.85}>
            <LinearGradient
              colors={['#0757DF', '#0BB9E7']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.centerPayBtn}>
              <Text style={styles.centerPayEmoji}>💳</Text>
            </LinearGradient>
            <Text style={[styles.navText, { marginTop: 4 }]}>Pay / Save</Text>
          </TouchableOpacity>

          {/* 4. Statements & Tax */}
          <TouchableOpacity
            style={styles.navItem}
            onPress={() => navigation.navigate(ROUTES.STATEMENTS_HUB)}
            activeOpacity={0.7}>
            <View style={styles.navIconContainer}>
              <Text style={styles.navEmoji}>📜</Text>
            </View>
            <Text style={styles.navText}>Statements</Text>
          </TouchableOpacity>

          {/* 5. Support & Help */}
          <TouchableOpacity
            style={styles.navItem}
            onPress={() => navigation.navigate(ROUTES.HELP_DESK)}
            activeOpacity={0.7}>
            <View style={styles.navIconContainer}>
              <Text style={styles.navEmoji}>💬</Text>
            </View>
            <Text style={styles.navText}>Support</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F4F8FF',
  },
  topBarSafe: {
    backgroundColor: '#FFFFFF',
  },
  topbar: {
    height: 62,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 19,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF2F9',
  },
  brandmark: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  miniicon: {
    width: 35,
    height: 35,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#A9E9FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 9,
  },
  miniiconText: {
    fontSize: 18,
  },
  brandText: {
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: -1,
  },
  brandFee: {
    color: '#073A9B',
  },
  brandVault: {
    color: '#11BD52',
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconbtn: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: '#F0F6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  iconbtnText: {
    fontSize: 16,
  },
  notifBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    borderWidth: 1.5,
    borderColor: '#F0F6FF',
  },
  topAvatar: {
    width: 38,
    height: 38,
    borderRadius: 14,
    overflow: 'hidden',
  },
  avatarGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0757C9',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 17,
    paddingTop: 18,
    paddingBottom: 24,
  },
  headerRow: {
    marginBottom: 16,
  },
  greetingCol: {
    flex: 1,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.7,
    color: '#2682C4',
    marginBottom: 4,
  },
  heading: {
    fontSize: 25,
    fontWeight: '800',
    letterSpacing: -0.8,
    color: '#10275E',
    marginBottom: 4,
  },
  sub: {
    fontSize: 12,
    lineHeight: 18,
    color: '#8190A9',
  },
  quickGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 8,
  },
  quickBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E9EFF8',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 4,
    alignItems: 'center',
    shadowColor: '#123B78',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  quickIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  quickIcon: {
    fontSize: 20,
  },
  quickLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#22549D',
    textAlign: 'center',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#10275E',
  },
  sectionLink: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0757DF',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EDF1F8',
    borderRadius: 20,
    padding: 16,
    elevation: 3,
    marginBottom: 14,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  activitySymbol: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: '#EDF5FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activitySymbolText: {
    fontSize: 18,
  },
  activityTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#10275E',
  },
  activityMeta: {
    fontSize: 10.5,
    color: '#8997AE',
    marginTop: 2,
  },
  activityAmountPositive: {
    fontSize: 13,
    fontWeight: '900',
    color: COLORS.feeBlue,
  },
  activityAmountCredit: {
    fontSize: 13,
    fontWeight: '900',
    color: COLORS.vaultGreen,
  },
  bottomSpacer: {
    height: 84,
  },
  bottomNavContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EDF1F7',
    elevation: 16,
  },
  bottomNav: {
    height: 72,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 4,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  navIconContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navEmoji: {
    fontSize: 20,
    opacity: 0.6,
  },
  navEmojiActive: {
    fontSize: 20,
    opacity: 1,
  },
  activeGlowDot: {
    position: 'absolute',
    bottom: -6,
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#0757DF',
  },
  tabBadge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: '#0757DF',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  tabBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  centerPayWrap: {
    alignItems: 'center',
    marginTop: -20,
    zIndex: 10,
  },
  centerPayBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0757DF',
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  centerPayEmoji: {
    fontSize: 22,
  },
  navText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#9AA8BD',
    marginTop: 4,
  },
  navTextActive: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#0757DF',
    marginTop: 4,
  },
});

export default HomeScreen;
