import { describe, expect, it } from 'bun:test';
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';
import React from 'react';
import { parseSync, transformSync } from '@babel/core';
import { getAuthTheme } from '../theme/authTheme';

function screen_fixture(name, { header_height = 88, mode = 'entry', loading = false, export_name = 'default' } = {}) {
  const source = readFileSync(new URL(`./${name}.js`, import.meta.url), 'utf8');
  const fixture_source = export_name === 'default' ? source : `${source}\nexport { ${export_name} };`;
  const { code } = transformSync(fixture_source, {
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
          Text: 'Text', ActivityIndicator: 'ActivityIndicator',
          useWindowDimensions: () => ({ width: 900 }),
        };
      }
      if (dependency === 'mobx-react') return { observer: (component) => component };
      if (dependency === '@react-navigation/elements') return { useHeaderHeight: () => header_height };
      if (dependency === '@expo/vector-icons') return { MaterialIcons: 'MaterialIcons' };
      if (dependency === '@react-navigation/native') return { useNavigation: () => ({}) };
      if (dependency === 'react-native-safe-area-context') {
        return { useSafeAreaInsets: () => ({ top: 0, bottom: 20, left: 12, right: 68 }) };
      }
      if (dependency === 'react-native-reanimated') {
        return {
          __esModule: true, default: { View: 'Animated.View' },
          FadeInDown: animation, FadeOutUp: animation, LinearTransition: animation,
        };
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
          show_posts_for_feed: () => {},
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
          READER_COLUMN_MAX_WIDTH: 760,
          RECAP_EMAIL_DAYS: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
          RECAP_SETTINGS_LAYOUT_TRANSITION: animation,
          RECAP_SETTINGS_ROW_ENTERING: animation, RECAP_SETTINGS_ROW_EXITING: animation,
          get_recap_day_chip_label: (day) => day.slice(0, 3),
          get_recap_day_summary_label: (day) => day,
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
  return (props = {}) => {
    state_index = 0;
    return context.exports[export_name]({ navigation: {}, route: { params: { mode, entry_id: '123' } }, ...props });
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

function absolute_layout_styles(path, names) {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
  const ast = parseSync(source, {
    configFile: false, babelrc: false, parserOpts: { plugins: ['jsx'] },
  });
  const declaration = ast.program.body
    .filter((node) => node.type === 'VariableDeclaration')
    .flatMap((node) => node.declarations)
    .find((node) => node.id.name === 'styles');
  const properties = declaration.init.arguments[0].properties;

  // Evaluate the real overlay styles without loading native modules or stores.
  return names.map((name) => {
    const property = properties.find((node) => node.key.name === name);
    return vm.runInNewContext(`(${source.slice(property.value.start, property.value.end)})`, {
      StyleSheet: {
        absoluteFill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
      },
      READER_HORIZONTAL_PADDING: 20,
    });
  });
}

describe('absolute overlay layout', () => {
  it('does not reference the removed layout helper anywhere in app code', () => {
    const source_root = new URL('../', import.meta.url);
    const source_files = readdirSync(source_root, { recursive: true })
      .filter((name) => name.endsWith('.js') && !name.endsWith('.test.js'));
    const removed_helper_files = source_files.filter((name) => {
      return readFileSync(new URL(name, source_root), 'utf8').includes('absoluteFillObject');
    });
    expect(removed_helper_files).toEqual([]);
  });

  [
    ['App.js', ['toastOverlay']],
    ['navigation/SignedInTabs.js', ['headerBackdrop']],
    ['components/auth/AuthBackground.js', ['container', 'canvas', 'glowLayer', 'transitionOverlay']],
    ['components/timeline/FeedTimelineCard.js', ['sourceAvatarPlaceholder', 'sourceAvatarImage']],
    ['components/feed_item_detail/RepliesListView.js', ['avatarPlaceholder', 'avatarImage']],
    ['components/feed_item_detail/FeedItemDetailViews.js', [
      'headerBackdrop', 'recapFaviconImage', 'readerTextSizeOverlay', 'readerImageViewerOverlay',
      'readerImageViewerLoading', 'readerImageViewerError', 'readerHighlightActionWrap',
      'readerTextSizeBackdrop', 'avatarPlaceholder', 'avatarImage',
    ]],
    ['screens/AccountScreen.js', ['paletteSwatchLayer']],
    ['screens/BookmarksScreen.js', ['rowSwipeActionCirclePressed']],
    ['screens/FeedScreen.js', [
      'searchFooterOverlay', 'footerBackdrop', 'footerTouchShield', 'menuDismissTouchOverlay',
      'accountAvatarPlaceholder', 'accountAvatarImage', 'rowSwipeActionCirclePressed',
    ]],
    ['screens/HighlightsScreen.js', ['rowSwipeActionCirclePressed']],
    ['screens/SubscriptionFeedScreen.js', ['menuDismissTouchOverlay']],
    ['screens/SubscriptionsScreen.js', ['menuDismissTouchOverlay', 'rowSwipeActionCirclePressed']],
    ['screens/WelcomeScreen.js', ['modalBackdrop']],
  ].forEach(([path, names]) => {
    it(`pins the overlay layers to their parent bounds in ${path}`, () => {
      const styles = absolute_layout_styles(path, names);
      for (const style of styles) {
        expect(style.position).toBe('absolute');
        for (const edge of ['top', 'right', 'bottom', 'left']) {
          expect(style[edge]).toBe(0);
        }
      }
    });
  });
});

describe('reader and list layout', () => {
  [false, true].forEach((is_dark) => {
    it(`keeps the recap email header full-width while toggling and updating in ${is_dark ? 'dark' : 'light'} mode`, () => {
      const render = screen_fixture('../components/feed_item_detail/ReadingRecapView', {
        export_name: 'RecapEmailSettingsCard',
      });
      const props = {
        is_enabled: true, selected_day: 'Monday',
        scaled_text_styles: {}, theme: getAuthTheme(is_dark),
      };

      function header_parts(card) {
        const header = card.props.children[0];
        const copy = header.props.children[0];
        const row = copy.props.children[0];
        const actions = row.props.children[1];
        const selector = actions.props.children[1].props.children;

        expect(row.type).toBe('View');
        expect(row.props.layout).toBeUndefined();
        expect(flatten_style(row.props.style).width).toBe('100%');
        expect(flatten_style(row.props.children[0].props.style).flexShrink).toBe(1);
        expect(flatten_style(actions.props.style).marginLeft).toBe('auto');
        expect(card.props.layout).toBeDefined();
        return { copy, selector };
      }

      let card = render(props);
      let { selector } = header_parts(card);
      expect(selector.props.label).toBe('Monday');
      expect(card.props.children[1]).toBeNull();

      selector.props.onPress();
      card = render(props);
      ({ selector } = header_parts(card));
      expect(selector.props.icon_name).toBe('expand-less');
      expect(card.props.children[1].props.children.flat().filter(Boolean)).toHaveLength(8);
      expect(header_parts(card).copy.props.children[1].props.children).toContain('weekly email');

      selector.props.onPress();
      card = render({ ...props, selected_day: 'Wednesday' });
      expect(header_parts(card).selector.props.label).toBe('Wednesday');
      expect(card.props.children[1]).toBeNull();

      for (const busy_state of [{ is_loading: true }, { is_saving: true }]) {
        card = render({ ...props, ...busy_state });
        expect(header_parts(card).selector.props.disabled).toBe(true);
        expect(find_component(card, 'ActivityIndicator')).not.toBeNull();
      }
    });
  });

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

  it('renders the embedded post header and actions at the pane width', () => {
    const render = screen_fixture('FeedItemDetailScreen');
    const screen = render({ is_embedded: true, pane_width: 456 });

    expect(find_component(screen, 'EntryReaderView').props.width).toBe(456);
    expect(find_component(screen, 'HeaderEntryMenuButton')).not.toBeNull();
    expect(find_component(screen, 'Text').props.children).toBe('Article');
    expect(find_component(screen, 'Pressable')).toBeNull();

    let did_close = false;
    const compact = render({
      is_embedded: true,
      pane_width: 360,
      onCloseReader: () => { did_close = true; },
    });
    find_component(compact, 'Pressable').props.onPress();
    expect(did_close).toBe(true);
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
