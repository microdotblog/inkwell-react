import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { observer } from 'mobx-react';
import { createScaledTextStyles } from '../../theme/textScale';

const PHASE_COPY = {
  connecting: {
    title: 'Opening Micro.blog',
    body: 'Handing you off to your Micro.blog sign in and waiting for the callback.',
  },
  verifying: {
    title: 'Verifying session',
    body: 'Checking the token and pulling the profile details.',
  },
  loading_feeds: {
    title: 'Loading posts',
    body: 'Fetching subscriptions and recent entries.',
  },
};

function resolve_phase_copy(phase = 'loading_feeds') {
  if (PHASE_COPY[phase]) {
    return PHASE_COPY[phase];
  } else {
    return PHASE_COPY.loading_feeds;
  }
}

const TEXT_STYLE_NAMES = ['title', 'body'];

function RssLoadingView({
  theme,
  phase = 'loading_feeds',
  title = '',
  body = '',
}) {
  const scaled_text_styles = React.useMemo(() => {
    return createScaledTextStyles(styles, TEXT_STYLE_NAMES);
  }, []);

  const phase_copy = resolve_phase_copy(phase);
  const resolved_title = title || phase_copy.title;
  const resolved_body = body || phase_copy.body;

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.loadingOrb,
          {
            backgroundColor: theme.colors.accentSoft,
            borderColor: theme.colors.line,
          },
        ]}
      >
        <ActivityIndicator color={theme.colors.accentStrong} size="small" />
      </View>

      <View style={styles.copy}>
        <Text
          style={[
            styles.title,
            scaled_text_styles.title,
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
    gap: 18,
    width: '100%',
  },
  loadingOrb: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  copy: {
    alignItems: 'center',
    gap: 10,
    maxWidth: 320,
  },
  title: {
    fontSize: 18,
    lineHeight: 28,
    textAlign: 'center',
  },
  body: {
    fontSize: 15,
    lineHeight: 23,
    textAlign: 'center',
  },
});

export default observer(RssLoadingView);
