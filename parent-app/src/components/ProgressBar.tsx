// ─────────────────────────────────────────────
//  Shared Component: ProgressBar
//  Animated horizontal progress bar
// ─────────────────────────────────────────────
import React, {useEffect, useRef} from 'react';
import {View, Animated, StyleSheet, ViewStyle} from 'react-native';
import {COLORS} from '../theme/colors';

interface ProgressBarProps {
  progress?: number; // 0 to 1
  animated?: boolean;
  style?: ViewStyle;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress = 0.3,
  animated = true,
  style,
}) => {
  const animVal = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (animated) {
      Animated.timing(animVal, {
        toValue: progress,
        duration: 1200,
        useNativeDriver: false,
      }).start();
    } else {
      animVal.setValue(progress);
    }
  }, [progress, animated, animVal]);

  const widthInterpolated = animVal.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={[styles.track, style]}>
      <Animated.View style={[styles.fill, {width: widthInterpolated}]} />
    </View>
  );
};

const styles = StyleSheet.create({
  track: {
    height: 4,
    borderRadius: 4,
    backgroundColor: COLORS.progressTrack,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: COLORS.progressFill,
  },
});

