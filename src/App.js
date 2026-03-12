import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { observer } from 'mobx-react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';

import SignedInScreen from './screens/SignedInScreen';
import WelcomeScreen from './screens/WelcomeScreen';
import Auth from './stores/Auth';
import AppStore from './stores/App';
import { getAuthTheme } from './theme/authTheme';

WebBrowser.maybeCompleteAuthSession();

function App() {
  const isDark = AppStore.theme === 'dark';
  const theme = getAuthTheme(isDark);

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

  if (!fontsLoaded || AppStore.is_hydrating) {
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
        <StatusBar style={isDark ? 'light' : 'dark'} />
        {Auth.is_signed_in() ? <SignedInScreen isDark={isDark} /> : <WelcomeScreen isDark={isDark} />}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
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
