import React from 'react';
import {
  Animated as RNAnimated,
  FlatList,
  Linking,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useHeaderHeight } from '@react-navigation/elements';
import { MaterialIcons } from '@expo/vector-icons';
import { SFSymbol } from 'react-native-sfsymbols';
import { observer } from 'mobx-react';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { RectButton } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AuthBackground from '../components/auth/AuthBackground';
import AuthCard from '../components/auth/AuthCard';
import { open_micro_blog_entry_post } from '../components/highlights/highlightPostUtils';
import RssLoadingView from '../components/loading/RssLoadingView';
import PrimaryButton from '../components/auth/PrimaryButton';
import FeedTimelineCard from '../components/timeline/FeedTimelineCard';
import { resolve_bookmark_timeline_entry_content } from '../components/timeline/timelineEntryContent';
import AppStore from '../stores/App';
import Bookmarks from '../stores/Bookmarks';
import { getAuthTheme } from '../theme/authTheme';
import { createScaledTextStyles } from '../theme/textScale';

const SCREEN_HORIZONTAL_PADDING = 16;
const LIST_TOP_PADDING = 12;
const LIST_BOTTOM_PADDING = 28;
const TEXT_STYLE_NAMES = [
  'stateTitle',
  'stateBody',
  'sourceAvatarInitial',
  'rowSourceLabel',
  'timestamp',
  'rowTitle',
  'rowSummary',
];

function BookmarksScreen({ navigation, isDark = false }) {
  const accent_palette_id = AppStore.accent_palette_id;
  const theme = getAuthTheme(isDark, accent_palette_id);
  const scaled_text_styles = React.useMemo(() => {
    return createScaledTextStyles(styles, TEXT_STYLE_NAMES);
  }, []);
  const header_height = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const bookmark_entries = Bookmarks.bookmark_entries();
  const error_message = Bookmarks.error_message;
  const has_bookmarks = bookmark_entries.length > 0;
  const is_loading_initial =
    Bookmarks.is_loading && !Bookmarks.has_loaded && !has_bookmarks;
  const is_refreshing = Bookmarks.is_loading && Bookmarks.has_loaded;
  const background_intensity = has_bookmarks ? 0.14 : 1;
  const content_top_padding = header_height + LIST_TOP_PADDING;
  const list_bottom_inset = insets.bottom + LIST_BOTTOM_PADDING;
  const [removing_bookmark_id, set_removing_bookmark_id] = React.useState('');

  React.useEffect(() => {
    Bookmarks.load();
  }, []);

  const handle_entry_press = React.useCallback(
    (entry_id = '') => {
      if (!entry_id) {
        return;
      }

      navigation.navigate('FeedItemDetail', {
        entry_id,
        entry_source: 'bookmark',
      });
    },
    [navigation],
  );

  const handle_entry_menu_action = React.useCallback(
    async (entry = null, menu_action_id = '') => {
      const resolved_entry_id = `${entry?.id || ''}`.trim();
      const original_url = `${entry?.url || ''}`.trim();

      if (!resolved_entry_id) {
        return;
      }

      if (menu_action_id === 'copy_link') {
        if (!original_url) {
          return;
        }

        try {
          await Clipboard.setStringAsync(original_url);
          AppStore.show_toast('Link copied');
        } catch (error) {
          console.warn('Failed to copy link', error);
        }
        return;
      }

      if (menu_action_id === 'new_post') {
        const normalized_post_title = `${entry?.title || ''}`.trim();
        const did_open = await open_micro_blog_entry_post(entry, {
          post_has_title:
            Boolean(normalized_post_title) &&
            normalized_post_title.toLowerCase() !== 'untitled',
          post_source: entry?.source,
          post_title: entry?.title,
          post_url: original_url,
        });

        if (!did_open) {
          AppStore.show_toast('We could not open Micro.blog.');
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

      if (menu_action_id !== 'toggle_bookmark') {
        return;
      }

      if (removing_bookmark_id === resolved_entry_id) {
        return;
      }

      set_removing_bookmark_id(resolved_entry_id);

      try {
        const did_delete = await Bookmarks.delete_bookmark(resolved_entry_id);

        if (did_delete) {
          AppStore.show_toast('Bookmark removed');
        }
      } finally {
        set_removing_bookmark_id('');
      }
    },
    [removing_bookmark_id],
  );

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.canvas }]}>
      <AuthBackground intensity={background_intensity} theme={theme} />
      <View style={styles.safeArea}>
        {is_loading_initial ? (
          <View
            style={[
              styles.stateScreen,
              {
                paddingBottom: list_bottom_inset,
                paddingHorizontal: SCREEN_HORIZONTAL_PADDING,
                paddingTop: content_top_padding,
              },
            ]}
          >
            <AuthCard style={styles.stateCard} theme={theme}>
              <RssLoadingView
                body="Recent saved posts will show up here as soon as Micro.blog responds."
                theme={theme}
                title="Loading your bookmarks"
              />
            </AuthCard>
          </View>
        ) : (
          <FlatList
            contentInsetAdjustmentBehavior="never"
            contentContainerStyle={[
              styles.listContent,
              {
                paddingBottom: list_bottom_inset,
                paddingHorizontal: SCREEN_HORIZONTAL_PADDING,
                paddingTop: content_top_padding,
              },
              !has_bookmarks ? styles.listContentEmpty : null,
            ]}
            data={bookmark_entries}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={
              error_message ? (
                <AuthCard style={styles.stateCard} theme={theme}>
                  <View style={styles.stateCopy}>
                    <Text
                      style={[
                        styles.stateTitle,
                        scaled_text_styles.stateTitle,
                        { color: theme.colors.ink },
                      ]}
                    >
                      Couldn't load your bookmarks
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
                    onPress={Bookmarks.refresh}
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
                      No bookmarks yet
                    </Text>
                    <Text
                      style={[
                        styles.stateBody,
                        scaled_text_styles.stateBody,
                        { color: theme.colors.inkSoft },
                      ]}
                    >
                      Posts you save on Micro.blog will collect here for later reading.
                    </Text>
                  </View>
                </AuthCard>
              )
            }
            refreshControl={
              <RefreshControl
                colors={[theme.colors.accentStrong]}
                onRefresh={Bookmarks.refresh}
                progressViewOffset={content_top_padding}
                refreshing={is_refreshing}
                tintColor={theme.colors.accentStrong}
              />
            }
            renderItem={({ item }) => {
              const timeline_entry_content =
                resolve_bookmark_timeline_entry_content(item);

              return (
                <BookmarkSwipeRow
                  entry={item}
                  is_busy={removing_bookmark_id === item.id}
                  onDeletePress={handle_entry_menu_action}
                  theme={theme}
                >
                  <FeedTimelineCard
                    accessibility_label={`Open ${timeline_entry_content.display_title}`}
                    avatar_url={item.avatar_url}
                    display_title={timeline_entry_content.display_title}
                    menu_actions={get_bookmark_menu_actions({
                      entry: item,
                      theme,
                    })}
                    onMenuAction={(menu_action_id) => {
                      handle_entry_menu_action(item, menu_action_id);
                    }}
                    onPress={() => handle_entry_press(item.id)}
                    row_opacity={
                      removing_bookmark_id === item.id
                        ? 0.64
                        : timeline_entry_content.row_opacity
                    }
                    scaled_text_styles={scaled_text_styles}
                    secondary_source_label={
                      timeline_entry_content.secondary_source_label
                    }
                    show_bookmark_indicator={
                      timeline_entry_content.show_bookmark_indicator
                    }
                    source_label={timeline_entry_content.source_label}
                    summary={timeline_entry_content.summary}
                    theme={theme}
                    timestamp={timeline_entry_content.timestamp}
                  />
                </BookmarkSwipeRow>
              );
            }}
            showsVerticalScrollIndicator={false}
            style={styles.list}
          />
        )}
      </View>
    </View>
  );
}

function BookmarkSwipeRow({
  children,
  entry = null,
  is_busy = false,
  onDeletePress,
  theme,
}) {
  const swipeable_ref = React.useRef(null);
  const [is_action_pressed, set_is_action_pressed] = React.useState(false);

  if (Platform.OS !== 'ios' || is_busy) {
    return <View style={styles.rowWrap}>{children}</View>;
  }

  return (
    <Swipeable
      ref={swipeable_ref}
      containerStyle={styles.rowWrap}
      enableTrackpadTwoFingerGesture={true}
      friction={1}
      overshootFriction={8}
      overshootRight={false}
      renderRightActions={(progress) => {
        const action_opacity = progress.interpolate({
          inputRange: [0, 0.2, 0.85, 1],
          outputRange: [0, 0, 1, 1],
          extrapolate: 'clamp',
        });

        return (
          <View style={styles.rowSwipeActionsWrap}>
            <RectButton
              activeOpacity={1}
              onActiveStateChange={set_is_action_pressed}
              onPress={() => {
                swipeable_ref.current?.close?.();
                set_is_action_pressed(false);
                onDeletePress?.(entry, 'toggle_bookmark');
              }}
              rippleColor="transparent"
              style={styles.rowSwipeActionButton}
              underlayColor="transparent"
            >
              <RNAnimated.View style={{ opacity: action_opacity }}>
                <View
                  style={[
                    styles.rowSwipeActionCircle,
                    {
                      backgroundColor: theme.colors.danger,
                    },
                  ]}
                >
                  {is_action_pressed ? (
                    <View style={styles.rowSwipeActionCirclePressed} />
                  ) : null}
                  {Platform.OS === 'ios' ? (
                    <SFSymbol
                      color="#ffffff"
                      multicolor={false}
                      name="trash"
                      style={styles.rowSwipeActionSymbol}
                    />
                  ) : (
                    <MaterialIcons
                      color="#ffffff"
                      name="delete-outline"
                      size={22}
                    />
                  )}
                </View>
              </RNAnimated.View>
            </RectButton>
          </View>
        );
      }}
      rightThreshold={40}
    >
      {children}
    </Swipeable>
  );
}

function get_bookmark_menu_actions({ entry = null, theme }) {
  if (!entry) {
    return [];
  }

  const icon_color = theme?.colors?.ink;
  const original_url = `${entry?.url || ''}`.trim();
  const actions = [];

  if (original_url) {
    actions.push({
      id: 'new_post',
      image: Platform.select({
        ios: 'square.and.pencil',
      }),
      imageColor: icon_color,
      title: 'New Post...',
    });

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
    id: 'toggle_bookmark',
    image: Platform.select({
      ios: 'star',
    }),
    imageColor: icon_color,
    title: 'Unbookmark',
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

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  rowWrap: {
    marginBottom: 14,
  },
  listContent: {
    paddingBottom: 0,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  stateScreen: {
    flex: 1,
  },
  stateCard: {
    gap: 18,
    minHeight: 220,
    justifyContent: 'center',
  },
  stateCopy: {
    alignItems: 'center',
    gap: 10,
  },
  stateTitle: {
    // fontFamily: 'Newsreader_600SemiBold',
    fontSize: 18,
    lineHeight: 28,
    textAlign: 'center',
  },
  stateBody: {
    fontSize: 15,
    lineHeight: 23,
    maxWidth: 320,
    textAlign: 'center',
  },
  sourceAvatarInitial: {
    fontFamily: 'Newsreader_700Bold',
    fontSize: 14,
    lineHeight: 15,
  },
  timestamp: {
    fontSize: 13,
    lineHeight: 18,
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
  rowSwipeActionsWrap: {
    alignItems: 'stretch',
    justifyContent: 'center',
    marginLeft: 12,
  },
  rowSwipeActionButton: {
    alignItems: 'center',
    height: '100%',
    justifyContent: 'center',
    width: 74,
  },
  rowSwipeActionCircle: {
    alignItems: 'center',
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  rowSwipeActionCirclePressed: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
    borderRadius: 22,
  },
  rowSwipeActionSymbol: {
    height: 20,
    width: 20,
  },
});

export default observer(BookmarksScreen);
