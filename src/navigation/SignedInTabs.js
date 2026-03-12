import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { observer } from 'mobx-react';

import FeedItemDetailScreen from '../screens/FeedItemDetailScreen';
import FeedScreen from '../screens/FeedScreen';
import SignedInScreen from '../screens/SignedInScreen';
import { getAuthTheme } from '../theme/authTheme';

const Stack = createNativeStackNavigator();

function SignedInTabs({ isDark = false }) {
  const theme = getAuthTheme(isDark);

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
          <SignedInScreen
            {...screen_props}
            isDark={isDark}
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
