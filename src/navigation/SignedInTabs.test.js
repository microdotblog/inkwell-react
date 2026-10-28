import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import React from 'react';
import { transformSync } from '@babel/core';

const source = readFileSync(new URL('./SignedInTabs.js', import.meta.url), 'utf8');
const { code } = transformSync(source, {
  configFile: false,
  babelrc: false,
  plugins: [
    '@babel/plugin-transform-modules-commonjs',
    ['@babel/plugin-transform-react-jsx', { runtime: 'classic' }],
  ],
});

function render_navigation(platform, is_dark) {
  const context = {
    exports: {},
    require(name) {
      if (name === 'react') {
        return React;
      }
      if (name === 'react-native') {
        return {
          Platform: { OS: platform },
          StyleSheet: { create: (styles) => styles },
          View: 'View',
        };
      }
      if (name === '@react-navigation/native-stack') {
        return { createNativeStackNavigator: () => ({ Navigator: 'Navigator', Screen: 'Screen' }) };
      }
      if (name === 'mobx-react') {
        return { observer: (component) => component };
      }
      if (name === 'react-native-screens/experimental') {
        return { SafeAreaView: 'NativeSafeAreaView' };
      }
      if (name === '../stores/App') {
        return { default: { accent_palette_id: 'test' }, __esModule: true };
      }
      if (name === '../theme/authTheme') {
        return { getAuthTheme: () => ({ colors: {} }) };
      }
      return { default: name, __esModule: true };
    },
  };
  vm.runInNewContext(code, context);
  return context.exports.default({ isDark: is_dark });
}

const safe_area_screens = [
  'Feed',
  'SubscriptionFeed',
  'FeedItemDetail',
  'Subscriptions',
  'Highlights',
  'Bookmarks',
];

describe('reader horizontal safe areas', () => {
  ['ios', 'android'].forEach((platform) => {
    [false, true].forEach((is_dark) => {
      it(`insets the reader and list screens on ${platform} in ${is_dark ? 'dark' : 'light'} mode`, () => {
        const navigator = render_navigation(platform, is_dark);
        const screen_props = { navigation: {}, route: {} };

        safe_area_screens.forEach((name) => {
          const screen = navigator.props.children.find((child) => child.props.name === name);
          const wrapper = screen.props.children(screen_props);
          expect(wrapper.type).toBe('NativeSafeAreaView');
          expect(wrapper.props.edges).toEqual({ left: true, right: true });
          expect(wrapper.props.children.props.navigation).toBe(screen_props.navigation);
          expect(wrapper.props.children.props.route).toBe(screen_props.route);
          expect(wrapper.props.children.props.isDark).toBe(is_dark);
        });
      });
    });
  });

  it('leaves the other screen layouts unchanged', () => {
    const navigator = render_navigation('ios', false);
    navigator.props.children
      .filter((screen) => !safe_area_screens.includes(screen.props.name))
      .forEach((screen) => {
        expect(screen.props.children({}).type).not.toBe('NativeSafeAreaView');
      });
  });
});
