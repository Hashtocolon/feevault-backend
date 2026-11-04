// ─────────────────────────────────────────────
//  Shared Component: PillBadge
//  Green dot + ALL CAPS label pill
// ─────────────────────────────────────────────
import React from 'react';
import {View, Text, StyleSheet, ViewStyle} from 'react-native';
import {COLORS} from '../theme/colors';

interface PillBadgeProps {
  label?: string;
  style?: ViewStyle;
}

export const PillBadge: React.FC<PillBadgeProps> = ({
  label = 'TRUSTED FEE MANAGEMENT',
  style,
}) => (
  <View style={[styles.pill, style]}>
    <View style={styles.dot} />
    <Text style={styles.text}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.pillBg,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.pillDot,
    marginRight: 7,
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.pillText,
    letterSpacing: 1.1,
  },
});

