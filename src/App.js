import React from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import { observer } from 'mobx-react';
import { DefaultTheme, DarkTheme, NavigationContainer } from '@react-navigation/native';
import { SFSymbol } from 'react-native-sfsymbols';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import Animated, {
  FadeInDown,
  FadeOutUp,
} from 'react-native-reanimated';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';

import SignedInTabs from './navigation/SignedInTabs';
import InAppPurchaseScreen from './screens/InAppPurchaseScreen';
import RssLoadingScreen from './screens/RssLoadingScreen';
import WelcomeScreen from './screens/WelcomeScreen';
import Auth from './stores/Auth';
import AppStore from './stores/App';
import Bookmarks from './stores/Bookmarks';
import Feed from './stores/Feed';
import Highlights from './stores/Highlights';
import { getAuthTheme } from './theme/authTheme';

WebBrowser.maybeCompleteAuthSession();
const AUTH_VERIFICATION_LOADER_DELAY_MS = 2000;
const TOAST_ENTERING = FadeInDown.springify()
  .damping(18)
  .stiffness(220);
const TOAST_EXITING = FadeOutUp.duration(180);

function App() {
  const system_color_scheme = useColorScheme();
  const isDark = system_color_scheme === 'dark';
  const accent_palette_id = AppStore.accent_palette_id;
  const theme = getAuthTheme(isDark, accent_palette_id);
  const toast_key = AppStore.toast_key;
  const toast_message = AppStore.toast_message;
  const toast_top_offset = AppStore.toast_top_offset;
  const is_signed_in = Auth.is_signed_in();
  const is_auth_loading = Auth.is_loading();
  const needs_inkwell_subscription = is_signed_in && Auth.has_inkwell === false;
  const is_feed_bootstrapping = Feed.is_bootstrapping;
  const has_bootstrapped_feed = Feed.has_bootstrapped;
  const has_checked_timeline_cache = Feed.has_checked_timeline_cache;
  const is_verifying_session =
    Auth.loading_phase === 'verifying' &&
    (is_auth_loading || AppStore.is_hydrating);
  const [should_show_delayed_verifying_loader, set_should_show_delayed_verifying_loader] =
    React.useState(false);
  const should_show_auth_loader =
    Auth.loading_phase !== 'idle' &&
    (is_auth_loading || AppStore.is_hydrating) &&
    (
      Auth.loading_phase !== 'verifying' ||
      should_show_delayed_verifying_loader
    );

  const [fontsLoaded] = useFonts({
    Newsreader_500Medium: require('@expo-google-fonts/newsreader/500Medium/Newsreader_500Medium.ttf'),
    Newsreader_600SemiBold: require('@expo-google-fonts/newsreader/600SemiBold/Newsreader_600SemiBold.ttf'),
    Newsreader_700Bold: require('@expo-google-fonts/newsreader/700Bold/Newsreader_700Bold.ttf'),
  });

  React.useEffect(() => {
    AppStore.start();

    return () => {
      AppStore.stop();
    };
  }, []);

  React.useEffect(() => {
    AppStore.set_theme(system_color_scheme);
  }, [system_color_scheme]);

  React.useEffect(() => {
    if (!is_verifying_session) {
      set_should_show_delayed_verifying_loader(false);
      return;
    }

    const timeout_id = setTimeout(() => {
      set_should_show_delayed_verifying_loader(true);
    }, AUTH_VERIFICATION_LOADER_DELAY_MS);

    return () => {
      clearTimeout(timeout_id);
    };
  }, [is_verifying_session]);

  React.useLayoutEffect(() => {
    let is_cancelled = false;

    async function hydrate_timeline_cache() {
      await Feed.hydrate_timeline_cache();

      if (is_cancelled) {
        return;
      }
    }

    if (!fontsLoaded) {
      return () => {
        is_cancelled = true;
      };
    }

    if (
      !is_signed_in ||
      needs_inkwell_subscription ||
      AppStore.is_hydrating ||
      is_auth_loading
    ) {
      return () => {
        is_cancelled = true;
      };
    }

    if (has_checked_timeline_cache) {
      return () => {
        is_cancelled = true;
      };
    }

    hydrate_timeline_cache();

    return () => {
      is_cancelled = true;
    };
  }, [
    fontsLoaded,
    has_checked_timeline_cache,
    is_auth_loading,
    is_signed_in,
    needs_inkwell_subscription,
    AppStore.is_hydrating,
  ]);

  React.useLayoutEffect(() => {
    let is_cancelled = false;

    async function bootstrap_feed() {
      try {
        await Feed.bootstrap();
      } catch (error) {
        if (is_cancelled) {
          return;
        }

        if (error?.status === 401 || error?.status === 403) {
          await Auth.clear_invalid_session('Your Micro.blog session expired. Please sign in again.');
          Bookmarks.reset();
          Feed.reset();
          Highlights.reset();
        }
      }
    }

    if (!fontsLoaded) {
      return () => {
        is_cancelled = true;
      };
    }

    if (!is_signed_in || needs_inkwell_subscription) {
      Bookmarks.reset();
      Feed.reset();
      Highlights.reset();
      return () => {
        is_cancelled = true;
      };
    }

    if (AppStore.is_hydrating || is_auth_loading) {
      return () => {
        is_cancelled = true;
      };
    }

    if (!has_checked_timeline_cache) {
      return () => {
        is_cancelled = true;
      };
    }

    if (is_feed_bootstrapping || has_bootstrapped_feed) {
      return () => {
        is_cancelled = true;
      };
    }

    bootstrap_feed();

    return () => {
      is_cancelled = true;
    };
  }, [
    fontsLoaded,
    has_checked_timeline_cache,
    has_bootstrapped_feed,
    is_auth_loading,
    is_feed_bootstrapping,
    is_signed_in,
    needs_inkwell_subscription,
    AppStore.is_hydrating,
  ]);

  if (!fontsLoaded) {
    return (
      <View style={[styles.loadingScreen, { backgroundColor: theme.colors.canvas }]}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <ActivityIndicator color={theme.colors.accent} size="large" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <KeyboardProvider preload={false}>
          <StatusBar style={isDark ? 'light' : 'dark'} />
          {AppStore.is_hydrating ? (
            should_show_auth_loader ? (
              <RssLoadingScreen isDark={isDark} phase={Auth.loading_phase} />
            ) : (
              <View style={[styles.loadingScreen, { backgroundColor: theme.colors.canvas }]}>
                <ActivityIndicator color={theme.colors.accent} size="large" />
              </View>
            )
          ) : needs_inkwell_subscription ? (
            <InAppPurchaseScreen isDark={isDark} />
          ) : is_signed_in && !has_checked_timeline_cache ? (
            <View style={[styles.loadingScreen, { backgroundColor: theme.colors.canvas }]}>
              <ActivityIndicator color={theme.colors.accent} size="large" />
            </View>
          ) : should_show_auth_loader ? (
            <RssLoadingScreen isDark={isDark} phase={Auth.loading_phase} />
          ) : is_signed_in ? (
            <NavigationContainer theme={build_navigation_theme(theme)}>
              <SignedInTabs isDark={isDark} />
            </NavigationContainer>
          ) : (
            <WelcomeScreen isDark={isDark} />
          )}
          <ToastOverlay
            theme={theme}
            toast_key={toast_key}
            toast_message={toast_message}
            toast_top_offset={toast_top_offset}
          />
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function ToastOverlay({
  theme,
  toast_key = 0,
  toast_message = null,
  toast_top_offset = null,
}) {
  const insets = useSafeAreaInsets();
  const toast_icon_name = resolve_toast_icon_name(toast_message);
  const resolved_top_offset = Number.isFinite(toast_top_offset)
    ? toast_top_offset
    : insets.top + 12;

  if (Platform.OS !== 'ios' || !toast_message) {
    return null;
  }

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.toastOverlay,
        {
          paddingTop: resolved_top_offset,
        },
      ]}
    >
      <Animated.View
        entering={TOAST_ENTERING}
        exiting={TOAST_EXITING}
        key={toast_key}
        pointerEvents="none"
        style={[
          styles.toastCard,
          {
            backgroundColor: theme.isDark
              ? theme.colors.badge
              : theme.colors.paper,
            borderColor: theme.colors.line,
            shadowColor: theme.colors.shadow,
          },
        ]}
      >
        <View
          style={[
            styles.toastBadge,
            {
              backgroundColor: theme.colors.accentSoft,
              borderColor: theme.colors.line,
            },
          ]}
        >
          {Platform.OS === 'ios' ? (
            <SFSymbol
              color={theme.colors.accentStrong}
              name={toast_icon_name.ios}
              style={styles.toastSymbol}
            />
          ) : (
            <MaterialIcons
              color={theme.colors.accentStrong}
              name={toast_icon_name.android}
              size={18}
            />
          )}
        </View>
        <View style={styles.toastCopy}>
          <Text
            style={[
              styles.toastLabel,
              { color: theme.colors.ink },
            ]}
          >
            {toast_message}
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

function build_navigation_theme(theme) {
  const base_theme = theme.isDark ? DarkTheme : DefaultTheme;

  return {
    ...base_theme,
    colors: {
      ...base_theme.colors,
      background: theme.colors.canvas,
      border: theme.colors.line,
      card: theme.colors.paper,
      notification: theme.colors.accentStrong,
      primary: theme.colors.accent,
      text: theme.colors.ink,
    },
  };
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    elevation: 10,
    justifyContent: 'flex-start',
    paddingHorizontal: 28,
    zIndex: 10,
  },
  toastCard: {
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-start',
    maxWidth: 360,
    minHeight: 56,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowOffset: {
      width: 0,
      height: 12,
    },
    shadowOpacity: 0.16,
    shadowRadius: 22,
    width: '100%',
  },
  toastBadge: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  toastSymbol: {
    height: 18,
    width: 18,
  },
  toastCopy: {
    flex: 1,
  },
  toastLabel: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
});

export default observer(App);

function resolve_toast_icon_name(toast_message = '') {
  const normalized_toast_message = `${toast_message || ''}`.trim().toLowerCase();

  if (!normalized_toast_message) {
    return {
      android: 'check-circle-outline',
      ios: 'checkmark.circle',
    };
  }

  if (normalized_toast_message.includes('link')) {
    return {
      android: 'link',
      ios: 'link',
    };
  }

  if (normalized_toast_message.includes('bookmark removed')) {
    return {
      android: 'bookmark-border',
      ios: 'star.fill',
    };
  }

  if (normalized_toast_message.includes('bookmarked')) {
    return {
      android: 'bookmark',
      ios: 'star.fill',
    };
  }

  if (normalized_toast_message.includes('unread')) {
    return {
      android: 'smart-button',
      ios: 'button.programmable',
    };
  }

  if (normalized_toast_message.includes('read')) {
    return {
      android: 'radio-button-unchecked',
      ios: 'circle',
    };
  }

  return {
    android: 'check-circle-outline',
    ios: 'checkmark.circle',
  };
}
