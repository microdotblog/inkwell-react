import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { observer } from 'mobx-react';
import { DefaultTheme, DarkTheme, NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';

import SignedInTabs from './navigation/SignedInTabs';
import RssLoadingScreen from './screens/RssLoadingScreen';
import WelcomeScreen from './screens/WelcomeScreen';
import Auth from './stores/Auth';
import AppStore from './stores/App';
import Bookmarks from './stores/Bookmarks';
import Feed from './stores/Feed';
import { getAuthTheme } from './theme/authTheme';

WebBrowser.maybeCompleteAuthSession();

function App() {
  const isDark = AppStore.theme === 'dark';
  const accent_palette_id = AppStore.accent_palette_id;
  const theme = getAuthTheme(isDark, accent_palette_id);
  const is_signed_in = Auth.is_signed_in();
  const is_auth_loading = Auth.is_loading();
  const is_feed_bootstrapping = Feed.is_bootstrapping;
  const has_bootstrapped_feed = Feed.has_bootstrapped;
  const should_show_auth_loader =
    Auth.loading_phase !== 'idle' && (is_auth_loading || AppStore.is_hydrating);

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
        }
      }
    }

    if (!fontsLoaded) {
      return () => {
        is_cancelled = true;
      };
    }

    if (!is_signed_in) {
      Bookmarks.reset();
      Feed.reset();
      return () => {
        is_cancelled = true;
      };
    }

    if (AppStore.is_hydrating || is_auth_loading) {
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
    has_bootstrapped_feed,
    is_auth_loading,
    is_feed_bootstrapping,
    is_signed_in,
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
          ) : should_show_auth_loader ? (
            <RssLoadingScreen isDark={isDark} phase={Auth.loading_phase} />
          ) : is_signed_in ? (
            <NavigationContainer theme={build_navigation_theme(theme)}>
              <SignedInTabs isDark={isDark} />
            </NavigationContainer>
          ) : (
            <WelcomeScreen isDark={isDark} />
          )}
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
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
});

export default observer(App);
