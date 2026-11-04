// ─────────────────────────────────────────────
//  Home Component: AnnualPayoutBanner
//  Notice for scheduled school fee direct escrow disbursement
// ─────────────────────────────────────────────

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../../theme/colors';

interface AnnualPayoutBannerProps {
  payoutDate?: string;
  statusText?: string;
}

export const AnnualPayoutBanner: React.FC<AnnualPayoutBannerProps> = ({
  payoutDate = '15 May 2027',
  statusText = 'Target on track (78% Funded)',
}) => {
  return (
    <View style={styles.payoutBanner}>
      <Text style={styles.payoutIcon}>📅</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.payoutTitle}>Next School Fee Payout</Text>
        <Text style={styles.payoutSub}>
          Direct disbursement on {payoutDate} • {statusText}
        </Text>
      </View>
      <View style={styles.payoutPill}>
        <Text style={styles.payoutPillText}>On Track</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  payoutBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EDF1F8',
    marginBottom: 16,
    elevation: 2,
  },
  payoutIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  payoutTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textDark,
  },
  payoutSub: {
    fontSize: 10.5,
    color: '#64748B',
    marginTop: 2,
  },
  payoutPill: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  payoutPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#15803D',
  },
});

export default AnnualPayoutBanner;

