// ─────────────────────────────────────────────
//  FeeVault Parent App — Welcome Carousel Screen
//  3 Slides: Locked Savings, Daily Interest, Direct Payout
// ─────────────────────────────────────────────

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  FlatList,
  TouchableOpacity,
  NativeSyntheticEvent,
  NativeScrollEvent,
  StatusBar,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/AppNavigator';
import { ROUTES } from '../../../constants/routes';
import { COLORS } from '../../../theme/colors';
import { CustomButton } from '../../../components/CustomButton';
import { PillBadge } from '../../../components/PillBadge';

const { width: W } = Dimensions.get('window');

interface CarouselSlide {
  id: string;
  pillBadge: string;
  emoji: string;
  title: string;
  highlightText: string;
  subtitle: string;
  badgeCardTitle: string;
  badgeCardSubtitle: string;
}

const SLIDES: CarouselSlide[] = [
  {
    id: '1',
    pillBadge: 'GOAL PROTECTION',
    emoji: '🔒',
    title: 'Locked Savings for',
    highlightText: 'School Fees',
    subtitle:
      'Discipline your education budget. Funds deposited are strictly earmarked and protected from accidental spending.',
    badgeCardTitle: 'Zero Diversion Guarantee',
    badgeCardSubtitle: 'Dedicated escrow protection for your child',
  },
  {
    id: '2',
    pillBadge: 'SMART RETURNS',
    emoji: '📈',
    title: 'Earn High Yield',
    highlightText: 'Daily Interest',
    subtitle:
      'Earn up to 7.5% annual return with daily interest accrual on every rupee saved until the school fee deadline.',
    badgeCardTitle: 'Compounding Daily Yield',
    badgeCardSubtitle: 'More savings = Lower net school fee cost',
  },
  {
    id: '3',
    pillBadge: 'ESCROW SETTLEMENT',
    emoji: '🏫',
    title: 'Direct School Fee',
    highlightText: 'Escrow Payout',
    subtitle:
      'On fee due date, FeeVault pays the verified school bank account directly and delivers instant GST fee receipts.',
    badgeCardTitle: 'Instant Verified Payout',
    badgeCardSubtitle: 'Zero queues • Direct to School Account',
  },
];

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const WelcomeCarouselScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const scrollPosition = event.nativeEvent.contentOffset.x;
    const index = Math.round(scrollPosition / W);
    if (index !== activeIndex && index >= 0 && index < SLIDES.length) {
      setActiveIndex(index);
    }
  };

  const handleNext = () => {
    if (activeIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({
        index: activeIndex + 1,
        animated: true,
      });
    } else {
      navigation.navigate(ROUTES.LOGIN);
    }
  };

  const handleSkip = () => {
    navigation.navigate(ROUTES.LOGIN);
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" />

      {/* Background Gradient */}
      <LinearGradient
        colors={['#D9F3FF', '#EEF9FF', '#F7FCFF', '#E9FBF1']}
        locations={[0, 0.35, 0.7, 1]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safe}>
        {/* Top Header Row */}
        <View style={styles.topRow}>
          <PillBadge label="FEEVAULT SMART ONBOARDING" />
          <TouchableOpacity
            onPress={handleSkip}
            style={styles.skipBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>

        {/* Carousel Slides */}
        <FlatList
          ref={flatListRef}
          data={SLIDES}
          keyExtractor={(item) => item.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScroll}
          style={styles.carouselList}
          renderItem={({ item }) => (
            <View style={styles.slide}>
              {/* Illustration Hero Card */}
              <View style={styles.heroCardOuter}>
                <LinearGradient
                  colors={['rgba(255,255,255,0.95)', 'rgba(224,242,254,0.85)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.heroCard}>
                  <Text style={styles.heroEmoji}>{item.emoji}</Text>
                  <View style={styles.heroBadgeRow}>
                    <Text style={styles.heroBadgeText}>{item.pillBadge}</Text>
                  </View>
                </LinearGradient>
              </View>

              {/* Title & Tagline */}
              <Text style={styles.titleText}>
                {item.title}{' '}
                <Text style={styles.highlightText}>{item.highlightText}</Text>
              </Text>

              <Text style={styles.subtitleText}>{item.subtitle}</Text>

              {/* Feature Benefit Card */}
              <View style={styles.benefitCard}>
                <View style={styles.benefitDot} />
                <View style={styles.benefitInfo}>
                  <Text style={styles.benefitTitle}>{item.badgeCardTitle}</Text>
                  <Text style={styles.benefitSub}>{item.badgeCardSubtitle}</Text>
                </View>
              </View>
            </View>
          )}
        />

        {/* Bottom Navigation Section */}
        <View style={styles.bottomSection}>
          {/* Pagination Dots */}
          <View style={styles.dotsRow}>
            {SLIDES.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  i === activeIndex ? styles.dotActive : styles.dotInactive,
                ]}
              />
            ))}
          </View>

          {/* Action Button */}
          <CustomButton
            label={activeIndex === SLIDES.length - 1 ? 'Get Started →' : 'Continue'}
            onPress={handleNext}
            style={styles.actionBtn}
          />

          {/* Security Tagline */}
          <Text style={styles.secureTag}>
            🔒 RBI-REGULATED ESCROW & BANKING PARTNERS
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#EEF9FF',
  },
  safe: {
    flex: 1,
    justifyContent: 'space-between',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  skipBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  skipText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.feeBlue,
  },
  carouselList: {
    flex: 1,
  },
  slide: {
    width: W,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  heroCardOuter: {
    width: W * 0.58,
    height: W * 0.58,
    borderRadius: 36,
    padding: 3,
    backgroundColor: 'rgba(120,215,255,0.4)',
    shadowColor: '#35B6FF',
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
    marginBottom: 28,
  },
  heroCard: {
    flex: 1,
    borderRadius: 33,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  heroEmoji: {
    fontSize: 72,
    marginBottom: 10,
  },
  heroBadgeRow: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: 'rgba(26,86,219,0.12)',
  },
  heroBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.feeBlue,
    letterSpacing: 1.2,
  },
  titleText: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.textDark,
    textAlign: 'center',
    lineHeight: 33,
    marginBottom: 12,
  },
  highlightText: {
    color: COLORS.feeBlue,
  },
  subtitleText: {
    fontSize: 14,
    color: COLORS.textMid,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  benefitCard: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(160,210,255,0.4)',
  },
  benefitDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.vaultGreen,
    marginRight: 12,
  },
  benefitInfo: {
    flex: 1,
  },
  benefitTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  benefitSub: {
    fontSize: 11,
    color: COLORS.textMid,
    marginTop: 2,
  },
  bottomSection: {
    paddingHorizontal: 24,
    paddingBottom: 20,
    alignItems: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  dot: {
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  dotActive: {
    width: 26,
    backgroundColor: COLORS.feeBlue,
  },
  dotInactive: {
    width: 8,
    backgroundColor: '#CBD5E1',
  },
  actionBtn: {
    width: '100%',
    marginBottom: 14,
  },
  secureTag: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: COLORS.textLight,
  },
});

export default WelcomeCarouselScreen;

