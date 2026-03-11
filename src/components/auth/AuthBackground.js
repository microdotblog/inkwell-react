import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

export default function AuthBackground({ theme }) {
  const glowShift = useSharedValue(0);
  const topShift = useSharedValue(0);
  const bottomShift = useSharedValue(0);

  React.useEffect(() => {
    glowShift.value = withRepeat(
      withSequence(
        withTiming(1, {
          duration: 7200,
          easing: Easing.inOut(Easing.sin),
        }),
        withTiming(0, {
          duration: 7200,
          easing: Easing.inOut(Easing.sin),
        })
      ),
      -1,
      false
    );

    topShift.value = withRepeat(
      withSequence(
        withTiming(1, {
          duration: 8400,
          easing: Easing.inOut(Easing.sin),
        }),
        withTiming(0, {
          duration: 8400,
          easing: Easing.inOut(Easing.sin),
        })
      ),
      -1,
      false
    );

    bottomShift.value = withRepeat(
      withSequence(
        withTiming(1, {
          duration: 9000,
          easing: Easing.inOut(Easing.sin),
        }),
        withTiming(0, {
          duration: 9000,
          easing: Easing.inOut(Easing.sin),
        })
      ),
      -1,
      false
    );
  }, [bottomShift, glowShift, topShift]);

  const heroGlowStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: glowShift.value * -10 },
        { translateY: glowShift.value * 14 },
        { scale: 1 + glowShift.value * 0.04 },
      ],
    };
  }, []);

  const topOrbStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: topShift.value * -12 },
        { translateY: topShift.value * 10 },
        { scale: 1 + topShift.value * 0.03 },
      ],
    };
  }, []);

  const bottomOrbStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: bottomShift.value * 16 },
        { translateY: bottomShift.value * -10 },
        { scale: 1 + bottomShift.value * 0.035 },
      ],
    };
  }, []);

  return (
    <View pointerEvents="none" style={styles.container}>
      <LinearGradient
        colors={theme.gradients.background}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.canvas}
      />
      <Animated.View style={[styles.heroGlow, heroGlowStyle]}>
        <LinearGradient
          colors={theme.gradients.heroGlow}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.orbFill}
        />
      </Animated.View>
      <Animated.View style={[styles.topOrb, topOrbStyle]}>
        <LinearGradient
          colors={theme.gradients.topOrb}
          start={{ x: 0.3, y: 0.1 }}
          end={{ x: 1, y: 1 }}
          style={styles.orbFill}
        />
      </Animated.View>
      <Animated.View style={[styles.bottomOrb, bottomOrbStyle]}>
        <LinearGradient
          colors={theme.gradients.bottomOrb}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.orbFill}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
  },
  canvas: {
    ...StyleSheet.absoluteFillObject,
  },
  orbFill: {
    flex: 1,
    borderRadius: 999,
  },
  heroGlow: {
    position: 'absolute',
    top: -90,
    right: -40,
    width: 260,
    height: 260,
    borderRadius: 130,
  },
  topOrb: {
    position: 'absolute',
    top: 90,
    right: -70,
    width: 240,
    height: 240,
    borderRadius: 120,
  },
  bottomOrb: {
    position: 'absolute',
    bottom: -110,
    left: -30,
    width: 280,
    height: 280,
    borderRadius: 140,
  },
});
