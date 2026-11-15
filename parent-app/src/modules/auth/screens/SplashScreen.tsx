// SplashScreen.tsx — FeeVault Parent App (clean, static design)
// Logo image: src/assets/images/feevault.png
//
// No animations, no background circles, no new packages.
// Colors are unchanged from your original file.

import React, { useEffect } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  StatusBar,
  Platform,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/AppNavigator';
import { ROUTES } from '../../../constants/routes';
import { COLORS } from '../../../theme/colors';

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

      {/* Background – same colors, plain gradient only */}
      <LinearGradient
        colors={['#D9F3FF', '#EEF9FF', '#F7FCFF', '#E9FBF1']}
        locations={[0, 0.35, 0.7, 1]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safe}>
        {/* Top tagline with side rules */}
        <View style={styles.topWrap}>
          <View style={styles.topRule} />
          <Text style={styles.topLabel}>A SMARTER WAY TO MANAGE SCHOOL FEES</Text>
          <View style={styles.topRule} />
        </View>

        {/* Center content */}
        <View style={styles.center}>
          {/* Logo – full image, no crop, no box */}
          <Image
            source={require('../../../assets/images/feevault.png')}
            style={styles.logo}
            resizeMode="contain"
          />

          {/* Brand name */}
          <Text style={styles.brand}>
            <Text style={styles.brandFee}>Fee</Text>
            <Text style={styles.brandVault}>Vault</Text>
          </Text>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLineBlue} />
            <View style={styles.dividerLineGreen} />
          </View>

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

        {/* Bottom */}
        <View style={styles.bottom}>
          <View style={styles.footerRow}>
            <View style={styles.footerRule} />
            <Text style={styles.footer}>SECURE • SIMPLE • SMART</Text>
            <View style={styles.footerRule} />
          </View>
        </View>

        {/* App version – tiny, bottom-right corner */}
        <Text style={styles.version}>{APP_VERSION}</Text>
      </SafeAreaView>
    </View>
  );
}

/* ---------- Logo sizing ---------- */
const LOGO_SIZE = 190; // full logo, increase/decrease as you like

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

  /* Top label */
  topWrap: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
  },
  topRule: {
    width: 18,
    height: 1.5,
    borderRadius: 1,
    backgroundColor: COLORS.feeBlue,
    opacity: 0.4,
  },
  topLabel: {
    marginHorizontal: 10,
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
    paddingBottom: 50, // pushes everything up a little
  },

  /* Logo – no box */
  logo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
  },

  /* Brand */
  brand: {
    marginTop: 6,
    fontSize: 46,
    fontWeight: '900',
    letterSpacing: -1.2,
  },
  brandFee: { color: COLORS.feeBlue },
  brandVault: { color: COLORS.vaultGreen },

  /* Divider under brand: blue + green, matches the two-tone name */
  divider: {
    marginTop: 10,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dividerLineBlue: {
    width: 28,
    height: 3,
    borderTopLeftRadius: 2,
    borderBottomLeftRadius: 2,
    backgroundColor: COLORS.feeBlue,
  },
  dividerLineGreen: {
    width: 28,
    height: 3,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
    backgroundColor: COLORS.vaultGreen,
  },

  /* Description */
  desc: {
    marginTop: 4,
    fontSize: 14.5,
    lineHeight: 21,
    color: COLORS.textDark,
    textAlign: 'center',
    fontWeight: '500',
  },
  descBold: { fontWeight: '800', color: COLORS.feeBlue },

  /* Pill */
  pill: {
    marginTop: 28,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 20,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(160,210,255,0.8)',
    shadowColor: COLORS.feeBlue,
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
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
  footerRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerRule: {
    width: 22,
    height: 1,
    backgroundColor: COLORS.textMid,
    opacity: 0.35,
  },
  footer: {
    marginHorizontal: 10,
    fontSize: 9.5,
    letterSpacing: 2.4,
    fontWeight: '800',
    color: COLORS.textMid,
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
});