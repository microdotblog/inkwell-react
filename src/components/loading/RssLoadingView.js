import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { observer } from 'mobx-react';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import AppStore from '../../stores/App';
import { createScaledTextStyles } from '../../theme/textScale';

const PHASE_COPY = {
  connecting: {
    eyebrow: 'Opening',
    title: 'Opening Micro.blog',
    body: 'Handing you off to your Micro.blog sign in and waiting for the callback.',
  },
  verifying: {
    eyebrow: 'Verifying',
    title: 'Verifying your session',
    body: 'Checking the token and pulling the profile details we need for Inkwell.',
  },
  loading_feeds: {
    eyebrow: 'Loading Feeds',
    title: 'Loading your feeds',
    body: 'Fetching subscriptions and recent entries so your reader is ready to go.',
  },
};

function resolve_phase_copy(phase = 'loading_feeds') {
  if (PHASE_COPY[phase]) {
    return PHASE_COPY[phase];
  } else {
    return PHASE_COPY.loading_feeds;
  }
}

const TEXT_STYLE_NAMES = ['eyebrow', 'title', 'compactTitle', 'body'];

function RssLoadingView({
  theme,
  phase = 'loading_feeds',
  title = '',
  body = '',
  compact = false,
}) {
  const orbit_progress = useSharedValue(0);
  const pulse_progress = useSharedValue(0);
  const text_scale = AppStore.text_scale;
  const scaled_text_styles = React.useMemo(() => {
    return createScaledTextStyles(styles, TEXT_STYLE_NAMES, text_scale);
  }, [text_scale]);

  React.useEffect(() => {
    orbit_progress.value = withRepeat(
      withTiming(1, {
        duration: 2400,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      false
    );

    pulse_progress.value = withRepeat(
      withSequence(
        withTiming(1, {
          duration: 900,
          easing: Easing.out(Easing.quad),
        }),
        withTiming(0, {
          duration: 900,
          easing: Easing.inOut(Easing.quad),
        })
      ),
      -1,
      false
    );
  }, [orbit_progress, pulse_progress]);

  const phase_copy = resolve_phase_copy(phase);
  const resolved_title = title || phase_copy.title;
  const resolved_body = body || phase_copy.body;

  const halo_style = useAnimatedStyle(() => {
    return {
      opacity: interpolate(pulse_progress.value, [0, 1], [0.34, 0.74]),
      transform: [{ scale: interpolate(pulse_progress.value, [0, 1], [0.92, 1.06]) }],
    };
  }, []);

  const outer_ring_style = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${interpolate(orbit_progress.value, [0, 1], [0, 10])}deg` }],
    };
  }, []);

  const inner_ring_style = useAnimatedStyle(() => {
    return {
      opacity: interpolate(pulse_progress.value, [0, 1], [0.5, 0.88]),
      transform: [
        { rotate: `${interpolate(orbit_progress.value, [0, 1], [0, -16])}deg` },
        { scale: interpolate(pulse_progress.value, [0, 1], [0.96, 1.02]) },
      ],
    };
  }, []);

  return (
    <View style={[styles.container, compact ? styles.compactContainer : null]}>
      <View style={styles.iconStack}>
        <Animated.View
          style={[
            styles.halo,
            {
              backgroundColor: theme.colors.accentSoft,
            },
            halo_style,
          ]}
        />
        <Animated.View
          style={[
            styles.outerRing,
            {
              borderColor: theme.colors.line,
            },
            outer_ring_style,
          ]}
        />
        <Animated.View
          style={[
            styles.innerRing,
            {
              borderColor: theme.colors.accentStrong,
            },
            inner_ring_style,
          ]}
        />
        <View
          style={[
            styles.iconBadge,
            {
              backgroundColor: theme.colors.paper,
              borderColor: theme.colors.line,
              shadowColor: theme.colors.shadow,
            },
          ]}
        >
          <MaterialIcons name="rss-feed" size={compact ? 28 : 36} color={theme.colors.accentStrong} />
        </View>
      </View>

      <View style={styles.copy}>
        <Text
          style={[
            styles.eyebrow,
            scaled_text_styles.eyebrow,
            { color: theme.colors.accentStrong },
          ]}
        >
          {phase_copy.eyebrow}
        </Text>
        <Text
          style={[
            styles.title,
            scaled_text_styles.title,
            compact ? styles.compactTitle : null,
            compact ? scaled_text_styles.compactTitle : null,
            { color: theme.colors.ink },
          ]}
        >
          {resolved_title}
        </Text>
        <Text
          style={[
            styles.body,
            scaled_text_styles.body,
            { color: theme.colors.inkSoft },
          ]}
        >
          {resolved_body}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 24,
    width: '100%',
  },
  compactContainer: {
    gap: 18,
  },
  iconStack: {
    width: 142,
    height: 142,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
    width: 116,
    height: 116,
    borderRadius: 58,
  },
  outerRing: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 1,
  },
  innerRing: {
    position: 'absolute',
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  iconBadge: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: {
      width: 0,
      height: 16,
    },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 6,
  },
  copy: {
    alignItems: 'center',
    gap: 10,
    maxWidth: 320,
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: 'Newsreader_700Bold',
    fontSize: 34,
    lineHeight: 40,
    textAlign: 'center',
  },
  compactTitle: {
    fontSize: 28,
    lineHeight: 34,
  },
  body: {
    fontSize: 15,
    lineHeight: 23,
    textAlign: 'center',
  },
});

export default observer(RssLoadingView);
