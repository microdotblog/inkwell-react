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
import { MaterialIcons } from '@expo/vector-icons';
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
import AppStore from '../stores/App';
import Feed from '../stores/Feed';
import { getAuthTheme } from '../theme/authTheme';

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

function FeedItemDetailScreen({ navigation, route, isDark = false }) {
  const accent_palette_id = AppStore.accent_palette_id;
  const theme = getAuthTheme(isDark, accent_palette_id);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const detail_mode = resolve_detail_mode(route?.params?.mode);
  const entry_id = `${route?.params?.entry_id || ''}`.trim();
  const entry =
    detail_mode === 'entry' ? Feed.timeline_entry_snapshot(entry_id) : null;
  const recap =
    detail_mode === 'recap' ? Feed.active_recap_snapshot() : null;
  const source_label = `${entry?.source || 'Feed'}`.trim() || 'Feed';
  const reader_title = resolve_reader_title(entry);
  const formatted_date = format_reader_date(entry?.published_at);
  const source_url = normalize_http_url(entry?.source_url);
  const original_url = normalize_http_url(entry?.url);
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
  const [is_ios_header_title_visible, set_is_ios_header_title_visible] =
    React.useState(false);
  const is_ios_header_title_visible_ref = React.useRef(false);
  const header_title =
    detail_mode === 'recap' ? 'Reading Recap' : source_label;
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
            theme={theme}
          />
        );
      },
      'recap-topics': (props) => {
        return (
          <RecapTopicsRenderer
            {...props}
            theme={theme}
          />
        );
      },
      'recap-photo-strip': (props) => {
        return (
          <RecapPhotoStripRenderer
            {...props}
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
            theme={theme}
          />
        );
      },
    };
  }, [
    bookmarking_recap_quote_url,
    recap_bookmarked_quote_urls.join('|'),
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

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerBackButtonDisplayMode: 'minimal',
      headerStyle: {
        backgroundColor: theme.colors.canvas,
      },
      headerRight:
        detail_mode === 'entry' && original_url
          ? () => (
              <HeaderLinkButton
                onPress={() => open_external_url(original_url)}
                theme={theme}
              />
            )
          : undefined,
      headerShadowVisible: false,
      headerTintColor: theme.colors.ink,
      headerTitleStyle: {
        color: theme.colors.ink,
        fontSize: 17,
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
    header_title,
    is_ios_header_title_visible,
    navigation,
    original_url,
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
          },
        ]}
        onScroll={handle_scroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        {detail_mode === 'entry' && entry ? (
          <EntryReaderView
            entry={entry}
            formatted_date={formatted_date}
            has_renderable_body={has_entry_body}
            original_url={original_url}
            reader_html={sanitized_reader_html}
            reader_title={reader_title}
            should_show_reader_title={should_show_reader_title}
            source_host={source_host}
            source_label={source_label}
            source_url={source_url}
            theme={theme}
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
            theme={theme}
            width={width}
          />
        ) : null}

        {detail_mode === 'entry' && !entry ? (
          <UnavailableScreen
            body="It may have scrolled out of the current timeline, or the feed refreshed before the reader finished opening it."
            theme={theme}
            title="This post isn't available right now."
          />
        ) : null}

        {detail_mode === 'recap' && !recap ? (
          <UnavailableScreen
            body="Build a Reading Recap from the Fading segment first, then open it here."
            theme={theme}
            title="This recap isn't available right now."
          />
        ) : null}
      </ScrollView>
    </View>
  );
}

function EntryReaderView({
  entry,
  formatted_date,
  has_renderable_body = false,
  original_url = '',
  reader_html = '',
  reader_title = '',
  should_show_reader_title = false,
  source_host = '',
  source_label = '',
  source_url = '',
  theme,
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
                style={styles.sourceLabel}
              />
            </View>
            {source_host || formatted_date ? (
              <View style={styles.feedDetailsRow}>
                {source_host ? (
                  <Text style={[styles.hostLabel, { color: theme.colors.inkSoft }]}>
                    {source_host}
                  </Text>
                ) : null}
                {source_host && formatted_date ? (
                  <Text
                    style={[
                      styles.feedDetailSeparator,
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
                    style={styles.dateLabel}
                  />
                ) : null}
              </View>
            ) : null}
          </View>
        </View>

        {should_show_reader_title ? (
          <View style={styles.titleWrap}>
            <Text style={[styles.title, { color: theme.colors.ink }]}>
              {reader_title}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.bodySection}>
        {has_renderable_body ? (
          <ReaderHtml
            html={reader_html}
            theme={theme}
            width={width}
          />
        ) : (
          <UnavailableBodyCard
            body="This item doesn't include readable body content in the current timeline payload."
            can_open_original={Boolean(original_url)}
            on_open_original={() => open_external_url(original_url)}
            theme={theme}
            title="No readable preview yet."
          />
        )}
      </View>
    </View>
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
  theme,
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
          <Text style={[styles.title, { color: theme.colors.ink }]}>
            Reading Recap
          </Text>
        </View>
        <Text style={[styles.recapBody, { color: theme.colors.inkSoft }]}>
          {get_recap_summary_copy(recap_entry_count)}
        </Text>
      </View>

      <View style={styles.bodySection}>
        <RecapEmailSettingsCard
          is_enabled={is_recap_email_enabled}
          is_loading={is_loading_recap_email_settings}
          is_saving={is_saving_recap_email_settings}
          selected_day={recap_email_day}
          theme={theme}
          onSelectDay={(dayofweek) => Feed.update_recap_email_day(dayofweek)}
        />

        {recap_bookmark_error_message ? (
          <Text style={[styles.recapBookmarkError, { color: theme.colors.accentStrong }]}>
            {recap_bookmark_error_message}
          </Text>
        ) : null}

        {has_renderable_body ? (
          <ReaderHtml
            classes_styles={build_recap_classes_styles(theme)}
            custom_element_models={READER_HTML_MODELS}
            dom_visitors={recap_dom_visitors}
            html={recap_html}
            renderers={recap_renderers}
            theme={theme}
            width={width}
          />
        ) : (
          <UnavailableBodyCard
            body="We couldn't render the current recap payload."
            can_open_original={false}
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
  theme,
  width = 0,
}) {
  return (
    <RenderHtml
      baseStyle={{
        color: theme.colors.ink,
        fontSize: 18,
        lineHeight: 29,
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
          fontSize: 18,
          lineHeight: 29,
        },
        h1: {
          color: theme.colors.ink,
          fontFamily: 'Newsreader_600SemiBold',
          fontSize: 30,
          lineHeight: 36,
        },
        h2: {
          color: theme.colors.ink,
          fontFamily: 'Newsreader_600SemiBold',
          fontSize: 26,
          lineHeight: 32,
        },
        h3: {
          color: theme.colors.ink,
          fontFamily: 'Newsreader_600SemiBold',
          fontSize: 22,
          lineHeight: 28,
        },
        li: {
          color: theme.colors.ink,
          lineHeight: 29,
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

function RecapHeaderRenderer({ theme, ...props }) {
  const title = normalize_reader_text(extract_tnode_text(props.tnode));
  const icon_url = find_tnode_image_source(props.tnode);

  return (
    <View style={[props.style, styles.recapHeader]}>
      <RecapFavicon
        icon_url={icon_url}
        source={title}
        theme={theme}
      />
      <Text style={[styles.recapHeaderTitle, { color: theme.colors.ink }]}>
        {title}
      </Text>
    </View>
  );
}

function RecapTopicsRenderer({ ...props }) {
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

function RecapPhotoStripRenderer({ ...props }) {
  const tchildren_props = useTNodeChildrenProps(props);

  return (
    <View style={[props.style, styles.recapPhotoStrip]}>
      <TChildrenRenderer {...tchildren_props} />
    </View>
  );
}

function RecapQuoteRenderer({
  bookmarked_quote_url_set,
  bookmarking_quote_url = '',
  onBookmarkPress,
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
            <Text style={[styles.recapSettingsTitle, { color: theme.colors.ink }]}>
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
                  selection_kind={summary_selection_kind}
                  theme={theme}
                />
              </Animated.View>
            ) : null}
          </Animated.View>
          <Text style={[styles.recapSettingsBody, { color: theme.colors.inkSoft }]}>
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

function HeaderLinkButton({ onPress, theme }) {
  return (
    <Pressable
      accessibilityLabel="Open original post"
      accessibilityRole="button"
      hitSlop={8}
      onPress={onPress}
      style={styles.headerAction}
    >
      <Text style={[styles.headerActionLabel, { color: theme.colors.accentStrong }]}>
        Open
      </Text>
    </Pressable>
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

function UnavailableScreen({ body = '', theme, title = '' }) {
  return (
    <View style={styles.unavailableScreen}>
      <View style={styles.unavailableCopy}>
        <Text style={[styles.unavailableTitle, { color: theme.colors.ink }]}>
          {title}
        </Text>
        <Text style={[styles.unavailableBody, { color: theme.colors.inkSoft }]}>
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
        <Text style={[styles.unavailableTitle, { color: theme.colors.ink }]}>
          {title}
        </Text>
        <Text style={[styles.unavailableBody, { color: theme.colors.inkSoft }]}>
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
          <Text style={[styles.openOriginalLabel, { color: theme.colors.ink }]}>
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
          borderColor: theme.colors.line,
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
    paddingTop: Platform.OS === 'ios' ? 0 : 12,
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
  headerAction: {
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  headerActionLabel: {
    fontSize: 15,
    fontWeight: '700',
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
    borderWidth: 1,
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

function build_recap_classes_styles(theme) {
  return {
    'recap-summary': {
      color: theme.colors.inkSoft,
      fontSize: 15,
      lineHeight: 23,
      marginBottom: 18,
      marginTop: 0,
    },
    'recap-topic': {
      borderWidth: 1,
      borderRadius: 999,
      color: theme.colors.ink,
      fontSize: 11,
      fontWeight: '700',
      lineHeight: 14,
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
      fontSize: 18,
      lineHeight: 24,
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
      fontSize: 15,
      lineHeight: 22,
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
  const trimmed_url = `${raw_url || ''}`.trim();

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
