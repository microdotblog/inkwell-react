import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import React from 'react';
import { transformSync } from '@babel/core';
import { getAuthTheme } from '../theme/authTheme';

const source = readFileSync(new URL('./FeedScreen.js', import.meta.url), 'utf8');
const { code } = transformSync(`${source}\nexport { AccountHeaderButton };`, {
  configFile: false,
  babelrc: false,
  plugins: [
    '@babel/plugin-transform-modules-commonjs',
    ['@babel/plugin-transform-react-jsx', { runtime: 'classic' }],
  ],
});

function avatar_fixture({ platform = 'ios', is_dark = false } = {}) {
  const states = [];
  const effect_dependencies = [];
  let hook_index = 0;
  let effects = [];
  const context = {
    exports: {},
    require(name) {
      if (name === 'react') {
        return {
          ...React,
          useMemo: (callback) => callback(),
          useState(initial) {
            const index = hook_index++;
            if (!(index in states)) states[index] = initial;
            return [states[index], (value) => { states[index] = value; }];
          },
          useEffect(callback, dependencies) {
            const index = hook_index++;
            const previous = effect_dependencies[index];
            if (!previous || dependencies.some((value, offset) => value !== previous[offset])) {
              effects.push(callback);
              effect_dependencies[index] = dependencies;
            }
          },
        };
      }
      if (name === 'react-native') {
        return {
          Platform: { OS: platform, select: (options) => options[platform] },
          View: 'View', Text: 'Text',
          StyleSheet: {
            create: (styles) => styles,
            absoluteFill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
          },
        };
      }
      if (name === 'react-native-reanimated') {
        return { __esModule: true, default: { createAnimatedComponent: () => 'AnimatedFlatList' } };
      }
      if (name === 'expo-image') return { Image: 'Image' };
      if (name === '@react-native-menu/menu') return { MenuView: 'MenuView' };
      if (name === 'mobx-react') return { observer: (component) => component };
      return {};
    },
  };
  vm.runInNewContext(code, context);

  return (props = {}) => {
    hook_index = 0;
    effects = [];
    const result = context.exports.AccountHeaderButton({
      profile_name: 'Manton',
      profile_photo: 'https://example.com/avatar.jpg',
      scaled_text_styles: {},
      theme: getAuthTheme(is_dark),
      is_dark,
      ...props,
    });
    effects.forEach((effect) => effect());
    return result;
  };
}

function find_component(element, type) {
  if (element?.type === type) return element;
  for (const child of React.Children.toArray(element?.props?.children)) {
    const match = find_component(child, type);
    if (match) return match;
  }
  return null;
}

function flatten_style(style) {
  return Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
}

describe('timeline account avatar', () => {
  ['ios', 'android'].forEach((platform) => {
    [false, true].forEach((is_dark) => {
      it(`fills the avatar frame on ${platform} in ${is_dark ? 'dark' : 'light'} mode`, () => {
        const render = avatar_fixture({ platform, is_dark });
        const button = render();
        const frame = button.props.children.props.children;
        const placeholder = frame.props.children[0];
        const image = find_component(button, 'Image');

        expect(image.props.source.uri).toBe('https://example.com/avatar.jpg');
        expect(image.props.contentFit).toBe('cover');
        expect(flatten_style(frame.props.style).overflow).toBe('hidden');
        for (const element of [image, placeholder]) {
          const style = flatten_style(element.props.style);
          expect(style.position).toBe('absolute');
          for (const edge of ['top', 'right', 'bottom', 'left']) {
            expect(style[edge]).toBe(0);
          }
        }

        expect(find_component(button, 'Text').props.children).toBe('M');
        image.props.onLoad();
        expect(find_component(render(), 'Text')).toBeNull();
        expect(find_component(render(), 'Image')).not.toBeNull();
      });
    });
  });

  it('falls back to the initial on image failure and retries when the photo changes', () => {
    const render = avatar_fixture();
    find_component(render(), 'Image').props.onError();
    const failed_button = render();
    expect(find_component(failed_button, 'Image')).toBeNull();
    expect(find_component(failed_button, 'Text').props.children).toBe('M');

    const props = { profile_photo: 'https://example.com/new-avatar.jpg' };
    render(props);
    const image = find_component(render(props), 'Image');
    expect(image.props.source.uri).toBe(props.profile_photo);
    image.props.onLoad();
    expect(find_component(render(props), 'Text')).toBeNull();
  });

  it('keeps the initial when no photo is available', () => {
    const render = avatar_fixture();
    const button = render({ profile_photo: '  ', profile_name: 'Alex' });
    expect(find_component(button, 'Image')).toBeNull();
    expect(find_component(button, 'Text').props.children).toBe('A');
  });
});
