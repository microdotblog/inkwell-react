import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import React from 'react';
import { parseSync, transformFromAstSync, transformSync } from '@babel/core';

const motion_source = readFileSync(new URL('./swipeableMotion.js', import.meta.url), 'utf8');
const { code: motion_code } = transformSync(motion_source, {
  configFile: false,
  babelrc: false,
  plugins: ['@babel/plugin-transform-modules-commonjs'],
});

function motion_options(reduce_motion = false) {
  const context = {
    exports: {},
    require: () => ({ useReducedMotion: () => reduce_motion }),
  };
  vm.runInNewContext(motion_code, context);
  return context.exports.useSwipeableMotion();
}

function render_row(screen_name, row_name, options) {
  const source = readFileSync(new URL(`../screens/${screen_name}.js`, import.meta.url), 'utf8');
  const ast = parseSync(source, {
    configFile: false, babelrc: false, parserOpts: { plugins: ['jsx'] },
  });
  const row = ast.program.body.find((node) => node.type === 'FunctionDeclaration' && node.id.name === row_name);
  const { code } = transformFromAstSync({
    ...ast, program: { ...ast.program, body: [row] },
  }, source, {
    configFile: false, babelrc: false, plugins: ['@babel/plugin-transform-react-jsx'],
  });
  // Render the actual row without loading its screen's network-backed stores.
  const context = {
    exports: {},
    React: {
      ...React,
      useRef: (value) => ({ current: value }),
      useState: (value) => [value, () => {}],
      useMemo: (callback) => callback(),
      useCallback: (callback) => callback,
    },
    useSwipeableMotion: () => options,
    Platform: { OS: 'ios' },
    Swipeable: 'Swipeable', View: 'View', Text: 'Text', Pressable: 'Pressable',
    SubscriptionAvatar: 'SubscriptionAvatar',
    styles: {},
    get_entry_read_action_image: () => 'circle',
    get_entry_read_action_material_icon_name: () => 'circle',
    resolve_subscription_title: () => 'Feed',
    resolve_subscription_supporting_url: () => '',
    resolve_subscription_detail_label: () => '',
    get_subscription_row_actions: () => [],
  };
  vm.runInNewContext(`${code}\nexports.row = ${row_name};`, context);
  return context.exports.row({
    children: 'Row content',
    entry: { id: '123' },
    subscription: { id: '123' },
    scaled_text_styles: {},
    theme: { colors: {} },
  });
}

describe('swipeable row motion', () => {
  it('keeps direct tracking and adds resisted overdrag with a slower, non-bouncy release', () => {
    const options = motion_options();
    expect(options.friction).toBe(1);
    expect(options.overshootRight).toBe(true);
    expect(options.overshootFriction).toBe(8);
    expect(options.animationOptions.bounciness).toBe(0);
    expect(options.animationOptions.speed).toBeLessThan(12);
    expect(options.animationOptions.restSpeedThreshold).toBeLessThan(1.7);
    expect(options.animationOptions.restDisplacementThreshold).toBeLessThan(0.4);
  });

  it('uses fast settling without elastic overdrag for Reduce Motion', () => {
    const options = motion_options(true);
    expect(options.friction).toBe(1);
    expect(options.overshootRight).toBe(false);
    expect(options.animationOptions.bounciness).toBe(0);
    expect(options.animationOptions.speed).toBeGreaterThan(12);
  });

  it('keeps Swipeable velocity and native-driver settings and does not mix spring parameter families', () => {
    [false, true].forEach((reduce_motion) => {
      const options = motion_options(reduce_motion).animationOptions;
      ['velocity', 'toValue', 'useNativeDriver', 'duration', 'stiffness', 'damping', 'mass', 'tension', 'friction'].forEach((key) => {
        expect(key in options).toBe(false);
      });
    });
  });

  [
    ['FeedScreen', 'FeedEntrySwipeRow'],
    ['SubscriptionsScreen', 'SubscriptionRow'],
    ['HighlightsScreen', 'HighlightSwipeRow'],
    ['BookmarksScreen', 'BookmarkSwipeRow'],
  ].forEach(([screen_name, row_name]) => {
    [false, true].forEach((reduce_motion) => {
      it(`applies shared ${reduce_motion ? 'reduced' : 'normal'} motion to ${screen_name}`, () => {
        const options = motion_options(reduce_motion);
        const row = render_row(screen_name, row_name, options);
        expect(row.type).toBe('Swipeable');
        expect(row.props.animationOptions).toEqual(options.animationOptions);
        expect(row.props.friction).toBe(options.friction);
        expect(row.props.overshootRight).toBe(options.overshootRight);
        expect(row.props.overshootFriction).toBe(options.overshootFriction);
        expect(row.props.rightThreshold).toBe(40);
        expect(row.props.enableTrackpadTwoFingerGesture).toBe(true);
      });
    });
  });
});
