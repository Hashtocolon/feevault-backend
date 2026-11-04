// ─────────────────────────────────────────────
//  Payments Component: VirtualAccountCard
//  Dedicated NEFT / IMPS Virtual Escrow Account details (> ₹1 Lakh)
// ─────────────────────────────────────────────

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { COLORS } from '../../../theme/colors';

interface VirtualAccountCardProps {
  beneficiaryName?: string;
  accountNumber?: string;
  ifsc?: string;
  bankBranch?: string;
}

export const VirtualAccountCard: React.FC<VirtualAccountCardProps> = ({
  beneficiaryName = 'FeeVault Escrow - Ramesh Kumar',
  accountNumber = 'FVLT2026884920',
  ifsc = 'ICIC0000104',
  bankBranch = 'ICICI Bank, CMS Branch',
}) => {
  const handleCopy = (label: string, text: string) => {
    Alert.alert('Copied to Clipboard', `${label}: ${text}`);
  };

  return (
    <View style={styles.card}>
      <View style={styles.badgeRow}>
        <Text style={styles.badgeText}>DEDICATED VIRTUAL ACCOUNT</Text>
      </View>
      <Text style={styles.sectionTitle}>Escrow Bank Details</Text>
      <Text style={styles.sectionSub}>
        Ideal for large deposits &gt; ₹1,00,000. Add as beneficiary in your netbanking.
      </Text>

      {/* Beneficiary Name */}
      <View style={styles.detailRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.detailLabel}>Beneficiary Name</Text>
          <Text style={styles.detailVal}>{beneficiaryName}</Text>
        </View>
        <TouchableOpacity
          style={styles.copyBtn}
          onPress={() => handleCopy('Beneficiary', beneficiaryName)}>
          <Text style={styles.copyText}>Copy</Text>
        </TouchableOpacity>
      </View>

      {/* Account Number */}
      <View style={styles.detailRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.detailLabel}>Virtual Account Number</Text>
          <Text style={styles.detailValMono}>{accountNumber}</Text>
        </View>
        <TouchableOpacity
          style={styles.copyBtn}
          onPress={() => handleCopy('Account Number', accountNumber)}>
          <Text style={styles.copyText}>Copy</Text>
        </TouchableOpacity>
      </View>

      {/* IFSC Code */}
      <View style={styles.detailRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.detailLabel}>IFSC Code</Text>
          <Text style={styles.detailValMono}>{ifsc}</Text>
        </View>
        <TouchableOpacity
          style={styles.copyBtn}
          onPress={() => handleCopy('IFSC', ifsc)}>
          <Text style={styles.copyText}>Copy</Text>
        </TouchableOpacity>
      </View>

      {/* Bank & Branch */}
      <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.detailLabel}>Bank & Branch</Text>
          <Text style={styles.detailVal}>{bankBranch}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: '#EDF1F8',
    marginBottom: 20,
    elevation: 4,
  },
  badgeRow: {
    alignSelf: 'flex-start',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 8,
  },
  badgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#15803D',
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
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  detailLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  detailVal: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textDark,
    marginTop: 2,
  },
  detailValMono: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.feeBlue,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  copyBtn: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  copyText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.feeBlue,
  },
});

export default VirtualAccountCard;

