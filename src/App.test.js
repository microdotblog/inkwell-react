import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import React from 'react';
import { transformSync } from '@babel/core';
import { getAuthTheme } from './theme/authTheme';

const source = readFileSync(new URL('./App.js', import.meta.url), 'utf8');
const { code } = transformSync(`${source}\nexport { ToastOverlay };`, {
  configFile: false,
  babelrc: false,
  plugins: [
    '@babel/plugin-transform-modules-commonjs',
    ['@babel/plugin-transform-react-jsx', { runtime: 'classic' }],
  ],
});

function toast_fixture({ platform = 'ios', top_inset = 59 } = {}) {
  const animation = {
    springify: () => animation,
    damping: () => animation,
    stiffness: () => animation,
    duration: () => animation,
  };
  const context = {
    exports: {},
    require(name) {
      if (name === 'react') return React;
      if (name === 'react-native') {
        return {
          Platform: { OS: platform },
          View: 'View',
          Text: 'Text',
          StyleSheet: {
            create: (styles) => styles,
            absoluteFill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
          },
        };
      }
      if (name === 'react-native-reanimated') {
        return {
          __esModule: true,
          default: { View: 'AnimatedView' },
          FadeInDown: animation,
          FadeOutUp: animation,
        };
      }
      if (name === 'react-native-safe-area-context') {
        return { useSafeAreaInsets: () => ({ top: top_inset, right: 0, bottom: 34, left: 0 }) };
      }
      if (name === 'mobx-react') return { observer: (component) => component };
      if (name === 'react-native-sfsymbols') return { SFSymbol: 'SFSymbol' };
      if (name === 'expo-web-browser') return { maybeCompleteAuthSession: () => {} };
      return {};
    },
  };
  vm.runInNewContext(code, context);
  return context.exports.ToastOverlay;
}

function flatten_style(style) {
  return Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
}

describe('status toast layout', () => {
  [false, true].forEach((is_dark) => {
    it(`keeps successive toasts out of the navigator layout in ${is_dark ? 'dark' : 'light'} mode`, () => {
      const render = toast_fixture();
      const theme = getAuthTheme(is_dark);

      [
        'Marked as unread',
        'Marked as read',
        'Bookmarked',
        'Your Micro.blog session expired. Please sign in again.',
      ].forEach((toast_message, toast_key) => {
        const overlay = render({ theme, toast_message, toast_key });
        const style = flatten_style(overlay.props.style);
        const card_style = flatten_style(overlay.props.children.props.style);
        expect(style.position).toBe('absolute');
        for (const edge of ['top', 'right', 'bottom', 'left']) {
          expect(style[edge]).toBe(0);
        }
        expect(style.paddingTop).toBe(71);
        expect(style.justifyContent).toBe('flex-start');
        expect(overlay.props.pointerEvents).toBe('box-none');
        expect(overlay.props.children.props.pointerEvents).toBe('none');
        expect(overlay.props.children.key).toBe(`${toast_key}`);
        expect(card_style.maxWidth).toBe(320);
        expect(card_style.width).toBe('100%');
      });
    });
  });

  it('preserves an explicit toast offset without changing its absolute bounds', () => {
    const overlay = toast_fixture()({
      theme: getAuthTheme(false),
      toast_message: 'Marked as unread',
      toast_top_offset: 100,
    });
    const style = flatten_style(overlay.props.style);
    expect(style.position).toBe('absolute');
    expect(style.top).toBe(0);
    expect(style.bottom).toBe(0);
    expect(style.paddingTop).toBe(100);
  });

  it('renders no overlay when dismissed or when using Android native toasts', () => {
    const props = { theme: getAuthTheme(false), toast_message: 'Marked as unread' };
    expect(toast_fixture()({ ...props, toast_message: null })).toBeNull();
    expect(toast_fixture({ platform: 'android' })(props)).toBeNull();
  });
});
