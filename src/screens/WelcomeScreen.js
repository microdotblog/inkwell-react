import React from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { observer } from 'mobx-react';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
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
import AppStore from '../stores/App';
import { getAuthTheme } from '../theme/authTheme';
import { createScaledTextStyles } from '../theme/textScale';

const TEXT_STYLE_NAMES = [
  'title',
  'body',
  'errorMessage',
  'modalTitle',
  'modalBody',
  'modalInput',
  'modalError',
];
const MICRO_BLOG_LOGO = require('../assets/mb_logo.png');
const MICRO_BLOG_TERMS_OF_SERVICE_URL = 'https://help.micro.blog/t/terms-of-service/113';
const MICRO_BLOG_COMMUNITY_GUIDELINES_URL = 'https://help.micro.blog/t/community-guidelines/39';
const MICRO_BLOG_PRIVACY_POLICY_URL = 'https://help.micro.blog/t/privacy-policy/114';

function color_with_opacity(color = '', opacity = 0.25) {
  const rgba_match = color.match(/^rgba\((.+),\s*[\d.]+\)$/);

  if (rgba_match) {
    return `rgba(${rgba_match[1]}, ${opacity})`;
  }

  return color;
}

function TokenSignInModal({
  error_message = null,
  is_signing_in = false,
  onCancel,
  onChangeTokenValue,
  onSubmit,
  scaled_text_styles,
  theme,
  token_value = '',
  visible = false,
}) {
  return (
    <Modal
      animationType="fade"
      onRequestClose={onCancel}
      transparent
      visible={visible}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalRoot}
      >
        <Pressable
          disabled={is_signing_in}
          onPress={onCancel}
          style={styles.modalBackdrop}
        />

        <View pointerEvents="box-none" style={styles.modalCardWrap}>
          <AuthCard style={styles.modalCard} theme={theme}>
            <Text
              style={[
                styles.modalTitle,
                scaled_text_styles.modalTitle,
                { color: theme.colors.ink },
              ]}
            >
              Sign in with a token
            </Text>

            <Text
              style={[
                styles.modalBody,
                scaled_text_styles.modalBody,
                { color: theme.colors.inkSoft },
              ]}
            >
              Paste a Micro.blog token from your account page to sign in directly.
            </Text>

            <View
              style={[
                styles.modalInputWrap,
                {
                  backgroundColor: theme.colors.canvas,
                  borderColor: theme.colors.line,
                },
              ]}
            >
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus={visible}
                onChangeText={onChangeTokenValue}
                onSubmitEditing={onSubmit}
                placeholder="Micro.blog token"
                placeholderTextColor={theme.colors.inkSoft}
                returnKeyType="done"
                selectionColor={theme.colors.accentStrong}
                style={[
                  styles.modalInput,
                  scaled_text_styles.modalInput,
                  { color: theme.colors.ink },
                ]}
                value={token_value}
              />
            </View>

            {error_message ? (
              <Text
                style={[
                  styles.modalError,
                  scaled_text_styles.modalError,
                  { color: theme.colors.accentStrong },
                ]}
              >
                {error_message}
              </Text>
            ) : null}

            <View style={styles.modalActions}>
              <PrimaryButton
                disabled={is_signing_in}
                label={is_signing_in ? 'Checking token...' : 'Sign in with token'}
                onPress={onSubmit}
                style={styles.modalButton}
                theme={theme}
              />
              <Pressable
                accessibilityRole="button"
                disabled={is_signing_in}
                onPress={onCancel}
                style={({ pressed }) => [
                  styles.modalCancelAction,
                  pressed && !is_signing_in ? styles.modalCancelActionPressed : null,
                ]}
              >
                <Text
                  style={[
                    styles.modalCancelText,
                    { color: theme.colors.inkSoft },
                  ]}
                >
                  Cancel
                </Text>
              </Pressable>
            </View>
          </AuthCard>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function WelcomeScreen({ isDark = false }) {
  const accent_palette_id = AppStore.accent_palette_id;
  const theme = getAuthTheme(isDark, accent_palette_id);
  const scaled_text_styles = React.useMemo(() => {
    return createScaledTextStyles(styles, TEXT_STYLE_NAMES);
  }, []);
  const actionOpacity = useSharedValue(0);
  const actionTranslateY = useSharedValue(26);
  const is_signing_in = Auth.is_loading();
  const error_message = Auth.error_message;
  const [is_token_modal_visible, set_is_token_modal_visible] = React.useState(false);
  const [token_value, set_token_value] = React.useState('');

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

  function open_token_modal() {
    Auth.clear_error();
    set_is_token_modal_visible(true);
  }

  function close_token_modal() {
    if (is_signing_in) {
      return;
    }

    Auth.clear_error();
    set_is_token_modal_visible(false);
    set_token_value('');
  }

  function handle_token_value_change(value = '') {
    set_token_value(value);

    if (error_message) {
      Auth.clear_error();
    }
  }

  async function handle_token_submit() {
    const did_sign_in = await Auth.sign_in_with_token(token_value);

    if (did_sign_in) {
      set_is_token_modal_visible(false);
      set_token_value('');
    }
  }

  async function open_micro_blog_url(url = '', action_label = 'Micro.blog') {
    if (!url) {
      return;
    }

    try {
      await WebBrowser.openBrowserAsync(url, {
        controlsColor: theme.colors.accent,
        dismissButtonStyle: 'close',
      });
    } catch (error) {
      console.warn(`Failed to open ${action_label}`, error);
      AppStore.show_toast('We could not open Micro.blog.');
    }
  }

  const footer_error_message = is_token_modal_visible ? null : error_message;
  const modal_error_message = is_token_modal_visible ? error_message : null;

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
              <View style={styles.agreementWrap}>
                <Text
                  style={[
                    styles.agreementText,
                    { color: theme.colors.inkSoft },
                  ]}
                >
                  By continuing, you agree to the Micro.blog terms of service and community guidelines.
                </Text>

                <View style={styles.linkStack}>
                  <WelcomeLinkButton
                    label="Terms of service"
                    onPress={() => open_micro_blog_url(
                      MICRO_BLOG_TERMS_OF_SERVICE_URL,
                      'Terms of service',
                    )}
                    theme={theme}
                  />
                  <WelcomeLinkButton
                    label="Community guidelines"
                    onPress={() => open_micro_blog_url(
                      MICRO_BLOG_COMMUNITY_GUIDELINES_URL,
                      'Community guidelines',
                    )}
                    theme={theme}
                  />
                  <WelcomeLinkButton
                    label="Privacy policy"
                    onPress={() => open_micro_blog_url(
                      MICRO_BLOG_PRIVACY_POLICY_URL,
                      'Privacy policy',
                    )}
                    theme={theme}
                  />
                </View>
              </View>

              {footer_error_message ? (
                <Text
                  style={[
                    styles.errorMessage,
                    scaled_text_styles.errorMessage,
                    { color: theme.colors.accentStrong },
                  ]}
                >
                  {footer_error_message}
                </Text>
              ) : null}
              <PrimaryButton
                label={is_signing_in ? 'Connecting to Micro.blog...' : 'Sign in with Micro.blog'}
                leadingIconSource={MICRO_BLOG_LOGO}
                onLongPress={open_token_modal}
                onPress={Auth.sign_in_with_micro_blog}
                disabled={is_signing_in}
                style={styles.primaryButton}
                theme={theme}
              />
            </Animated.View>
          </View>
        </ScrollView>
      </SafeAreaView>
      <TokenSignInModal
        error_message={modal_error_message}
        is_signing_in={is_signing_in}
        onCancel={close_token_modal}
        onChangeTokenValue={handle_token_value_change}
        onSubmit={handle_token_submit}
        scaled_text_styles={scaled_text_styles}
        theme={theme}
        token_value={token_value}
        visible={is_token_modal_visible}
      />
    </View>
  );
}

function WelcomeLinkButton({
  label = '',
  onPress,
  theme,
}) {
  return (
    <Pressable
      accessibilityRole="link"
      onPress={onPress}
      style={({ pressed }) => [
        styles.linkButton,
        {
          backgroundColor: color_with_opacity(theme.colors.buttonGhost, 0.25),
        },
        pressed ? styles.pressedLinkButton : null,
      ]}
    >
      <Text style={[styles.linkButtonLabel, { color: theme.colors.ink }]}>
        {label}
      </Text>
      <MaterialIcons color={theme.colors.inkSoft} name="chevron-right" size={18} />
    </Pressable>
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
    // fontFamily: 'Newsreader_700Bold',
    fontSize: 18,
    lineHeight: 28,
    maxWidth: 320,
    paddingBottom: 10
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
  agreementWrap: {
    gap: 12,
    marginBottom: 8,
  },
  agreementText: {
    fontSize: 14,
    lineHeight: 20,
  },
  linkStack: {
    gap: 8,
  },
  linkButton: {
    minHeight: 40,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  pressedLinkButton: {
    opacity: 0.84,
  },
  linkButtonLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 17,
  },
  primaryButton: {
    width: '100%',
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.38)',
  },
  modalCardWrap: {
    width: '100%',
  },
  modalCard: {
    gap: 16,
  },
  modalTitle: {
    fontFamily: 'Newsreader_700Bold',
    fontSize: 30,
    lineHeight: 34,
  },
  modalBody: {
    fontSize: 16,
    lineHeight: 24,
  },
  modalInputWrap: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  modalInput: {
    fontSize: 16,
    lineHeight: 22,
    height: 48,
    paddingVertical: 0,
    textAlignVertical: 'center',
  },
  modalError: {
    fontSize: 14,
    lineHeight: 21,
  },
  modalActions: {
    gap: 10,
  },
  modalButton: {
    width: '100%',
  },
  modalCancelAction: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 24,
    paddingVertical: 4,
  },
  modalCancelActionPressed: {
    opacity: 0.6,
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
});

export default observer(WelcomeScreen);
