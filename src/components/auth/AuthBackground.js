import React from 'react';
import { StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

const AUTH_WAVE_BACKGROUND = require('../../../assets/images/auth-wave-background.jpg');

export default function AuthBackground({ theme, intensity = 1 }) {
  const backgroundOpacity = useSharedValue(intensity);
  const waveShift = useSharedValue(0);
  const glowShift = useSharedValue(0);

  React.useEffect(() => {
    backgroundOpacity.value = withTiming(intensity, {
      duration: 380,
      easing: Easing.out(Easing.cubic),
    });
  }, [backgroundOpacity, intensity]);

  React.useEffect(() => {
    waveShift.value = withRepeat(
      withSequence(
        withTiming(1, {
          duration: 14000,
          easing: Easing.inOut(Easing.sin),
        }),
        withTiming(0, {
          duration: 14000,
          easing: Easing.inOut(Easing.sin),
        })
      ),
      -1,
      false
    );

    glowShift.value = withRepeat(
      withSequence(
        withTiming(1, {
          duration: 16000,
          easing: Easing.inOut(Easing.sin),
        }),
        withTiming(0, {
          duration: 16000,
          easing: Easing.inOut(Easing.sin),
        })
      ),
      -1,
      false
    );
  }, [glowShift, waveShift]);

  const waveStyle = useAnimatedStyle(() => {
    return {
      opacity: theme.background.imageOpacity - waveShift.value * 0.06,
      transform: [
        { translateX: -20 + waveShift.value * 34 },
        { translateY: -14 + waveShift.value * 22 },
        { scale: theme.background.waveScale + waveShift.value * 0.03 },
      ],
    };
  }, [theme]);

  const tintStyle = useAnimatedStyle(() => {
    return {
      opacity: 0.84 - glowShift.value * 0.08,
      transform: [
        { translateX: -10 + glowShift.value * 20 },
        { translateY: -12 + glowShift.value * 18 },
        { scale: 1.02 + glowShift.value * 0.03 },
      ],
    };
  }, []);

  const glowStyle = useAnimatedStyle(() => {
    return {
      opacity: 0.66 + glowShift.value * 0.14,
      transform: [
        { translateX: 12 - glowShift.value * 28 },
        { translateY: -18 + glowShift.value * 30 },
        { scale: 1.04 + glowShift.value * 0.05 },
      ],
    };
  }, []);

  const containerStyle = useAnimatedStyle(() => {
    return {
      opacity: backgroundOpacity.value,
    };
  }, []);

  return (
    <Animated.View pointerEvents="none" style={[styles.container, containerStyle]}>
      <LinearGradient
        colors={theme.background.base}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.canvas}
      />

      <Animated.View style={[styles.waveLayer, waveStyle]}>
        <Image
          contentFit="cover"
          source={AUTH_WAVE_BACKGROUND}
          style={styles.waveImage}
          transition={0}
        />
      </Animated.View>

      <Animated.View style={[styles.canvas, tintStyle]}>
        <LinearGradient
          colors={theme.background.tint}
          start={{ x: 0.4, y: 0 }}
          end={{ x: 0.6, y: 1 }}
          style={styles.canvas}
        />
      </Animated.View>

      <Animated.View style={[styles.glowLayer, glowStyle]}>
        <LinearGradient
          colors={theme.background.glow}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.canvas}
        />
      </Animated.View>

      <LinearGradient
        colors={theme.background.edge}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.canvas}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  canvas: {
    ...StyleSheet.absoluteFillObject,
  },
  waveLayer: {
    position: 'absolute',
    top: -72,
    right: -72,
    bottom: -72,
    left: -72,
  },
  waveImage: {
    flex: 1,
  },
  glowLayer: {
    ...StyleSheet.absoluteFillObject,
  },
});
