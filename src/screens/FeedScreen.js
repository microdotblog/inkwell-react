import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MenuView } from '@react-native-menu/menu';
import { useFocusEffect, useScrollToTop } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { observer } from 'mobx-react';
import {
  KeyboardStickyView,
  useReanimatedKeyboardAnimation,
} from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import AuthBackground from '../components/auth/AuthBackground';
import AuthCard from '../components/auth/AuthCard';
import PrimaryButton from '../components/auth/PrimaryButton';
import RssLoadingView from '../components/loading/RssLoadingView';
import Auth from '../stores/Auth';
import AppStore from '../stores/App';
import Feed from '../stores/Feed';
import { getAuthTheme } from '../theme/authTheme';
import { createScaledTextStyles } from '../theme/textScale';

const SEGMENT_OPTIONS = [
  { key: 'today', label: 'Today' },
  { key: 'recent', label: 'Recent' },
  { key: 'fading', label: 'Fading' },
];
const AnimatedFlatList = Animated.createAnimatedComponent(FlatList);
const SCREEN_HORIZONTAL_PADDING = 20;
const LIST_TOP_PADDING = 12;
const SEGMENT_WRAP_MAX_HEIGHT = 50;
const HEADER_ACCOUNT_BUTTON_SIZE = 40;
const HEADER_CONTROL_HEIGHT = HEADER_ACCOUNT_BUTTON_SIZE;
const HEADER_CONTROL_RADIUS = HEADER_CONTROL_HEIGHT / 2;
const HEADER_ACCOUNT_GAP = 12;
const HEADER_ACCOUNT_AVATAR_TRANSITION_MS = 180;
const LIST_TOP_GAP = 12;
const FOOTER_FLOAT_GAP = 2;
const FOOTER_TOP_PADDING = 10;
const FOOTER_SCROLL_DELTA_THRESHOLD = 6;
const FOOTER_TOUCH_BLOCK_THRESHOLD = 0.05;
const FOOTER_VISIBILITY_TOP_THRESHOLD = 24;
const SEGMENT_CONTROL_INSET = 3;
const SEGMENT_BUTTON_HEIGHT = HEADER_CONTROL_HEIGHT - SEGMENT_CONTROL_INSET * 2;
const SEGMENT_BUTTON_RADIUS = SEGMENT_BUTTON_HEIGHT / 2;
const FEED_AVATAR_SIZE = 26;
const READ_ROW_OPACITY = 0.56;
const FEED_AVATAR_TRANSITION_MS = 180;
const TOP_STATUS_SCRIM_EXTRA_HEIGHT = 44;
const TOP_STATUS_SCRIM_SCROLL_DISTANCE = 24;
const TEXT_STYLE_NAMES = [
  'searchInput',
  'segmentLabel',
  'stateTitle',
  'stateBody',
  'recapBody',
  'recapError',
  'recapButtonLabel',
  'accountAvatarInitial',
  'sourceAvatarInitial',
  'rowSourceLabel',
  'timestamp',
  'rowTitle',
  'rowSummary',
];

function get_profile_menu_actions(theme) {
  const icon_color = theme?.colors?.ink;
  const settings_action = {
    id: 'settings',
    title: 'Settings',
    image: Platform.select({
      ios: 'gearshape',
    }),
    imageColor: icon_color,
  };
  const new_feed_action = {
    id: 'new_feed',
    title: 'New Feed...',
    image: Platform.select({
      ios: 'plus',
    }),
    imageColor: icon_color,
  };
  const subscriptions_action = {
    id: 'subscriptions',
    title: 'Subscriptions',
    image: Platform.select({
      ios: 'dot.radiowaves.left.and.right',
    }),
    imageColor: icon_color,
  };

  if (Platform.OS === 'ios') {
    return [
      {
        displayInline: true,
        subactions: [settings_action],
        title: '',
      },
      new_feed_action,
      subscriptions_action,
      {
        id: 'highlights',
        title: 'Highlights',
        image: Platform.select({
          ios: 'highlighter',
        }),
        imageColor: icon_color,
      },
      {
        id: 'bookmarks',
        title: 'Bookmarks',
        image: Platform.select({
          ios: 'bookmark',
        }),
        imageColor: icon_color,
      },
    ];
  }

  return [
    settings_action,
    new_feed_action,
    subscriptions_action,
    {
      id: 'highlights',
      title: 'Highlights',
      image: Platform.select({
        ios: 'highlighter',
      }),
      imageColor: icon_color,
    },
    {
      id: 'bookmarks',
      title: 'Bookmarks',
      image: Platform.select({
        ios: 'bookmark',
      }),
      imageColor: icon_color,
    },
  ];
}

function clear_feed_search_focus(
  input_ref,
  should_dismiss_keyboard = false,
) {
  input_ref?.current?.blur?.();

  if (should_dismiss_keyboard) {
    Keyboard.dismiss();
  }
}

function get_entry_menu_actions({ entry = null, theme }) {
  if (!entry) {
    return [];
  }

  const icon_color = theme?.colors?.ink;
  const original_url = normalize_http_url(entry?.url);
  const bookmark_title = entry?.is_bookmarked ? 'Unbookmark' : 'Bookmark';
  const read_title = entry?.is_read ? 'Mark as Unread' : 'Mark as Read';
  const actions = [];

  if (original_url) {
    actions.push({
      id: 'copy_link',
      image: Platform.select({
        ios: 'link',
      }),
      imageColor: icon_color,
      title: 'Copy Link',
    });
  }

  actions.push({
    id: 'toggle_read',
    image: Platform.select({
      ios: entry?.is_read ? 'button.programmable' : 'circle',
    }),
    imageColor: icon_color,
    title: read_title,
  });

  actions.push({
    id: 'toggle_bookmark',
    image: Platform.select({
      ios: bookmark_title === 'Unbookmark' ? 'bookmark.slash' : 'bookmark',
    }),
    imageColor: icon_color,
    title: bookmark_title,
  });

  if (original_url) {
    actions.push({
      id: 'open_web',
      image: Platform.select({
        ios: 'safari',
      }),
      imageColor: icon_color,
      title: 'Open on Web',
    });
  }

  return actions;
}

function FeedScreen({ navigation, isDark = false }) {
  const accent_palette_id = AppStore.accent_palette_id;
  const theme = getAuthTheme(isDark, accent_palette_id);
  const scaled_text_styles = React.useMemo(() => {
    return createScaledTextStyles(styles, TEXT_STYLE_NAMES);
  }, []);
  const insets = useSafeAreaInsets();
  const active_segment = Feed.active_segment;
  const is_search_active = Feed.is_search_active;
  const search_query = Feed.search_query;
  const profile = Auth.current_profile();
  const has_bootstrapped = Feed.has_bootstrapped;
  const has_any_timeline_entries = Feed.timeline_entries.length > 0;
  const visible_timeline_entries = Feed.visible_timeline_entries();
  const error_message = Feed.error_message;
  const recap_error_message = Feed.recap_error_message;
  const is_generating_recap = Feed.is_generating_recap;
  const background_intensity = visible_timeline_entries.length > 0 ? 0.14 : 1;
  const list_top_inset = insets.top + LIST_TOP_PADDING;
  const top_status_scrim_height = insets.top + TOP_STATUS_SCRIM_EXTRA_HEIGHT;
  const top_status_scrim_color = resolve_top_status_scrim_color(theme);
  const top_status_scrim_mid_color = with_color_opacity(
    theme?.colors?.canvas,
    Platform.OS === 'ios' ? 0.34 : 0.42,
  );
  const top_status_scrim_transparent_color = with_color_opacity(
    theme?.colors?.canvas,
    0,
  );
  const toast_top_offset = insets.top + 12;
  const footer_bottom_inset = insets.bottom + FOOTER_FLOAT_GAP;
  const list_bottom_inset =
    footer_bottom_inset +
    FOOTER_TOP_PADDING +
    SEGMENT_WRAP_MAX_HEIGHT +
    LIST_TOP_GAP;
  const search_footer_open_offset = Math.max(
    footer_bottom_inset - FOOTER_FLOAT_GAP,
    0,
  );
  const footer_visibility_bottom_threshold = list_bottom_inset;
  const list_ref = React.useRef(null);
  const search_input_ref = React.useRef(null);
  const [segment_frames, set_segment_frames] = React.useState({});
  const scroll_y = useSharedValue(0);
  const previous_scroll_y = useSharedValue(0);
  const footer_visibility_progress = useSharedValue(1);
  const active_segment_offset = useSharedValue(0);
  const active_segment_width = useSharedValue(0);
  const { height: keyboard_height } = useReanimatedKeyboardAnimation();
  const [should_block_footer_touches, set_should_block_footer_touches] =
    React.useState(true);
  const is_loading_initial =
    (Feed.is_bootstrapping && visible_timeline_entries.length === 0) ||
    (!has_bootstrapped &&
      !error_message &&
      visible_timeline_entries.length === 0);
  const is_refreshing = Feed.is_bootstrapping && has_bootstrapped;
  const scroll_to_top_ref = React.useRef({
    scrollToTop: () => {
      footer_visibility_progress.value = 1;
      previous_scroll_y.value = scroll_y.value;
      list_ref.current?.scrollToOffset?.({
        animated: true,
        offset: 0,
      });
    },
  });

  useScrollToTop(scroll_to_top_ref);

  const on_scroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      const next_scroll_y = Math.max(event.contentOffset.y, 0);
      const scroll_delta = next_scroll_y - previous_scroll_y.value;
      const viewport_bottom =
        next_scroll_y + event.layoutMeasurement.height;
      const is_at_bottom =
        viewport_bottom >=
        event.contentSize.height - footer_visibility_bottom_threshold;

      scroll_y.value = next_scroll_y;

      if (
        is_search_active ||
        next_scroll_y <= FOOTER_VISIBILITY_TOP_THRESHOLD ||
        is_at_bottom
      ) {
        if (footer_visibility_progress.value !== 1) {
          footer_visibility_progress.value = withTiming(1, {
            duration: 180,
          });
        }
      } else if (scroll_delta >= FOOTER_SCROLL_DELTA_THRESHOLD) {
        if (footer_visibility_progress.value !== 0) {
          footer_visibility_progress.value = withTiming(0, {
            duration: 180,
          });
        }
      } else if (scroll_delta <= -FOOTER_SCROLL_DELTA_THRESHOLD) {
        if (footer_visibility_progress.value !== 1) {
          footer_visibility_progress.value = withTiming(1, {
            duration: 180,
          });
        }
      }

      previous_scroll_y.value = next_scroll_y;
    },
  });

  const handle_segment_press = React.useCallback((segment) => {
    Feed.set_active_segment(segment);
    scroll_to_top_ref.current.scrollToTop();
  }, []);

  const handle_search_toggle_press = React.useCallback(() => {
    if (Feed.is_search_active) {
      Feed.hide_search();
      Keyboard.dismiss();
      return;
    }

    Feed.show_search();
    scroll_y.value = 0;
    previous_scroll_y.value = 0;
    footer_visibility_progress.value = 1;
    list_ref.current?.scrollToOffset?.({
      animated: false,
      offset: 0,
    });
  }, [scroll_y]);

  const handle_search_query_change = React.useCallback(
    (next_search_query = '') => {
      Feed.set_search_query(next_search_query);
      scroll_y.value = 0;
      previous_scroll_y.value = 0;
      footer_visibility_progress.value = 1;
      list_ref.current?.scrollToOffset?.({
        animated: false,
        offset: 0,
      });
    },
    [scroll_y],
  );

  const handle_feed_screen_blur = React.useCallback(() => {
    clear_feed_search_focus(search_input_ref);
  }, []);

  const handle_profile_menu_open = React.useCallback(() => {
    clear_feed_search_focus(search_input_ref, true);
  }, []);

  const update_footer_touch_blocking = React.useCallback(
    (next_should_block = false) => {
      set_should_block_footer_touches((current_value) => {
        if (current_value === next_should_block) {
          return current_value;
        } else {
          return next_should_block;
        }
      });
    },
    [],
  );

  const handle_entry_press = React.useCallback(
    (entry_id = '') => {
      if (!entry_id) {
        return;
      }

      Feed.open_entry(entry_id);
      navigation.navigate('FeedItemDetail', {
        entry_id,
      });
    },
    [navigation],
  );

  const handle_entry_menu_action = React.useCallback(
    async (entry, menu_action_id = '') => {
      const resolved_entry_id = `${entry?.id || ''}`.trim();
      const original_url = normalize_http_url(entry?.url);

      if (!resolved_entry_id) {
        return;
      }

      if (menu_action_id === 'copy_link') {
        if (!original_url) {
          return;
        }

        try {
          await Clipboard.setStringAsync(original_url);
          AppStore.show_toast('Link copied', {
            top_offset: toast_top_offset,
          });
        } catch (error) {
          console.warn('Failed to copy link', error);
        }
        return;
      }

      if (menu_action_id === 'open_web') {
        if (!original_url) {
          return;
        }

        try {
          await Linking.openURL(original_url);
        } catch (error) {
          console.warn('Failed to open url', error);
        }
        return;
      }

      if (menu_action_id === 'toggle_read') {
        if (entry?.is_read) {
          const did_mark_unread = Feed.mark_entry_unread(resolved_entry_id);

          if (did_mark_unread) {
            AppStore.show_toast('Marked as unread', {
              top_offset: toast_top_offset,
            });
          }
        } else {
          const did_mark_read = Feed.mark_entry_read(resolved_entry_id);

          if (did_mark_read) {
            AppStore.show_toast('Marked as read', {
              top_offset: toast_top_offset,
            });
          }
        }
        return;
      }

      if (menu_action_id !== 'toggle_bookmark') {
        return;
      }

      if (entry?.is_bookmarked) {
        const did_unbookmark = Feed.unbookmark_entry(resolved_entry_id);

        if (did_unbookmark) {
          AppStore.show_toast('Bookmark removed', {
            top_offset: toast_top_offset,
          });
        }
      } else {
        const did_bookmark = Feed.bookmark_entry(resolved_entry_id);

        if (did_bookmark) {
          AppStore.show_toast('Bookmarked', {
            top_offset: toast_top_offset,
          });
        }
      }
    },
    [toast_top_offset],
  );

  const handle_profile_menu_action = React.useCallback(
    (menu_action_id = '') => {
      if (menu_action_id === 'new_feed') {
        navigation.navigate('Subscriptions', {
          mode: 'subscribe',
          open_request_id: Date.now(),
        });
      } else if (menu_action_id === 'subscriptions') {
        navigation.navigate('Subscriptions', {
          mode: 'manage',
          open_request_id: Date.now(),
        });
      } else if (menu_action_id === 'bookmarks') {
        navigation.navigate('Bookmarks');
      } else if (menu_action_id === 'highlights') {
        navigation.navigate('Highlights');
      } else if (menu_action_id === 'settings') {
        const parent_navigation = navigation.getParent();

        if (parent_navigation) {
          parent_navigation.navigate('Account');
        } else {
          navigation.navigate('Account');
        }
      }
    },
    [navigation],
  );

  useFocusEffect(
    React.useCallback(() => {
      return handle_feed_screen_blur;
    }, [handle_feed_screen_blur]),
  );

  const handle_recap_press = React.useCallback(async () => {
    const did_open_recap = await Feed.open_fading_recap();

    if (!did_open_recap) {
      return;
    }

    navigation.navigate('FeedItemDetail', {
      mode: 'recap',
    });
  }, [navigation]);

  const handle_segment_swipe = React.useCallback(
    (direction) => {
      if (is_search_active) {
        return;
      }

      const current_index = SEGMENT_OPTIONS.findIndex(
        (option) => option.key === active_segment,
      );
      if (current_index < 0) {
        return;
      }

      const next_index = current_index + direction;
      const next_option = SEGMENT_OPTIONS[next_index];
      if (!next_option) {
        return;
      }

      handle_segment_press(next_option.key);
    },
    [active_segment, handle_segment_press, is_search_active],
  );

  const update_segment_frame = React.useCallback((segment, layout) => {
    set_segment_frames((current_frames) => {
      const previous_frame = current_frames[segment];
      if (
        previous_frame &&
        previous_frame.x === layout.x &&
        previous_frame.width === layout.width
      ) {
        return current_frames;
      }

      return {
        ...current_frames,
        [segment]: {
          width: layout.width,
          x: layout.x,
        },
      };
    });
  }, []);

  React.useEffect(() => {
    if (is_search_active) {
      footer_visibility_progress.value = withTiming(1, {
        duration: 180,
      });
      search_input_ref.current?.focus?.();
    }
  }, [footer_visibility_progress, is_search_active]);

  useAnimatedReaction(
    () => {
      return footer_visibility_progress.value > FOOTER_TOUCH_BLOCK_THRESHOLD;
    },
    (next_should_block, previous_should_block) => {
      if (next_should_block === previous_should_block) {
        return;
      }

      runOnJS(update_footer_touch_blocking)(next_should_block);
    },
    [update_footer_touch_blocking],
  );

  React.useEffect(() => {
    const active_frame = segment_frames[active_segment];
    active_segment_offset.value = withTiming(active_frame?.x || 0, {
      duration: 220,
    });
    active_segment_width.value = withTiming(active_frame?.width || 0, {
      duration: 220,
    });
  }, [
    active_segment,
    active_segment_offset,
    active_segment_width,
    segment_frames,
  ]);

  const content_nudge_style = useAnimatedStyle(() => {
    return {
      opacity: 1,
      transform: [
        {
          translateX: 0,
        },
      ],
    };
  }, []);

  const footer_wrap_style = useAnimatedStyle(() => {
    const hidden_footer_offset =
      footer_bottom_inset + SEGMENT_WRAP_MAX_HEIGHT + LIST_TOP_GAP;

    return {
      opacity: footer_visibility_progress.value,
      transform: [
        {
          translateY: interpolate(
            footer_visibility_progress.value,
            [0, 1],
            [hidden_footer_offset, 0],
            Extrapolation.CLAMP,
          ),
        },
      ],
    };
  }, [footer_bottom_inset]);

  const footer_backdrop_style = useAnimatedStyle(() => {
    const hidden_footer_offset =
      footer_bottom_inset + SEGMENT_WRAP_MAX_HEIGHT + LIST_TOP_GAP;

    return {
      opacity: interpolate(
        footer_visibility_progress.value,
        [0, 1],
        [0, 1],
        Extrapolation.CLAMP,
      ),
      transform: [
        {
          translateY: interpolate(
            footer_visibility_progress.value,
            [0, 1],
            [hidden_footer_offset * 0.75, 0],
            Extrapolation.CLAMP,
          ),
        },
      ],
    };
  }, [footer_bottom_inset]);

  const active_segment_style = useAnimatedStyle(() => {
    return {
      opacity: active_segment_width.value > 0 ? 1 : 0,
      transform: [
        {
          translateX: active_segment_offset.value,
        },
      ],
      width: active_segment_width.value,
    };
  }, []);

  const search_results_spacer_style = useAnimatedStyle(() => {
    const keyboard_height_value = Math.max(-keyboard_height.value, 0);
    const search_results_spacer_height = is_search_active
      ? Math.max(
          keyboard_height_value - search_footer_open_offset,
          0,
        )
      : 0;

    return {
      height: search_results_spacer_height,
    };
  }, [is_search_active, search_footer_open_offset]);

  const top_status_scrim_style = useAnimatedStyle(() => {
    return {
      opacity: interpolate(
        scroll_y.value,
        [0, TOP_STATUS_SCRIM_SCROLL_DISTANCE],
        [0, 1],
        Extrapolation.CLAMP,
      ),
    };
  }, []);

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.canvas }]}>
      <AuthBackground intensity={background_intensity} theme={theme} />
      <Animated.View
        collapsable={false}
        style={[styles.contentSurface, content_nudge_style]}
      >
        {render_content({
            active_segment,
            is_search_active,
            list_bottom_inset,
            list_top_inset,
            on_scroll,
            theme,
            is_loading_initial,
            is_refreshing,
            error_message,
            has_any_timeline_entries,
            list_ref,
            is_generating_recap,
            on_entry_press: handle_entry_press,
            on_entry_menu_action: handle_entry_menu_action,
            on_open_recap: handle_recap_press,
            search_query,
            recap_error_message,
            search_results_spacer_style,
            visible_timeline_entries,
            scaled_text_styles,
          })}
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.topStatusScrim,
          {
            height: top_status_scrim_height,
          },
          top_status_scrim_style,
        ]}
      >
        <LinearGradient
          colors={[
            top_status_scrim_color,
            top_status_scrim_mid_color,
            top_status_scrim_transparent_color,
          ]}
          end={{ x: 0.5, y: 1 }}
          locations={[0, 0.58, 1]}
          start={{ x: 0.5, y: 0 }}
          style={styles.topStatusScrimGradient}
        />
      </Animated.View>
      {is_search_active ? (
        <View pointerEvents="box-none" style={styles.searchFooterOverlay}>
          <KeyboardStickyView
            offset={{
              closed: 0,
              opened: search_footer_open_offset,
            }}
            style={styles.searchFooterSticky}
          >
            <View
              style={[
                styles.searchFooter,
                {
                  paddingBottom: footer_bottom_inset,
                  paddingTop: FOOTER_TOP_PADDING,
                },
              ]}
            >
              <FeedFooterControlsRow
                active_segment={active_segment}
                active_segment_style={active_segment_style}
                input_ref={search_input_ref}
                is_search_active={is_search_active}
                is_dark={isDark}
                onProfileMenuAction={handle_profile_menu_action}
                onProfileMenuOpen={handle_profile_menu_open}
                onSearchQueryChange={handle_search_query_change}
                onSearchTogglePress={handle_search_toggle_press}
                onSegmentPress={handle_segment_press}
                profile_name={profile.name}
                profile_photo={profile.photo}
                search_query={search_query}
                scaled_text_styles={scaled_text_styles}
                theme={theme}
                update_segment_frame={update_segment_frame}
              />
            </View>
          </KeyboardStickyView>
        </View>
      ) : (
        <View pointerEvents="box-none" style={styles.footerOverlay}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.footerBackdrop,
              {
                backgroundColor: resolve_footer_backdrop_color(theme),
              },
              footer_backdrop_style,
            ]}
          />
          <View
            style={[
              styles.footer,
              {
                paddingBottom: footer_bottom_inset,
                paddingTop: FOOTER_TOP_PADDING,
              },
            ]}
          >
            <View
              accessibilityElementsHidden
              accessible={false}
              importantForAccessibility="no-hide-descendants"
              onMoveShouldSetResponder={() => should_block_footer_touches}
              onStartShouldSetResponder={() => should_block_footer_touches}
              pointerEvents={should_block_footer_touches ? 'auto' : 'none'}
              style={styles.footerTouchShield}
            />
            <Animated.View style={[styles.footerWrap, footer_wrap_style]}>
              <FeedFooterControlsRow
                active_segment={active_segment}
                active_segment_style={active_segment_style}
                input_ref={search_input_ref}
                is_search_active={is_search_active}
                is_dark={isDark}
                onProfileMenuAction={handle_profile_menu_action}
                onProfileMenuOpen={handle_profile_menu_open}
                onSearchQueryChange={handle_search_query_change}
                onSearchTogglePress={handle_search_toggle_press}
                onSegmentPress={handle_segment_press}
                profile_name={profile.name}
                profile_photo={profile.photo}
                search_query={search_query}
                scaled_text_styles={scaled_text_styles}
                theme={theme}
                update_segment_frame={update_segment_frame}
              />
            </Animated.View>
          </View>
        </View>
      )}
    </View>
  );
}

function render_content({
  active_segment,
  is_search_active,
  list_bottom_inset,
  list_top_inset,
  on_scroll,
  theme,
  is_loading_initial,
  is_refreshing,
  error_message,
  has_any_timeline_entries,
  list_ref,
  is_generating_recap,
  on_entry_press,
  on_entry_menu_action,
  on_open_recap,
  search_query,
  recap_error_message,
  search_results_spacer_style,
  scaled_text_styles,
  visible_timeline_entries,
}) {
  if (is_loading_initial) {
    return (
      <View
        style={[
          styles.stateScreen,
          {
            paddingBottom: list_bottom_inset,
            paddingHorizontal: SCREEN_HORIZONTAL_PADDING,
            paddingTop: list_top_inset,
          },
        ]}
      >
        <AuthCard style={styles.stateCard} theme={theme}>
          <RssLoadingView
            body="Fetching subscriptions and recent entries for your first timeline."
            compact
            phase="loading_feeds"
            theme={theme}
            title="Loading your feed"
          />
        </AuthCard>
      </View>
    );
  } else {
    return (
      <AnimatedFlatList
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={[
          styles.listContent,
          {
            paddingBottom: list_bottom_inset,
            paddingHorizontal: SCREEN_HORIZONTAL_PADDING,
            paddingTop: list_top_inset,
          },
          visible_timeline_entries.length === 0
            ? styles.listContentEmpty
            : null,
        ]}
        data={visible_timeline_entries}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          error_message && !has_any_timeline_entries ? (
            <AuthCard style={styles.stateCard} theme={theme}>
              <View style={styles.stateCopy}>
                <Text
                  style={[
                    styles.stateTitle,
                    scaled_text_styles.stateTitle,
                    { color: theme.colors.ink },
                  ]}
                >
                  Couldn't load your feed
                </Text>
                <Text
                  style={[
                    styles.stateBody,
                    scaled_text_styles.stateBody,
                    { color: theme.colors.inkSoft },
                  ]}
                >
                  {error_message}
                </Text>
              </View>
              <PrimaryButton
                label="Try again"
                onPress={Feed.retry_bootstrap}
                theme={theme}
              />
            </AuthCard>
          ) : (
            <AuthCard style={styles.stateCard} theme={theme}>
              <View style={styles.stateCopy}>
                <Text
                  style={[
                    styles.stateTitle,
                    scaled_text_styles.stateTitle,
                    { color: theme.colors.ink },
                  ]}
                >
                  {get_empty_state_title(
                    active_segment,
                    is_search_active,
                    search_query,
                  )}
                </Text>
                <Text
                  style={[
                    styles.stateBody,
                    scaled_text_styles.stateBody,
                    { color: theme.colors.inkSoft },
                  ]}
                >
                  {get_empty_state_body(
                    active_segment,
                    is_search_active,
                    search_query,
                  )}
                </Text>
              </View>
            </AuthCard>
          )
        }
        ListHeaderComponent={
          should_show_recap_card({
            active_segment,
            is_search_active,
            visible_timeline_entries,
          }) ? (
            <FeedRecapSummaryCard
              count={visible_timeline_entries.length}
              error_message={recap_error_message}
              is_loading={is_generating_recap || is_refreshing}
              onPress={on_open_recap}
              scaled_text_styles={scaled_text_styles}
              theme={theme}
            />
          ) : null
        }
        ListFooterComponent={
          <Animated.View
            pointerEvents="none"
            style={search_results_spacer_style}
          />
        }
        onScroll={on_scroll}
        progressViewOffset={list_top_inset}
        ref={list_ref}
        refreshControl={
          <RefreshControl
            colors={[theme.colors.accentStrong]}
            onRefresh={Feed.retry_bootstrap}
            progressViewOffset={list_top_inset}
            refreshing={is_refreshing}
            tintColor={theme.colors.accentStrong}
          />
        }
        renderItem={({ item }) => {
          return (
            <FeedTimelineRow
              entry={item}
              onMenuAction={on_entry_menu_action}
              onPress={on_entry_press}
              scaled_text_styles={scaled_text_styles}
              theme={theme}
            />
          );
        }}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        style={styles.list}
      />
    );
  }
}

function FeedFooterControlsRow({
  active_segment = 'today',
  active_segment_style,
  input_ref,
  is_dark = false,
  is_search_active = false,
  onProfileMenuAction,
  onProfileMenuOpen,
  onSearchQueryChange,
  onSearchTogglePress,
  onSegmentPress,
  profile_name = '',
  profile_photo = '',
  search_query = '',
  scaled_text_styles,
  theme,
  update_segment_frame,
}) {
  return (
    <View style={styles.headerControlsRow}>
      <AccountHeaderButton
        is_dark={is_dark}
        onMenuAction={onProfileMenuAction}
        onMenuOpen={onProfileMenuOpen}
        profile_name={profile_name}
        profile_photo={profile_photo}
        scaled_text_styles={scaled_text_styles}
        theme={theme}
      />
      {is_search_active ? (
        <FeedSearchField
          input_ref={input_ref}
          onChangeText={onSearchQueryChange}
          scaled_text_styles={scaled_text_styles}
          theme={theme}
          value={search_query}
        />
      ) : (
        <View
          style={[
            styles.segmentedControl,
            {
              backgroundColor: theme.colors.paper,
              borderColor: theme.colors.line,
              shadowColor: theme.colors.shadow,
            },
          ]}
        >
          <Animated.View
            pointerEvents="none"
            style={[
              styles.activeSegmentPill,
              {
                backgroundColor: theme.colors.accent,
              },
              active_segment_style,
            ]}
          />
          {SEGMENT_OPTIONS.map((option) => {
            const is_active = option.key === active_segment;

            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: is_active }}
                key={option.key}
                onLayout={(event) => {
                  update_segment_frame(
                    option.key,
                    event.nativeEvent.layout,
                  );
                }}
                onPress={() => onSegmentPress(option.key)}
                style={[styles.segmentButton]}
              >
                <Text
                  style={[
                    styles.segmentLabel,
                    scaled_text_styles.segmentLabel,
                    {
                      color: is_active
                        ? theme.colors.white
                        : theme.colors.inkSoft,
                    },
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
      <FeedSearchToggleButton
        is_search_active={is_search_active}
        onPress={onSearchTogglePress}
        theme={theme}
      />
    </View>
  );
}

function FeedTimelineRow({
  entry,
  onMenuAction,
  onPress,
  scaled_text_styles,
  theme,
}) {
  const source_label = entry.source || 'Feed';
  const post_title = resolve_entry_title(entry);
  const display_title = resolve_entry_display_title(entry, source_label);
  const secondary_source_label = resolve_entry_secondary_source_label(
    source_label,
    post_title,
  );
  const summary = resolve_entry_summary(entry, post_title);
  const timestamp = format_entry_timestamp(entry.published_at);
  const is_bookmarked = Boolean(entry?.is_bookmarked);
  const row_opacity = entry.is_read ? READ_ROW_OPACITY : 1;
  const menu_actions = React.useMemo(() => {
    return get_entry_menu_actions({
      entry,
      theme,
    });
  }, [entry, theme]);

  return (
    <Pressable
      accessibilityRole="button"
      onLongPress={() => {}}
      onPress={() => onPress?.(entry.id)}
      style={({ pressed }) => {
        return [
          styles.rowCard,
          {
            backgroundColor: theme.colors.paper,
            borderColor: theme.colors.line,
            opacity: pressed ? Math.max(row_opacity - 0.08, 0.42) : row_opacity,
          },
        ];
      }}
    >
      <MenuView
        accessibilityLabel={`More options for ${display_title}`}
        actions={menu_actions}
        onPressAction={({ nativeEvent }) => {
          onMenuAction?.(entry, nativeEvent.event);
        }}
        shouldOpenOnLongPress
        themeVariant={theme.isDark ? 'dark' : 'light'}
      >
        <View style={styles.rowContentWrap}>
          <FeedSourceAvatar
            avatar_url={entry.avatar_url}
            scaled_text_styles={scaled_text_styles}
            source={source_label}
            theme={theme}
          />
          <View style={styles.rowContent}>
            <Text
              numberOfLines={2}
              style={[
                styles.rowTitle,
                scaled_text_styles.rowTitle,
                { color: theme.colors.ink },
              ]}
            >
              {display_title}
            </Text>
            {summary ? (
              <Text
                numberOfLines={3}
                style={[
                  styles.rowSummary,
                  scaled_text_styles.rowSummary,
                  { color: theme.colors.inkSoft },
                ]}
              >
                {summary}
              </Text>
            ) : null}
            {secondary_source_label ? (
              <Text
                numberOfLines={1}
                style={[
                  styles.rowSourceLabel,
                  scaled_text_styles.rowSourceLabel,
                  { color: theme.colors.inkSoft },
                ]}
              >
                {secondary_source_label}
              </Text>
            ) : null}
            {timestamp || is_bookmarked ? (
              <View style={styles.rowFooter}>
                {timestamp ? (
                  <Text
                    style={[
                      styles.timestamp,
                      scaled_text_styles.timestamp,
                      { color: theme.colors.inkSoft },
                    ]}
                  >
                    {timestamp}
                  </Text>
                ) : (
                  <View />
                )}
                {is_bookmarked ? (
                  <View style={styles.bookmarkIndicator}>
                    <MaterialIcons
                      color={theme.colors.inkSoft}
                      name="star"
                      size={16}
                    />
                    <Text
                      style={[
                        styles.timestamp,
                        scaled_text_styles.timestamp,
                        styles.bookmarkLabel,
                        { color: theme.colors.inkSoft },
                      ]}
                    >
                      Bookmarked
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        </View>
      </MenuView>
    </Pressable>
  );
}

function normalize_http_url(value = '') {
  const normalized_value = `${value || ''}`.trim();

  if (!normalized_value) {
    return '';
  }

  if (/^https?:\/\//i.test(normalized_value)) {
    return normalized_value;
  }

  try {
    const parsed_url = new URL(normalized_value, 'https://');

    return parsed_url.toString();
  } catch (error) {
    return '';
  }
}

function FeedRecapSummaryCard({
  count = 0,
  error_message = '',
  is_loading = false,
  onPress,
  scaled_text_styles,
  theme,
}) {
  const summary_label = get_recap_summary_label(count);

  return (
    <View
      style={[
        styles.recapCard,
        {
          backgroundColor: resolve_recap_card_background_color(theme),
          borderColor: theme.colors.line,
          shadowColor: theme.colors.shadow,
        },
      ]}
    >
      <View style={styles.recapCopy}>
        <View style={styles.recapSummaryRow}>
          <Pressable
            accessibilityRole="button"
            disabled={is_loading}
            onPress={onPress}
            style={({ pressed }) => {
              return [
                styles.recapButton,
                {
                  backgroundColor: theme.colors.accentSoft,
                  borderColor: theme.colors.line,
                  opacity: is_loading ? 0.72 : pressed ? 0.86 : 1,
                },
              ];
            }}
          >
            {is_loading ? (
              <View style={{ height: 16, justifyContent: 'center' }}>
                <ActivityIndicator
                  color={theme.colors.accentStrong}
                  size="small"
                />
              </View>
            ) : (
              <Text
                style={[
                  styles.recapButtonLabel,
                  scaled_text_styles.recapButtonLabel,
                  { color: theme.colors.accentStrong },
                ]}
              >
                Reading Recap
              </Text>
            )}
          </Pressable>
          <Text
            style={[
              styles.recapBody,
              scaled_text_styles.recapBody,
              styles.recapBodyInline,
              { color: theme.colors.inkSoft },
            ]}
          >
            {summary_label}
          </Text>
        </View>
        {error_message ? (
          <Text
            style={[
              styles.recapError,
              scaled_text_styles.recapError,
              { color: theme.colors.accentStrong },
            ]}
          >
            {error_message}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function AccountHeaderButton({
  is_dark = false,
  onMenuAction,
  onMenuOpen,
  profile_name = '',
  profile_photo = '',
  scaled_text_styles,
  theme,
}) {
  const menu_actions = React.useMemo(() => {
    return get_profile_menu_actions(theme);
  }, [theme]);
  const trimmed_profile_photo = `${profile_photo || ''}`.trim();
  const [did_fail_to_load, set_did_fail_to_load] = React.useState(false);
  const [is_image_loaded, set_is_image_loaded] = React.useState(false);
  const should_show_image = trimmed_profile_photo && !did_fail_to_load;
  const should_show_initial =
    !trimmed_profile_photo || did_fail_to_load || !is_image_loaded;
  const profile_initial = get_profile_initial(profile_name);

  React.useEffect(() => {
    set_did_fail_to_load(false);
    set_is_image_loaded(false);
  }, [trimmed_profile_photo]);

  return (
    <MenuView
      accessibilityLabel="Open profile menu"
      actions={menu_actions}
      onOpenMenu={onMenuOpen}
      onPressAction={({ nativeEvent }) => {
        onMenuAction?.(nativeEvent.event);
      }}
      shouldOpenOnLongPress={false}
      themeVariant={is_dark ? 'dark' : 'light'}
    >
      <View
        accessibilityRole="button"
        style={[
          styles.accountButton,
          {
            backgroundColor: theme.colors.paper,
            borderColor: theme.colors.line,
            shadowColor: theme.colors.shadow,
          },
        ]}
      >
        <View
          style={[
            styles.accountAvatarFrame,
            {
              backgroundColor: theme.colors.accentSoft,
            },
          ]}
        >
          <View style={styles.accountAvatarPlaceholder}>
            {should_show_initial ? (
              <Text
                style={[
                  styles.accountAvatarInitial,
                  scaled_text_styles.accountAvatarInitial,
                  { color: theme.colors.accentStrong },
                ]}
              >
                {profile_initial}
              </Text>
            ) : null}
          </View>
          {should_show_image ? (
            <Image
              cachePolicy="memory-disk"
              contentFit="cover"
              onError={() => set_did_fail_to_load(true)}
              onLoad={() => set_is_image_loaded(true)}
              source={{ uri: trimmed_profile_photo }}
              style={styles.accountAvatarImage}
              transition={HEADER_ACCOUNT_AVATAR_TRANSITION_MS}
            />
          ) : null}
        </View>
      </View>
    </MenuView>
  );
}

function FeedSearchField({
  input_ref,
  onChangeText,
  scaled_text_styles,
  theme,
  value = '',
}) {
  return (
    <View
      style={[
        styles.searchField,
        {
          backgroundColor: theme.colors.paper,
          borderColor: theme.colors.line,
          shadowColor: theme.colors.shadow,
        },
      ]}
    >
      <MaterialIcons
        color={theme.colors.inkSoft}
        name="search"
        size={18}
        style={styles.searchFieldIcon}
      />
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={onChangeText}
        onSubmitEditing={Keyboard.dismiss}
        placeholder="Search"
        placeholderTextColor={theme.colors.inkSoft}
        ref={input_ref}
        returnKeyType="search"
        selectionColor={theme.colors.accentStrong}
        style={[
          styles.searchInput,
          scaled_text_styles.searchInput,
          { color: theme.colors.ink },
        ]}
        value={value}
      />
    </View>
  );
}

function FeedSearchToggleButton({
  is_search_active = false,
  onPress,
  theme,
}) {
  const icon_name = is_search_active ? 'close' : 'search';
  const handle_press = is_search_active ? undefined : onPress;
  const handle_press_in = is_search_active ? onPress : undefined;

  return (
    <Pressable
      accessibilityLabel={is_search_active ? 'Close search' : 'Search'}
      accessibilityRole="button"
      onPress={handle_press}
      onPressIn={handle_press_in}
      style={({ pressed }) => {
        return [
          styles.headerUtilityButton,
          {
            backgroundColor: theme.colors.paper,
            borderColor: theme.colors.line,
            opacity: pressed ? 0.82 : 1,
            shadowColor: theme.colors.shadow,
          },
        ];
      }}
    >
      <MaterialIcons
        color={
          is_search_active ? theme.colors.accentStrong : theme.colors.inkSoft
        }
        name={icon_name}
        size={20}
      />
    </Pressable>
  );
}

function FeedSourceAvatar({
  avatar_url = '',
  scaled_text_styles,
  source = '',
  theme,
}) {
  const trimmed_avatar_url = `${avatar_url || ''}`.trim();
  const [did_fail_to_load, set_did_fail_to_load] = React.useState(false);
  const [is_image_loaded, set_is_image_loaded] = React.useState(false);
  const initial = get_source_avatar_initial(source);
  const should_show_image = trimmed_avatar_url && !did_fail_to_load;
  const should_show_initial =
    !trimmed_avatar_url || did_fail_to_load || !is_image_loaded;

  React.useEffect(() => {
    set_did_fail_to_load(false);
    set_is_image_loaded(false);
  }, [trimmed_avatar_url]);

  return (
    <View
      style={[
        styles.sourceAvatarFrame,
        {
          backgroundColor: theme.colors.accentSoft,
        },
      ]}
    >
      <View style={styles.sourceAvatarPlaceholder}>
        {should_show_initial ? (
          <Text
            style={[
              styles.sourceAvatarInitial,
              scaled_text_styles.sourceAvatarInitial,
              { color: theme.colors.accentStrong },
            ]}
          >
            {initial}
          </Text>
        ) : null}
      </View>
      {should_show_image ? (
        <Image
          cachePolicy="memory-disk"
          contentFit="cover"
          onError={() => set_did_fail_to_load(true)}
          onLoad={() => set_is_image_loaded(true)}
          source={{ uri: trimmed_avatar_url }}
          style={styles.sourceAvatarImage}
          transition={FEED_AVATAR_TRANSITION_MS}
        />
      ) : null}
    </View>
  );
}

function resolve_entry_title(entry) {
  const title = normalize_entry_text(entry?.title);

  if (title) {
    return title;
  } else {
    return '';
  }
}

function resolve_entry_display_title(entry, source_label = '') {
  const title = resolve_entry_title(entry);

  if (title) {
    return title;
  } else {
    return source_label;
  }
}

function resolve_entry_secondary_source_label(
  source_label = '',
  post_title = '',
) {
  if (post_title) {
    return source_label;
  } else {
    return '';
  }
}

function resolve_entry_summary(entry, title = '') {
  const normalized_title = normalize_entry_text(title || entry?.title);
  const summary = normalize_entry_text(entry?.summary);

  if (!summary) {
    return '';
  } else if (normalized_title && summary === normalized_title) {
    return '';
  } else {
    return summary;
  }
}

function normalize_entry_text(value = '') {
  return `${value || ''}`.replace(/\s+/g, ' ').trim();
}

function get_source_avatar_initial(source = '') {
  const trimmed_source = `${source || ''}`.trim();
  const initial = trimmed_source.charAt(0).toUpperCase();

  if (initial) {
    return initial;
  } else {
    return 'F';
  }
}

function get_profile_initial(profile_name = '') {
  const trimmed_profile_name = `${profile_name || ''}`.trim();
  const initial = trimmed_profile_name.charAt(0).toUpperCase();

  if (initial) {
    return initial;
  } else {
    return 'M';
  }
}

function format_entry_timestamp(raw_date = '') {
  if (!raw_date) {
    return '';
  }

  const date = new Date(raw_date);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const date_part = date.toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
  });
  const time_part = date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });

  if (!date_part) {
    return time_part;
  } else if (!time_part) {
    return date_part;
  } else {
    return `${date_part}, ${time_part}`;
  }
}

function get_empty_state_title(
  active_segment = 'today',
  is_search_active = false,
  search_query = '',
) {
  if (is_search_active) {
    if (`${search_query || ''}`.trim()) {
      return 'No matching posts';
    } else {
      return 'Nothing in your feed yet';
    }
  }

  if (active_segment === 'recent') {
    return 'Nothing recent yet';
  } else if (active_segment === 'fading') {
    return 'Nothing is fading yet';
  } else {
    return 'Nothing new today';
  }
}

function get_empty_state_body(
  active_segment = 'today',
  is_search_active = false,
  search_query = '',
) {
  if (is_search_active) {
    if (`${search_query || ''}`.trim()) {
      return 'Try a different word or phrase.';
    } else {
      return 'Posts will show up here as soon as your feeds update.';
    }
  }

  if (active_segment === 'recent') {
    return 'Posts from the last couple of days will gather here once they arrive.';
  } else if (active_segment === 'fading') {
    return 'Older unread entries from the last week will collect here automatically.';
  } else {
    return 'Fresh posts published today will show up here as soon as your feeds update.';
  }
}

function should_show_recap_card({
  active_segment = 'today',
  is_search_active = false,
  visible_timeline_entries = [],
}) {
  if (active_segment !== 'fading' || is_search_active) {
    return false;
  }

  return visible_timeline_entries.length > 0;
}

function get_recap_summary_label(count = 0) {
  const normalized_count = Number.isFinite(count) ? Math.max(count, 0) : 0;
  const noun = normalized_count === 1 ? 'post' : 'posts';

  return `${normalized_count} older ${noun}, grouped`;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    position: 'relative',
  },
  contentSurface: {
    flex: 1,
    position: 'relative',
    zIndex: 0,
  },
  topStatusScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    elevation: 2,
    zIndex: 2,
  },
  topStatusScrimGradient: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  footerOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 3,
  },
  footer: {
    paddingHorizontal: SCREEN_HORIZONTAL_PADDING,
    position: 'relative',
  },
  searchFooterOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 4,
  },
  searchFooterSticky: {
    width: '100%',
  },
  searchFooter: {
    paddingHorizontal: SCREEN_HORIZONTAL_PADDING,
  },
  footerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  footerTouchShield: {
    ...StyleSheet.absoluteFillObject,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  headerControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: HEADER_ACCOUNT_GAP,
  },
  footerWrap: {
    marginBottom: 0,
    position: 'relative',
    zIndex: 1,
  },
  accountButton: {
    width: HEADER_ACCOUNT_BUTTON_SIZE,
    height: HEADER_ACCOUNT_BUTTON_SIZE,
    borderRadius: HEADER_ACCOUNT_BUTTON_SIZE / 2,
    borderWidth: 1,
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 3,
  },
  headerUtilityButton: {
    width: HEADER_ACCOUNT_BUTTON_SIZE,
    height: HEADER_ACCOUNT_BUTTON_SIZE,
    borderRadius: HEADER_ACCOUNT_BUTTON_SIZE / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 3,
  },
  accountAvatarFrame: {
    width: '100%',
    height: '100%',
    borderRadius: HEADER_ACCOUNT_BUTTON_SIZE / 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountAvatarPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountAvatarInitial: {
    fontFamily: 'Newsreader_700Bold',
    fontSize: 16,
    lineHeight: 18,
  },
  accountAvatarImage: {
    ...StyleSheet.absoluteFillObject,
  },
  segmentedControl: {
    position: 'relative',
    flex: 1,
    minHeight: HEADER_CONTROL_HEIGHT,
    flexDirection: 'row',
    borderRadius: HEADER_CONTROL_RADIUS,
    borderWidth: 1,
    padding: SEGMENT_CONTROL_INSET,
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 3,
  },
  searchField: {
    flex: 1,
    minHeight: HEADER_CONTROL_HEIGHT,
    borderRadius: HEADER_CONTROL_RADIUS,
    borderWidth: 1,
    paddingLeft: 14,
    paddingRight: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 3,
  },
  searchFieldIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    paddingVertical: 0,
  },
  activeSegmentPill: {
    position: 'absolute',
    top: SEGMENT_CONTROL_INSET,
    bottom: SEGMENT_CONTROL_INSET,
    left: 0,
    borderRadius: SEGMENT_BUTTON_RADIUS,
  },
  segmentButton: {
    flex: 1,
    minHeight: SEGMENT_BUTTON_HEIGHT,
    borderRadius: SEGMENT_BUTTON_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    position: 'relative',
    zIndex: 1,
  },
  segmentLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  stateScreen: {
    flex: 1,
  },
  stateCard: {
    marginTop: 12,
    gap: 24,
    alignItems: 'center',
    paddingVertical: 28,
  },
  stateCopy: {
    alignItems: 'center',
    gap: 10,
    maxWidth: 320,
  },
  stateTitle: {
    fontFamily: 'Newsreader_600SemiBold',
    fontSize: 28,
    lineHeight: 34,
    textAlign: 'center',
  },
  stateBody: {
    fontSize: 15,
    lineHeight: 23,
    textAlign: 'center',
  },
  listContent: {
    gap: 14,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  rowCard: {
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  recapCard: {
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 18,
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 3,
  },
  recapCopy: {
    gap: 12,
  },
  recapSummaryRow: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recapBody: {
    fontSize: 15,
    lineHeight: 22,
  },
  recapBodyInline: {
    flexShrink: 1,
    textAlign: 'right',
  },
  recapError: {
    fontSize: 14,
    lineHeight: 20,
  },
  recapButton: {
    minHeight: 34,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  recapButtonLabel: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 16,
  },
  rowContentWrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  sourceAvatarFrame: {
    width: FEED_AVATAR_SIZE,
    height: FEED_AVATAR_SIZE,
    borderRadius: FEED_AVATAR_SIZE / 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sourceAvatarPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceAvatarImage: {
    ...StyleSheet.absoluteFillObject,
  },
  sourceAvatarInitial: {
    fontFamily: 'Newsreader_700Bold',
    fontSize: 14,
    lineHeight: 15,
  },
  rowContent: {
    flex: 1,
    gap: 8,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
  },
  rowSummary: {
    fontSize: 15,
    lineHeight: 22,
  },
  rowSourceLabel: {
    fontSize: 15,
    lineHeight: 20,
  },
  rowFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  bookmarkIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  bookmarkLabel: {
    flexShrink: 0,
  },
  timestamp: {
    fontSize: 13,
    lineHeight: 18,
  },
});

export default observer(FeedScreen);

function resolve_footer_backdrop_color(theme) {
  return with_color_opacity(theme?.colors?.canvas, theme?.isDark ? 0.78 : 0.84);
}

function resolve_top_status_scrim_color(theme, platform = Platform.OS) {
  return with_color_opacity(
    theme?.colors?.canvas,
    platform === 'ios' ? 0.56 : 0.64,
  );
}

function resolve_recap_card_background_color(theme) {
  return theme?.colors?.badge || theme?.colors?.paper || '#ffffff';
}

function with_color_opacity(color_value = '', opacity = 1) {
  const normalized_color = `${color_value || ''}`.trim();
  const normalized_opacity = Number.isFinite(opacity)
    ? Math.min(Math.max(opacity, 0), 1)
    : 1;
  const hex_match = normalized_color.match(/^#([0-9a-f]{6})$/i);

  if (!hex_match) {
    return normalized_color || 'rgba(255, 255, 255, 0.84)';
  }

  const hex = hex_match[1];
  const red = parseInt(hex.slice(0, 2), 16);
  const green = parseInt(hex.slice(2, 4), 16);
  const blue = parseInt(hex.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${normalized_opacity})`;
}
