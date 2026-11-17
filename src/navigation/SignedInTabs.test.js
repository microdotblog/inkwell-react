import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import React from 'react';
import { transformSync } from '@babel/core';
import { getAuthTheme } from '../theme/authTheme';

const source = readFileSync(new URL('./SignedInTabs.js', import.meta.url), 'utf8');
const { code } = transformSync(source, {
  configFile: false,
  babelrc: false,
  plugins: [
    '@babel/plugin-transform-modules-commonjs',
    ['@babel/plugin-transform-react-jsx', { runtime: 'classic' }],
  ],
});

function navigation_fixture(platform, is_dark, window = { width: 390, height: 844 }, back_handler) {
  const effects = [];
  const context = {
    exports: {},
    require(name) {
      if (name === 'react') {
        return {
          ...React,
          useCallback: (callback) => callback,
          useEffect: (callback) => effects.push(callback),
        };
      }
      if (name === 'react-native') {
        return {
          BackHandler: back_handler,
          Dimensions: { get: () => window.screen || window },
          Platform: { OS: platform, get isPad() { return Boolean(window.is_pad); } },
          StyleSheet: { create: (styles) => styles, hairlineWidth: 1 },
          View: 'View', Text: 'Text',
          useWindowDimensions: () => window,
        };
      }
      if (name === '@react-navigation/native-stack') {
        return { createNativeStackNavigator: () => ({ Navigator: 'Navigator', Screen: 'Screen' }) };
      }
      if (name === '@react-navigation/elements') {
        return { HeaderButton: 'HeaderButton' };
      }
      if (name === '@react-navigation/native') {
        return { useFocusEffect: (callback) => effects.push(callback) };
      }
      if (name === 'mobx-react') {
        return { observer: (component) => component };
      }
      if (name === 'react-native-screens/experimental') {
        return { SafeAreaView: 'NativeSafeAreaView' };
      }
      if (name === 'react-native-safe-area-context') {
        return {
          SafeAreaProvider: 'SafeAreaProvider',
          useSafeAreaInsets: () => ({ left: 0, right: 0, ...window.insets }),
        };
      }
      if (name === '../stores/App') {
        return { default: { accent_palette_id: 'purple' }, __esModule: true };
      }
      if (name === '../theme/authTheme') {
        return { getAuthTheme };
      }
      return { default: name, __esModule: true };
    },
  };
  vm.runInNewContext(code, context);
  return { navigator: context.exports.default({ isDark: is_dark }), effects };
}

function find_screen(navigator, name) {
  return React.Children.toArray(navigator.props.children)
    .find((screen) => screen.props.name === name);
}

function render_component(element) {
  return element.type(element.props);
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
        const { navigator } = navigation_fixture(platform, is_dark);
        const screen_props = { navigation: {}, route: {} };

        safe_area_screens.forEach((name) => {
          const screen = find_screen(navigator, name);
          const wrapper = render_component(screen.props.children(screen_props));
          expect(wrapper.type).toBe('NativeSafeAreaView');
          expect(wrapper.props.edges).toEqual({ left: true, right: true });
          const component = name === 'Feed' ? wrapper.props.children[0].props.children : wrapper.props.children;
          expect(component.props.navigation).toBe(screen_props.navigation);
          expect(component.props.route).toBe(screen_props.route);
          expect(component.props.isDark).toBe(is_dark);
        });
      });
    });
  });

  it('leaves the other screen layouts unchanged', () => {
    const { navigator } = navigation_fixture('ios', false);
    React.Children.toArray(navigator.props.children)
      .filter((screen) => ![...safe_area_screens, 'Library'].includes(screen.props.name))
      .forEach((screen) => {
        expect(render_component(screen.props.children({})).type).not.toBe('NativeSafeAreaView');
      });
  });
});

describe('timeline split view', () => {
  const cases = [
    ['iPad portrait', 'ios', { width: 820, height: 1180, is_pad: true }, true],
    ['iPad landscape', 'ios', { width: 1194, height: 834, is_pad: true }, true],
    ['narrow iPad window', 'ios', { width: 630, height: 900, is_pad: true }, false],
    ['unfolded Duo window', 'ios', { width: 669, height: 951, insets: { right: 84 } }, true],
    ['folded Duo window', 'ios', { width: 466, height: 678, insets: { right: 84 } }, false],
    ['wide window with insufficient safe width', 'ios', { width: 669, height: 951, insets: { right: 95 } }, false],
    ['phone landscape', 'ios', { width: 844, height: 390 }, false],
    ['Android tablet portrait', 'android', { width: 800, height: 1000 }, true],
    ['Android tablet landscape', 'android', { width: 1000, height: 800 }, true],
    ['Android tablet with system bars', 'android', {
      width: 960, height: 564, screen: { width: 960, height: 600 },
    }, true],
    ['narrow Android tablet window', 'android', {
      width: 600, height: 800, insets: { left: 12 }, screen: { width: 1200, height: 800 },
    }, false],
    ['Android phone portrait', 'android', { width: 412, height: 915 }, false],
    ['Android phone landscape', 'android', { width: 915, height: 412 }, false],
  ];

  for (const [label, platform, window, is_split] of cases) {
    it(`uses the right timeline layout for ${label}`, () => {
      const { navigator } = navigation_fixture(platform, false, window);
      const feed = find_screen(navigator, 'Feed');
      const workspace = render_component(feed.props.children({ navigation: {}, route: {} }));
      const [timeline, reader] = workspace.props.children;

      expect(timeline.props.children.props.is_sidebar).toBe(is_split);
      expect(Boolean(timeline.props.children.props.onOpenReader)).toBe(is_split);
      expect(Boolean(timeline.props.children.props.onOpenLibrary)).toBe(is_split);
      expect(Boolean(reader)).toBe(is_split);
    });
  }

  it('keeps the selected reader during resize and restores the timeline on Back', () => {
    const window = { width: 1024, height: 768, is_pad: true };
    const { navigator } = navigation_fixture('ios', false, window);
    const feed = find_screen(navigator, 'Feed');
    const route = { key: 'timeline' };
    const navigation = {
      setParams: (params) => { route.params = { ...route.params, ...params }; },
    };
    const render = () => render_component(feed.props.children({ navigation, route })).props.children;
    const [initial_timeline] = render();
    initial_timeline.props.children.props.onOpenReader({ entry_id: '123' });

    const [timeline, reader_pane] = render();
    const reader = reader_pane.props.children.props.children;
    expect(timeline.props.children.props.selected_entry_id).toBe('123');
    expect(reader.props.pane_width).toBe(696);
    expect(reader.props.route.params).toMatchObject({ entry_id: '123', reply_posted_at: 0 });

    window.width = 560;
    const [hidden_timeline, compact_pane] = render();
    const compact_safe_area = compact_pane.props.children;
    const compact_reader = compact_safe_area.props.children;
    expect(compact_safe_area.props.edges).toEqual({ right: false });
    expect(hidden_timeline.props.style.flat().filter(Boolean)).toContainEqual({ display: 'none' });
    expect(compact_reader.key).toBe(reader.key);
    compact_reader.props.onCloseReader();
    expect(render()[1]).toBeNull();

    window.width = 1024;
    render()[0].props.children.props.onOpenReader({ mode: 'recap' });
    const recap_reader = render()[1].props.children.props.children;
    expect(recap_reader.props.route.params).toMatchObject({ entry_id: '', mode: 'recap' });
  });

  it('lets Android Back close the embedded reader after the tablet window narrows', () => {
    const window = { width: 820, height: 1180, screen: { width: 820, height: 1180 } };
    const route = { params: { entry_id: '123' } };
    const navigation = {
      setParams: (params) => { route.params = { ...route.params, ...params }; },
    };
    const back_listeners = new Set();
    const { navigator, effects } = navigation_fixture('android', false, window, {
      addEventListener(event, listener) {
        expect(event).toBe('hardwareBackPress');
        back_listeners.add(listener);
        return { remove: () => back_listeners.delete(listener) };
      },
    });
    const feed = find_screen(navigator, 'Feed');
    const render = () => render_component(feed.props.children({ navigation, route }));

    render();
    expect(effects.at(-1)()).toBeUndefined();
    window.width = 540;
    const [, reader] = render().props.children;
    expect(reader.props.children.props.children.props.route.params.entry_id).toBe('123');

    const cleanup = effects.at(-1)();
    expect([...back_listeners][0]()).toBe(true);
    expect(render().props.children[1]).toBeNull();
    cleanup();
    expect(back_listeners.size).toBe(0);
  });

  it('retains the same split reader across post selections but not for Reading Recap', () => {
    const { navigator } = navigation_fixture('ios', false, { width: 1024, height: 768, is_pad: true });
    const feed = find_screen(navigator, 'Feed');
    const render_reader = (params) => {
      const workspace = render_component(feed.props.children({ navigation: {}, route: { params } }));
      return workspace.props.children[1].props.children.props.children;
    };
    const first = render_reader({ entry_id: '123' });
    const second = render_reader({ entry_id: '456' });

    expect(second.type).toBe(first.type);
    expect(second.key).toBe(first.key);
    expect(second.props.route.params.entry_id).toBe('456');
    expect(render_reader({ mode: 'recap' }).key).not.toBe(first.key);
  });

  for (const is_dark of [false, true]) {
    it(`keeps the right inset inside the reader background in ${is_dark ? 'dark' : 'light'} mode`, () => {
      const window = { width: 951, height: 669, insets: { right: 84 } };
      const { navigator } = navigation_fixture('ios', is_dark, window);
      const feed = find_screen(navigator, 'Feed');
      const { colors } = getAuthTheme(is_dark);

      for (const params of [{}, { entry_id: '123' }, { mode: 'recap' }]) {
        const workspace = render_component(feed.props.children({ navigation: {}, route: { params } }));
        const [, reader_pane] = workspace.props.children;
        const safe_area = reader_pane.props.children;
        const expected_color = is_dark
          ? (params.mode === 'recap' ? '#000000' : colors.canvas)
          : colors.white;

        expect(workspace.props.edges).toEqual({ left: true, right: false });
        expect(reader_pane.type).toBe('View');
        expect(Object.assign({}, ...reader_pane.props.style).backgroundColor).toBe(expected_color);
        expect(safe_area.type).toBe('NativeSafeAreaView');
        expect(safe_area.props.edges).toEqual({ right: true });
        if (params.entry_id || params.mode) {
          expect(safe_area.props.children.props.pane_width).toBe(583);
        }
      }
    });
  }

  it('moves the pushed timeline reader into the pane when widening', () => {
    const { navigator, effects } = navigation_fixture('ios', false, { width: 1024, height: 768, is_pad: true });
    const detail = find_screen(navigator, 'FeedItemDetail');
    const calls = [];
    const navigation = {
      getState: () => ({ index: 1, routes: [{ name: 'Feed' }, { name: 'FeedItemDetail' }] }),
      navigate: (...args) => calls.push(args),
    };
    const route = { params: { entry_id: '123' } };
    const wrapper = render_component(detail.props.children({ navigation, route }));
    render_component(wrapper.props.children);
    effects.forEach((effect) => effect());
    expect(calls).toEqual([['Feed', route.params, { pop: true }]]);
  });

  for (const platform of ['ios', 'android']) {
    for (const section of ['Subscriptions', 'Bookmarks', 'Highlights', 'Account']) {
      it(`presents ${section} in a dismissible sheet with its own navigation on ${platform}`, () => {
        const { navigator } = navigation_fixture(platform, false, { width: 1024, height: 768, is_pad: true });
        const feed = find_screen(navigator, 'Feed');
        const sheet = find_screen(navigator, 'Library');
        const calls = [];
        const navigation = {
          navigate: (...args) => calls.push(args),
          goBack: () => calls.push('close'),
        };
        const workspace = render_component(feed.props.children({ navigation, route: {} }));
        const section_params = section === 'Subscriptions' ? { mode: 'subscribe' } : undefined;
        workspace.props.children[0].props.children.props.onOpenLibrary(section, section_params);

        const [[destination, params]] = calls;
        expect(destination).toBe('Library');
        expect(sheet.props.options.presentation).toBe(platform === 'ios' ? 'pageSheet' : 'transparentModal');
        const sheet_content = render_component(sheet.props.children({ navigation, route: { params } }));
        let safe_area_provider = sheet_content;
        if (platform === 'android') {
          expect(sheet.props.options.contentStyle.backgroundColor).toBe('transparent');
          expect(sheet_content.props.edges).toEqual({ top: true, right: true, bottom: true, left: true });
          safe_area_provider = sheet_content.props.children.props.children;
        }
        const stack = safe_area_provider.props.children;
        expect(stack.props.initialRouteName).toBe(section);
        const root = find_screen(stack, section);
        expect(root.props.initialParams).toEqual(section_params);
        if (platform === 'ios') {
          root.props.options.unstable_headerLeftItems()[0].onPress();
        } else {
          const close_button = root.props.options.headerLeft();
          expect(close_button.props.accessibilityLabel).toBe('Close');
          close_button.props.onPress();
        }
        expect(calls.at(-1)).toBe('close');
        expect(Boolean(find_screen(stack, 'SubscriptionFeed'))).toBe(section === 'Subscriptions');
        expect(Boolean(find_screen(stack, 'FeedItemDetail'))).toBe(
          section === 'Subscriptions' || section === 'Bookmarks',
        );
        if (section === 'Account') {
          expect(root.props.options.title).toBe('Settings');
          expect(find_screen(navigator, 'Account').props.options.presentation).toBeUndefined();
          expect(React.Children.count(stack.props.children)).toBe(1);
        }
      });
    }
  }
});
