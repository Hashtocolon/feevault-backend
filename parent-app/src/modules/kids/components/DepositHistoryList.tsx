// ─────────────────────────────────────────────
//  Kids Component: DepositHistoryList
//  Ledger list of past deposits, interest credits, and co-parent contributions
// ─────────────────────────────────────────────

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../../theme/colors';

export interface DepositLedgerEntry {
  id: string;
  date: string;
  title: string;
  amount: number;
  mode: string;
}

interface DepositHistoryListProps {
  entries: DepositLedgerEntry[];
}

export const DepositHistoryList: React.FC<DepositHistoryListProps> = ({ entries }) => {
  return (
    <View style={styles.ledgerCard}>
      {entries.map((item, index) => {
        const isInterest = item.mode.toLowerCase().includes('interest') || item.mode.toLowerCase().includes('yield');
        const isLast = index === entries.length - 1;

        return (
          <View
            key={item.id}
            style={[styles.ledgerRow, isLast && { borderBottomWidth: 0 }]}>
            <View style={[styles.ledgerIconWrap, isInterest && { backgroundColor: '#DCFCE7' }]}>
              <Text style={styles.ledgerIcon}>{isInterest ? '📈' : '💰'}</Text>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.ledgerTitle}>{item.title}</Text>
              <Text style={styles.ledgerDate}>
                {item.date} • {item.mode}
              </Text>
            </View>

            <Text
              style={[
                styles.ledgerAmount,
                isInterest && { color: COLORS.vaultGreen },
              ]}>
              +₹{item.amount.toLocaleString('en-IN')}
            </Text>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  ledgerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EDF1F8',
    elevation: 2,
  },
  ledgerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  ledgerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  ledgerIcon: {
    fontSize: 16,
  },
  ledgerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  ledgerDate: {
    fontSize: 10.5,
    color: '#8997AE',
    marginTop: 2,
  },
  ledgerAmount: {
    fontSize: 13.5,
    fontWeight: '900',
    color: COLORS.feeBlue,
  },
});

export default DepositHistoryList;

