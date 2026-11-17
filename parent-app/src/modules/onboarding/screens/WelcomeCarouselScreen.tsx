// ─────────────────────────────────────────────
//  FeeVault Parent App — Welcome Carousel Screen
//  3 Slides: Locked Savings, Daily Interest, Direct Payout
//  Solid colors only (COLORS tokens), no gradient / glass.
//  Built-in Animated only — no new packages.
// ─────────────────────────────────────────────

import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Animated,
  FlatList,
  TouchableOpacity,
  NativeSyntheticEvent,
  NativeScrollEvent,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/AppNavigator';
import { ROUTES } from '../../../constants/routes';
import { COLORS } from '../../../theme/colors';
import { CustomButton } from '../../../components/CustomButton';
import Svg, { Path } from 'react-native-svg';

const ArrowRightIcon = ({ color = COLORS.textWhite, size = 18 }: { color?: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M5 12H19M19 12L12 5M19 12L12 19"
      stroke={color}
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const { width: W } = Dimensions.get('window');
const HERO = W * 0.56;

interface CarouselSlide {
  id: string;
  pillBadge: string;
  emoji: string;
  title: string;
  highlightText: string;
  subtitle: string;
  badgeCardTitle: string;
  badgeCardSubtitle: string;
  tint: string;   // solid hero background
  accent: string; // highlight color
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
    tint: COLORS.gradientTop,
    accent: COLORS.feeBlue,
  },
  {
    id: '2',
    pillBadge: 'SMART DISCIPLINE',
    emoji: '📊',
    title: 'Flexible & Smart',
    highlightText: 'Split Plans',
    subtitle:
      'Save gradually with 50/50, 70/30 split options or AutoPay at your own pace so you never face sudden school fee pressure.',
    badgeCardTitle: 'Custom Split & AutoPay',
    badgeCardSubtitle: '50/50 • 70/30 • Daily, Weekly or Monthly',
    tint: COLORS.gradientBot,
    accent: COLORS.vaultGreen,
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
    tint: COLORS.gradientTop,
    accent: COLORS.feeBlue,
  },
];

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const WelcomeCarouselScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList<CarouselSlide>>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const handleScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / W);
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

  const isLast = activeIndex === SLIDES.length - 1;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" />

      <SafeAreaView style={styles.safe}>
        {/* Top row: step counter + Skip */}
        <View style={styles.topRow}>
          <Text style={styles.stepText}>
            <Text style={styles.stepNow}>
              {String(activeIndex + 1).padStart(2, '0')}
            </Text>
            {' / '}
            {String(SLIDES.length).padStart(2, '0')}
          </Text>

          {!isLast ? (
            <TouchableOpacity
              onPress={handleSkip}
              style={styles.skipBtn}
              hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}>
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.skipPlaceholder} />
          )}
        </View>

        {/* Slides */}
        <Animated.FlatList
          ref={flatListRef as any}
          data={SLIDES}
          keyExtractor={(item: CarouselSlide) => item.id}
          horizontal
          pagingEnabled
          bounces={false}
          showsHorizontalScrollIndicator={false}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { x: scrollX } } }],
            { useNativeDriver: false },
          )}
          scrollEventThrottle={16}
          onMomentumScrollEnd={handleScrollEnd}
          getItemLayout={(_: unknown, index: number) => ({
            length: W,
            offset: W * index,
            index,
          })}
          style={styles.carouselList}
          renderItem={({ item, index }: { item: CarouselSlide; index: number }) => {
            const input = [(index - 1) * W, index * W, (index + 1) * W];
            const heroScale = scrollX.interpolate({
              inputRange: input,
              outputRange: [0.8, 1, 0.8],
              extrapolate: 'clamp',
            });
            const fade = scrollX.interpolate({
              inputRange: input,
              outputRange: [0, 1, 0],
              extrapolate: 'clamp',
            });

            return (
              <View style={styles.slide}>
                {/* Hero */}
                <Animated.View
                  style={[
                    styles.heroWrap,
                    { opacity: fade, transform: [{ scale: heroScale }] },
                  ]}>
                  <View style={[styles.heroCard, { backgroundColor: item.tint }]}>
                    <View style={styles.heroInner}>
                      <Text style={styles.heroEmoji}>{item.emoji}</Text>
                    </View>
                  </View>

                  {/* Badge overlapping hero edge */}
                  <View style={[styles.heroBadge, { borderColor: item.tint }]}>
                    <View
                      style={[styles.heroBadgeDot, { backgroundColor: item.accent }]}
                    />
                    <Text style={[styles.heroBadgeText, { color: item.accent }]}>
                      {item.pillBadge}
                    </Text>
                  </View>
                </Animated.View>

                {/* Text */}
                <Animated.View style={[styles.textBlock, { opacity: fade }]}>
                  <Text style={styles.titleText}>
                    {item.title}{' '}
                    <Text style={{ color: item.accent }}>{item.highlightText}</Text>
                  </Text>
                  <Text style={styles.subtitleText}>{item.subtitle}</Text>
                </Animated.View>

                {/* Benefit card */}
                <Animated.View style={[styles.benefitCard, { opacity: fade }]}>
                  <View
                    style={[styles.benefitAccent, { backgroundColor: item.accent }]}
                  />
                  <View style={styles.benefitInfo}>
                    <Text style={styles.benefitTitle}>{item.badgeCardTitle}</Text>
                    <Text style={styles.benefitSub}>{item.badgeCardSubtitle}</Text>
                  </View>
                  <View style={styles.benefitTick}>
                    <Text style={styles.benefitTickText}>✓</Text>
                  </View>
                </Animated.View>
              </View>
            );
          }}
        />

        {/* Bottom */}
        <View style={styles.bottomSection}>
          {/* Animated pagination dots */}
          <View style={styles.dotsRow}>
            {SLIDES.map((_, i) => {
              const range = [(i - 1) * W, i * W, (i + 1) * W];
              const dotWidth = scrollX.interpolate({
                inputRange: range,
                outputRange: [8, 26, 8],
                extrapolate: 'clamp',
              });
              const dotOpacity = scrollX.interpolate({
                inputRange: range,
                outputRange: [0.25, 1, 0.25],
                extrapolate: 'clamp',
              });
              return (
                <Animated.View
                  key={i}
                  style={[styles.dot, { width: dotWidth, opacity: dotOpacity }]}
                />
              );
            })}
          </View>

          <CustomButton
            label={isLast ? 'Get Started' : 'Continue'}
            icon={<ArrowRightIcon color={COLORS.textWhite} size={18} />}
            iconPosition="right"
            onPress={handleNext}
            style={styles.actionBtn}
          />

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
    backgroundColor: COLORS.cardBg,
  },
  safe: {
    flex: 1,
    justifyContent: 'space-between',
  },

  /* Header */
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 18,
  },
  stepText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: COLORS.textLight,
  },
  stepNow: {
    color: COLORS.feeBlue,
  },
  skipBtn: {
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: COLORS.cardBg,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
  },
  skipPlaceholder: {
    height: 32,
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
    marginTop: -12,
  },

  /* Hero */
  heroWrap: {
    width: HERO,
    height: HERO,
    marginBottom: 34,
  },
  heroCard: {
    flex: 1,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroInner: {
    width: HERO * 0.62,
    height: HERO * 0.62,
    borderRadius: (HERO * 0.62) / 2,
    backgroundColor: COLORS.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.navy,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  heroEmoji: {
    fontSize: 64,
  },
  heroBadge: {
    position: 'absolute',
    bottom: -16,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.cardBg,
    borderWidth: 1.5,
    shadowColor: COLORS.navy,
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  heroBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 7,
  },
  heroBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },

  /* Text */
  textBlock: {
    alignItems: 'center',
  },
  titleText: {
    fontSize: 27,
    fontWeight: '800',
    color: COLORS.textDark,
    textAlign: 'center',
    lineHeight: 34,
    marginBottom: 12,
  },
  subtitleText: {
    fontSize: 14,
    color: COLORS.textMid,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 22,
    paddingHorizontal: 6,
  },

  /* Benefit card */
  benefitCard: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingVertical: 13,
    paddingRight: 16,
    paddingLeft: 0,
    borderRadius: 16,
    backgroundColor: COLORS.cardBg,
    borderWidth: 1,
    borderColor: COLORS.divider,
    overflow: 'hidden',
    shadowColor: COLORS.navy,
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  benefitAccent: {
    width: 4,
    alignSelf: 'stretch',
    marginRight: 14,
    marginVertical: -13,
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
    width: 24,
    height: 24,
    borderRadius: 8,
    marginLeft: 10,
    backgroundColor: COLORS.pillBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitTickText: {
    fontSize: 12,
    fontWeight: '900',
    color: COLORS.pillText,
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
    backgroundColor: COLORS.feeBlue,
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