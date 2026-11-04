// ─────────────────────────────────────────────
//  Payments Component: ChildSplitSelector
//  Toggle between Auto-Ratio Split and Manual ₹ Allocation
// ─────────────────────────────────────────────

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { COLORS } from '../../../theme/colors';

interface ChildSplitSelectorProps {
  splitMode: 'auto' | 'manual';
  onSplitModeChange: (mode: 'auto' | 'manual') => void;
  kid1Amount: string;
  kid2Amount: string;
  onKid1AmountChange: (val: string) => void;
  onKid2AmountChange: (val: string) => void;
}

export const ChildSplitSelector: React.FC<ChildSplitSelectorProps> = ({
  splitMode,
  onSplitModeChange,
  kid1Amount,
  kid2Amount,
  onKid1AmountChange,
  onKid2AmountChange,
}) => {
  return (
    <View style={styles.card}>
      <View style={styles.splitHeaderRow}>
        <Text style={styles.cardLabel}>Allocate Between Children</Text>
        <View style={styles.splitToggleWrap}>
          <TouchableOpacity
            style={[styles.splitTab, splitMode === 'auto' && styles.splitTabActive]}
            onPress={() => onSplitModeChange('auto')}>
            <Text
              style={[styles.splitTabText, splitMode === 'auto' && styles.splitTabTextActive]}>
              Auto-Ratio
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.splitTab, splitMode === 'manual' && styles.splitTabActive]}
            onPress={() => onSplitModeChange('manual')}>
            <Text
              style={[styles.splitTabText, splitMode === 'manual' && styles.splitTabTextActive]}>
              Manual
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.splitHint}>
        {splitMode === 'auto'
          ? '🔀 Past fee target ratio applied: 65% Aarav, 35% Ira.'
          : '✏️ Specify exact amounts for each child vault.'}
      </Text>

      {/* Kid 1 Allocation: Aarav */}
      <View style={styles.kidRow}>
        <View style={styles.avatarWrap}>
          <Text style={styles.avatarText}>AS</Text>
        </View>
        <View style={styles.kidInfo}>
          <Text style={styles.kidName}>Aarav Sharma</Text>
          <Text style={styles.kidClass}>Grade 7 • Class Target: ₹72,000</Text>
        </View>
        {splitMode === 'auto' ? (
          <View style={styles.allocPill}>
            <Text style={styles.allocPillText}>
              ₹{parseInt(kid1Amount, 10).toLocaleString('en-IN')}
            </Text>
            <Text style={styles.allocPct}>65%</Text>
          </View>
        ) : (
          <View style={styles.manualInputWrap}>
            <Text style={styles.manualRupee}>₹</Text>
            <TextInput
              style={styles.manualInput}
              value={kid1Amount}
              onChangeText={onKid1AmountChange}
              keyboardType="numeric"
            />
          </View>
        )}
      </View>

      {/* Kid 2 Allocation: Ira */}
      <View style={[styles.kidRow, styles.kidRowLast]}>
        <View style={[styles.avatarWrap, { backgroundColor: '#E0F2FE' }]}>
          <Text style={[styles.avatarText, { color: '#0284C7' }]}>IS</Text>
        </View>
        <View style={styles.kidInfo}>
          <Text style={styles.kidName}>Ira Sharma</Text>
          <Text style={styles.kidClass}>Grade 3 • Class Target: ₹48,000</Text>
        </View>
        {splitMode === 'auto' ? (
          <View style={styles.allocPill}>
            <Text style={styles.allocPillText}>
              ₹{parseInt(kid2Amount, 10).toLocaleString('en-IN')}
            </Text>
            <Text style={styles.allocPct}>35%</Text>
          </View>
        ) : (
          <View style={styles.manualInputWrap}>
            <Text style={styles.manualRupee}>₹</Text>
            <TextInput
              style={styles.manualInput}
              value={kid2Amount}
              onChangeText={onKid2AmountChange}
              keyboardType="numeric"
            />
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: '#EDF1F8',
    shadowColor: '#123B78',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
    marginBottom: 16,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  splitHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  splitToggleWrap: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 2,
  },
  splitTab: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  splitTabActive: {
    backgroundColor: '#FFFFFF',
    elevation: 2,
  },
  splitTabText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  splitTabTextActive: {
    color: COLORS.feeBlue,
  },
  splitHint: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 14,
    lineHeight: 16,
  },
  kidRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  kidRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  avatarWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#D9FAFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0757C9',
  },
  kidInfo: {
    flex: 1,
  },
  kidName: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textDark,
  },
  kidClass: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  allocPill: {
    alignItems: 'flex-end',
  },
  allocPillText: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.feeBlue,
  },
  allocPct: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 1,
  },
  manualInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 8,
    height: 38,
    width: 90,
  },
  manualRupee: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
    marginRight: 4,
  },
  manualInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textDark,
    padding: 0,
  },
});

export default ChildSplitSelector;

