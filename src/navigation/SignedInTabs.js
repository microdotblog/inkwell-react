import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { observer } from 'mobx-react';

import AccountScreen from '../screens/AccountScreen';
import FeedItemDetailScreen from '../screens/FeedItemDetailScreen';
import FeedScreen from '../screens/FeedScreen';
import LibraryPlaceholderScreen from '../screens/LibraryPlaceholderScreen';
import AppStore from '../stores/App';
import { getAuthTheme } from '../theme/authTheme';

const Stack = createNativeStackNavigator();

function SignedInTabs({ isDark = false }) {
  const accent_palette_id = AppStore.accent_palette_id;
  const theme = getAuthTheme(isDark, accent_palette_id);

  return (
    <Stack.Navigator
      initialRouteName="SignedInHome"
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
        name="SignedInHome"
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
          headerShadowVisible: false,
          headerStyle: {
            backgroundColor: 'transparent',
          },
          headerTintColor: theme.colors.ink,
          headerTitle: '',
          headerTransparent: true,
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
          title: 'Bookmarks',
        }}
      >
        {(screen_props) => (
          <LibraryPlaceholderScreen
            {...screen_props}
            body="Bookmarks are coming soon."
            icon_name="bookmark-border"
            isDark={isDark}
            title="Bookmarks"
          />
        )}
      </Stack.Screen>
      <Stack.Screen
        name="Highlights"
        options={{
          title: 'Highlights',
        }}
      >
        {(screen_props) => (
          <LibraryPlaceholderScreen
            {...screen_props}
            body="Highlights are coming soon."
            icon_name="format-quote"
            isDark={isDark}
            title="Highlights"
          />
        )}
      </Stack.Screen>
      <Stack.Screen
        name="FeedItemDetail"
        options={{
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
    </Stack.Navigator>
  );
}

export default observer(SignedInTabs);
