import React from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useScrollToTop } from '@react-navigation/native';
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
const HEADER_TOP_PADDING = 10;
const SEGMENT_COLLAPSE_DISTANCE = 74;
const SEGMENT_WRAP_MAX_HEIGHT = 50;
const HEADER_ACCOUNT_BUTTON_SIZE = 40;
const HEADER_ACCOUNT_GAP = 12;
const HEADER_ACCOUNT_AVATAR_TRANSITION_MS = 180;
const LIST_TOP_GAP = 12;
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
  const profile = Auth.current_profile();
  const has_bootstrapped = Feed.has_bootstrapped;
  const has_any_timeline_entries = Feed.timeline_entries.length > 0;
  const visible_timeline_entries = Feed.visible_timeline_entries();
  const error_message = Feed.error_message;
  const background_intensity = visible_timeline_entries.length > 0 ? 0.14 : 1;
  const header_top_inset = insets.top + HEADER_TOP_PADDING;
  const list_top_inset =
    header_top_inset + SEGMENT_WRAP_MAX_HEIGHT + LIST_TOP_GAP;
  const list_ref = React.useRef(null);
  const [segment_frames, set_segment_frames] = React.useState({});
  const scroll_y = useSharedValue(0);
  const swipe_nudge_x = useSharedValue(0);
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
      scroll_y.value = 0;
      list_ref.current?.scrollToOffset?.({
        animated: true,
        offset: 0,
      });
    },
  });

  useScrollToTop(scroll_to_top_ref);

  const on_scroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scroll_y.value = Math.max(event.contentOffset.y, 0);
    },
  });

  const handle_segment_press = React.useCallback((segment) => {
    Feed.set_active_segment(segment);
    scroll_to_top_ref.current.scrollToTop();
  }, []);

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
    [active_segment, handle_segment_press],
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
  }, [handle_segment_swipe, swipe_nudge_x]);

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

  const segment_wrap_style = useAnimatedStyle(() => {
    return {
      height: interpolate(
        scroll_y.value,
        [0, SEGMENT_COLLAPSE_DISTANCE],
        [SEGMENT_WRAP_MAX_HEIGHT, 0],
        Extrapolation.CLAMP,
      ),
      marginTop: interpolate(
        scroll_y.value,
        [0, SEGMENT_COLLAPSE_DISTANCE],
        [2, 0],
        Extrapolation.CLAMP,
      ),
      opacity: interpolate(
        scroll_y.value,
        [0, SEGMENT_COLLAPSE_DISTANCE * 0.82],
        [1, 0],
        Extrapolation.CLAMP,
      ),
      transform: [
        {
          translateY: interpolate(
            scroll_y.value,
            [0, SEGMENT_COLLAPSE_DISTANCE],
            [0, -18],
            Extrapolation.CLAMP,
          ),
        },
        {
          translateX: swipe_nudge_x.value * 0.4,
        },
      ],
    };
  }, []);

  const active_segment_style = useAnimatedStyle(() => {
    return {
      opacity: active_segment_width.value > 0 ? 1 : 0,
      transform: [
        {
          translateX: active_segment_offset.value + swipe_nudge_x.value * 0.18,
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
            list_top_inset,
            on_scroll,
            theme,
            is_loading_initial,
            is_refreshing,
            error_message,
            has_any_timeline_entries,
            list_ref,
            on_entry_press: handle_entry_press,
            visible_timeline_entries,
          })}
        </Animated.View>
      </GestureDetector>
      <View pointerEvents="box-none" style={styles.headerOverlay}>
        <View style={[styles.header, { paddingTop: header_top_inset }]}>
          <Animated.View style={[styles.segmentWrap, segment_wrap_style]}>
            <View style={styles.headerControlsRow}>
              <AccountHeaderButton
                onPress={handle_account_press}
                profile_name={profile.name}
                profile_photo={profile.photo}
                theme={theme}
              />
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
            </View>
          </Animated.View>
        </View>
      </View>
    </View>
  );
}

function render_content({
  active_segment,
  list_top_inset,
  on_scroll,
  theme,
  is_loading_initial,
  is_refreshing,
  error_message,
  has_any_timeline_entries,
  list_ref,
  on_entry_press,
  visible_timeline_entries,
}) {
  if (is_loading_initial) {
    return (
      <View
        style={[
          styles.stateScreen,
          {
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
                  {get_empty_state_title(active_segment)}
                </Text>
                <Text
                  style={[styles.stateBody, { color: theme.colors.inkSoft }]}
                >
                  {get_empty_state_body(active_segment)}
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

function get_empty_state_title(active_segment = 'today') {
  if (active_segment === 'recent') {
    return 'Nothing recent yet';
  } else if (active_segment === 'fading') {
    return 'Nothing is fading yet';
  } else {
    return 'Nothing new today';
  }
}

function get_empty_state_body(active_segment = 'today') {
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
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
  },
  header: {
    paddingHorizontal: SCREEN_HORIZONTAL_PADDING,
  },
  headerControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: HEADER_ACCOUNT_GAP,
  },
  segmentWrap: {
    overflow: 'hidden',
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
    paddingBottom: 104,
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
