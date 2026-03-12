import React from 'react';
import {
  FlatList,
  Keyboard,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useScrollToTop } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { observer } from 'mobx-react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
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
import Feed from '../stores/Feed';
import { getAuthTheme } from '../theme/authTheme';

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
const HEADER_ACCOUNT_GAP = 12;
const HEADER_ACCOUNT_AVATAR_TRANSITION_MS = 180;
const LIST_TOP_GAP = 12;
const FOOTER_FLOAT_GAP = 8;
const FOOTER_TOP_PADDING = 10;
const FOOTER_SCROLL_DELTA_THRESHOLD = 6;
const FOOTER_VISIBILITY_TOP_THRESHOLD = 24;
const SEGMENT_SWIPE_DISTANCE = 56;
const SEGMENT_SWIPE_VELOCITY = 620;
const SEGMENT_SWIPE_NUDGE = 24;
const SEGMENT_CONTROL_INSET = 3;
const FEED_AVATAR_SIZE = 28;
const READ_ROW_OPACITY = 0.56;
const FEED_AVATAR_TRANSITION_MS = 180;

function FeedScreen({ navigation, isDark = false }) {
  const theme = getAuthTheme(isDark);
  const insets = useSafeAreaInsets();
  const active_segment = Feed.active_segment;
  const is_search_active = Feed.is_search_active;
  const search_query = Feed.search_query;
  const profile = Auth.current_profile();
  const has_bootstrapped = Feed.has_bootstrapped;
  const has_any_timeline_entries = Feed.timeline_entries.length > 0;
  const visible_timeline_entries = Feed.visible_timeline_entries();
  const error_message = Feed.error_message;
  const background_intensity = visible_timeline_entries.length > 0 ? 0.14 : 1;
  const list_top_inset = insets.top + LIST_TOP_PADDING;
  const footer_bottom_inset = insets.bottom + FOOTER_FLOAT_GAP;
  const list_bottom_inset =
    footer_bottom_inset +
    FOOTER_TOP_PADDING +
    SEGMENT_WRAP_MAX_HEIGHT +
    LIST_TOP_GAP;
  const list_ref = React.useRef(null);
  const search_input_ref = React.useRef(null);
  const [segment_frames, set_segment_frames] = React.useState({});
  const scroll_y = useSharedValue(0);
  const previous_scroll_y = useSharedValue(0);
  const swipe_nudge_x = useSharedValue(0);
  const footer_visibility_progress = useSharedValue(1);
  const active_segment_offset = useSharedValue(0);
  const active_segment_width = useSharedValue(0);
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

      scroll_y.value = next_scroll_y;

      if (is_search_active || next_scroll_y <= FOOTER_VISIBILITY_TOP_THRESHOLD) {
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

  const handle_account_press = React.useCallback(() => {
    const parent_navigation = navigation.getParent();

    if (parent_navigation) {
      parent_navigation.navigate('Account');
    } else {
      navigation.navigate('Account');
    }
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

  const swipe_gesture = React.useMemo(() => {
    return Gesture.Pan()
      .enabled(!is_search_active)
      .activeOffsetX([-18, 18])
      .failOffsetY([-14, 14])
      .onUpdate((event) => {
        const next_nudge = clamp_swipe_nudge(event.translationX * 0.22);
        swipe_nudge_x.value = next_nudge;
      })
      .onEnd((event) => {
        const has_enough_distance =
          Math.abs(event.translationX) >= SEGMENT_SWIPE_DISTANCE;
        const has_enough_velocity =
          Math.abs(event.velocityX) >= SEGMENT_SWIPE_VELOCITY;

        swipe_nudge_x.value = withTiming(0, {
          duration: 180,
        });

        if (!has_enough_distance && !has_enough_velocity) {
          return;
        }

        if (has_enough_distance) {
          runOnJS(handle_segment_swipe)(event.translationX < 0 ? 1 : -1);
        } else if (event.velocityX < 0) {
          runOnJS(handle_segment_swipe)(1);
        } else {
          runOnJS(handle_segment_swipe)(-1);
        }
      })
      .onFinalize(() => {
        swipe_nudge_x.value = withTiming(0, {
          duration: 180,
        });
      });
  }, [handle_segment_swipe, is_search_active, swipe_nudge_x]);

  React.useEffect(() => {
    if (is_search_active) {
      footer_visibility_progress.value = withTiming(1, {
        duration: 180,
      });
      search_input_ref.current?.focus?.();
    }
  }, [footer_visibility_progress, is_search_active]);

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
      opacity: interpolate(
        Math.abs(swipe_nudge_x.value),
        [0, SEGMENT_SWIPE_NUDGE],
        [1, 0.985],
        Extrapolation.CLAMP,
      ),
      transform: [
        {
          translateX: swipe_nudge_x.value,
        },
      ],
    };
  }, []);

  const footer_wrap_style = useAnimatedStyle(() => {
    const segment_nudge_x = -swipe_nudge_x.value;
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
        {
          translateX: segment_nudge_x * 0.4,
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
    const segment_nudge_x = -swipe_nudge_x.value;

    return {
      opacity: active_segment_width.value > 0 ? 1 : 0,
      transform: [
        {
          translateX: active_segment_offset.value + segment_nudge_x * 0.18,
        },
      ],
      width: active_segment_width.value,
    };
  }, []);

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.canvas }]}>
      <AuthBackground intensity={background_intensity} theme={theme} />
      <GestureDetector gesture={swipe_gesture}>
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
            on_entry_press: handle_entry_press,
            search_query,
            visible_timeline_entries,
          })}
        </Animated.View>
      </GestureDetector>
      <View pointerEvents="box-none" style={styles.footerOverlay}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.footerBackdrop,
            {
              backgroundColor: resolve_footer_backdrop_color(isDark),
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
          <Animated.View style={[styles.footerWrap, footer_wrap_style]}>
            <View style={styles.headerControlsRow}>
              <AccountHeaderButton
                onPress={handle_account_press}
                profile_name={profile.name}
                profile_photo={profile.photo}
                theme={theme}
              />
              {is_search_active ? (
                <FeedSearchField
                  input_ref={search_input_ref}
                  onChangeText={handle_search_query_change}
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
                        onPress={() => handle_segment_press(option.key)}
                        style={[styles.segmentButton]}
                      >
                        <Text
                          style={[
                            styles.segmentLabel,
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
                onPress={handle_search_toggle_press}
                theme={theme}
              />
            </View>
          </Animated.View>
        </View>
      </View>
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
  on_entry_press,
  search_query,
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
                <Text style={[styles.stateTitle, { color: theme.colors.ink }]}>
                  Couldn't load your feed
                </Text>
                <Text
                  style={[styles.stateBody, { color: theme.colors.inkSoft }]}
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
                <Text style={[styles.stateTitle, { color: theme.colors.ink }]}>
                  {get_empty_state_title(
                    active_segment,
                    is_search_active,
                    search_query,
                  )}
                </Text>
                <Text
                  style={[styles.stateBody, { color: theme.colors.inkSoft }]}
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
              onPress={on_entry_press}
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

function FeedTimelineRow({ entry, onPress, theme }) {
  const source_label = entry.source || 'Feed';
  const title = resolve_entry_title(entry);
  const summary = resolve_entry_summary(entry);
  const timestamp = format_entry_timestamp(entry.published_at);
  const row_opacity = entry.is_read ? READ_ROW_OPACITY : 1;

  return (
    <Pressable
      accessibilityRole="button"
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
      <View style={styles.rowHeader}>
        <View style={styles.sourceWrap}>
          <FeedSourceAvatar
            avatar_url={entry.avatar_url}
            source={source_label}
            theme={theme}
          />
          <Text
            numberOfLines={1}
            style={[styles.sourceLabel, { color: theme.colors.inkSoft }]}
          >
            {source_label}
          </Text>
        </View>
        <Text style={[styles.timestamp, { color: theme.colors.inkSoft }]}>
          {timestamp}
        </Text>
      </View>

      <View style={styles.rowBody}>
        <Text
          numberOfLines={2}
          style={[styles.rowTitle, { color: theme.colors.ink }]}
        >
          {title}
        </Text>
        {summary ? (
          <Text
            numberOfLines={3}
            style={[styles.rowSummary, { color: theme.colors.inkSoft }]}
          >
            {summary}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function AccountHeaderButton({
  onPress,
  profile_name = '',
  profile_photo = '',
  theme,
}) {
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
    <Pressable
      accessibilityLabel="Open account"
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => {
        return [
          styles.accountButton,
          {
            backgroundColor: theme.colors.paper,
            borderColor: theme.colors.line,
            opacity: pressed ? 0.82 : 1,
            shadowColor: theme.colors.shadow,
          },
        ];
      }}
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
    </Pressable>
  );
}

function FeedSearchField({
  input_ref,
  onChangeText,
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
        style={[styles.searchInput, { color: theme.colors.ink }]}
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

  return (
    <Pressable
      accessibilityLabel={is_search_active ? 'Close search' : 'Search'}
      accessibilityRole="button"
      onPress={onPress}
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

function FeedSourceAvatar({ avatar_url = '', source = '', theme }) {
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
          borderColor: theme.colors.line,
        },
      ]}
    >
      <View style={styles.sourceAvatarPlaceholder}>
        {should_show_initial ? (
          <Text
            style={[
              styles.sourceAvatarInitial,
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
  const title = `${entry?.title || ''}`.trim();
  const summary = `${entry?.summary || ''}`.replace(/\s+/g, ' ').trim();

  if (title) {
    return title;
  } else if (summary) {
    return summary;
  } else {
    return 'Untitled post';
  }
}

function resolve_entry_summary(entry) {
  const title = `${entry?.title || ''}`.trim();
  const summary = `${entry?.summary || ''}`.replace(/\s+/g, ' ').trim();

  if (!summary || summary === title) {
    return '';
  } else {
    return summary;
  }
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

  if (is_today(date)) {
    return date.toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    });
  } else {
    return date.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
    });
  }
}

function is_today(date) {
  const now = new Date();

  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
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

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  contentSurface: {
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
    zIndex: 2,
  },
  footer: {
    paddingHorizontal: SCREEN_HORIZONTAL_PADDING,
  },
  footerBackdrop: {
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
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: 1,
    padding: 3,
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
    minHeight: HEADER_ACCOUNT_BUTTON_SIZE,
    borderRadius: 20,
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
    borderRadius: 12,
  },
  segmentButton: {
    flex: 1,
    minHeight: 34,
    borderRadius: 12,
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
    gap: 14,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sourceWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  sourceAvatarFrame: {
    width: FEED_AVATAR_SIZE,
    height: FEED_AVATAR_SIZE,
    borderRadius: FEED_AVATAR_SIZE / 2,
    borderWidth: 1,
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
  sourceLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  timestamp: {
    fontSize: 13,
    lineHeight: 18,
  },
  rowBody: {
    gap: 8,
  },
  rowTitle: {
    fontFamily: 'Newsreader_600SemiBold',
    fontSize: 24,
    lineHeight: 30,
  },
  rowSummary: {
    fontSize: 15,
    lineHeight: 22,
  },
});

export default observer(FeedScreen);

function clamp_swipe_nudge(value = 0) {
  'worklet';
  return Math.max(Math.min(value, SEGMENT_SWIPE_NUDGE), -SEGMENT_SWIPE_NUDGE);
}

function resolve_footer_backdrop_color(is_dark = false) {
  if (is_dark) {
    return 'rgba(17, 24, 33, 0.76)';
  } else {
    return 'rgba(246, 241, 230, 0.82)';
  }
}
