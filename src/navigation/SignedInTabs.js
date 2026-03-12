import React from 'react';
import { Platform } from 'react-native';
import { createNativeBottomTabNavigator } from '@react-navigation/bottom-tabs/unstable';
import { observer } from 'mobx-react';

import FeedScreen from '../screens/FeedScreen';
import SignedInScreen from '../screens/SignedInScreen';
import { getAuthTheme } from '../theme/authTheme';

const Tab = createNativeBottomTabNavigator();

function SignedInTabs({ isDark = false }) {
  const theme = getAuthTheme(isDark);

  return (
    <Tab.Navigator
      initialRouteName="Feed"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.accentStrong,
        tabBarInactiveTintColor: theme.colors.inkSoft,
        tabBarActiveIndicatorColor: theme.colors.accentSoft,
        tabBarLabelVisibilityMode: 'labeled',
        tabBarStyle: {
          backgroundColor: theme.isDark ? 'rgba(28, 36, 48, 0.76)' : 'rgba(255, 255, 255, 0.74)',
          shadowColor: theme.colors.shadow,
        },
        tabBarBlurEffect: 'systemDefault',
        tabBarMinimizeBehavior: 'onScrollDown',
      }}
    >
      <Tab.Screen
        name="Feed"
        options={{
          title: 'Feed',
          tabBarLabel: 'Feed',
          tabBarIcon: ({ focused }) => {
            if (Platform.OS === 'ios') {
              return {
                type: 'sfSymbol',
                name: focused
                  ? 'dot.radiowaves.left.and.right.circle.fill'
                  : 'dot.radiowaves.left.and.right',
              };
            } else {
              return {
                type: 'image',
                source: { uri: 'ic_tab_feed' },
              };
            }
          },
        }}
      >
        {() => <FeedScreen isDark={isDark} />}
      </Tab.Screen>
      <Tab.Screen
        name="Account"
        options={{
          title: 'Account',
          tabBarLabel: 'Account',
          tabBarIcon: ({ focused }) => {
            if (Platform.OS === 'ios') {
              return {
                type: 'sfSymbol',
                name: focused ? 'person.crop.circle.fill' : 'person.crop.circle',
              };
            } else {
              return {
                type: 'image',
                source: { uri: 'ic_tab_account' },
              };
            }
          },
        }}
      >
        {() => <SignedInScreen isDark={isDark} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

export default observer(SignedInTabs);
