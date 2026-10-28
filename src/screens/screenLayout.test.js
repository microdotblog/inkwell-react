import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import React from 'react';
import { transformSync } from '@babel/core';
import { getAuthTheme } from '../theme/authTheme';

function screen_fixture(name, { header_height = 88, mode = 'entry', loading = false } = {}) {
  const source = readFileSync(new URL(`./${name}.js`, import.meta.url), 'utf8');
  const { code } = transformSync(source, {
    configFile: false,
    babelrc: false,
    plugins: [
      '@babel/plugin-transform-modules-commonjs',
      ['@babel/plugin-transform-react-jsx', { runtime: 'classic' }],
    ],
  });
  const states = [];
  let state_index = 0;
  const hooks = {
    ...React,
    useMemo: (callback) => callback(),
    useCallback: (callback) => callback,
    useEffect: () => {},
    useLayoutEffect: () => {},
    useRef: (value) => ({ current: value }),
    useState(initial) {
      const index = state_index++;
      if (!(index in states)) states[index] = initial;
      return [states[index], (value) => {
        states[index] = typeof value === 'function' ? value(states[index]) : value;
      }];
    },
  };
  const entry = { id: '123', title: 'Article', url: 'https://example.com/post' };
  const animation = { duration: () => animation };
  const context = {
    exports: {}, URL,
    require(dependency) {
      if (dependency === 'react') return hooks;
      if (dependency === 'react-native') {
        return {
          Platform: { OS: 'ios' },
          StyleSheet: { create: (styles) => styles },
          View: 'View', ScrollView: 'ScrollView', FlatList: 'FlatList',
          Pressable: 'Pressable', RefreshControl: 'RefreshControl',
          useWindowDimensions: () => ({ width: 900 }),
        };
      }
      if (dependency === 'mobx-react') return { observer: (component) => component };
      if (dependency === '@react-navigation/elements') return { useHeaderHeight: () => header_height };
      if (dependency === '@react-navigation/native') return { useNavigation: () => ({}) };
      if (dependency === 'react-native-safe-area-context') {
        return { useSafeAreaInsets: () => ({ top: 0, bottom: 20, left: 12, right: 68 }) };
      }
      if (dependency === 'react-native-reanimated') {
        return { FadeInDown: animation, FadeOutUp: animation, LinearTransition: animation };
      }
      if (dependency === '../theme/authTheme') return { getAuthTheme };
      if (dependency === '../theme/textScale') {
        return { createScaledTextStyles: () => ({}), getTextScaleSliderIndex: () => 0 };
      }
      if (dependency === '../stores/App') {
        return { __esModule: true, default: { accent_palette_id: 'purple', reader_text_scale: 1 } };
      }
      if (dependency === '../stores/Feed') {
        return { __esModule: true, default: {
          subscription_snapshots: () => [],
          is_loading_subscriptions: loading,
          timeline_entry_snapshot: () => entry,
          active_recap_snapshot: () => ({ html: '<p>Recap</p>' }),
        } };
      }
      if (dependency === '../stores/Highlights') {
        return { __esModule: true, default: {
          highlight_entries: () => [], highlights_count: () => 0, has_search_query: () => false,
          is_loading: loading,
          entry_highlight_snapshot_by_identifier: () => null, entry_highlight_entries: () => [],
        } };
      }
      if (dependency.endsWith('/FeedItemDetailViews')) {
        const names = [
          'EntryReaderView', 'RecapReaderView', 'HeaderEntryMenuButton', 'ReaderHighlightAction',
          'ReaderImageViewerModal', 'ReaderTextSizeTray', 'UnavailableScreen',
        ];
        return {
          ...Object.fromEntries(names.map((value) => [value, value])),
          get_entry_menu_actions: () => [], useFeedItemDetailScaledTextStyles: () => ({}),
        };
      }
      if (dependency.endsWith('/feedItemDetailUtils')) {
        return {
          READER_BOTTOM_PADDING: 32, READER_HORIZONTAL_PADDING: 20,
          create_reader_body_html: () => '<p>Article</p>',
          normalize_http_url: (url) => url || '', sanitize_reader_html: (html) => html,
          resolve_detail_mode: (value) => value || 'entry',
          resolve_entry_source: () => 'feed', resolve_highlight_post_id: (id) => id,
        };
      }
      return { __esModule: true, default: dependency };
    },
  };
  vm.runInNewContext(code, context);
  return () => {
    state_index = 0;
    return context.exports.default({ navigation: {}, route: { params: { mode, entry_id: '123' } } });
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

describe('reader and list layout', () => {
  ['entry', 'recap'].forEach((mode) => {
    it(`sizes the ${mode} reader using the safe-area viewport and subsequent layout changes`, () => {
      const render = screen_fixture('FeedItemDetailScreen', { mode });
      const component = mode === 'entry' ? 'EntryReaderView' : 'RecapReaderView';
      let screen = render();
      expect(find_component(screen, component).props.width).toBe(820);

      screen.props.onLayout({ nativeEvent: { layout: { width: 680 } } });
      screen = render();
      expect(find_component(screen, component).props.width).toBe(680);

      screen.props.onLayout({ nativeEvent: { layout: { width: 1100 } } });
      screen = render();
      expect(find_component(screen, component).props.width).toBe(1100);

      screen.props.onLayout({ nativeEvent: { layout: { width: 0 } } });
      expect(find_component(render(), component).props.width).toBe(1100);
    });
  });

  ['SubscriptionsScreen', 'HighlightsScreen'].forEach((name) => {
    [56, 88, 104].forEach((header_height) => {
      it(`places ${name} content 12 points below a ${header_height}-point header`, () => {
        const screen = screen_fixture(name, { header_height })();
        const list = find_component(screen, 'FlatList');
        expect(flatten_style(list.props.contentContainerStyle).paddingTop).toBe(header_height + 12);
        expect(list.props.refreshControl.props.progressViewOffset).toBe(header_height + 12);
      });
    });

    it(`uses the same header gap for the ${name} loading state`, () => {
      const screen = screen_fixture(name, { header_height: 104, loading: true })();
      const safe_area = React.Children.toArray(screen.props.children)[1];
      expect(flatten_style(safe_area.props.children.props.style).paddingTop).toBe(116);
    });
  });
});
