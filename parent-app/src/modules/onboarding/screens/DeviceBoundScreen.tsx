// ─────────────────────────────────────────────
//  DeviceBoundScreen — Device Hardware Bound
//  One-way success confirmation screen
// ─────────────────────────────────────────────
import React, {useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  ScrollView,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {SafeAreaView} from 'react-native-safe-area-context';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useNavigation} from '@react-navigation/native';

import {COLORS} from '../../../theme/colors';
import {CustomButton} from '../../../components/CustomButton';
import {PillBadge} from '../../../components/PillBadge';
import {ROUTES} from '../../../constants/routes';
import {RootStackParamList} from '../../../navigation/AppNavigator';

type DeviceBoundNav = NativeStackNavigationProp<
  RootStackParamList,
  typeof ROUTES.DEVICE_BOUND
>;

// ── Feature chip data ──────────────────────────
interface FeatureChip {
  icon: string;
  label: string;
}

const CHIPS: FeatureChip[] = [
  {icon: '🔒', label: 'Encrypted'},
  {icon: '📱', label: 'Device Locked'},
  {icon: '✅', label: 'DPDP Secure'},
];

// ─────────────────────────────────────────────
const DeviceBoundScreen: React.FC = () => {
  const navigation = useNavigation<DeviceBoundNav>();

  // Entrance animation for the success circle
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        tension: 80,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacityAnim, scaleAnim]);

  return (
    <LinearGradient
      colors={['#D9F3FF', '#EEF9FF', '#F7FCFF', '#E9FBF1']}
      locations={[0, 0.35, 0.7, 1]}
      style={styles.gradient}>
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}>

          {/* ── Animated success circle ── */}
          <Animated.View
            style={[
              styles.circleWrap,
              {transform: [{scale: scaleAnim}], opacity: opacityAnim},
            ]}>
            <LinearGradient
              colors={['#16A34A', '#22C55E']}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 1}}
              style={styles.successCircle}>
              <Text style={styles.checkmark}>✓</Text>
            </LinearGradient>
          </Animated.View>

          {/* ── Title ── */}
          <Text style={styles.title}>Device Successfully Bound!</Text>

          {/* ── Subtitle ── */}
          <Text style={styles.subtitle}>
            Your account is now securely linked to this device. Only you can
            access your FeeVault.
          </Text>

          {/* ── Hardware security badge ── */}
          <PillBadge label="HARDWARE SECURITY ACTIVE" style={styles.pill} />

          {/* ── Feature chips row ── */}
          <View style={styles.chipsRow}>
            {CHIPS.map(chip => (
              <View key={chip.label} style={styles.chip}>
                <Text style={styles.chipIcon}>{chip.icon}</Text>
                <Text style={styles.chipLabel}>{chip.label}</Text>
              </View>
            ))}
          </View>

          {/* ── CTA ── */}
          <CustomButton
            label="Add Your First Child →"
            onPress={() => navigation.navigate(ROUTES.ADD_CHILD)}
            style={styles.ctaBtn}
          />

        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
};

// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safe: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 40,
  },

  // ── Success circle
  circleWrap: {
    marginBottom: 32,
    shadowColor: COLORS.vaultGreen,
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 12,
  },
  successCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    fontSize: 48,
    color: COLORS.textWhite,
    fontWeight: '800',
    lineHeight: 56,
  },

  // ── Text
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.textDark,
    textAlign: 'center',
    letterSpacing: 0.2,
    marginBottom: 14,
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.textMid,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
    paddingHorizontal: 8,
  },

  // ── Badge
  pill: {
    marginBottom: 28,
  },

  // ── Chips
  chipsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 40,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(22,163,74,0.2)',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.07,
    shadowRadius: 4,
  },
  chipIcon: {
    fontSize: 15,
    marginRight: 6,
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textDark,
  },

  // ── Button
  ctaBtn: {
    width: '100%',
  },
});

export default DeviceBoundScreen;
