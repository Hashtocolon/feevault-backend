// SplashScreen.tsx — FeeVault Parent App
// Logo image: src/assets/images/feevault.png

import React, { useEffect } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  StatusBar,
  Platform,
  Dimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/AppNavigator';
import { ROUTES } from '../../../constants/routes';
import { COLORS } from '../../../theme/colors';

const { width: W, height: H } = Dimensions.get('window');

// Shown in the bottom-right corner. Change it per release.
const APP_VERSION = 'v1.0';

export default function SplashScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  useEffect(() => {
    if (Platform.OS === 'android') {
      (StatusBar as any).setBackgroundColor?.('transparent');
      (StatusBar as any).setTranslucent?.(true);
    }

    const timer = setTimeout(() => {
      navigation.replace(ROUTES.WELCOME_CAROUSEL);
    }, 2400);

    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" />

      {/* Base background */}
      <LinearGradient
        colors={['#D9F3FF', '#EEF9FF', '#F7FCFF', '#E9FBF1']}
        locations={[0, 0.35, 0.7, 1]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Soft glow – top left (sky blue) */}
      <LinearGradient
        colors={['rgba(120,220,255,0.55)', 'rgba(120,220,255,0)']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.glowLeft}
      />

      {/* Soft glow – bottom right (mint green) */}
      <LinearGradient
        colors={['rgba(90,230,160,0)', 'rgba(90,230,160,0.55)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.glowRight}
      />

      <SafeAreaView style={styles.safe}>
        {/* Top tagline */}
        <Text style={styles.topLabel}>A SMARTER WAY TO MANAGE SCHOOL FEES</Text>

        {/* Center content */}
        <View style={styles.center}>
          {/* Logo card */}
          <View style={styles.logoOuter}>
            <LinearGradient
              colors={['rgba(255,255,255,0.95)', 'rgba(220,245,255,0.85)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.logoCard}
            >
              <View style={styles.logoInner}>
                <Image
                  source={require('../../../assets/images/feevault.png')}
                  style={styles.logoCropped}
                  resizeMode="cover"
                />
              </View>
            </LinearGradient>
          </View>

          {/* Brand name */}
          <Text style={styles.brand}>
            <Text style={styles.brandFee}>Fee</Text>
            <Text style={styles.brandVault}>Vault</Text>
          </Text>

          {/* Description */}
          <Text style={styles.desc}>
            Your child's education.{' '}
            <Text style={styles.descBold}>Safely in your hands.</Text>
          </Text>
          <Text style={styles.desc}>Simple fees. Clear records. Peace of mind.</Text>

          {/* Trust pill */}
          <View style={styles.pill}>
            <View style={styles.dotOuter}>
              <View style={styles.dot} />
            </View>
            <Text style={styles.pillText}>TRUSTED FEE MANAGEMENT</Text>
          </View>
        </View>

        {/* Bottom loader */}
        <View style={styles.bottom}>
          <Text style={styles.loadingText}>Preparing your FeeVault experience...</Text>
          <Text style={styles.footer}>SECURE • SIMPLE • SMART</Text>
        </View>

        {/* App version – tiny, bottom-right corner */}
        <Text style={styles.version}>{APP_VERSION}</Text>
      </SafeAreaView>
    </View>
  );
}

/* ---------- Logo crop sizing ---------- */
const CARD = 168;
const WINDOW_W = 130;
const WINDOW_H = 122;
const IMG = 160;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.gradientTop },
  safe: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'android' ? 24 : 8,
    paddingBottom: 18,
  },

  /* Background glows */
  glowLeft: {
    position: 'absolute',
    left: -W * 0.35,
    top: H * 0.12,
    width: W * 0.9,
    height: W * 0.9,
    borderRadius: W,
  },
  glowRight: {
    position: 'absolute',
    right: -W * 0.35,
    bottom: H * 0.02,
    width: W * 1.0,
    height: W * 1.0,
    borderRadius: W,
  },

  /* Top label */
  topLabel: {
    marginTop: 18,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2.2,
    color: COLORS.feeBlue,
    textAlign: 'center',
  },

  /* Center */
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    marginTop: -10,
  },

  /* Logo */
  logoOuter: {
    width: CARD,
    height: CARD,
    borderRadius: 40,
    padding: 3,
    backgroundColor: 'rgba(120,215,255,0.55)',
    shadowColor: '#35B6FF',
    shadowOpacity: 0.45,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 14 },
    elevation: 14,
  },
  logoCard: {
    flex: 1,
    borderRadius: 37,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  logoInner: {
    width: WINDOW_W,
    height: WINDOW_H,
    overflow: 'hidden',
    alignItems: 'center',
  },
  logoCropped: {
    position: 'absolute',
    width: IMG,
    height: IMG,
    left: (WINDOW_W - IMG) / 2 - 1,
    top: -2,
  },

  /* Brand */
  brand: {
    marginTop: 26,
    fontSize: 46,
    fontWeight: '900',
    letterSpacing: -1.2,
  },
  brandFee: { color: COLORS.feeBlue },
  brandVault: { color: COLORS.vaultGreen },

  /* Description */
  desc: {
    marginTop: 6,
    fontSize: 14.5,
    lineHeight: 21,
    color: COLORS.textDark,
    textAlign: 'center',
    fontWeight: '500',
  },
  descBold: { fontWeight: '800', color: COLORS.feeBlue },

  /* Pill */
  pill: {
    marginTop: 26,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 20,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(160,210,255,0.55)',
    shadowColor: COLORS.feeBlue,
    shadowOpacity: 0.25,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  dotOuter: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: COLORS.pillBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.pillDot,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.3,
    color: COLORS.feeBlue,
  },

  /* Bottom */
  bottom: { width: '100%', alignItems: 'center', paddingBottom: 6 },
  loadingText: {
    fontSize: 12,
    color: COLORS.textMid,
    fontWeight: '600',
  },
  version: {
    position: 'absolute',
    right: 16,
    bottom: 4,
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.4,
    color: COLORS.textLight,
  },
  footer: {
    marginTop: 8,
    fontSize: 9.5,
    letterSpacing: 2.4,
    fontWeight: '800',
    color: COLORS.textMid,
  },
});
