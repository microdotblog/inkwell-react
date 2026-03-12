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
import { observer } from 'mobx-react';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

import AuthBackground from '../components/auth/AuthBackground';
import AuthCard from '../components/auth/AuthCard';
import PrimaryButton from '../components/auth/PrimaryButton';
import RssLoadingView from '../components/loading/RssLoadingView';
import Feed from '../stores/Feed';
import { getAuthTheme } from '../theme/authTheme';

const SEGMENT_OPTIONS = [
  { key: 'today', label: 'Today' },
  { key: 'recent', label: 'Recent' },
  { key: 'fading', label: 'Fading' },
];
const AnimatedFlatList = Animated.createAnimatedComponent(FlatList);
const SEGMENT_COLLAPSE_DISTANCE = 74;
const SEGMENT_WRAP_MAX_HEIGHT = 50;

function FeedScreen({ isDark = false }) {
  const theme = getAuthTheme(isDark);
  const active_segment = Feed.active_segment;
  const has_bootstrapped = Feed.has_bootstrapped;
  const has_any_timeline_entries = Feed.timeline_entries.length > 0;
  const visible_timeline_entries = Feed.visible_timeline_entries();
  const error_message = Feed.error_message;
  const background_intensity = visible_timeline_entries.length > 0 ? 0.14 : 1;
  const list_ref = React.useRef(null);
  const scroll_y = useSharedValue(0);
  const is_loading_initial =
    (Feed.is_bootstrapping && visible_timeline_entries.length === 0) ||
    (!has_bootstrapped && !error_message && visible_timeline_entries.length === 0);
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

  const handle_segment_press = (segment) => {
    Feed.set_active_segment(segment);
    scroll_to_top_ref.current.scrollToTop();
  };

  const segment_wrap_style = useAnimatedStyle(() => {
    return {
      height: interpolate(
        scroll_y.value,
        [0, SEGMENT_COLLAPSE_DISTANCE],
        [SEGMENT_WRAP_MAX_HEIGHT, 0],
        Extrapolation.CLAMP
      ),
      marginTop: interpolate(
        scroll_y.value,
        [0, SEGMENT_COLLAPSE_DISTANCE],
        [2, 0],
        Extrapolation.CLAMP
      ),
      opacity: interpolate(
        scroll_y.value,
        [0, SEGMENT_COLLAPSE_DISTANCE * 0.82],
        [1, 0],
        Extrapolation.CLAMP
      ),
      transform: [
        {
          translateY: interpolate(
            scroll_y.value,
            [0, SEGMENT_COLLAPSE_DISTANCE],
            [0, -18],
            Extrapolation.CLAMP
          ),
        },
      ],
    };
  }, []);

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.canvas }]}>
      <AuthBackground intensity={background_intensity} theme={theme} />
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <Animated.View style={[styles.segmentWrap, segment_wrap_style]}>
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
              {SEGMENT_OPTIONS.map((option) => {
                const is_active = option.key === active_segment;

                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: is_active }}
                    key={option.key}
                    onPress={() => handle_segment_press(option.key)}
                    style={[
                      styles.segmentButton,
                      is_active
                        ? {
                            backgroundColor: theme.colors.accent,
                          }
                        : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.segmentLabel,
                        {
                          color: is_active ? theme.colors.white : theme.colors.inkSoft,
                        },
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>
        </View>

        <View style={styles.content}>
          {render_content({
            active_segment,
            on_scroll,
            theme,
            is_loading_initial,
            is_refreshing,
            error_message,
            has_any_timeline_entries,
            list_ref,
            visible_timeline_entries,
          })}
        </View>
      </SafeAreaView>
    </View>
  );
}

function render_content({
  active_segment,
  on_scroll,
  theme,
  is_loading_initial,
  is_refreshing,
  error_message,
  has_any_timeline_entries,
  list_ref,
  visible_timeline_entries,
}) {
  if (is_loading_initial) {
    return (
      <AuthCard style={styles.stateCard} theme={theme}>
        <RssLoadingView
          body="Fetching subscriptions and recent entries for your first timeline."
          compact
          phase="loading_feeds"
          theme={theme}
          title="Loading your feed"
        />
      </AuthCard>
    );
  } else {
    return (
      <AnimatedFlatList
        contentContainerStyle={[
          styles.listContent,
          visible_timeline_entries.length === 0 ? styles.listContentEmpty : null,
        ]}
        data={visible_timeline_entries}
        keyExtractor={item => item.id}
        ListEmptyComponent={
          error_message && !has_any_timeline_entries ? (
            <AuthCard style={styles.stateCard} theme={theme}>
              <View style={styles.stateCopy}>
                <Text style={[styles.stateTitle, { color: theme.colors.ink }]}>
                  Couldn't load your feed
                </Text>
                <Text style={[styles.stateBody, { color: theme.colors.inkSoft }]}>
                  {error_message}
                </Text>
              </View>
              <PrimaryButton label="Try again" onPress={Feed.retry_bootstrap} theme={theme} />
            </AuthCard>
          ) : (
            <AuthCard style={styles.stateCard} theme={theme}>
              <View style={styles.stateCopy}>
                <Text style={[styles.stateTitle, { color: theme.colors.ink }]}>
                  {get_empty_state_title(active_segment)}
                </Text>
                <Text style={[styles.stateBody, { color: theme.colors.inkSoft }]}>
                  {get_empty_state_body(active_segment)}
                </Text>
              </View>
            </AuthCard>
          )
        }
        onScroll={on_scroll}
        ref={list_ref}
        refreshControl={
          <RefreshControl
            colors={[theme.colors.accentStrong]}
            onRefresh={Feed.retry_bootstrap}
            refreshing={is_refreshing}
            tintColor={theme.colors.accentStrong}
          />
        }
        renderItem={({ item }) => {
          return <FeedTimelineRow entry={item} theme={theme} />;
        }}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      />
    );
  }
}

function FeedTimelineRow({ entry, theme }) {
  const title = resolve_entry_title(entry);
  const summary = resolve_entry_summary(entry);
  const timestamp = format_entry_timestamp(entry.published_at);

  return (
    <View
      style={[
        styles.rowCard,
        {
          backgroundColor: theme.colors.paper,
          borderColor: theme.colors.line,
          opacity: entry.is_read ? 0.72 : 1,
        },
      ]}
    >
      <View style={styles.rowHeader}>
        <View style={styles.sourceWrap}>
          <View
            style={[
              styles.readDot,
              {
                backgroundColor: entry.is_read ? theme.colors.line : theme.colors.accentStrong,
              },
            ]}
          />
          <Text numberOfLines={1} style={[styles.sourceLabel, { color: theme.colors.inkSoft }]}>
            {entry.source || 'Feed'}
          </Text>
        </View>
        <Text style={[styles.timestamp, { color: theme.colors.inkSoft }]}>{timestamp}</Text>
      </View>

      <View style={styles.rowBody}>
        <Text numberOfLines={2} style={[styles.rowTitle, { color: theme.colors.ink }]}>
          {title}
        </Text>
        {summary ? (
          <Text numberOfLines={3} style={[styles.rowSummary, { color: theme.colors.inkSoft }]}>
            {summary}
          </Text>
        ) : null}
      </View>
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
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  segmentWrap: {
    overflow: 'hidden',
  },
  segmentedControl: {
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
  segmentButton: {
    flex: 1,
    minHeight: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  segmentLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
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
  readDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
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
