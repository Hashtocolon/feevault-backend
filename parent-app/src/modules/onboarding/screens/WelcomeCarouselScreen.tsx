// ─────────────────────────────────────────────
//  FeeVault Parent App — Welcome Carousel Screen (redesigned)
//  3 Slides: Locked Savings, Daily Interest, Direct Payout
//  Static design: no animations, no glass, no background circles.
//  Colors are unchanged from your original file.
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

      {/* Background – same gradient, nothing else */}
      <LinearGradient
        colors={['#D9F3FF', '#EEF9FF', '#F7FCFF', '#E9FBF1']}
        locations={[0, 0.35, 0.7, 1]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safe}>
        {/* Top Header Row — Clean Skip Button */}
        <View style={styles.topRow}>
          <View />
          <TouchableOpacity
            onPress={handleSkip}
            style={styles.skipBtn}
            hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}>
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
          getItemLayout={(_, index) => ({
            length: W,
            offset: W * index,
            index,
          })}
          style={styles.carouselList}
          renderItem={({ item }) => (
            <View style={styles.slide}>
              {/* Hero Card – big square, like the original */}
              <View style={styles.heroCardOuter}>
                <View style={styles.heroCard}>
                  <Text style={styles.heroEmoji}>{item.emoji}</Text>
                  <View style={styles.heroBadgeRow}>
                    <Text style={styles.heroBadgeText}>{item.pillBadge}</Text>
                  </View>
                </View>
              </View>

              {/* Title & Tagline */}
              <Text style={styles.titleText}>
                {item.title}{' '}
                <Text style={styles.highlightText}>{item.highlightText}</Text>
              </Text>

              <Text style={styles.subtitleText}>{item.subtitle}</Text>

              {/* Feature Benefit Card */}
              <View style={styles.benefitCard}>
                <View style={styles.benefitInfo}>
                  <Text style={styles.benefitTitle}>{item.badgeCardTitle}</Text>
                  <Text style={styles.benefitSub}>{item.badgeCardSubtitle}</Text>
                </View>
                <View style={styles.benefitTick}>
                  <Text style={styles.benefitTickText}>✓</Text>
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
          <View style={styles.secureRow}>
            <View style={styles.secureRule} />
            <Text style={styles.secureTag}>
              🔒 HELD IN SCHEDULED BANK ESCROW ACCOUNT
            </Text>
            <View style={styles.secureRule} />
          </View>
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

  /* Header */
  topRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingTop: 18, // Moved down nicely for easy reach & clean spacing
  },
  skipBtn: {
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(160,210,255,0.8)',
    shadowColor: '#0757DF',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  skipText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.feeBlue,
  },

  /* Slide */
  carouselList: {
    flex: 1,
  },
  slide: {
    width: W,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingTop: 10,
    marginTop: -28, // Moves the entire hero card and illustration up nicely
  },

  /* Hero card – big square, solid (no glass) */
  heroCardOuter: {
    width: W * 0.48,
    height: W * 0.48,
    borderRadius: 34,
    padding: 3,
    backgroundColor: '#78D7FF',
    shadowColor: '#35B6FF',
    shadowOpacity: 0.3,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
    marginBottom: 20, // Reduced space to keep everything comfortably higher
  },
  heroCard: {
    flex: 1,
    borderRadius: 33,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  heroEmoji: {
    fontSize: 62,
    marginBottom: 10,
  },
  heroBadgeRow: {
    paddingHorizontal: 11,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: 'rgba(26,86,219,0.12)',
  },
  heroBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: COLORS.feeBlue,
    letterSpacing: 1,
  },

  /* Text */
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
    marginBottom: 22,
    paddingHorizontal: 6,
  },

  /* Benefit card – clean solid white with soft border */
  benefitCard: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D3EBFF',
    shadowColor: '#0757DF',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  benefitInfo: {
    flex: 1,
  },
  benefitTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textDark,
  },
  benefitSub: {
    fontSize: 11,
    color: COLORS.textMid,
    marginTop: 2,
  },
  benefitTick: {
    width: 22,
    height: 22,
    borderRadius: 7,
    marginLeft: 10,
    backgroundColor: '#E9FBF1',
    borderWidth: 1,
    borderColor: '#B8E6CD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitTickText: {
    fontSize: 12,
    fontWeight: '900',
    color: COLORS.vaultGreen,
  },

  /* Bottom */
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
  secureRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  secureRule: {
    width: 14,
    height: 1,
    backgroundColor: COLORS.textLight,
    opacity: 0.5,
  },
  secureTag: {
    marginHorizontal: 8,
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: COLORS.textLight,
  },
});

export default WelcomeCarouselScreen;