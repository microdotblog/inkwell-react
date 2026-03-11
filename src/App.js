import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { observer } from 'mobx-react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import WelcomeScreen from './screens/WelcomeScreen';
import AppStore from './stores/App';
import { getAuthTheme } from './theme/authTheme';

function App() {
  const isDark = AppStore.theme === 'dark';
  const theme = getAuthTheme(isDark);

  const [fontsLoaded] = useFonts({
    Newsreader_500Medium: require('@expo-google-fonts/newsreader/500Medium/Newsreader_500Medium.ttf'),
    Newsreader_600SemiBold: require('@expo-google-fonts/newsreader/600SemiBold/Newsreader_600SemiBold.ttf'),
    Newsreader_700Bold: require('@expo-google-fonts/newsreader/700Bold/Newsreader_700Bold.ttf'),
  });

  React.useEffect(() => {
    AppStore.start_theme_listener();

    return () => {
      AppStore.stop_theme_listener();
    };
  }, []);

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
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <WelcomeScreen isDark={isDark} />
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
