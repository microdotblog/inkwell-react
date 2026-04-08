import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { observer } from 'mobx-react';
import { SafeAreaView } from 'react-native-safe-area-context';

import AuthBackground from '../components/auth/AuthBackground';
import AuthCard from '../components/auth/AuthCard';
import AppStore from '../stores/App';
import { getAuthTheme } from '../theme/authTheme';
import { createScaledTextStyles } from '../theme/textScale';

const TEXT_STYLE_NAMES = ['title', 'body'];

function LibraryPlaceholderScreen({
  body = '',
  icon_name = 'bookmark-border',
  isDark = false,
  title = '',
}) {
  const accent_palette_id = AppStore.accent_palette_id;
  const theme = getAuthTheme(isDark, accent_palette_id);
  const scaled_text_styles = React.useMemo(() => {
    return createScaledTextStyles(styles, TEXT_STYLE_NAMES);
  }, []);

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.canvas }]}>
      <AuthBackground theme={theme} />
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <View style={styles.content}>
          <AuthCard style={styles.card} theme={theme}>
            <View
              style={[
                styles.iconWrap,
                {
                  backgroundColor: theme.colors.accentSoft,
                  borderColor: theme.colors.line,
                },
              ]}
            >
              <MaterialIcons
                color={theme.colors.accentStrong}
                name={icon_name}
                size={28}
              />
            </View>
            <View style={styles.copy}>
              <Text
                style={[
                  styles.title,
                  scaled_text_styles.title,
                  { color: theme.colors.ink },
                ]}
              >
                {title}
              </Text>
              <Text
                style={[
                  styles.body,
                  scaled_text_styles.body,
                  { color: theme.colors.inkSoft },
                ]}
              >
                {body}
              </Text>
            </View>
          </AuthCard>
        </View>
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
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  card: {
    alignItems: 'center',
    gap: 20,
    paddingVertical: 32,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    alignItems: 'center',
    gap: 10,
    maxWidth: 320,
  },
  title: {
    fontFamily: 'Newsreader_600SemiBold',
    fontSize: 30,
    lineHeight: 36,
    textAlign: 'center',
  },
  body: {
    fontSize: 15,
    lineHeight: 23,
    textAlign: 'center',
  },
});

export default observer(LibraryPlaceholderScreen);
