// ─────────────────────────────────────────────
//  FeeVault Parent App — Child Detail Screen
//  Modular Architecture using DepositHistoryList
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
import { PillBadge } from '../../../components/PillBadge';

// Modular Sub-Component
import { DepositHistoryList, DepositLedgerEntry } from '../components/DepositHistoryList';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

interface ChildProfile {
  id: string;
  name: string;
  grade: string;
  school: string;
  studentId: string;
  saved: number;
  target: number;
  interestEarned: number;
  avatar: string;
}

const CHILDREN: ChildProfile[] = [
  {
    id: 'aarav',
    name: 'Aarav Sharma',
    grade: 'Class 4 • Section A',
    school: 'Green Valley School',
    studentId: 'GV-2026-0714',
    saved: 45000,
    target: 60000,
    interestEarned: 1240.5,
    avatar: 'AS',
  },
  {
    id: 'ira',
    name: 'Ira Sharma',
    grade: 'Class 3 • Section C',
    school: 'Green Valley School',
    studentId: 'GV-2026-0312',
    saved: 48000,
    target: 48000,
    interestEarned: 980.25,
    avatar: 'IS',
  },
];

const DEPOSIT_LEDGER: DepositLedgerEntry[] = [
  { id: '1', date: '04 Nov 2026', title: 'Monthly Savings Deposit', amount: 6500, mode: 'UPI Intent' },
  { id: '2', date: '01 Nov 2026', title: 'Daily Compounding Yield', amount: 187.5, mode: 'Auto Interest' },
  { id: '3', date: '15 Oct 2026', title: 'Mid-Term Savings Deposit', amount: 15000, mode: 'NEFT Escrow' },
  { id: '4', date: '01 Oct 2026', title: 'Grandparent Contribution', amount: 5000, mode: 'Co-Parent UPI' },
];

export const ChildDetailScreen: React.FC = () => {
  const navigation = useNavigation<NavProp>();
  const [selectedChildId, setSelectedChildId] = useState<'aarav' | 'ira'>('aarav');

  const child = CHILDREN.find((c) => c.id === selectedChildId) || CHILDREN[0];
  const progressPct = Math.min(child.saved / child.target, 1);

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
        <Header title="My Kids & Vaults" showBack />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>

          {/* Child Selector Tabs */}
          <View style={styles.childTabs}>
            {CHILDREN.map((c) => {
              const active = c.id === selectedChildId;
              return (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.childTab, active && styles.childTabActive]}
                  onPress={() => setSelectedChildId(c.id as any)}>
                  <View style={[styles.miniAvatar, active && styles.miniAvatarActive]}>
                    <Text style={[styles.miniAvatarText, active && styles.miniAvatarTextActive]}>
                      {c.avatar}
                    </Text>
                  </View>
                  <Text style={[styles.childTabText, active && styles.childTabTextActive]}>
                    {c.name.split(' ')[0]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Child Vault Overview Card */}
          <View style={styles.vaultCard}>
            <View style={styles.vaultHeaderRow}>
              <View>
                <Text style={styles.childName}>{child.name}</Text>
                <Text style={styles.childMeta}>{child.grade} • {child.school}</Text>
                <Text style={styles.studentIdText}>ID: {child.studentId}</Text>
              </View>
              <PillBadge label="TARGET ON TRACK" />
            </View>

            <View style={styles.divider} />

            {/* Savings & Interest Numbers */}
            <View style={styles.numbersRow}>
              <View>
                <Text style={styles.numberLabel}>Total Saved in Vault</Text>
                <Text style={styles.numberValBold}>₹{child.saved.toLocaleString('en-IN')}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.numberLabel}>Interest Earned</Text>
                <Text style={styles.interestVal}>+₹{child.interestEarned.toFixed(2)}</Text>
              </View>
            </View>

            {/* Target Progress Bar */}
            <View style={styles.progressContainer}>
              <View style={styles.progressHeaderRow}>
                <Text style={styles.progressLabel}>Annual Fee Target</Text>
                <Text style={styles.progressVal}>
                  ₹{child.saved.toLocaleString('en-IN')} of ₹{child.target.toLocaleString('en-IN')} ({Math.round(progressPct * 100)}%)
                </Text>
              </View>

              <View style={styles.progressBarTrack}>
                <LinearGradient
                  colors={['#0757DF', '#10BD59']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.progressBarFill, { width: `${(progressPct * 100).toFixed(1)}%` as any }]}
                />
              </View>
            </View>
          </View>

          {/* Dedicated Feature Actions (School Docs, Co-Parent, Rollover) */}
          <Text style={styles.sectionHeading}>Child Vault Hub</Text>
          <View style={styles.actionGrid}>
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => navigation.navigate(ROUTES.SCHOOL_DOCUMENTS)}
              activeOpacity={0.8}>
              <View style={[styles.actionIconWrap, { backgroundColor: '#EFF6FF' }]}>
                <Text style={styles.actionIcon}>📑</Text>
              </View>
              <Text style={styles.actionTitle}>School Docs</Text>
              <Text style={styles.actionSub}>Receipts & Reports</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => navigation.navigate(ROUTES.CO_PARENT_INVITE)}
              activeOpacity={0.8}>
              <View style={[styles.actionIconWrap, { backgroundColor: '#F0FDF4' }]}>
                <Text style={styles.actionIcon}>👥</Text>
              </View>
              <Text style={styles.actionTitle}>Co-Parent</Text>
              <Text style={styles.actionSub}>Invite Contributor</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => navigation.navigate(ROUTES.CLASS_ROLLOVER)}
              activeOpacity={0.8}>
              <View style={[styles.actionIconWrap, { backgroundColor: '#FEF3C7' }]}>
                <Text style={styles.actionIcon}>🔄</Text>
              </View>
              <Text style={styles.actionTitle}>Rollover</Text>
              <Text style={styles.actionSub}>Year-End Class 5</Text>
            </TouchableOpacity>
          </View>

          {/* Deposit Ledger History via Modular Component */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeading}>Deposit History</Text>
            <Text style={styles.subCount}>{DEPOSIT_LEDGER.length} entries</Text>
          </View>

          <DepositHistoryList entries={DEPOSIT_LEDGER} />
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
  childTabs: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  childTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 10,
  },
  childTabActive: {
    borderColor: COLORS.feeBlue,
    backgroundColor: '#FFFFFF',
    elevation: 3,
  },
  miniAvatar: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  miniAvatarActive: {
    backgroundColor: '#EFF6FF',
  },
  miniAvatarText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748B',
  },
  miniAvatarTextActive: {
    color: COLORS.feeBlue,
  },
  childTabText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  childTabTextActive: {
    color: COLORS.textDark,
    fontWeight: '800',
  },
  vaultCard: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: '#EDF1F8',
    elevation: 4,
    marginBottom: 20,
  },
  vaultHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  childName: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.textDark,
  },
  childMeta: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  studentIdText: {
    fontSize: 10.5,
    color: '#94A3B8',
    marginTop: 2,
    fontFamily: 'monospace',
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 14,
  },
  numbersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  numberLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  numberValBold: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.feeBlue,
    marginTop: 2,
  },
  interestVal: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.vaultGreen,
    marginTop: 2,
  },
  progressContainer: {
    marginTop: 4,
  },
  progressHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  progressVal: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textDark,
  },
  progressBarTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textDark,
    marginBottom: 10,
  },
  actionGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  actionCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EDF1F8',
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    elevation: 2,
  },
  actionIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  actionIcon: {
    fontSize: 18,
  },
  actionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textDark,
  },
  actionSub: {
    fontSize: 9.5,
    color: '#64748B',
    marginTop: 2,
    textAlign: 'center',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  subCount: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
});

export default ChildDetailScreen;
