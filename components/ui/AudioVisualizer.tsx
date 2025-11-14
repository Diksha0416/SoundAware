import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withTiming,
  interpolate,
  Extrapolate
} from 'react-native-reanimated';
import { useTheme } from '@/contexts/ThemeContext';

interface AudioVisualizerProps {
  isActive: boolean;
  type?: 'waveform' | 'bars' | 'circle';
  height?: number;
  barCount?: number;
}

const { width } = Dimensions.get('window');

export function AudioVisualizer({ 
  isActive, 
  type = 'waveform', 
  height = 60,
  barCount = 20 
}: AudioVisualizerProps) {
  const { colors } = useTheme();
  const animationValue = useSharedValue(0);

  useEffect(() => {
    if (isActive) {
      animationValue.value = withRepeat(
        withTiming(1, { duration: 1000 }),
        -1,
        true
      );
    } else {
      animationValue.value = withTiming(0, { duration: 300 });
    }
  }, [isActive]);

  const renderWaveform = () => {
    const bars = Array.from({ length: barCount }, (_, index) => {
      const animatedStyle = useAnimatedStyle(() => {
        const delay = (index / barCount) * 0.5;
        const animatedHeight = interpolate(
          animationValue.value,
          [0, 1],
          [4, height * (0.3 + Math.random() * 0.7)],
          Extrapolate.CLAMP
        );
        
        return {
          height: withTiming(animatedHeight, { 
            duration: 200 + Math.random() * 300 
          }),
          opacity: isActive ? 1 : 0.3,
        };
      });

      return (
        <Animated.View
          key={index}
          style={[
            styles.bar,
            { backgroundColor: colors.primary },
            animatedStyle
          ]}
        />
      );
    });

    return <View style={styles.waveformContainer}>{bars}</View>;
  };

  const renderBars = () => {
    const bars = Array.from({ length: barCount }, (_, index) => {
      const animatedStyle = useAnimatedStyle(() => {
        const staggerDelay = index * 0.1;
        const animatedHeight = interpolate(
          (animationValue.value + staggerDelay) % 1,
          [0, 0.5, 1],
          [10, height, 10],
          Extrapolate.CLAMP
        );
        
        return {
          height: animatedHeight,
          opacity: isActive ? 0.8 + Math.sin(animationValue.value * Math.PI + index) * 0.2 : 0.3,
        };
      });

      return (
        <Animated.View
          key={index}
          style={[
            styles.bar,
            { backgroundColor: colors.secondary },
            animatedStyle
          ]}
        />
      );
    });

    return <View style={styles.barsContainer}>{bars}</View>;
  };

  const renderCircle = () => {
    const circles = Array.from({ length: 3 }, (_, index) => {
      const animatedStyle = useAnimatedStyle(() => {
        const delay = index * 0.3;
        const scale = interpolate(
          (animationValue.value + delay) % 1,
          [0, 0.5, 1],
          [0.5, 1.2, 0.5],
          Extrapolate.CLAMP
        );
        
        const opacity = interpolate(
          (animationValue.value + delay) % 1,
          [0, 0.5, 1],
          [0.3, 0.8, 0.3],
          Extrapolate.CLAMP
        );
        
        return {
          transform: [{ scale: isActive ? scale : 0.5 }],
          opacity: isActive ? opacity : 0.2,
        };
      });

      return (
        <Animated.View
          key={index}
          style={[
            styles.circle,
            { 
              borderColor: index === 0 ? colors.primary : index === 1 ? colors.secondary : colors.accent,
              width: 40 + index * 20,
              height: 40 + index * 20,
              borderRadius: 20 + index * 10,
            },
            animatedStyle
          ]}
        />
      );
    });

    return <View style={styles.circleContainer}>{circles}</View>;
  };

  return (
    <View style={[styles.container, { height, overflow: 'hidden', width: '100%' }]}>
      {type === 'waveform' && renderWaveform()}
      {type === 'bars' && renderBars()}
      {type === 'circle' && renderCircle()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    height: '100%',
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    height: '100%',
  },
  bar: {
    width: 3,
    borderRadius: 2,
    minHeight: 4,
  },
  circleContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  circle: {
    position: 'absolute',
    borderWidth: 2,
  },
});