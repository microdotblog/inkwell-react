import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { observer } from 'mobx-react';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  FadeInUp,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import AuthBackground from '../components/auth/AuthBackground';
import PrimaryButton from '../components/auth/PrimaryButton';
import Auth from '../stores/Auth';
import AppStore from '../stores/App';
import { getAuthTheme } from '../theme/authTheme';
import { createScaledTextStyles } from '../theme/textScale';

const TEXT_STYLE_NAMES = ['title', 'body', 'errorMessage'];
const MICRO_BLOG_LOGO = require('../assets/mb_logo.png');

function WelcomeScreen({ isDark = false }) {
  const accent_palette_id = AppStore.accent_palette_id;
  const text_scale = AppStore.text_scale;
  const theme = getAuthTheme(isDark, accent_palette_id);
  const scaled_text_styles = React.useMemo(() => {
    return createScaledTextStyles(styles, TEXT_STYLE_NAMES, text_scale);
  }, [text_scale]);
  const actionOpacity = useSharedValue(0);
  const actionTranslateY = useSharedValue(26);
  const is_signing_in = Auth.is_loading();
  const error_message = Auth.error_message;

  React.useEffect(() => {
    actionOpacity.value = withDelay(
      620,
      withTiming(1, {
        duration: 320,
        easing: Easing.out(Easing.cubic),
      })
    );
    actionTranslateY.value = withDelay(
      620,
      withTiming(0, {
        duration: 360,
        easing: Easing.out(Easing.cubic),
      })
    );
  }, []);

  const actionAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: actionOpacity.value,
      transform: [{ translateY: actionTranslateY.value }],
    };
  }, []);

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.canvas }]}>
      <AuthBackground theme={theme} />
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <ScrollView
          bounces={false}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeInUp.duration(680)} style={styles.hero}>
            <Text
              style={[
                styles.title,
                scaled_text_styles.title,
                { color: theme.colors.ink },
              ]}
            >
              Welcome to Inkwell
            </Text>
            <Text
              style={[
                styles.body,
                scaled_text_styles.body,
                { color: theme.colors.inkSoft },
              ]}
            >
              Inkwell is a feed reader that syncs with Micro.blog.
              {'\n\n'}
              Make highlights to remember passages later or to blog quotes from them.
            </Text>
          </Animated.View>

          <View style={styles.footer}>
            <Animated.View pointerEvents="box-none" style={[styles.actionWrap, actionAnimatedStyle]}>
              {error_message ? (
                <Text
                  style={[
                    styles.errorMessage,
                    scaled_text_styles.errorMessage,
                    { color: theme.colors.accentStrong },
                  ]}
                >
                  {error_message}
                </Text>
              ) : null}
              <PrimaryButton
                label={is_signing_in ? 'Connecting to Micro.blog...' : 'Sign in with Micro.blog'}
                leadingIconSource={MICRO_BLOG_LOGO}
                onPress={Auth.sign_in_with_micro_blog}
                disabled={is_signing_in}
                style={styles.primaryButton}
                theme={theme}
              />
            </Animated.View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 24,
    gap: 32,
  },
  hero: {
    gap: 16,
    paddingTop: 28,
  },
  title: {
    fontFamily: 'Newsreader_700Bold',
    fontSize: 48,
    lineHeight: 52,
    maxWidth: 320,
  },
  body: {
    fontSize: 18,
    lineHeight: 28,
    maxWidth: 336,
  },
  errorMessage: {
    fontSize: 14,
    lineHeight: 21,
  },
  footer: {
    minHeight: 112,
    justifyContent: 'flex-end',
    paddingBottom: 32,
  },
  actionWrap: {
    gap: 12,
    width: '100%',
  },
  primaryButton: {
    width: '100%',
  },
});

export default observer(WelcomeScreen);
