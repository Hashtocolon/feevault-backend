// ─────────────────────────────────────────────
//  Home Component: VaultOverviewCard
//  Hero deep navy-to-cyan gradient card for total locked savings & interest
// ─────────────────────────────────────────────

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

interface VaultOverviewCardProps {
  totalSavings: string;
  totalInterest: string;
  onAddMoney: () => void;
}

export const VaultOverviewCard: React.FC<VaultOverviewCardProps> = ({
  totalSavings,
  totalInterest,
  onAddMoney,
}) => {
  return (
    <View style={styles.heroOuter}>
      <LinearGradient
        colors={['#061C60', '#0754C8', '#079BD0']}
        locations={[0, 0.65, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroCard}>

        {/* Decorative concentric rings */}
        <View style={styles.heroRing1} />
        <View style={styles.heroRing2} />

        {/* Top Header Pill */}
        <View style={styles.heroHeaderRow}>
          <View style={styles.heroPill}>
            <View style={styles.heroPillDot} />
            <Text style={styles.heroPillText}>ESCROW VAULT ACTIVE</Text>
          </View>
          <Text style={styles.heroShield}>🛡️</Text>
        </View>

        <Text style={styles.heroAmountLabel}>💰 Total Savings Locked</Text>
        <Text style={styles.heroAmount}>{totalSavings}</Text>

        {/* Footer row */}
        <View style={styles.heroFooterRow}>
          <View style={styles.heroDueBox}>
            <Text style={styles.heroInterestText}>
              📈 Total Interest Earned: {totalInterest} (7.5% p.a.)
            </Text>
          </View>

          <TouchableOpacity
            style={styles.payBtn}
            onPress={onAddMoney}
            activeOpacity={0.85}>
            <LinearGradient
              colors={['#10BD59', '#08BDB4']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.payBtnGradient}>
              <Text style={styles.payBtnText}>＋ Add Money</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  heroOuter: {
    borderRadius: 24,
    marginBottom: 14,
    shadowColor: '#0755BD',
    shadowOpacity: 0.35,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 14 },
    elevation: 12,
  },
  heroCard: {
    borderRadius: 24,
    padding: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  heroRing1: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    right: -40,
    bottom: -60,
  },
  heroRing2: {
    position: 'absolute',
    width: 230,
    height: 230,
    borderRadius: 115,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    right: -70,
    bottom: -90,
  },
  heroHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  heroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  heroPillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#35D07F',
    marginRight: 6,
  },
  heroPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#E9FBFF',
    letterSpacing: 1,
  },
  heroShield: {
    fontSize: 22,
  },
  heroAmountLabel: {
    fontSize: 12,
    color: '#D2EAFF',
    marginBottom: 4,
  },
  heroAmount: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.7,
    marginBottom: 14,
  },
  heroFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.18)',
  },
  heroDueBox: {
    flex: 1,
  },
  heroInterestText: {
    fontSize: 11,
    color: '#86EFAC',
    fontWeight: '700',
  },
  payBtn: {
    borderRadius: 14,
    shadowColor: '#10BD59',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  payBtnGradient: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
  },
  payBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#052E65',
  },
});

export default VaultOverviewCard;

