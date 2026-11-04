// ─────────────────────────────────────────────
//  Payments Component: LockedWarningBox
//  Legal warning that saved amounts cannot be withdrawn and go to school
// ─────────────────────────────────────────────

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export const LockedWarningBox: React.FC = () => {
  return (
    <View style={styles.lockNoticeCard}>
      <Text style={styles.lockIcon}>🔒</Text>
      <View style={styles.lockTextWrap}>
        <Text style={styles.lockNoticeTitle}>Locked Goal Protection Notice</Text>
        <Text style={styles.lockNoticeDesc}>
          Saved amounts cannot be casually withdrawn. Deposits are strictly earmarked in
          regulated escrow and transferred directly to the school bank account on fee due date.
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  lockNoticeCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 18,
    padding: 16,
    marginBottom: 20,
  },
  lockIcon: {
    fontSize: 22,
    marginRight: 12,
  },
  lockTextWrap: {
    flex: 1,
  },
  lockNoticeTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#B45309',
    marginBottom: 4,
  },
  lockNoticeDesc: {
    fontSize: 11,
    lineHeight: 16,
    color: '#92400E',
  },
});

export default LockedWarningBox;

