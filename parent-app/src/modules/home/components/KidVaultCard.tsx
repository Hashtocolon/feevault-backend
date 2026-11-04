// ─────────────────────────────────────────────
//  Home Component: KidVaultCard
//  Child savings progress card with gradient progress bar
// ─────────────────────────────────────────────

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { COLORS } from '../../../theme/colors';

interface KidVaultCardProps {
  name: string;
  grade: string;
  school: string;
  saved: number;
  target: number;
  avatar: string;
  isCompleted?: boolean;
  onPress: () => void;
}

export const KidVaultCard: React.FC<KidVaultCardProps> = ({
  name,
  grade,
  school,
  saved,
  target,
  avatar,
  isCompleted = false,
  onPress,
}) => {
  const pct = Math.min(saved / target, 1);
  const pctDisplay = Math.round(pct * 100);
  const remaining = Math.max(target - saved, 0);

  return (
    <TouchableOpacity
      style={styles.kidVaultCard}
      onPress={onPress}
      activeOpacity={0.85}>
      <View style={styles.kidCardTop}>
        <View style={[styles.avatarWrap, isCompleted && { backgroundColor: '#E0F2FE' }]}>
          <Text style={[styles.avatarText, isCompleted && { color: '#0284C7' }]}>
            {avatar}
          </Text>
        </View>

        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.kidName}>{name}</Text>
          <Text style={styles.kidClass}>{grade} • {school}</Text>
        </View>

        <View style={[styles.targetBadge, isCompleted && { backgroundColor: '#DCFCE7' }]}>
          <Text style={[styles.targetBadgeText, isCompleted && { color: '#15803D' }]}>
            {isCompleted ? '100% Target Met ✓' : `${pctDisplay}% Saved`}
          </Text>
        </View>
      </View>

      <View style={styles.progressWrap}>
        <View style={styles.progressRow}>
          <Text style={styles.progressVal}>
            ₹{saved.toLocaleString('en-IN')} saved of ₹{target.toLocaleString('en-IN')} target
          </Text>
          <Text style={[styles.remainingVal, isCompleted && { color: '#16A34A' }]}>
            {isCompleted ? 'Fully Funded' : `₹${remaining.toLocaleString('en-IN')} left`}
          </Text>
        </View>

        <View style={styles.progressBarTrack}>
          <LinearGradient
            colors={isCompleted ? ['#10BD59', '#08BDB4'] : ['#0757DF', '#10BD59']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.progressBarFill, { width: `${(pct * 100).toFixed(1)}%` as any }]}
          />
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  kidVaultCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EDF1F8',
    marginBottom: 12,
    elevation: 3,
  },
  kidCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#D9FAFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0757C9',
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
  targetBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  targetBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: COLORS.feeBlue,
  },
  progressWrap: {
    marginTop: 12,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressVal: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  remainingVal: {
    fontSize: 11,
    fontWeight: '800',
    color: '#D97706',
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
});

export default KidVaultCard;

