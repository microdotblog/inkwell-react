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
import AuthCard from '../components/auth/AuthCard';
import PrimaryButton from '../components/auth/PrimaryButton';
import Auth from '../stores/Auth';
import { getAuthTheme } from '../theme/authTheme';

function WelcomeScreen({ isDark = false }) {
  const theme = getAuthTheme(isDark);
  const cardOpacity = useSharedValue(0);
  const cardTranslateY = useSharedValue(26);
  const is_signing_in = Auth.is_loading();
  const error_message = Auth.error_message;

  React.useEffect(() => {
    cardOpacity.value = withDelay(
      620,
      withTiming(1, {
        duration: 320,
        easing: Easing.out(Easing.cubic),
      })
    );
    cardTranslateY.value = withDelay(
      620,
      withTiming(0, {
        duration: 360,
        easing: Easing.out(Easing.cubic),
      })
    );
  }, []);

  const cardAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: cardOpacity.value,
      transform: [{ translateY: cardTranslateY.value }],
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
            <Text style={[styles.title, { color: theme.colors.ink }]}>Welcome to Inkwell</Text>
            <Text style={[styles.body, { color: theme.colors.inkSoft }]}>
              A quieter way to read the open web.
            </Text>
          </Animated.View>

          <View style={styles.footer}>
            <Animated.View pointerEvents="box-none" style={[styles.cardWrap, cardAnimatedStyle]}>
              <AuthCard style={styles.card} theme={theme}>
                <Text style={[styles.cardEyebrow, { color: theme.colors.accentStrong }]}>
                  Micro.blog sign in
                </Text>
                <Text style={[styles.cardTitle, { color: theme.colors.ink }]}>
                  Sign in with Micro.blog.
                </Text>
                <Text style={[styles.cardBody, { color: theme.colors.inkSoft }]}>
                  Connect your account in your default browser and come right back.
                </Text>
                {error_message ? (
                  <Text style={[styles.errorMessage, { color: theme.colors.accentStrong }]}>
                    {error_message}
                  </Text>
                ) : null}
                <PrimaryButton
                  label={is_signing_in ? 'Connecting to Micro.blog...' : 'Continue with Micro.blog'}
                  onPress={Auth.sign_in_with_micro_blog}
                  disabled={is_signing_in}
                  theme={theme}
                />
              </AuthCard>
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
  card: {
    gap: 24,
  },
  cardEyebrow: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  cardTitle: {
    fontFamily: 'Newsreader_600SemiBold',
    fontSize: 31,
    lineHeight: 38,
  },
  cardBody: {
    fontSize: 16,
    lineHeight: 24,
  },
  errorMessage: {
    fontSize: 14,
    lineHeight: 21,
  },
  footer: {
    minHeight: 255,
    justifyContent: 'flex-end',
  },
  cardWrap: {
    width: '100%',
  },
});

export default observer(WelcomeScreen);
