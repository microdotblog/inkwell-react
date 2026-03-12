import React from 'react';
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { observer } from 'mobx-react';
import RenderHtml, {
  HTMLContentModel,
  defaultHTMLElementModels,
} from 'react-native-render-html';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AuthBackground from '../components/auth/AuthBackground';
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
};

function FeedItemDetailScreen({ navigation, route, isDark = false }) {
  const theme = getAuthTheme(isDark);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const entry_id = `${route?.params?.entry_id || ''}`.trim();
  const entry = Feed.timeline_entry_snapshot(entry_id);
  const source_label = `${entry?.source || 'Feed'}`.trim() || 'Feed';
  const reader_title = resolve_reader_title(entry);
  const formatted_date = format_reader_date(entry?.published_at);
  const source_url = normalize_http_url(entry?.source_url);
  const original_url = normalize_http_url(entry?.url);
  const source_host = resolve_host_label(source_url || original_url);
  const should_show_reader_title = Boolean(reader_title);
  const reader_html = create_reader_body_html(entry);
  const sanitized_reader_html = sanitize_reader_html(reader_html);
  const has_renderable_body = Boolean(sanitized_reader_html);
  const [is_ios_header_title_visible, set_is_ios_header_title_visible] =
    React.useState(false);
  const is_ios_header_title_visible_ref = React.useRef(false);

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

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerBackButtonDisplayMode: 'minimal',
      headerStyle: {
        backgroundColor: theme.colors.canvas,
      },
      headerRight: original_url
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
          ? (is_ios_header_title_visible ? source_label : '')
          : source_label,
    });
  }, [
    is_ios_header_title_visible,
    navigation,
    original_url,
    source_label,
    theme,
  ]);

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.canvas }]}>
      <AuthBackground
        intensity={entry ? 0.1 : 1}
        theme={theme}
      />
      <ScrollView
        bounces={false}
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
        {entry ? (
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
                        <Text
                          style={[
                            styles.hostLabel,
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
                          onPress={original_url ? () => open_external_url(original_url) : null}
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
                  }}
                  contentWidth={Math.max(
                    Math.min(
                      width - READER_HORIZONTAL_PADDING * 2,
                      READER_COLUMN_MAX_WIDTH,
                    ),
                    0,
                  )}
                  customHTMLElementModels={READER_HTML_MODELS}
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
                    html: sanitized_reader_html,
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
              ) : (
                <UnavailableBodyCard
                  can_open_original={Boolean(original_url)}
                  on_open_original={() => open_external_url(original_url)}
                  theme={theme}
                />
              )}
            </View>
          </View>
        ) : (
          <View style={styles.unavailableScreen}>
            <View style={styles.unavailableCopy}>
              <Text style={[styles.unavailableTitle, { color: theme.colors.ink }]}>
                This post isn&apos;t available right now.
              </Text>
              <Text style={[styles.unavailableBody, { color: theme.colors.inkSoft }]}>
                It may have scrolled out of the current timeline, or the feed refreshed before the
                reader finished opening it.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
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
    return (
      <Text style={[style, { color }]}>
        {label}
      </Text>
    );
  } else {
    return (
      <Pressable
        accessibilityRole="link"
        hitSlop={6}
        onPress={onPress}
      >
        <Text style={[style, { color }]}>
          {label}
        </Text>
      </Pressable>
    );
  }
}

function UnavailableBodyCard({ can_open_original = false, on_open_original, theme }) {
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
          No readable preview yet.
        </Text>
        <Text style={[styles.unavailableBody, { color: theme.colors.inkSoft }]}>
          This item doesn&apos;t include readable body content in the current timeline payload.
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
    paddingBottom: 24,
    paddingTop: Platform.OS === 'ios' ? 0 : 10,
    borderBottomWidth: 1,
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
    flexDirection: 'row',
    alignItems: 'center',
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
  bodySection: {
    paddingTop: Platform.OS === 'ios' ? 20 : 24,
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
    width: '100%',
    paddingTop: 40,
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

function sanitize_reader_html(markup = '') {
  const trimmed_markup = `${markup || ''}`.trim();

  if (!trimmed_markup) {
    return '';
  }

  return trimmed_markup
    .replace(/<\s*(script|style|iframe|embed|object|form|input|button|select|textarea|video|audio|source|link|meta)\b[^>]*>[\s\S]*?<\s*\/\s*\1>/gi, '')
    .replace(/<\s*(script|style|iframe|embed|object|form|input|button|select|textarea|video|audio|source|link|meta)\b[^>]*\/?>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, '')
    .replace(/\s(href|src)\s*=\s*(['"])(.*?)\2/gi, (_match, attribute_name, quote, raw_url) => {
      const safe_url = normalize_http_url(raw_url);

      if (!safe_url) {
        return '';
      }

      return ` ${attribute_name}=${quote}${safe_url}${quote}`;
    })
    .replace(/\s(href|src)\s*=\s*([^\s>"']+)/gi, (_match, attribute_name, raw_url) => {
      const safe_url = normalize_http_url(raw_url);

      if (!safe_url) {
        return '';
      }

      return ` ${attribute_name}="${safe_url}"`;
    });
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

      const shared_prefix = title.startsWith(summary) || summary.startsWith(title);
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
