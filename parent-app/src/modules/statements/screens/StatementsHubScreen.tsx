// ─────────────────────────────────────────────
//  FeeVault Parent App — Statements & Tax Hub
//  Monthly PDFs, Annual Interest Statement & Form 16A TDS Certificate
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

import { COLORS } from '../../../theme/colors';
import Header from '../../../components/Header';
import { PillBadge } from '../../../components/PillBadge';

const MONTHLY_STATEMENTS = [
  { id: '1', month: 'October 2026', deposits: '₹21,500', interest: '+₹187.50', size: '180 KB' },
  { id: '2', month: 'September 2026', deposits: '₹15,000', interest: '+₹142.10', size: '175 KB' },
  { id: '3', month: 'August 2026', deposits: '₹10,000', interest: '+₹98.40', size: '170 KB' },
];

export const StatementsHubScreen: React.FC = () => {
  const handleDownload = (docName: string) => {
    Alert.alert('Download Started', `${docName} has been downloaded to your phone.`);
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
        <Header title="Statements & Tax" showBack />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>

          <PillBadge label="TAX COMPLIANCE & AUDIT" style={styles.badge} />

          <Text style={styles.title}>Statements & Tax Hub</Text>
          <Text style={styles.subtitle}>
            Official monthly account ledgers, annual gross interest, and Form 16A certificates for filing ITR.
          </Text>

          {/* Form 16A TDS Tax Hero Card */}
          <View style={styles.taxHeroCard}>
            <LinearGradient
              colors={['#061C60', '#0754C8']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.taxHeroGradient}>
              <View style={styles.taxBadgeRow}>
                <Text style={styles.taxBadgeText}>ITR COMPLIANCE</Text>
                <Text style={{ fontSize: 20 }}>📑</Text>
              </View>

              <Text style={styles.taxTitle}>Form 16A TDS Certificate</Text>
              <Text style={styles.taxDesc}>
                Assessment Year 2026-27. Certificate of deduction of tax at source on interest earned
                in escrow. Directly reportable under 'Income from Other Sources'.
              </Text>

              <TouchableOpacity
                style={styles.taxDownloadBtn}
                onPress={() => handleDownload('Form 16A TDS Certificate (AY 2026-27)')}
                activeOpacity={0.85}>
                <Text style={styles.taxDownloadBtnText}>Download Form 16A (PDF) ⬇️</Text>
              </TouchableOpacity>
            </LinearGradient>
          </View>

          {/* Annual Interest Summary Card */}
          <View style={styles.card}>
            <Text style={styles.cardHeader}>Annual Interest Summary (FY 2026-27)</Text>

            <View style={styles.interestRow}>
              <View>
                <Text style={styles.interestLabel}>Gross Accrued Interest</Text>
                <Text style={styles.interestVal}>₹2,220.75</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.interestLabel}>TDS Deducted (10%)</Text>
                <Text style={styles.tdsVal}>-₹222.08</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.rowBetween}>
              <Text style={styles.netLabel}>Net Compounded Yield</Text>
              <Text style={styles.netVal}>+₹1,998.67</Text>
            </View>

            <TouchableOpacity
              style={styles.outlineDownloadBtn}
              onPress={() => handleDownload('Annual Gross Interest Statement FY 2026-27')}>
              <Text style={styles.outlineDownloadText}>Download Annual Summary (PDF)</Text>
            </TouchableOpacity>
          </View>

          {/* Monthly Account Statements */}
          <Text style={styles.sectionHeading}>Monthly Statements</Text>
          <View style={styles.card}>
            {MONTHLY_STATEMENTS.map((item, index) => (
              <View
                key={item.id}
                style={[
                  styles.statementRow,
                  index === MONTHLY_STATEMENTS.length - 1 && { borderBottomWidth: 0 },
                ]}>
                <View style={styles.statementIconWrap}>
                  <Text style={styles.statementIcon}>📜</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.statementMonth}>{item.month}</Text>
                  <Text style={styles.statementSub}>
                    Deposits: {item.deposits} • Yield: {item.interest}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.smallDownloadBtn}
                  onPress={() => handleDownload(`${item.month} Statement`)}>
                  <Text style={styles.smallDownloadText}>PDF</Text>
                </TouchableOpacity>
              </View>
            ))}
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
  taxHeroCard: {
    borderRadius: 22,
    overflow: 'hidden',
    marginBottom: 16,
    elevation: 4,
  },
  taxHeroGradient: {
    padding: 18,
  },
  taxBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  taxBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#86EFAC',
    letterSpacing: 1.1,
  },
  taxTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  taxDesc: {
    fontSize: 11.5,
    color: '#D6EAFF',
    lineHeight: 16,
    marginBottom: 16,
  },
  taxDownloadBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  taxDownloadBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: COLORS.feeBlue,
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
  interestRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  interestLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  interestVal: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.vaultGreen,
    marginTop: 2,
  },
  tdsVal: {
    fontSize: 18,
    fontWeight: '900',
    color: '#EF4444',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 12,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  netLabel: {
    fontSize: 12.5,
    fontWeight: '800',
    color: COLORS.textDark,
  },
  netVal: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.feeBlue,
  },
  outlineDownloadBtn: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  outlineDownloadText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: COLORS.feeBlue,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textDark,
    marginBottom: 10,
  },
  statementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  statementIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  statementIcon: {
    fontSize: 18,
  },
  statementMonth: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textDark,
  },
  statementSub: {
    fontSize: 10.5,
    color: '#64748B',
    marginTop: 2,
  },
  smallDownloadBtn: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  smallDownloadText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.feeBlue,
  },
});

export default StatementsHubScreen;

