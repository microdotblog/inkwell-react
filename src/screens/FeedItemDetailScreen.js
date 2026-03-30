import React from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { MenuView } from '@react-native-menu/menu';
import { useHeaderHeight } from '@react-navigation/elements';
import { MaterialIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { observer } from 'mobx-react';
import RenderHtml, {
  HTMLContentModel,
  TChildrenRenderer,
  HTMLElementModel,
  defaultHTMLElementModels,
  useTNodeChildrenProps,
} from 'react-native-render-html';
import Animated, {
  FadeInDown,
  FadeOutUp,
  LinearTransition,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AuthBackground from '../components/auth/AuthBackground';
import { fetch_micro_blog_conversation_replies } from '../api/MicroBlogFeeds';
import AppStore from '../stores/App';
import Bookmarks from '../stores/Bookmarks';
import Feed from '../stores/Feed';
import Tokens from '../stores/Tokens';
import { getAuthTheme } from '../theme/authTheme';
import {
  createScaledTextStyles,
  scaleTextMetric,
} from '../theme/textScale';

const READER_HORIZONTAL_PADDING = 20;
const READER_BOTTOM_PADDING = 32;
const READER_COLUMN_MAX_WIDTH = 760;
const READER_AVATAR_SIZE = 42;
const READER_AVATAR_TRANSITION_MS = 180;
const READER_TITLE_FONT_SIZE = 44;
const READER_TITLE_LINE_HEIGHT = 50;
const READER_TITLE_TOP_MARGIN = 18;
const READER_PARAGRAPH_SPACING = 18;
const IOS_HEADER_TITLE_REVEAL_OFFSET = 12;
const RECAP_FAVICON_SIZE = 22;
const RECAP_SETTINGS_LAYOUT_TRANSITION = LinearTransition.duration(180);
const RECAP_SETTINGS_ROW_ENTERING = FadeInDown.duration(180);
const RECAP_SETTINGS_ROW_EXITING = FadeOutUp.duration(140);
const REPLY_AVATAR_SIZE = 30;
const READER_PANE_CONTROL_INSET = 3;
const READER_PANE_CONTROL_HEIGHT = 40;
const READER_PANE_CONTROL_RADIUS = READER_PANE_CONTROL_HEIGHT / 2;
const READER_PANE_BUTTON_HEIGHT =
  READER_PANE_CONTROL_HEIGHT - READER_PANE_CONTROL_INSET * 2;
const READER_PANE_BUTTON_RADIUS = READER_PANE_BUTTON_HEIGHT / 2;
const READER_REPLY_CONTENT_WIDTH_OFFSET = 64;
const RECAP_EMAIL_DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];
const READER_IGNORED_DOM_TAGS = [
  'script',
  'style',
  'iframe',
  'embed',
  'object',
  'form',
  'input',
  'button',
  'select',
  'textarea',
  'video',
  'audio',
  'source',
  'link',
  'meta',
];
const READER_HTML_MODELS = {
  img: defaultHTMLElementModels.img.extend({
    contentModel: HTMLContentModel.mixed,
  }),
  'recap-card': HTMLElementModel.fromCustomModel({
    tagName: 'recap-card',
    contentModel: HTMLContentModel.block,
  }),
  'recap-header-group': HTMLElementModel.fromCustomModel({
    tagName: 'recap-header-group',
    contentModel: HTMLContentModel.block,
  }),
  'recap-header': HTMLElementModel.fromCustomModel({
    tagName: 'recap-header',
    contentModel: HTMLContentModel.mixed,
  }),
  'recap-topics': HTMLElementModel.fromCustomModel({
    tagName: 'recap-topics',
    contentModel: HTMLContentModel.block,
  }),
  'recap-photo-strip': HTMLElementModel.fromCustomModel({
    tagName: 'recap-photo-strip',
    contentModel: HTMLContentModel.block,
  }),
  'recap-quote': HTMLElementModel.fromCustomModel({
    tagName: 'recap-quote',
    contentModel: HTMLContentModel.block,
  }),
};
const TEXT_STYLE_NAMES = [
  'sourceLabel',
  'hostLabel',
  'feedDetailSeparator',
  'dateLabel',
  'title',
  'recapBody',
  'readerPaneButtonLabel',
  'replyAuthor',
  'replyDate',
  'recapSettingsTitle',
  'recapSettingsBody',
  'recapDayChipLabel',
  'recapBookmarkError',
  'recapHeaderTitle',
  'recapFaviconInitial',
  'recapTopicLabel',
  'recapPhotoTileFallbackLabel',
  'recapQuoteButtonLabel',
  'unavailableTitle',
  'unavailableBody',
  'openOriginalLabel',
];

function FeedItemDetailScreen({ navigation, route, isDark = false }) {
  const accent_palette_id = AppStore.accent_palette_id;
  const text_scale = AppStore.text_scale;
  const theme = getAuthTheme(isDark, accent_palette_id);
  const scaled_text_styles = React.useMemo(() => {
    return createScaledTextStyles(styles, TEXT_STYLE_NAMES, text_scale);
  }, [text_scale]);
  const header_height = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const detail_mode = resolve_detail_mode(route?.params?.mode);
  const entry_source = resolve_entry_source(route?.params?.entry_source);
  const entry_id = `${route?.params?.entry_id || ''}`.trim();
  const entry =
    detail_mode === 'entry'
      ? entry_source === 'bookmark'
        ? Bookmarks.bookmark_entry_snapshot(entry_id)
        : entry_source === 'subscription_feed'
          ? Feed.subscription_feed_entry_snapshot(entry_id)
          : Feed.timeline_entry_snapshot(entry_id)
      : null;
  const recap =
    detail_mode === 'recap' ? Feed.active_recap_snapshot() : null;
  const source_label = `${entry?.source || 'Feed'}`.trim() || 'Feed';
  const reader_title = resolve_reader_title(entry);
  const formatted_date = format_reader_date(entry?.published_at);
  const source_url = normalize_http_url(entry?.source_url);
  const original_url = normalize_http_url(entry?.url);
  const resolved_entry_id = `${entry?.id || entry_id || ''}`.trim();
  const source_host = resolve_host_label(source_url || original_url);
  const should_show_reader_title = Boolean(reader_title);
  const reader_html = create_reader_body_html(entry);
  const sanitized_reader_html = sanitize_reader_html(reader_html);
  const recap_entry_count = recap?.entry_ids?.length || 0;
  const recap_html = `${recap?.html || ''}`.trim();
  const decorated_recap_html = decorate_recap_html(recap_html);
  const sanitized_recap_html = sanitize_reader_html(decorated_recap_html);
  const has_entry_body = Boolean(sanitized_reader_html);
  const has_recap_body = Boolean(sanitized_recap_html);
  const is_loading_recap_email_settings =
    Feed.is_loading_recap_email_settings;
  const is_saving_recap_email_settings =
    Feed.is_saving_recap_email_settings;
  const recap_email_day = Feed.recap_email_day;
  const is_recap_email_enabled = Feed.is_recap_email_enabled();
  const recap_bookmark_error_message = Feed.recap_bookmark_error_message;
  const recap_bookmarked_quote_urls = Feed.recap_bookmarked_quote_urls.slice();
  const bookmarking_recap_quote_url =
    `${Feed.bookmarking_recap_quote_url || ''}`.trim();
  const [active_pane, set_active_pane] = React.useState('post');
  const [is_loading_replies, set_is_loading_replies] = React.useState(false);
  const [replies, set_replies] = React.useState([]);
  const [is_ios_header_title_visible, set_is_ios_header_title_visible] =
    React.useState(false);
  const is_ios_header_title_visible_ref = React.useRef(false);
  const replies_request_token_ref = React.useRef(0);
  const header_title =
    detail_mode === 'recap' ? 'Reading Recap' : source_label;
  const has_entry_menu =
    detail_mode === 'entry' && Boolean(entry) && Boolean(resolved_entry_id);
  const is_entry_bookmarked =
    entry_source === 'bookmark' ? Boolean(entry) : Boolean(entry?.is_bookmarked);
  const toast_top_offset = header_height + 10;
  const content_top_padding =
    header_height + (Platform.OS === 'ios' ? 0 : 12);
  const header_background_color =
    resolve_translucent_header_background_color(theme, Platform.OS);
  const header_title_font_size = scaleTextMetric(17, text_scale);
  const reply_count = replies.length;
  const should_show_reply_tabs =
    detail_mode === 'entry' && !is_loading_replies && reply_count > 0;
  const entry_menu_actions = React.useMemo(() => {
    return get_entry_menu_actions({
      entry,
      entry_source,
      is_bookmarked: is_entry_bookmarked,
      original_url,
      theme,
    });
  }, [entry, entry_source, is_entry_bookmarked, original_url, theme]);
  const recap_renderers = React.useMemo(() => {
    const bookmarked_quote_url_set = new Set(recap_bookmarked_quote_urls);

    return {
      'recap-card': (props) => {
        return (
          <RecapCardRenderer
            {...props}
            theme={theme}
          />
        );
      },
      'recap-header-group': (props) => {
        return (
          <RecapHeaderGroupRenderer
            {...props}
            theme={theme}
          />
        );
      },
      'recap-header': (props) => {
        return (
          <RecapHeaderRenderer
            {...props}
            scaled_text_styles={scaled_text_styles}
            theme={theme}
          />
        );
      },
      'recap-topics': (props) => {
        return (
          <RecapTopicsRenderer
            {...props}
            scaled_text_styles={scaled_text_styles}
            theme={theme}
          />
        );
      },
      'recap-photo-strip': (props) => {
        return (
          <RecapPhotoStripRenderer
            {...props}
            scaled_text_styles={scaled_text_styles}
            theme={theme}
          />
        );
      },
      'recap-quote': (props) => {
        return (
          <RecapQuoteRenderer
            {...props}
            bookmarked_quote_url_set={bookmarked_quote_url_set}
            bookmarking_quote_url={bookmarking_recap_quote_url}
            onBookmarkPress={(bookmark_url) =>
              Feed.bookmark_recap_quote(bookmark_url)
            }
            scaled_text_styles={scaled_text_styles}
            theme={theme}
          />
        );
      },
    };
  }, [
    bookmarking_recap_quote_url,
    recap_bookmarked_quote_urls.join('|'),
    scaled_text_styles,
    theme,
  ]);
  const recap_dom_visitors = React.useMemo(() => {
    return create_recap_dom_visitors(theme);
  }, [theme]);

  const handle_scroll = React.useCallback((event) => {
    if (Platform.OS !== 'ios') {
      return;
    }

    const offset_y = Math.max(event?.nativeEvent?.contentOffset?.y || 0, 0);
    const next_visibility = offset_y > IOS_HEADER_TITLE_REVEAL_OFFSET;

    if (next_visibility === is_ios_header_title_visible_ref.current) {
      return;
    }

    is_ios_header_title_visible_ref.current = next_visibility;
    set_is_ios_header_title_visible(next_visibility);
  }, []);

  React.useEffect(() => {
    if (detail_mode === 'recap' && recap) {
      Feed.load_recap_email_settings();
    }
  }, [detail_mode, recap?.requested_at]);

  React.useEffect(() => {
    replies_request_token_ref.current += 1;
    const request_token = replies_request_token_ref.current;

    set_active_pane('post');
    set_replies([]);
    set_is_loading_replies(false);

    if (detail_mode !== 'entry' || !original_url) {
      return;
    }

    let did_cancel = false;
    set_is_loading_replies(true);

    async function load_replies() {
      try {
        await Tokens.hydrate();
        const user_token = Tokens.get_user_token();

        if (!user_token) {
          return;
        }

        const payload = await fetch_micro_blog_conversation_replies({
          token: user_token,
          post_url: original_url,
        });

        if (
          did_cancel ||
          replies_request_token_ref.current !== request_token
        ) {
          return;
        }

        set_replies(normalize_conversation_replies(payload?.items));
      } catch (error) {
        if (
          did_cancel ||
          replies_request_token_ref.current !== request_token
        ) {
          return;
        }

        console.warn('Failed to load conversation replies', error);
        set_replies([]);
      } finally {
        if (
          did_cancel ||
          replies_request_token_ref.current !== request_token
        ) {
          return;
        }

        set_is_loading_replies(false);
      }
    }

    load_replies();

    return () => {
      did_cancel = true;
    };
  }, [detail_mode, entry_id, original_url]);

  React.useEffect(() => {
    if (active_pane === 'replies' && reply_count === 0) {
      set_active_pane('post');
    }
  }, [active_pane, reply_count]);

  const handle_post_pane_press = React.useCallback(() => {
    set_active_pane('post');
  }, []);

  const handle_replies_pane_press = React.useCallback(() => {
    if (reply_count === 0) {
      return;
    }

    set_active_pane('replies');
  }, [reply_count]);

  const handle_copy_link = React.useCallback(async () => {
    if (!original_url) {
      return false;
    }

    try {
      await Clipboard.setStringAsync(original_url);
      AppStore.show_toast('Link copied', {
        top_offset: toast_top_offset,
      });
      return true;
    } catch (error) {
      console.warn('Failed to copy link', error);
      return false;
    }
  }, [original_url, toast_top_offset]);

  const handle_entry_menu_action = React.useCallback(
    async (menu_action_id = '') => {
      if (!has_entry_menu) {
        return;
      }

      if (menu_action_id === 'copy_link') {
        await handle_copy_link();
        return;
      }

      if (menu_action_id === 'open_web') {
        await open_external_url(original_url);
        return;
      }

      if (menu_action_id === 'toggle_read') {
        if (entry_source === 'bookmark') {
          return;
        }

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

      if (entry_source === 'bookmark') {
        const did_delete = await Bookmarks.delete_bookmark(resolved_entry_id);

        if (did_delete) {
          AppStore.show_toast('Bookmark removed', {
            top_offset: toast_top_offset,
          });

          if (typeof navigation.canGoBack === 'function' && navigation.canGoBack()) {
            navigation.goBack();
          } else {
            navigation.navigate('Bookmarks');
          }
        }
        return;
      }

      if (is_entry_bookmarked) {
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
    [
      entry?.is_read,
      entry_source,
      handle_copy_link,
      has_entry_menu,
      is_entry_bookmarked,
      navigation,
      original_url,
      resolved_entry_id,
      toast_top_offset,
    ],
  );

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerBackButtonDisplayMode: 'minimal',
      headerBackground: () => (
        <View
          pointerEvents="none"
          style={[
            styles.headerBackdrop,
            {
              backgroundColor: header_background_color,
            },
          ]}
        />
      ),
      headerStyle: {
        backgroundColor: 'transparent',
      },
      headerTransparent: true,
      headerRight: has_entry_menu
        ? () => (
            <HeaderEntryMenuButton
              is_dark={isDark}
              menu_actions={entry_menu_actions}
              onMenuAction={handle_entry_menu_action}
              theme={theme}
            />
          )
        : undefined,
      headerShadowVisible: false,
      headerTintColor: theme.colors.ink,
      headerTitleStyle: {
        color: theme.colors.ink,
        fontSize: header_title_font_size,
        fontWeight: '600',
      },
      title:
        Platform.OS === 'ios'
          ? is_ios_header_title_visible
            ? header_title
            : ''
          : header_title,
    });
  }, [
    detail_mode,
    entry_menu_actions,
    handle_entry_menu_action,
    header_background_color,
    header_title_font_size,
    header_title,
    has_entry_menu,
    isDark,
    is_ios_header_title_visible,
    navigation,
    theme,
  ]);

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.canvas }]}>
      <AuthBackground
        intensity={detail_mode === 'recap' || entry ? 0.1 : 1}
        theme={theme}
      />
      <ScrollView
        alwaysBounceVertical
        bounces
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={[
          styles.content,
          {
            paddingBottom: insets.bottom + READER_BOTTOM_PADDING,
            paddingHorizontal: READER_HORIZONTAL_PADDING,
            paddingTop: content_top_padding,
          },
        ]}
        onScroll={handle_scroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        {detail_mode === 'entry' && entry ? (
          <EntryReaderView
            active_pane={active_pane}
            entry={entry}
            formatted_date={formatted_date}
            has_renderable_body={has_entry_body}
            onPressPostPane={handle_post_pane_press}
            onPressRepliesPane={handle_replies_pane_press}
            original_url={original_url}
            replies={replies}
            reader_html={sanitized_reader_html}
            reader_title={reader_title}
            reply_count={reply_count}
            should_show_reply_tabs={should_show_reply_tabs}
            should_show_reader_title={should_show_reader_title}
            source_host={source_host}
            source_label={source_label}
            source_url={source_url}
            scaled_text_styles={scaled_text_styles}
            theme={theme}
            text_scale={text_scale}
            width={width}
          />
        ) : null}

        {detail_mode === 'recap' && recap ? (
          <RecapReaderView
            has_renderable_body={has_recap_body}
            is_loading_recap_email_settings={is_loading_recap_email_settings}
            is_recap_email_enabled={is_recap_email_enabled}
            is_saving_recap_email_settings={is_saving_recap_email_settings}
            recap_bookmark_error_message={recap_bookmark_error_message}
            recap_email_day={recap_email_day}
            recap_entry_count={recap_entry_count}
            recap_html={sanitized_recap_html}
            recap_dom_visitors={recap_dom_visitors}
            recap_renderers={recap_renderers}
            scaled_text_styles={scaled_text_styles}
            theme={theme}
            text_scale={text_scale}
            width={width}
          />
        ) : null}

        {detail_mode === 'entry' && !entry ? (
          <UnavailableScreen
            body={
              entry_source === 'bookmark'
                ? "It may have been removed from your bookmarks, or the list refreshed before the reader finished opening it."
                : "It may have scrolled out of the current timeline, or the feed refreshed before the reader finished opening it."
            }
            scaled_text_styles={scaled_text_styles}
            theme={theme}
            title={
              entry_source === 'bookmark'
                ? "This bookmark isn't available right now."
                : "This post isn't available right now."
            }
          />
        ) : null}

        {detail_mode === 'recap' && !recap ? (
          <UnavailableScreen
            body="Build a Reading Recap from the Fading segment first, then open it here."
            scaled_text_styles={scaled_text_styles}
            theme={theme}
            title="This recap isn't available right now."
          />
        ) : null}
      </ScrollView>
    </View>
  );
}

function EntryReaderView({
  active_pane = 'post',
  entry,
  formatted_date,
  has_renderable_body = false,
  onPressPostPane,
  onPressRepliesPane,
  original_url = '',
  replies = [],
  reader_html = '',
  reader_title = '',
  reply_count = 0,
  should_show_reply_tabs = false,
  should_show_reader_title = false,
  source_host = '',
  source_label = '',
  source_url = '',
  scaled_text_styles,
  theme,
  text_scale = 1,
  width = 0,
}) {
  return (
    <View style={styles.readerColumn}>
      <View
        style={[
          styles.masthead,
          {
            borderBottomColor: theme.colors.line,
          },
        ]}
      >
        <View style={styles.feedHeaderRow}>
          <FeedDetailAvatar
            avatar_url={entry.avatar_url}
            source={source_label}
            size={READER_AVATAR_SIZE}
            theme={theme}
          />
          <View style={styles.feedMeta}>
            <View style={styles.feedTitleRow}>
              <MetaLink
                color={theme.colors.ink}
                label={source_label}
                onPress={source_url ? () => open_external_url(source_url) : null}
                style={[styles.sourceLabel, scaled_text_styles.sourceLabel]}
              />
            </View>
            {source_host || formatted_date ? (
              <View style={styles.feedDetailsRow}>
                {source_host ? (
                  <Text
                    style={[
                      styles.hostLabel,
                      scaled_text_styles.hostLabel,
                      { color: theme.colors.inkSoft },
                    ]}
                  >
                    {source_host}
                  </Text>
                ) : null}
                {source_host && formatted_date ? (
                  <Text
                    style={[
                      styles.feedDetailSeparator,
                      scaled_text_styles.feedDetailSeparator,
                      { color: theme.colors.inkSoft },
                    ]}
                  >
                    •
                  </Text>
                ) : null}
                {formatted_date ? (
                  <MetaLink
                    color={theme.colors.inkSoft}
                    label={formatted_date}
                    onPress={
                      original_url ? () => open_external_url(original_url) : null
                    }
                    style={[styles.dateLabel, scaled_text_styles.dateLabel]}
                  />
                ) : null}
              </View>
            ) : null}
          </View>
        </View>

        {should_show_reader_title ? (
          <View style={styles.titleWrap}>
            <Text
              style={[
                styles.title,
                scaled_text_styles.title,
                { color: theme.colors.ink },
              ]}
            >
              {reader_title}
            </Text>
          </View>
        ) : null}
      </View>

      {should_show_reply_tabs ? (
        <ReaderPaneTabs
          active_pane={active_pane}
          onPressPostPane={onPressPostPane}
          onPressRepliesPane={onPressRepliesPane}
          reply_count={reply_count}
          scaled_text_styles={scaled_text_styles}
          theme={theme}
        />
      ) : null}

      <View
        style={[
          styles.bodySection,
          should_show_reply_tabs ? styles.bodySectionWithPaneTabs : null,
        ]}
      >
        {active_pane === 'replies' ? (
          <RepliesListView
            replies={replies}
            scaled_text_styles={scaled_text_styles}
            theme={theme}
            text_scale={text_scale}
            width={width}
          />
        ) : has_renderable_body ? (
          <ReaderHtml
            html={reader_html}
            scaled_text_styles={scaled_text_styles}
            theme={theme}
            text_scale={text_scale}
            width={width}
          />
        ) : (
          <UnavailableBodyCard
            body="This item doesn't include readable body content in the current timeline payload."
            can_open_original={Boolean(original_url)}
            on_open_original={() => open_external_url(original_url)}
            scaled_text_styles={scaled_text_styles}
            theme={theme}
            title="No readable preview yet."
          />
        )}
      </View>
    </View>
  );
}

function ReaderPaneTabs({
  active_pane = 'post',
  onPressPostPane,
  onPressRepliesPane,
  reply_count = 0,
  scaled_text_styles,
  theme,
}) {
  const reply_label = get_reply_count_label(reply_count);

  return (
    <View style={styles.readerPaneTabsWrap}>
      <View
        style={[
          styles.readerPaneTabs,
          {
            backgroundColor: theme.colors.badge,
            borderColor: theme.colors.line,
            shadowColor: theme.colors.shadow,
          },
        ]}
      >
        <ReaderPaneButton
          is_active={active_pane === 'post'}
          label="Post"
          onPress={onPressPostPane}
          scaled_text_styles={scaled_text_styles}
          theme={theme}
        />
        <ReaderPaneButton
          is_active={active_pane === 'replies'}
          label={reply_label}
          onPress={onPressRepliesPane}
          scaled_text_styles={scaled_text_styles}
          theme={theme}
        />
      </View>
    </View>
  );
}

function ReaderPaneButton({
  is_active = false,
  label = '',
  onPress,
  scaled_text_styles,
  theme,
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: is_active }}
      onPress={onPress}
      style={({ pressed }) => {
        return [
          styles.readerPaneButton,
          {
            backgroundColor: is_active
              ? theme.colors.paper
              : 'transparent',
            borderColor: is_active ? theme.colors.line : 'transparent',
            opacity: pressed ? 0.84 : 1,
          },
        ];
      }}
    >
      <Text
        style={[
          styles.readerPaneButtonLabel,
          scaled_text_styles.readerPaneButtonLabel,
          {
            color: is_active
              ? theme.colors.ink
              : theme.colors.inkSoft,
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function RepliesListView({
  replies = [],
  scaled_text_styles,
  theme,
  text_scale = 1,
  width = 0,
}) {
  return (
    <View style={styles.repliesList}>
      {replies.map((reply, index) => {
        return (
          <ReplyRow
            key={resolve_reply_key(reply, index)}
            reply={reply}
            scaled_text_styles={scaled_text_styles}
            theme={theme}
            text_scale={text_scale}
            width={width}
          />
        );
      })}
    </View>
  );
}

function ReplyRow({
  reply,
  scaled_text_styles,
  theme,
  text_scale = 1,
  width = 0,
}) {
  const author_name = get_reply_author_name(reply);
  const author_url = normalize_http_url(reply?.author?.url);
  const formatted_date = format_reply_date(reply?.date_published);
  const reply_html = resolve_reply_html(reply);

  return (
    <View style={styles.replyRow}>
      <FeedDetailAvatar
        avatar_url={reply?.author?.avatar}
        size={REPLY_AVATAR_SIZE}
        source={author_name}
        theme={theme}
      />
      <View style={styles.replyBody}>
        <MetaLink
          color={theme.colors.ink}
          label={author_name}
          onPress={author_url ? () => open_external_url(author_url) : null}
          style={[styles.replyAuthor, scaled_text_styles.replyAuthor]}
        />
        {reply_html ? (
          <ReplyHtml
            html={reply_html}
            text_scale={text_scale}
            theme={theme}
            width={width}
          />
        ) : null}
        {formatted_date ? (
          <Text
            style={[
              styles.replyDate,
              scaled_text_styles.replyDate,
              { color: theme.colors.inkSoft },
            ]}
          >
            {formatted_date}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function ReplyHtml({
  html = '',
  text_scale = 1,
  theme,
  width = 0,
}) {
  const reply_font_size = scaleTextMetric(15, text_scale);
  const reply_line_height = scaleTextMetric(23, text_scale);

  return (
    <RenderHtml
      baseStyle={{
        color: theme.colors.inkSoft,
        fontSize: reply_font_size,
        lineHeight: reply_line_height,
      }}
      contentWidth={Math.max(
        Math.min(
          width - READER_HORIZONTAL_PADDING * 2 - READER_REPLY_CONTENT_WIDTH_OFFSET,
          READER_COLUMN_MAX_WIDTH,
        ),
        0,
      )}
      enableExperimentalMarginCollapsing
      ignoredDomTags={READER_IGNORED_DOM_TAGS}
      renderersProps={{
        a: {
          onPress: (_event, href) => {
            if (href) {
              open_external_url(href);
            }
          },
        },
      }}
      source={{
        html,
      }}
      tagsStyles={{
        a: {
          color: theme.colors.accentStrong,
          textDecorationLine: 'none',
        },
        blockquote: {
          borderLeftColor: theme.colors.line,
          borderLeftWidth: 3,
          color: theme.colors.inkSoft,
          marginLeft: 0,
          paddingLeft: 12,
        },
        body: {
          color: theme.colors.inkSoft,
          fontSize: reply_font_size,
          lineHeight: reply_line_height,
        },
        p: {
          color: theme.colors.inkSoft,
          fontSize: reply_font_size,
          lineHeight: reply_line_height,
          marginBottom: 10,
          marginTop: 0,
        },
      }}
    />
  );
}

function RecapReaderView({
  has_renderable_body = false,
  is_loading_recap_email_settings = false,
  is_recap_email_enabled = false,
  is_saving_recap_email_settings = false,
  recap_bookmark_error_message = '',
  recap_email_day = '',
  recap_entry_count = 0,
  recap_html = '',
  recap_dom_visitors,
  recap_renderers,
  scaled_text_styles,
  theme,
  text_scale = 1,
  width = 0,
}) {
  return (
    <View style={styles.readerColumn}>
      <View
        style={[
          styles.masthead,
          {
            borderBottomColor: theme.colors.line,
          },
        ]}
      >
        <View style={styles.titleWrapCompact}>
          <Text
            style={[
              styles.title,
              scaled_text_styles.title,
              { color: theme.colors.ink },
            ]}
          >
            Reading Recap
          </Text>
        </View>
        <Text
          style={[
            styles.recapBody,
            scaled_text_styles.recapBody,
            { color: theme.colors.inkSoft },
          ]}
        >
          {get_recap_summary_copy(recap_entry_count)}
        </Text>
      </View>

      <View style={styles.bodySection}>
        <RecapEmailSettingsCard
          is_enabled={is_recap_email_enabled}
          is_loading={is_loading_recap_email_settings}
          is_saving={is_saving_recap_email_settings}
          selected_day={recap_email_day}
          scaled_text_styles={scaled_text_styles}
          theme={theme}
          onSelectDay={(dayofweek) => Feed.update_recap_email_day(dayofweek)}
        />

        {recap_bookmark_error_message ? (
          <Text
            style={[
              styles.recapBookmarkError,
              scaled_text_styles.recapBookmarkError,
              { color: theme.colors.accentStrong },
            ]}
          >
            {recap_bookmark_error_message}
          </Text>
        ) : null}

        {has_renderable_body ? (
          <ReaderHtml
            classes_styles={build_recap_classes_styles(theme, text_scale)}
            custom_element_models={READER_HTML_MODELS}
            dom_visitors={recap_dom_visitors}
            html={recap_html}
            renderers={recap_renderers}
            scaled_text_styles={scaled_text_styles}
            theme={theme}
            text_scale={text_scale}
            width={width}
          />
        ) : (
          <UnavailableBodyCard
            body="We couldn't render the current recap payload."
            can_open_original={false}
            scaled_text_styles={scaled_text_styles}
            theme={theme}
            title="No recap yet."
          />
        )}
      </View>
    </View>
  );
}

function ReaderHtml({
  classes_styles,
  custom_element_models = READER_HTML_MODELS,
  dom_visitors,
  html = '',
  renderers,
  scaled_text_styles,
  theme,
  text_scale = 1,
  width = 0,
}) {
  const body_font_size = scaleTextMetric(18, text_scale);
  const body_line_height = scaleTextMetric(29, text_scale);

  return (
    <RenderHtml
      baseStyle={{
        color: theme.colors.ink,
        fontSize: body_font_size,
        lineHeight: body_line_height,
      }}
      classesStyles={{
        lead: {
          color: theme.colors.inkSoft,
        },
        ...classes_styles,
      }}
      contentWidth={Math.max(
        Math.min(width - READER_HORIZONTAL_PADDING * 2, READER_COLUMN_MAX_WIDTH),
        0,
      )}
      customHTMLElementModels={custom_element_models}
      domVisitors={dom_visitors}
      enableExperimentalMarginCollapsing
      ignoredDomTags={READER_IGNORED_DOM_TAGS}
      renderers={renderers}
      renderersProps={{
        a: {
          onPress: (_event, href) => {
            if (href) {
              open_external_url(href);
            }
          },
        },
      }}
      source={{
        html,
      }}
      tagsStyles={{
        a: {
          color: theme.colors.accentStrong,
          textDecorationLine: 'none',
        },
        blockquote: {
          borderLeftColor: theme.colors.line,
          borderLeftWidth: 3,
          color: theme.colors.inkSoft,
          marginLeft: 0,
          paddingLeft: 16,
        },
        body: {
          color: theme.colors.ink,
          fontSize: body_font_size,
          lineHeight: body_line_height,
        },
        h1: {
          color: theme.colors.ink,
          fontFamily: 'Newsreader_600SemiBold',
          fontSize: scaleTextMetric(30, text_scale),
          lineHeight: scaleTextMetric(36, text_scale),
        },
        h2: {
          color: theme.colors.ink,
          fontFamily: 'Newsreader_600SemiBold',
          fontSize: scaleTextMetric(26, text_scale),
          lineHeight: scaleTextMetric(32, text_scale),
        },
        h3: {
          color: theme.colors.ink,
          fontFamily: 'Newsreader_600SemiBold',
          fontSize: scaleTextMetric(22, text_scale),
          lineHeight: scaleTextMetric(28, text_scale),
        },
        li: {
          color: theme.colors.ink,
          lineHeight: body_line_height,
        },
        p: {
          color: theme.colors.ink,
          marginBottom: READER_PARAGRAPH_SPACING,
          marginTop: 0,
        },
        pre: {
          backgroundColor: theme.colors.badge,
          borderColor: theme.colors.line,
          borderRadius: 16,
          borderWidth: 1,
          color: theme.colors.ink,
          padding: 16,
        },
        ul: {
          color: theme.colors.ink,
        },
        ol: {
          color: theme.colors.ink,
        },
      }}
    />
  );
}

function RecapCardRenderer({ theme, ...props }) {
  const tchildren_props = useTNodeChildrenProps(props);
  const recap_colors = resolve_recap_colors(props?.tnode?.attributes, theme);

  return (
    <View
      style={[
        props.style,
        styles.recapCard,
        {
          backgroundColor: recap_colors.background_color || theme.colors.badge,
          borderColor: recap_colors.border_color || theme.colors.line,
        },
      ]}
    >
      <TChildrenRenderer {...tchildren_props} />
    </View>
  );
}

function RecapHeaderGroupRenderer({ ...props }) {
  const tchildren_props = useTNodeChildrenProps(props);

  return (
    <View style={[props.style, styles.recapHeaderGroup]}>
      <TChildrenRenderer {...tchildren_props} />
    </View>
  );
}

function RecapHeaderRenderer({ scaled_text_styles, theme, ...props }) {
  const title = normalize_reader_text(extract_tnode_text(props.tnode));
  const icon_url = find_tnode_image_source(props.tnode);

  return (
    <View style={[props.style, styles.recapHeader]}>
      <RecapFavicon
        icon_url={icon_url}
        scaled_text_styles={scaled_text_styles}
        source={title}
        theme={theme}
      />
      <Text
        style={[
          styles.recapHeaderTitle,
          scaled_text_styles.recapHeaderTitle,
          { color: theme.colors.ink },
        ]}
      >
        {title}
      </Text>
    </View>
  );
}

function RecapTopicsRenderer({ scaled_text_styles, ...props }) {
  const topic_labels = extract_recap_topic_labels(props.tnode);
  const recap_card = find_tnode_ancestor_by_tag(props.tnode, 'recap-card');
  const recap_colors = resolve_recap_colors(recap_card?.attributes, props.theme);

  if (topic_labels.length === 0) {
    const tchildren_props = useTNodeChildrenProps(props);

    return (
      <View style={[props.style, styles.recapTopics]}>
        <TChildrenRenderer {...tchildren_props} />
      </View>
    );
  } else {
    return (
      <View style={[props.style, styles.recapTopics]}>
        {topic_labels.map((topic_label) => {
          return (
            <View
              key={topic_label}
              style={[
                styles.recapTopicPill,
                {
                  backgroundColor:
                    recap_colors.topics_background_color || props.theme.colors.badge,
                  borderColor:
                    recap_colors.topics_border_color || props.theme.colors.line,
                },
              ]}
            >
              <Text
                style={[
                  styles.recapTopicLabel,
                  scaled_text_styles.recapTopicLabel,
                  { color: props.theme.colors.ink },
                ]}
              >
                {topic_label}
              </Text>
            </View>
          );
        })}
      </View>
    );
  }
}

function RecapPhotoStripRenderer({ scaled_text_styles, ...props }) {
  const photo_items = extract_recap_photo_items(props.tnode);

  if (photo_items.length === 0) {
    const tchildren_props = useTNodeChildrenProps(props);

    return (
      <View style={[props.style, styles.recapPhotoStrip]}>
        <TChildrenRenderer {...tchildren_props} />
      </View>
    );
  } else {
    return (
      <View style={[props.style, styles.recapPhotoStrip]}>
        {photo_items.map((photo_item) => {
          return (
            <RecapPhotoTile
              href={photo_item.href}
              image_alt={photo_item.image_alt}
              image_url={photo_item.image_url}
              key={photo_item.key}
              scaled_text_styles={scaled_text_styles}
              theme={props.theme}
            />
          );
        })}
      </View>
    );
  }
}

function RecapPhotoTile({
  href = '',
  image_alt = '',
  image_url = '',
  scaled_text_styles,
  theme,
}) {
  const [did_fail_to_load, set_did_fail_to_load] = React.useState(false);
  const accessibility_label = image_alt || 'Recap image';
  const is_link = Boolean(href);
  const tile_content = did_fail_to_load ? (
    <View
      style={[
        styles.recapPhotoTileFallback,
        {
          backgroundColor: theme.colors.paper,
          borderColor: theme.colors.line,
        },
      ]}
    >
      {image_alt ? (
        <Text
          numberOfLines={2}
          style={[
            styles.recapPhotoTileFallbackLabel,
            scaled_text_styles.recapPhotoTileFallbackLabel,
            { color: theme.colors.inkSoft },
          ]}
        >
          {image_alt}
        </Text>
      ) : null}
    </View>
  ) : (
    <Image
      cachePolicy="memory-disk"
      contentFit="cover"
      onError={() => set_did_fail_to_load(true)}
      source={{ uri: image_url }}
      style={styles.recapPhotoTileImage}
      transition={READER_AVATAR_TRANSITION_MS}
    />
  );

  if (is_link) {
    return (
      <Pressable
        accessibilityLabel={accessibility_label}
        accessibilityRole="link"
        onPress={() => open_external_url(href)}
        style={({ pressed }) => {
          return [
            styles.recapPhotoTile,
            {
              opacity: pressed ? 0.88 : 1,
            },
          ];
        }}
      >
        {tile_content}
      </Pressable>
    );
  } else {
    return (
      <View
        accessibilityLabel={accessibility_label}
        accessibilityRole="image"
        style={styles.recapPhotoTile}
      >
        {tile_content}
      </View>
    );
  }
}

function RecapQuoteRenderer({
  bookmarked_quote_url_set,
  bookmarking_quote_url = '',
  onBookmarkPress,
  scaled_text_styles,
  theme,
  ...props
}) {
  const tchildren_props = useTNodeChildrenProps(props);
  const bookmark_url = normalize_http_url(
    props?.tnode?.attributes?.['data-bookmark-url'],
  );
  const is_bookmarked = bookmark_url
    ? bookmarked_quote_url_set.has(bookmark_url)
    : false;
  const is_loading =
    bookmark_url && bookmark_url === bookmarking_quote_url;
  const label = is_bookmarked
    ? 'Bookmarked'
    : is_loading
      ? 'Saving...'
      : 'Bookmark';

  return (
    <View style={styles.recapQuoteRow}>
      <View style={styles.recapQuoteMain}>
        <TChildrenRenderer {...tchildren_props} />
      </View>
      {bookmark_url ? (
        <Pressable
          accessibilityRole="button"
          disabled={is_bookmarked || is_loading}
          onPress={() => onBookmarkPress(bookmark_url)}
          style={({ pressed }) => {
            return [
              styles.recapQuoteButton,
              {
                backgroundColor: theme.colors.badge,
                borderColor: theme.colors.line,
                opacity: is_bookmarked || is_loading ? 0.72 : pressed ? 0.84 : 1,
              },
            ];
          }}
        >
          <Text
            style={[
              styles.recapQuoteButtonLabel,
              scaled_text_styles.recapQuoteButtonLabel,
              {
                color: is_bookmarked
                  ? theme.colors.accentStrong
                  : theme.colors.inkSoft,
              },
            ]}
          >
            {label}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function RecapFavicon({
  icon_url = '',
  scaled_text_styles,
  source = '',
  theme,
}) {
  const trimmed_icon_url = `${icon_url || ''}`.trim();
  const [did_fail_to_load, set_did_fail_to_load] = React.useState(false);
  const [is_image_loaded, set_is_image_loaded] = React.useState(false);
  const should_show_image = trimmed_icon_url && !did_fail_to_load;
  const should_show_initial =
    !trimmed_icon_url || did_fail_to_load || !is_image_loaded;
  const initial = get_source_avatar_initial(source);

  React.useEffect(() => {
    set_did_fail_to_load(false);
    set_is_image_loaded(false);
  }, [trimmed_icon_url]);

  return (
    <View
      style={[
        styles.recapFaviconFrame,
        {
          backgroundColor: theme.colors.paper,
          borderColor: theme.colors.line,
          height: RECAP_FAVICON_SIZE,
          width: RECAP_FAVICON_SIZE,
        },
      ]}
    >
      {should_show_initial ? (
        <Text
          style={[
            styles.recapFaviconInitial,
            scaled_text_styles.recapFaviconInitial,
            { color: theme.colors.accentStrong },
          ]}
        >
          {initial}
        </Text>
      ) : null}
      {should_show_image ? (
        <Image
          cachePolicy="memory-disk"
          contentFit="cover"
          onError={() => set_did_fail_to_load(true)}
          onLoad={() => set_is_image_loaded(true)}
          source={{ uri: trimmed_icon_url }}
          style={styles.recapFaviconImage}
          transition={READER_AVATAR_TRANSITION_MS}
        />
      ) : null}
    </View>
  );
}

function RecapEmailSettingsCard({
  is_enabled = false,
  is_loading = false,
  is_saving = false,
  onSelectDay,
  scaled_text_styles,
  selected_day = '',
  theme,
}) {
  const [is_expanded, set_is_expanded] = React.useState(false);
  const is_busy = is_loading || is_saving;
  const is_showing_loading_summary =
    is_loading && !is_saving && !selected_day;
  const summary_label = is_showing_loading_summary
    ? 'Loading...'
    : is_enabled
      ? get_recap_day_summary_label(selected_day)
      : 'Off';
  const summary_selection_kind = is_enabled ? 'accent' : 'neutral';
  const helper_copy = get_recap_email_settings_copy({
    is_enabled,
    is_expanded,
    is_showing_loading_summary,
    selected_day,
  });

  async function handle_day_selection(next_dayofweek = '') {
    if (typeof onSelectDay !== 'function' || is_busy) {
      return;
    }

    if (`${next_dayofweek || ''}`.trim() === `${selected_day || ''}`.trim()) {
      set_is_expanded(false);
      return;
    }

    const did_save = await onSelectDay(next_dayofweek);

    if (did_save) {
      set_is_expanded(false);
    }
  }

  return (
    <Animated.View
      style={[
        styles.recapSettingsCard,
        {
          backgroundColor: theme.colors.badge,
          borderColor: theme.colors.line,
        },
      ]}
      layout={RECAP_SETTINGS_LAYOUT_TRANSITION}
    >
      <View style={styles.recapSettingsHeader}>
        <View style={styles.recapSettingsCopy}>
          <Animated.View
            layout={RECAP_SETTINGS_LAYOUT_TRANSITION}
            style={styles.recapSettingsTitleRow}
          >
            <Text
              style={[
                styles.recapSettingsTitle,
                scaled_text_styles.recapSettingsTitle,
                { color: theme.colors.ink },
              ]}
            >
              Weekly email
            </Text>
            {!is_expanded ? (
              <Animated.View
                entering={RECAP_SETTINGS_ROW_ENTERING}
                exiting={RECAP_SETTINGS_ROW_EXITING}
                layout={RECAP_SETTINGS_LAYOUT_TRANSITION}
              >
                <RecapDayChip
                  disabled={is_showing_loading_summary || is_busy}
                  icon_name="expand-more"
                  is_compact
                  is_selected
                  label={summary_label}
                  onPress={() => set_is_expanded(true)}
                  scaled_text_styles={scaled_text_styles}
                  selection_kind={summary_selection_kind}
                  theme={theme}
                />
              </Animated.View>
            ) : null}
          </Animated.View>
          <Text
            style={[
              styles.recapSettingsBody,
              scaled_text_styles.recapSettingsBody,
              { color: theme.colors.inkSoft },
            ]}
          >
            {helper_copy}
          </Text>
        </View>
        {is_loading || is_saving ? (
          <ActivityIndicator
            color={theme.colors.accentStrong}
            size="small"
          />
        ) : null}
      </View>

      {is_expanded ? (
        <Animated.View
          entering={RECAP_SETTINGS_ROW_ENTERING}
          exiting={RECAP_SETTINGS_ROW_EXITING}
          layout={RECAP_SETTINGS_LAYOUT_TRANSITION}
          style={styles.recapDayWrap}
        >
          {RECAP_EMAIL_DAYS.map((dayofweek) => {
            return (
              <RecapDayChip
                disabled={is_busy}
                is_selected={selected_day === dayofweek}
                key={dayofweek}
                label={get_recap_day_chip_label(dayofweek)}
                onPress={() => handle_day_selection(dayofweek)}
                scaled_text_styles={scaled_text_styles}
                selection_kind="accent"
                theme={theme}
              />
            );
          })}

          <RecapDayChip
            disabled={is_busy}
            is_selected={!selected_day}
            label="Off"
            onPress={() => handle_day_selection('')}
            scaled_text_styles={scaled_text_styles}
            selection_kind="destructive"
            theme={theme}
          />
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

function RecapDayChip({
  disabled = false,
  icon_name = '',
  is_compact = false,
  is_selected = false,
  label = '',
  onPress,
  scaled_text_styles,
  selection_kind = 'accent',
  theme,
}) {
  const uses_accent_selection =
    is_selected && selection_kind === 'accent';
  const uses_neutral_selection =
    is_selected && selection_kind === 'neutral';
  const uses_destructive_selection =
    is_selected && selection_kind === 'destructive';
  const uses_destructive_treatment =
    selection_kind === 'destructive';
  let background_color = theme.colors.paper;
  let border_color = theme.colors.line;
  let label_color = theme.colors.inkSoft;

  if (uses_accent_selection) {
    background_color = theme.colors.accent;
    border_color = theme.colors.accent;
    label_color = theme.colors.white;
  } else if (uses_neutral_selection) {
    background_color = theme.colors.paperMuted;
    border_color = theme.colors.inkSoft;
    label_color = theme.colors.ink;
  } else if (uses_destructive_selection) {
    background_color = theme.isDark
      ? 'rgba(188, 84, 110, 0.28)'
      : 'rgba(166, 47, 73, 0.12)';
    border_color = theme.isDark
      ? 'rgba(255, 160, 182, 0.4)'
      : 'rgba(166, 47, 73, 0.3)';
    label_color = theme.isDark ? '#ffb5c6' : '#942c49';
  } else if (uses_destructive_treatment) {
    background_color = theme.isDark
      ? 'rgba(188, 84, 110, 0.12)'
      : 'rgba(166, 47, 73, 0.05)';
    border_color = theme.isDark
      ? 'rgba(255, 160, 182, 0.22)'
      : 'rgba(166, 47, 73, 0.18)';
    label_color = theme.isDark ? '#f2a6ba' : '#a63b58';
  }

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => {
        return [
          styles.recapDayChip,
          is_compact ? styles.recapDayChipCompact : null,
          icon_name ? styles.recapDayChipWithIcon : null,
          {
            backgroundColor: background_color,
            borderColor: border_color,
            opacity: disabled ? 0.48 : pressed ? 0.84 : 1,
          },
        ];
      }}
    >
      <Text
        style={[
          styles.recapDayChipLabel,
          scaled_text_styles.recapDayChipLabel,
          {
            color: label_color,
          },
        ]}
      >
        {label}
      </Text>
      {icon_name ? (
        <MaterialIcons
          color={label_color}
          name={icon_name}
          size={is_compact ? 16 : 18}
        />
      ) : null}
    </Pressable>
  );
}

function get_entry_menu_actions({
  entry = null,
  entry_source = 'feed',
  is_bookmarked = false,
  original_url = '',
  theme,
}) {
  if (!entry) {
    return [];
  }

  const icon_color = theme?.colors?.ink;
  const bookmark_title =
    entry_source === 'bookmark' || is_bookmarked
      ? 'Unbookmark'
      : 'Bookmark';
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

  if (entry_source !== 'bookmark') {
    actions.push({
      id: 'toggle_read',
      image: Platform.select({
        ios: entry?.is_read ? 'envelope' : 'envelope.open',
      }),
      imageColor: icon_color,
      title: read_title,
    });
  }

  actions.push({
    attributes:
      bookmark_title === 'Unbookmark' && entry_source === 'bookmark'
        ? {
            destructive: true,
          }
        : undefined,
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

function HeaderEntryMenuButton({
  is_dark = false,
  menu_actions = [],
  onMenuAction,
  theme,
}) {
  if (menu_actions.length === 0) {
    return null;
  }

  return (
    <MenuView
      accessibilityLabel="Open post actions"
      actions={menu_actions}
      onPressAction={({ nativeEvent }) => {
        onMenuAction?.(nativeEvent.event);
      }}
      shouldOpenOnLongPress={false}
      themeVariant={is_dark ? 'dark' : 'light'}
    >
      <View
        accessibilityRole="button"
        style={styles.headerMenuButton}
      >
        <MaterialIcons
          color={theme.colors.accentStrong}
          name="more-horiz"
          size={24}
        />
      </View>
    </MenuView>
  );
}

function MetaLink({ color, label, onPress, style }) {
  if (!label) {
    return null;
  }

  if (!onPress) {
    return <Text style={[style, { color }]}>{label}</Text>;
  } else {
    return (
      <Pressable
        accessibilityRole="link"
        hitSlop={6}
        onPress={onPress}
      >
        <Text style={[style, { color }]}>{label}</Text>
      </Pressable>
    );
  }
}

function UnavailableScreen({
  body = '',
  scaled_text_styles,
  theme,
  title = '',
}) {
  return (
    <View style={styles.unavailableScreen}>
      <View style={styles.unavailableCopy}>
        <Text
          style={[
            styles.unavailableTitle,
            scaled_text_styles.unavailableTitle,
            { color: theme.colors.ink },
          ]}
        >
          {title}
        </Text>
        <Text
          style={[
            styles.unavailableBody,
            scaled_text_styles.unavailableBody,
            { color: theme.colors.inkSoft },
          ]}
        >
          {body}
        </Text>
      </View>
    </View>
  );
}

function UnavailableBodyCard({
  body = '',
  can_open_original = false,
  on_open_original,
  scaled_text_styles,
  theme,
  title = '',
}) {
  return (
    <View
      style={[
        styles.unavailableBodyCard,
        {
          backgroundColor: theme.colors.badge,
          borderColor: theme.colors.line,
        },
      ]}
    >
      <View style={styles.unavailableCopy}>
        <Text
          style={[
            styles.unavailableTitle,
            scaled_text_styles.unavailableTitle,
            { color: theme.colors.ink },
          ]}
        >
          {title}
        </Text>
        <Text
          style={[
            styles.unavailableBody,
            scaled_text_styles.unavailableBody,
            { color: theme.colors.inkSoft },
          ]}
        >
          {body}
        </Text>
      </View>

      {can_open_original ? (
        <Pressable
          accessibilityRole="link"
          onPress={on_open_original}
          style={[
            styles.openOriginalButton,
            {
              backgroundColor: theme.colors.buttonGhost,
              borderColor: theme.colors.line,
            },
          ]}
        >
          <Text
            style={[
              styles.openOriginalLabel,
              scaled_text_styles.openOriginalLabel,
              { color: theme.colors.ink },
            ]}
          >
            Open original post
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function FeedDetailAvatar({
  avatar_url = '',
  source = '',
  size = READER_AVATAR_SIZE,
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
        styles.avatarFrame,
        {
          backgroundColor: theme.colors.accentSoft,
          borderRadius: size / 2,
          height: size,
          width: size,
        },
      ]}
    >
      <View style={styles.avatarPlaceholder}>
        {should_show_initial ? (
          <Text
            style={[
              styles.avatarInitial,
              {
                color: theme.colors.accentStrong,
                fontSize: Math.max(Math.round(size * 0.48), 12),
                lineHeight: Math.max(Math.round(size * 0.54), 14),
              },
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
          style={styles.avatarImage}
          transition={READER_AVATAR_TRANSITION_MS}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    alignItems: 'center',
    flexGrow: 1,
  },
  headerBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  readerColumn: {
    maxWidth: READER_COLUMN_MAX_WIDTH,
    width: '100%',
  },
  masthead: {
    borderBottomWidth: 1,
    paddingBottom: 24,
    paddingTop: Platform.OS === 'ios' ? 0 : 10,
  },
  feedHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
  },
  feedMeta: {
    flex: 1,
    gap: 4,
  },
  feedTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  sourceLabel: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
  },
  feedDetailsRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  hostLabel: {
    fontSize: 14,
    lineHeight: 20,
  },
  feedDetailSeparator: {
    fontSize: 13,
    lineHeight: 18,
  },
  dateLabel: {
    fontSize: 14,
    lineHeight: 20,
  },
  title: {
    fontFamily: 'Newsreader_600SemiBold',
    fontSize: READER_TITLE_FONT_SIZE,
    lineHeight: READER_TITLE_LINE_HEIGHT,
  },
  titleWrap: {
    marginTop: READER_TITLE_TOP_MARGIN,
  },
  titleWrapCompact: {
    marginTop: 8,
  },
  recapBody: {
    fontSize: 16,
    lineHeight: 24,
    marginTop: 10,
    maxWidth: 420,
  },
  bodySection: {
    paddingTop: Platform.OS === 'ios' ? 20 : 24,
  },
  bodySectionWithPaneTabs: {
    paddingTop: 18,
  },
  readerPaneTabsWrap: {
    paddingTop: 18,
  },
  readerPaneTabs: {
    borderRadius: READER_PANE_CONTROL_RADIUS,
    borderWidth: 1,
    elevation: 2,
    flexDirection: 'row',
    minHeight: READER_PANE_CONTROL_HEIGHT,
    padding: READER_PANE_CONTROL_INSET,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.08,
    shadowRadius: 14,
  },
  readerPaneButton: {
    alignItems: 'center',
    borderRadius: READER_PANE_BUTTON_RADIUS,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: READER_PANE_BUTTON_HEIGHT,
    paddingHorizontal: 12,
  },
  readerPaneButtonLabel: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 16,
  },
  repliesList: {
    gap: 18,
  },
  replyRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
  },
  replyBody: {
    flex: 1,
    gap: 6,
    minWidth: 0,
  },
  replyAuthor: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  replyDate: {
    fontSize: 12,
    lineHeight: 18,
  },
  recapSettingsCard: {
    borderRadius: 22,
    borderWidth: 1,
    gap: 16,
    marginBottom: 22,
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  recapSettingsHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  recapSettingsCopy: {
    flex: 1,
    gap: 8,
  },
  recapSettingsTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  recapSettingsTitle: {
    fontFamily: 'Newsreader_600SemiBold',
    fontSize: 24,
    lineHeight: 28,
  },
  recapSettingsBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  recapDayWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  recapDayChip: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minWidth: 54,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  recapDayChipCompact: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  recapDayChipWithIcon: {
    paddingRight: 10,
  },
  recapDayChipLabel: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 16,
    textAlign: 'center',
  },
  recapBookmarkError: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  recapCard: {
    borderRadius: 24,
    borderWidth: 1,
    marginBottom: 22,
    overflow: 'hidden',
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  recapHeaderGroup: {
    alignItems: 'center',
    columnGap: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 14,
    rowGap: 8,
  },
  recapHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 1,
    gap: 10,
    minWidth: 0,
  },
  recapHeaderTitle: {
    flexShrink: 1,
    fontFamily: 'Newsreader_600SemiBold',
    fontSize: 28,
    lineHeight: 32,
  },
  recapFaviconFrame: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  recapFaviconInitial: {
    fontFamily: 'Newsreader_700Bold',
    fontSize: 13,
    lineHeight: 15,
  },
  recapFaviconImage: {
    ...StyleSheet.absoluteFillObject,
  },
  recapTopics: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 1,
    flexWrap: 'wrap',
    gap: 6,
    marginLeft: 'auto',
  },
  recapTopicPill: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 34,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  recapTopicLabel: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 16,
  },
  recapPhotoStrip: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
    marginTop: 2,
  },
  recapPhotoTile: {
    borderRadius: 14,
    height: 96,
    overflow: 'hidden',
    width: 96,
  },
  recapPhotoTileImage: {
    height: '100%',
    width: '100%',
  },
  recapPhotoTileFallback: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    height: '100%',
    justifyContent: 'center',
    paddingHorizontal: 10,
    width: '100%',
  },
  recapPhotoTileFallbackLabel: {
    fontSize: 11,
    lineHeight: 15,
    textAlign: 'center',
  },
  recapQuoteRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    width: '100%',
  },
  recapQuoteMain: {
    flex: 1,
    minWidth: 0,
  },
  recapQuoteButton: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 34,
    paddingHorizontal: 12,
  },
  recapQuoteButtonLabel: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  headerMenuButton: {
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  unavailableBodyCard: {
    gap: 16,
    paddingBottom: 12,
    paddingTop: 6,
  },
  unavailableScreen: {
    maxWidth: READER_COLUMN_MAX_WIDTH,
    paddingTop: 40,
    width: '100%',
  },
  unavailableCopy: {
    gap: 8,
  },
  unavailableTitle: {
    fontFamily: 'Newsreader_600SemiBold',
    fontSize: 24,
    lineHeight: 30,
  },
  unavailableBody: {
    fontSize: 15,
    lineHeight: 23,
  },
  openOriginalButton: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
  },
  openOriginalLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  avatarFrame: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontFamily: 'Newsreader_700Bold',
  },
  avatarImage: {
    ...StyleSheet.absoluteFillObject,
  },
});

export default observer(FeedItemDetailScreen);

function resolve_translucent_header_background_color(
  theme,
  platform = Platform.OS,
) {
  if (platform === 'ios') {
    return with_color_opacity(
      theme?.colors?.canvas,
      theme?.isDark ? 0.18 : 0.14,
    );
  }

  return with_color_opacity(
    theme?.colors?.canvas,
    theme?.isDark ? 0.78 : 0.84,
  );
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

function create_reader_body_html(entry = null) {
  const content = `${entry?.content || ''}`.trim();

  if (content) {
    return content;
  }

  const summary = `${entry?.summary || ''}`.trim();

  if (summary) {
    return `<p>${escape_html(summary)}</p>`;
  }

  return '';
}

function decorate_recap_html(markup = '') {
  const trimmed_markup = `${markup || ''}`.trim();

  if (!trimmed_markup) {
    return '';
  }

  return trimmed_markup.replace(
    /<p>(\s*💬\s*Quoting from\s*<a[\s\S]*?<\/a>)<\/p>/gi,
    (_match, quote_markup) => {
      const href_match =
        quote_markup.match(/\shref\s*=\s*(['"])(.*?)\1/i) ||
        quote_markup.match(/\shref\s*=\s*([^\s>"']+)/i);
      const raw_url = href_match?.[2] || href_match?.[1] || '';
      const bookmark_url = normalize_http_url(raw_url);
      const bookmark_attribute = bookmark_url
        ? ` data-bookmark-url="${escape_html_attribute(bookmark_url)}"`
        : '';

      return `<recap-quote${bookmark_attribute}><p>${quote_markup}</p></recap-quote>`;
    },
  );
}

function sanitize_reader_html(markup = '') {
  const trimmed_markup = `${markup || ''}`.trim();

  if (!trimmed_markup) {
    return '';
  }

  return trimmed_markup
    .replace(
      /<\s*(script|style|iframe|embed|object|form|input|button|select|textarea|video|audio|source|link|meta)\b[^>]*>[\s\S]*?<\s*\/\s*\1>/gi,
      '',
    )
    .replace(
      /<\s*(script|style|iframe|embed|object|form|input|button|select|textarea|video|audio|source|link|meta)\b[^>]*\/?>/gi,
      '',
    )
    .replace(/\son[a-z]+\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, '')
    .replace(
      /\s(href|src)\s*=\s*(['"])(.*?)\2/gi,
      (_match, attribute_name, quote, raw_url) => {
        const safe_url = normalize_http_url(raw_url);

        if (!safe_url) {
          return '';
        }

        return ` ${attribute_name}=${quote}${safe_url}${quote}`;
      },
    )
    .replace(
      /\s(href|src)\s*=\s*([^\s>"']+)/gi,
      (_match, attribute_name, raw_url) => {
        const safe_url = normalize_http_url(raw_url);

        if (!safe_url) {
          return '';
        }

        return ` ${attribute_name}="${safe_url}"`;
      },
    );
}

function resolve_detail_mode(raw_mode = '') {
  const normalized_mode = `${raw_mode || ''}`.trim().toLowerCase();

  if (normalized_mode === 'recap') {
    return 'recap';
  } else {
    return 'entry';
  }
}

function resolve_entry_source(raw_source = '') {
  const normalized_source = `${raw_source || ''}`.trim().toLowerCase();

  if (normalized_source === 'bookmark') {
    return 'bookmark';
  }

  if (normalized_source === 'subscription_feed') {
    return 'subscription_feed';
  } else {
    return 'feed';
  }
}

function build_recap_classes_styles(theme, text_scale = 1) {
  return {
    'recap-summary': {
      color: theme.colors.inkSoft,
      fontSize: scaleTextMetric(15, text_scale),
      lineHeight: scaleTextMetric(23, text_scale),
      marginBottom: 18,
      marginTop: 0,
    },
    'recap-topic': {
      borderWidth: 1,
      borderRadius: 999,
      color: theme.colors.ink,
      fontSize: scaleTextMetric(11, text_scale),
      fontWeight: '700',
      lineHeight: scaleTextMetric(14, text_scale),
      overflow: 'hidden',
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    'recap-photo-link': {
      borderRadius: 14,
      overflow: 'hidden',
    },
    'recap-photo-image': {
      borderRadius: 14,
      height: 96,
      width: 96,
    },
    'recap-blockquote': {
      color: theme.colors.ink,
      marginBottom: 20,
      marginLeft: 0,
      marginTop: 0,
      paddingBottom: 14,
      paddingLeft: 16,
      paddingRight: 16,
      paddingTop: 14,
    },
    'recap-posts-label': {
      color: theme.colors.ink,
      fontFamily: 'Newsreader_600SemiBold',
      fontSize: scaleTextMetric(18, text_scale),
      lineHeight: scaleTextMetric(24, text_scale),
      marginBottom: 10,
      marginTop: 4,
    },
    'recap-post-list': {
      marginBottom: 0,
      marginTop: 0,
      paddingLeft: 18,
    },
    'recap-post-item': {
      color: theme.colors.inkSoft,
      fontSize: scaleTextMetric(15, text_scale),
      lineHeight: scaleTextMetric(22, text_scale),
      marginBottom: 8,
    },
    'recap-post-link': {
      color: theme.colors.accentStrong,
      fontWeight: '600',
    },
  };
}

function create_recap_dom_visitors(theme) {
  return {
    onElement(element) {
      if (!element || !element.attribs) {
        return;
      }

      if (is_recap_card_element(element)) {
        rename_dom_element(element, 'recap-card');
        append_dom_class(element, 'recap-card');
      }

      const recap_element = is_recap_dom_node(element)
        ? element
        : find_recap_dom_ancestor(element);

      if (!recap_element) {
        return;
      }

      if (has_dom_class_name(element, 'reading-header')) {
        rename_dom_element(element, 'recap-header-group');
      }

      if (element.name === 'h2') {
        rename_dom_element(element, 'recap-header');
      }

      if (has_dom_class_name(element, 'topics')) {
        rename_dom_element(element, 'recap-topics');
      }

      if (element.name === 'p' && has_dom_class_name(element, 'reading-recap-photos')) {
        rename_dom_element(element, 'recap-photo-strip');
      }

      if (
        element.name === 'a' &&
        element.parent?.name === 'recap-photo-strip'
      ) {
        append_dom_class(element, 'recap-photo-link');
      }

      if (
        element.name === 'img' &&
        element.parent?.name === 'a' &&
        element.parent?.parent?.name === 'recap-photo-strip'
      ) {
        append_dom_class(element, 'recap-photo-image');
      }

      if (element.name === 'span' && element.parent?.name === 'recap-topics') {
        const recap_colors = resolve_recap_colors(
          recap_element?.attribs,
          theme,
        );

        append_dom_class(element, 'recap-topic');

        if (recap_colors.topics_background_color) {
          append_dom_style(
            element,
            `background-color: ${recap_colors.topics_background_color};`,
          );
        }

        if (recap_colors.topics_border_color) {
          append_dom_style(
            element,
            `border-color: ${recap_colors.topics_border_color};`,
          );
        }
      }

      if (is_recap_summary_paragraph(element)) {
        append_dom_class(element, 'recap-summary');
      }

      if (is_recap_recent_posts_label(element)) {
        append_dom_class(element, 'recap-posts-label');
      }

      if (element.name === 'blockquote') {
        const recap_colors = resolve_recap_colors(
          recap_element?.attribs,
          theme,
        );

        append_dom_class(element, 'recap-blockquote');

        if (recap_colors.blockquote_background_color) {
          append_dom_style(
            element,
            `background-color: ${recap_colors.blockquote_background_color};`,
          );
        }

        if (recap_colors.blockquote_border_color) {
          append_dom_style(
            element,
            `border-left-color: ${recap_colors.blockquote_border_color}; border-left-width: 3px;`,
          );
        }
      }

      if (
        element.name === 'ul' &&
        is_direct_child_of_recap_card(element)
      ) {
        append_dom_class(element, 'recap-post-list');
      }

      if (
        element.name === 'li' &&
        element.parent?.name === 'ul' &&
        is_direct_child_of_recap_card(element.parent)
      ) {
        append_dom_class(element, 'recap-post-item');
      }

      if (element.name === 'a' && is_recap_post_link(element)) {
        append_dom_class(element, 'recap-post-link');
      }
    },
  };
}

function resolve_recap_colors(attribs = {}, theme) {
  const light_color = normalize_recap_color(attribs?.['data-color-light']);
  const dark_color = normalize_recap_color(
    attribs?.['data-color-dark'] || attribs?.['data-color-right'],
  );
  const recap_base_color = theme.isDark
    ? dark_color || light_color
    : light_color || dark_color;

  return {
    background_color: with_recap_color_opacity(
      recap_base_color,
      theme.isDark ? 'd9' : 'a6',
    ),
    border_color: with_recap_color_opacity(
      recap_base_color,
      theme.isDark ? 'ff' : 'bf',
    ),
    blockquote_background_color: with_recap_color_opacity(
      recap_base_color,
      theme.isDark ? 'ee' : 'cc',
    ),
    blockquote_border_color: with_recap_color_opacity(
      recap_base_color,
      'ff',
    ),
    topics_background_color: with_recap_color_opacity(
      recap_base_color,
      theme.isDark ? 'ff' : 'f0',
    ),
    topics_border_color: with_recap_color_opacity(
      recap_base_color,
      'ff',
    ),
  };
}

function has_dom_class_name(element, class_name = '') {
  const class_names = `${element?.attribs?.class || ''}`
    .split(/\s+/)
    .map((value) => value.trim())
    .filter(Boolean);

  return class_names.includes(class_name);
}

function is_recap_card_element(element) {
  if (!element?.attribs) {
    return false;
  }

  return Boolean(
    has_dom_class_name(element, 'reading-recap') ||
      normalize_recap_color(element.attribs?.['data-color-light']) ||
      normalize_recap_color(
        element.attribs?.['data-color-dark'] || element.attribs?.['data-color-right'],
      ),
  );
}

function is_recap_dom_node(element) {
  if (!element) {
    return false;
  }

  return element.name === 'recap-card' || has_dom_class_name(element, 'reading-recap');
}

function find_recap_dom_ancestor(element) {
  let current_element = element?.parent || null;

  while (current_element) {
    if (is_recap_dom_node(current_element)) {
      return current_element;
    }

    current_element = current_element.parent || null;
  }

  return null;
}

function is_direct_child_of_recap_card(element) {
  return is_recap_dom_node(element?.parent);
}

function find_previous_dom_tag_sibling(element) {
  let current_element = element?.prev || null;

  while (current_element) {
    if (current_element.type === 'tag') {
      return current_element;
    }

    current_element = current_element.prev || null;
  }

  return null;
}

function is_recap_summary_paragraph(element) {
  if (element?.name !== 'p' || !is_direct_child_of_recap_card(element)) {
    return false;
  }

  if (
    has_dom_class_name(element, 'reading-recap-photos') ||
    is_recap_recent_posts_label(element)
  ) {
    return false;
  }

  const previous_tag_sibling = find_previous_dom_tag_sibling(element);

  if (!previous_tag_sibling) {
    return false;
  }

  return (
    previous_tag_sibling.name === 'h2' ||
    previous_tag_sibling.name === 'recap-header' ||
    has_dom_class_name(previous_tag_sibling, 'reading-header') ||
    previous_tag_sibling.name === 'recap-header-group'
  );
}

function is_recap_recent_posts_label(element) {
  if (element?.name !== 'p' || !is_direct_child_of_recap_card(element)) {
    return false;
  }

  return normalize_dom_text_content(element).toLowerCase() === 'recent posts:';
}

function normalize_dom_text_content(element) {
  return get_dom_text_content(element).replace(/\s+/g, ' ').trim();
}

function get_dom_text_content(element) {
  if (!element) {
    return '';
  }

  if (element.type === 'text') {
    return `${element.data || ''}`;
  }

  if (!Array.isArray(element.children)) {
    return '';
  }

  return element.children.map((child) => get_dom_text_content(child)).join('');
}

function is_recap_post_link(element) {
  if (element?.name !== 'a' || element.parent?.name !== 'li') {
    return false;
  }

  return element.parent?.parent?.name === 'ul' &&
    is_direct_child_of_recap_card(element.parent.parent);
}

function rename_dom_element(element, next_name = '') {
  if (!element || !next_name) {
    return;
  }

  element.name = next_name;
}

function append_dom_class(element, class_name = '') {
  const existing_class_name = `${element?.attribs?.class || ''}`.trim();

  if (!class_name || has_dom_class_name(element, class_name)) {
    return;
  }

  if (existing_class_name) {
    element.attribs.class = `${existing_class_name} ${class_name}`;
  } else {
    element.attribs.class = class_name;
  }
}

function append_dom_style(element, next_style = '') {
  const trimmed_next_style = `${next_style || ''}`.trim();

  if (!trimmed_next_style) {
    return;
  }

  const existing_style = `${element?.attribs?.style || ''}`.trim();

  if (!existing_style) {
    element.attribs.style = trimmed_next_style;
  } else if (existing_style.endsWith(';')) {
    element.attribs.style = `${existing_style} ${trimmed_next_style}`;
  } else {
    element.attribs.style = `${existing_style}; ${trimmed_next_style}`;
  }
}

function extract_tnode_text(tnode) {
  if (!tnode) {
    return '';
  }

  if (tnode.type === 'text') {
    return `${tnode.data || ''}`;
  }

  return (tnode.children || []).map((child) => extract_tnode_text(child)).join('');
}

function extract_recap_topic_labels(tnode) {
  if (!tnode) {
    return [];
  }

  const direct_labels = (tnode.children || [])
    .map((child) => normalize_reader_text(extract_tnode_text(child)))
    .filter(Boolean);

  if (direct_labels.length > 0) {
    return [...new Set(direct_labels)];
  }

  const fallback_label = normalize_reader_text(extract_tnode_text(tnode));

  if (!fallback_label) {
    return [];
  }

  return [fallback_label];
}

function extract_recap_photo_items(tnode) {
  if (!tnode) {
    return [];
  }

  const photo_items = [];
  const seen_keys = new Set();

  traverse_tnode_descendants(tnode, (child) => {
    if (child?.tagName !== 'img') {
      return;
    }

    const image_url = normalize_http_url(child?.attributes?.src);

    if (!image_url) {
      return;
    }

    const photo_link = find_tnode_ancestor_by_tag(child, 'a');
    const href = normalize_http_url(photo_link?.attributes?.href);
    const image_alt = `${child?.attributes?.alt || ''}`.trim();
    const key = `${href || image_url || 'recap-photo'}-${photo_items.length}`;

    if (seen_keys.has(key)) {
      return;
    }

    seen_keys.add(key);

    photo_items.push({
      href,
      image_alt,
      image_url,
      key,
    });
  });

  return photo_items;
}

function find_tnode_ancestor_by_tag(tnode, tag_name = '') {
  let current_tnode = tnode?.parent || null;

  while (current_tnode) {
    if (current_tnode.tagName === tag_name) {
      return current_tnode;
    }

    current_tnode = current_tnode.parent || null;
  }

  return null;
}

function find_tnode_image_source(tnode) {
  if (!tnode) {
    return '';
  }

  if (tnode.tagName === 'img') {
    return normalize_http_url(tnode.attributes?.src);
  }

  for (const child of tnode.children || []) {
    const child_source = find_tnode_image_source(child);

    if (child_source) {
      return child_source;
    }
  }

  return '';
}

function find_tnode_image_alt(tnode) {
  if (!tnode) {
    return '';
  }

  if (tnode.tagName === 'img') {
    return `${tnode.attributes?.alt || ''}`.trim();
  }

  for (const child of tnode.children || []) {
    const child_alt = find_tnode_image_alt(child);

    if (child_alt) {
      return child_alt;
    }
  }

  return '';
}

function traverse_tnode_descendants(tnode, on_visit) {
  if (!tnode || typeof on_visit !== 'function') {
    return;
  }

  for (const child of tnode.children || []) {
    on_visit(child);
    traverse_tnode_descendants(child, on_visit);
  }
}

function normalize_recap_color(raw_color = '') {
  const normalized_color = `${raw_color || ''}`.trim();

  if (!/^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(normalized_color)) {
    return '';
  }

  const hex = normalized_color.slice(1);

  if (hex.length === 3 || hex.length === 4) {
    return `#${[...hex]
      .map((character) => `${character}${character}`)
      .join('')}`;
  } else {
    return `#${hex}`;
  }
}

function with_recap_color_opacity(color_value = '', opacity_hex = '80') {
  const normalized_color = normalize_recap_color(color_value);

  if (!normalized_color) {
    return '';
  }

  const base_color =
    normalized_color.length === 9 ? normalized_color.slice(0, 7) : normalized_color;
  const safe_opacity = /^[0-9a-f]{2}$/i.test(`${opacity_hex || ''}`)
    ? `${opacity_hex}`.toLowerCase()
    : '80';

  return `${base_color}${safe_opacity}`;
}

function resolve_reader_title(entry = null) {
  const title = normalize_reader_text(entry?.title);

  if (title) {
    if (title.toLowerCase() === 'untitled') {
      return '';
    }

    const summary = normalize_reader_text(entry?.summary);

    if (summary) {
      if (summary === title) {
        return '';
      }

      const shared_prefix =
        title.startsWith(summary) || summary.startsWith(title);
      const prefix_length = Math.min(title.length, summary.length);

      if (shared_prefix && prefix_length >= 40) {
        return '';
      }
    }

    return title;
  }

  return '';
}

function normalize_reader_text(value = '') {
  return `${value || ''}`.trim().replace(/\s+/g, ' ');
}

function format_reader_date(raw_date = '') {
  const trimmed_date = `${raw_date || ''}`.trim();

  if (!trimmed_date) {
    return '';
  }

  const date = new Date(trimmed_date);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function normalize_conversation_replies(items = []) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.filter((item) => {
    return item && typeof item === 'object';
  });
}

function get_reply_count_label(count = 0) {
  const normalized_count = Number.isFinite(count) ? Math.max(count, 0) : 0;
  return `${normalized_count} repl${normalized_count === 1 ? 'y' : 'ies'}`;
}

function resolve_reply_key(reply = null, index = 0) {
  const reply_id = `${reply?.id || ''}`.trim();

  if (reply_id) {
    return reply_id;
  }

  const author_name = get_reply_author_name(reply);
  const published_at = `${reply?.date_published || ''}`.trim();
  const content_key =
    `${reply?.content_text || reply?.content_html || ''}`.trim().slice(0, 40);

  return `${author_name}-${published_at}-${content_key || index}`;
}

function get_reply_author_name(reply = null) {
  const name = `${reply?.author?.name || ''}`.trim();

  if (name) {
    return name;
  }

  const username = `${reply?.author?._microblog?.username || ''}`.trim();

  if (username) {
    return username;
  }

  return 'Unknown';
}

function format_reply_date(raw_date = '') {
  const trimmed_date = `${raw_date || ''}`.trim();

  if (!trimmed_date) {
    return '';
  }

  const date = new Date(trimmed_date);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const date_text = date.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  });
  const time_text = date
    .toLocaleTimeString('en-US', {
      hour: 'numeric',
      hour12: true,
      minute: '2-digit',
    })
    .toLowerCase();

  return `${date_text} ${time_text}`;
}

function resolve_reply_html(reply = null) {
  const content_html = sanitize_reader_html(`${reply?.content_html || ''}`.trim());

  if (content_html) {
    return content_html;
  }

  const content_text = `${reply?.content_text || ''}`.trim();

  if (!content_text) {
    return '';
  }

  const safe_text = escape_html(content_text).replace(/\r?\n/g, '<br>');

  return `<p>${safe_text}</p>`;
}

function get_recap_summary_copy(count = 0) {
  const normalized_count = Number.isFinite(count) ? Math.max(count, 0) : 0;
  const noun = normalized_count === 1 ? 'post' : 'posts';

  return `${normalized_count} older ${noun}, grouped into one recap.`;
}

function get_recap_day_chip_label(dayofweek = '') {
  const trimmed_dayofweek = `${dayofweek || ''}`.trim();

  if (!trimmed_dayofweek) {
    return '';
  }

  return trimmed_dayofweek.slice(0, 3);
}

function get_recap_day_summary_label(dayofweek = '') {
  return `${dayofweek || ''}`.trim();
}

function get_recap_email_settings_copy({
  is_enabled = false,
  is_expanded = false,
  is_showing_loading_summary = false,
  selected_day = '',
} = {}) {
  if (is_showing_loading_summary) {
    return 'Loading your weekly email setting.';
  }

  if (is_expanded) {
    return 'Choose a day for Reading Recap, or turn weekly email off.';
  }

  if (is_enabled && selected_day) {
    return `Reading Recap is included in weekly email every ${selected_day}.`;
  }

  return 'Reading Recap is not included in weekly email.';
}

function normalize_http_url(raw_url = '') {
  const trimmed_url = decode_html_entities(`${raw_url || ''}`).trim();

  if (!trimmed_url) {
    return '';
  }

  try {
    const parsed_url = new URL(trimmed_url);

    if (parsed_url.protocol === 'http:' || parsed_url.protocol === 'https:') {
      return parsed_url.toString();
    }
  } catch (error) {
    return '';
  }

  return '';
}

function resolve_host_label(raw_url = '') {
  const normalized_url = normalize_http_url(raw_url);

  if (!normalized_url) {
    return '';
  }

  try {
    return new URL(normalized_url).hostname.replace(/^www\./, '');
  } catch (error) {
    return '';
  }
}

async function open_external_url(raw_url = '') {
  const normalized_url = normalize_http_url(raw_url);

  if (!normalized_url) {
    return;
  }

  try {
    await Linking.openURL(normalized_url);
  } catch (error) {
    // Ignore failed external open attempts for now.
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

function escape_html(value = '') {
  return `${value || ''}`
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escape_html_attribute(value = '') {
  return escape_html(value);
}

function decode_html_entities(value = '') {
  return `${value || ''}`.replace(
    /&(#x[0-9a-f]+|#\d+|amp|apos|gt|lt|nbsp|quot);/gi,
    (match, entity) => {
      const normalized_entity = `${entity || ''}`.toLowerCase();

      if (normalized_entity === 'amp') {
        return '&';
      } else if (normalized_entity === 'apos') {
        return "'";
      } else if (normalized_entity === 'gt') {
        return '>';
      } else if (normalized_entity === 'lt') {
        return '<';
      } else if (normalized_entity === 'nbsp') {
        return ' ';
      } else if (normalized_entity === 'quot') {
        return '"';
      } else if (normalized_entity.startsWith('#x')) {
        const code_point = Number.parseInt(normalized_entity.slice(2), 16);

        if (Number.isInteger(code_point)) {
          return String.fromCodePoint(code_point);
        }
      } else if (normalized_entity.startsWith('#')) {
        const code_point = Number.parseInt(normalized_entity.slice(1), 10);

        if (Number.isInteger(code_point)) {
          return String.fromCodePoint(code_point);
        }
      }

      return match;
    },
  );
}
