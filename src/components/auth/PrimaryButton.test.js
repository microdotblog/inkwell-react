import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import React from 'react';
import { transformSync } from '@babel/core';
import { ACCENT_PALETTE_OPTIONS, getAuthTheme } from '../../theme/authTheme';

const source = readFileSync(new URL('./PrimaryButton.js', import.meta.url), 'utf8');
const { code } = transformSync(source, {
  configFile: false,
  babelrc: false,
  plugins: [
    '@babel/plugin-transform-modules-commonjs',
    ['@babel/plugin-transform-react-jsx', { runtime: 'classic' }],
  ],
});
const context = {
  exports: {},
  setTimeout,
  require(name) {
    if (name === 'react') {
      return { ...React, useRef: (value) => ({ current: value }) };
    }
    if (name === 'react-native') {
      return {
        Pressable: 'Pressable',
        Text: 'Text',
        View: 'View',
        StyleSheet: { create: (styles) => styles },
      };
    }
    if (name === 'expo-image') {
      return { Image: 'Image' };
    }
    if (name === 'mobx-react') {
      return { observer: (component) => component };
    }
    if (name === '../../theme/authTheme') {
      return { getAuthTheme };
    }
    if (name === 'react-native-reanimated') {
      return {
        __esModule: true,
        default: { View: 'AnimatedView' },
        useSharedValue: (value) => ({ value }),
        useAnimatedStyle: (callback) => callback(),
        withSpring: (value) => value,
      };
    }
    throw new Error(`Unexpected button dependency: ${name}`);
  },
};
vm.runInNewContext(code, context);
const PrimaryButton = context.exports.default;

function flatten_style(style) {
  return Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
}

function luminance(color) {
  const channels = color.slice(1).match(/../g).map((value) => {
    const channel = parseInt(value, 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrast_ratio(first, second) {
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

describe('primary button colors', () => {
  ACCENT_PALETTE_OPTIONS.forEach(({ id }) => {
    [false, true].forEach((is_dark) => {
      it(`uses the light-mode fill for ${id} in ${is_dark ? 'dark' : 'light'} mode`, () => {
        const theme = getAuthTheme(is_dark, id);
        const light_theme = getAuthTheme(false, id);
        const rendered = PrimaryButton({ label: 'Sign in with Micro.blog', theme });
        const button = rendered.props.children;
        const label = button.props.children.props.children[1];
        const text_color = flatten_style(label.props.style).color;

        [false, true].forEach((pressed) => {
          const style = flatten_style(button.props.style({ pressed }));
          expect(style.backgroundColor).toBe(light_theme.colors.accent);
          expect(style.backgroundColor).toMatch(/^#[0-9a-f]{6}$/i);
          if (is_dark) {
            expect(text_color).toBe('#ffffff');
          } else {
            expect(contrast_ratio(style.backgroundColor, text_color)).toBeGreaterThanOrEqual(4.5);
          }
        });
      });
    });
  });

  it('preserves ghost button styling and disabled state', () => {
    const theme = getAuthTheme(false);
    const rendered = PrimaryButton({ label: 'Cancel', theme, variant: 'ghost', disabled: true });
    const button = rendered.props.children;
    const label = button.props.children.props.children[1];
    const style = flatten_style(button.props.style({ pressed: false }));
    expect(style.backgroundColor).toBe(theme.colors.buttonGhost);
    expect(flatten_style(label.props.style).color).toBe(theme.colors.ink);
    expect(button.props.disabled).toBe(true);
    expect(style.opacity).toBe(0.58);
  });
});
