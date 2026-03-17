import React from 'react';
import { StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

const AUTH_WAVE_BACKGROUND = require('../../../assets/images/auth-wave-background.jpg');
const BACKGROUND_THEME_TRANSITION_DURATION = 1000;

export default function AuthBackground({ theme, intensity = 1 }) {
  const backgroundOpacity = useSharedValue(intensity);
  const waveShift = useSharedValue(0);
  const glowShift = useSharedValue(0);
  const theme_transition_progress = useSharedValue(1);
  const theme_key = `${theme.isDark ? 'dark' : 'light'}:${theme.accent_palette_id || 'default'}`;
  const previous_theme_ref = React.useRef(theme);
  const previous_theme_key_ref = React.useRef(theme_key);
  const transition_token_ref = React.useRef(0);
  const [transition_theme, set_transition_theme] = React.useState(null);
  const needs_immediate_transition = previous_theme_key_ref.current !== theme_key;
  const outgoing_theme = transition_theme || (needs_immediate_transition ? previous_theme_ref.current : null);

  const clear_theme_transition = React.useCallback((transition_token) => {
    if (transition_token_ref.current === transition_token) {
      set_transition_theme(null);
    }
  }, []);

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

  React.useLayoutEffect(() => {
    if (previous_theme_key_ref.current === theme_key) {
      previous_theme_ref.current = theme;
      return;
    }

    const next_transition_token = transition_token_ref.current + 1;
    transition_token_ref.current = next_transition_token;
    set_transition_theme(previous_theme_ref.current);
    theme_transition_progress.value = 0;
    theme_transition_progress.value = withTiming(
      1,
      {
        duration: BACKGROUND_THEME_TRANSITION_DURATION,
        easing: Easing.inOut(Easing.cubic),
      },
      (finished) => {
        if (finished) {
          runOnJS(clear_theme_transition)(next_transition_token);
        }
      },
    );
    previous_theme_key_ref.current = theme_key;
    previous_theme_ref.current = theme;
  }, [clear_theme_transition, theme, theme_key, theme_transition_progress]);

  const containerStyle = useAnimatedStyle(() => {
    return {
      opacity: backgroundOpacity.value,
    };
  }, []);

  const transition_overlay_style = useAnimatedStyle(() => {
    return {
      opacity: 1 - theme_transition_progress.value,
    };
  }, []);

  return (
    <Animated.View pointerEvents="none" style={[styles.container, containerStyle]}>
      <BackgroundLayer glow_shift={glowShift} theme={theme} wave_shift={waveShift} />

      {outgoing_theme ? (
        <Animated.View
          style={[
            styles.transitionOverlay,
            transition_theme ? transition_overlay_style : styles.immediateTransitionOverlay,
          ]}
        >
          <BackgroundLayer glow_shift={glowShift} theme={outgoing_theme} wave_shift={waveShift} />
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

function BackgroundLayer({ glow_shift, theme, wave_shift }) {
  const wave_style = useAnimatedStyle(() => {
    return {
      opacity: theme.background.imageOpacity - wave_shift.value * 0.06,
      transform: [
        { translateX: -20 + wave_shift.value * 34 },
        { translateY: -14 + wave_shift.value * 22 },
        { scale: theme.background.waveScale + wave_shift.value * 0.03 },
      ],
    };
  }, [theme, wave_shift]);

  const tint_style = useAnimatedStyle(() => {
    return {
      opacity: 0.84 - glow_shift.value * 0.08,
      transform: [
        { translateX: -10 + glow_shift.value * 20 },
        { translateY: -12 + glow_shift.value * 18 },
        { scale: 1.02 + glow_shift.value * 0.03 },
      ],
    };
  }, [glow_shift]);

  const glow_style = useAnimatedStyle(() => {
    return {
      opacity: 0.66 + glow_shift.value * 0.14,
      transform: [
        { translateX: 12 - glow_shift.value * 28 },
        { translateY: -18 + glow_shift.value * 30 },
        { scale: 1.04 + glow_shift.value * 0.05 },
      ],
    };
  }, [glow_shift]);

  return (
    <>
      <LinearGradient
        colors={theme.background.base}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.canvas}
      />

      <Animated.View style={[styles.waveLayer, wave_style]}>
        <Image
          contentFit="cover"
          source={AUTH_WAVE_BACKGROUND}
          style={styles.waveImage}
          transition={0}
        />
      </Animated.View>

      <Animated.View style={[styles.canvas, tint_style]}>
        <LinearGradient
          colors={theme.background.tint}
          start={{ x: 0.4, y: 0 }}
          end={{ x: 0.6, y: 1 }}
          style={styles.canvas}
        />
      </Animated.View>

      <Animated.View style={[styles.glowLayer, glow_style]}>
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
    </>
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
  transitionOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  immediateTransitionOverlay: {
    opacity: 1,
  },
});
