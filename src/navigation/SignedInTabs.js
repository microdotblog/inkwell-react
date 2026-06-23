import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { observer } from 'mobx-react';

import AccountScreen from '../screens/AccountScreen';
import BookmarksScreen from '../screens/BookmarksScreen';
import FeedItemDetailScreen from '../screens/FeedItemDetailScreen';
import FeedScreen from '../screens/FeedScreen';
import HighlightsScreen from '../screens/HighlightsScreen';
import ReplyComposerScreen from '../screens/ReplyComposerScreen';
import SubscriptionFeedScreen from '../screens/SubscriptionFeedScreen';
import SubscriptionsScreen from '../screens/SubscriptionsScreen';
import UserProfileScreen from '../screens/UserProfileScreen';
import AppStore from '../stores/App';
import { getAuthTheme } from '../theme/authTheme';

const Stack = createNativeStackNavigator();

function SignedInTabs({ isDark = false }) {
  const accent_palette_id = AppStore.accent_palette_id;
  const theme = getAuthTheme(isDark, accent_palette_id);
  const header_background_color =
    resolve_translucent_header_background_color(theme, Platform.OS);
  const feed_item_detail_header_options =
    build_feed_item_detail_header_options(theme, Platform.OS);
  const translucent_header_options = {
    headerBackground: () => (
      <View
        pointerEvents="none"
        style={[
          styles.headerBackdrop,
          {
            backgroundColor: header_background_color,
          },
        ]}
      />
    ),
    headerShadowVisible: false,
    headerStyle: {
      backgroundColor: 'transparent',
    },
    headerTintColor: theme.colors.ink,
    headerTitleStyle: {
      color: theme.colors.ink,
      fontSize: 17,
      fontWeight: '600',
    },
    headerTransparent: true,
  };

  return (
    <Stack.Navigator
      initialRouteName="Feed"
      screenOptions={{
        contentStyle: {
          backgroundColor: theme.colors.canvas,
        },
        headerBackButtonDisplayMode: 'minimal',
        headerStyle: {
          backgroundColor: theme.colors.paper,
        },
        headerTintColor: theme.colors.ink,
      }}
    >
      <Stack.Screen
        name="Feed"
        options={{
          headerShown: false,
        }}
      >
        {(screen_props) => (
          <FeedScreen
            {...screen_props}
            isDark={isDark}
          />
        )}
      </Stack.Screen>
      <Stack.Screen
        name="Account"
        options={{
          ...translucent_header_options,
          title: 'Settings',
        }}
      >
        {(screen_props) => (
          <AccountScreen
            {...screen_props}
            isDark={isDark}
          />
        )}
      </Stack.Screen>
      <Stack.Screen
        name="Bookmarks"
        options={{
          ...translucent_header_options,
          title: 'Bookmarks',
        }}
      >
        {(screen_props) => (
          <BookmarksScreen
            {...screen_props}
            isDark={isDark}
          />
        )}
      </Stack.Screen>
      <Stack.Screen
        name="Subscriptions"
        options={{
          ...translucent_header_options,
          title: 'Subscriptions',
        }}
      >
        {(screen_props) => (
          <SubscriptionsScreen
            {...screen_props}
            isDark={isDark}
          />
        )}
      </Stack.Screen>
      <Stack.Screen
        name="SubscriptionFeed"
        options={{
          ...translucent_header_options,
          title: 'Feed',
        }}
      >
        {(screen_props) => (
          <SubscriptionFeedScreen
            {...screen_props}
            isDark={isDark}
          />
        )}
      </Stack.Screen>
      <Stack.Screen
        name="Highlights"
        options={{
          ...translucent_header_options,
          title: 'Highlights',
        }}
      >
        {(screen_props) => (
          <HighlightsScreen
            {...screen_props}
            isDark={isDark}
          />
        )}
      </Stack.Screen>
      <Stack.Screen
        name="FeedItemDetail"
        options={{
          ...feed_item_detail_header_options,
          title: '',
        }}
      >
        {(screen_props) => (
          <FeedItemDetailScreen
            {...screen_props}
            isDark={isDark}
          />
        )}
      </Stack.Screen>
      <Stack.Screen
        name="UserProfile"
        options={{
          ...feed_item_detail_header_options,
          title: '',
        }}
      >
        {(screen_props) => (
          <UserProfileScreen
            {...screen_props}
            isDark={isDark}
          />
        )}
      </Stack.Screen>
      <Stack.Screen
        name="ReplyComposer"
        options={{
          headerBackVisible: false,
          presentation: 'modal',
          title: 'Reply',
        }}
      >
        {(screen_props) => (
          <ReplyComposerScreen
            {...screen_props}
            isDark={isDark}
          />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  headerBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
});

function resolve_translucent_header_background_color(
  theme,
  platform = Platform.OS,
) {
  if (platform === 'ios') {
    return with_color_opacity(
      theme?.colors?.canvas,
      theme?.isDark ? 0.1 : 0.14,
    );
  }

  return with_color_opacity(
    theme?.colors?.canvas,
    theme?.isDark ? 0.72 : 0.84,
  );
}

function build_feed_item_detail_header_options(
  theme,
  platform = Platform.OS,
) {
  const header_options = {
    headerShadowVisible: false,
  };

  if (platform === 'android') {
    header_options.headerStyle = {
      backgroundColor: theme?.colors?.canvas,
    };
  }

  return header_options;
}

function with_color_opacity(color_value = '', opacity = 1) {
  const normalized_color = `${color_value || ''}`.trim();
  const normalized_opacity = Number.isFinite(opacity)
    ? Math.min(Math.max(opacity, 0), 1)
    : 1;
  const hex_match = normalized_color.match(/^#([0-9a-f]{6})$/i);

  if (!hex_match) {
    return normalized_color || 'rgba(255, 255, 255, 0.84)';
  }

  const hex = hex_match[1];
  const red = parseInt(hex.slice(0, 2), 16);
  const green = parseInt(hex.slice(2, 4), 16);
  const blue = parseInt(hex.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${normalized_opacity})`;
}

export default observer(SignedInTabs);
