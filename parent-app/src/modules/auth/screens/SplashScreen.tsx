// SplashScreen.tsx — FeeVault Parent App
// Solid colors only, taken from theme COLORS. Uses only built-in RN Animated.
// Logo image: src/assets/images/feevault.png

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, StatusBar, Animated, Easing } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/AppNavigator';
import { ROUTES } from '../../../constants/routes';
import { COLORS } from '../../../theme/colors';

const SPLASH_MS = 2600;
const LOGO_SIZE = 190;
const SPINNER_SIZE = 34;

export default function SplashScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.85)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textShift = useRef(new Animated.Value(12)).current;
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const intro = Animated.parallel([
      Animated.timing(logoOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(logoScale, {
        toValue: 1,
        duration: 700,
        easing: Easing.out(Easing.back(1.4)),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(400),
        Animated.parallel([
          Animated.timing(textOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
          Animated.timing(textShift, {
            toValue: 0,
            duration: 600,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]);
    intro.start();

    // Rotating circle loader
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();

    const timer = setTimeout(() => {
      navigation.replace(ROUTES.WELCOME_CAROUSEL);
    }, SPLASH_MS);

    return () => {
      clearTimeout(timer);
      intro.stop();
      loop.stop();
    };
  }, [navigation, logoOpacity, logoScale, textOpacity, textShift, spin]);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" />

      {/* Center */}
      <View style={styles.center}>
        <Animated.Image
          source={require('../../../assets/images/feevault.png')}
          resizeMode="contain"
          style={[
            styles.logo,
            { opacity: logoOpacity, transform: [{ scale: logoScale }] },
          ]}
        />

        <Animated.View
          style={{
            alignItems: 'center',
            opacity: textOpacity,
            transform: [{ translateY: textShift }],
          }}
        >
          <Text style={styles.brand}>
            <Text style={styles.brandFee}>Fee</Text>
            <Text style={styles.brandVault}>vault</Text>
          </Text>

          <View style={styles.rule}>
            <View style={styles.ruleBlue} />
            <View style={styles.ruleGreen} />
          </View>

          <Text style={styles.tagline}>SMART SCHOOL FEE MANAGEMENT</Text>
        </Animated.View>
      </View>

      {/* Bottom: rotating circle loader */}
      <View style={styles.bottom}>
        <Animated.View style={[styles.spinner, { transform: [{ rotate }] }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 40,
  },
  logo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
  },
  brand: {
    marginTop: 8,
    fontSize: 44,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  brandFee: { color: COLORS.feeBlue },
  brandVault: { color: COLORS.vaultGreen },
  rule: {
    flexDirection: 'row',
    marginTop: 12,
    marginBottom: 14,
  },
  ruleBlue: {
    width: 22,
    height: 3,
    borderTopLeftRadius: 2,
    borderBottomLeftRadius: 2,
    backgroundColor: COLORS.feeBlue,
  },
  ruleGreen: {
    width: 22,
    height: 3,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
    backgroundColor: COLORS.vaultGreen,
  },
  tagline: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2.4,
    color: COLORS.textMid,
  },
  bottom: {
    width: '100%',
    alignItems: 'center',
    paddingBottom: 48,
  },
  spinner: {
    width: SPINNER_SIZE,
    height: SPINNER_SIZE,
    borderRadius: SPINNER_SIZE / 2,
    borderWidth: 3,
    borderColor: COLORS.progressTrack,
    borderTopColor: COLORS.vaultGreen,
    borderRightColor: COLORS.feeBlue,
  },
});