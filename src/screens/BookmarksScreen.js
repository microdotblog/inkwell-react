import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { observer } from 'mobx-react';
import { SafeAreaView } from 'react-native-safe-area-context';

import AuthBackground from '../components/auth/AuthBackground';
import AuthCard from '../components/auth/AuthCard';
import PrimaryButton from '../components/auth/PrimaryButton';
import AppStore from '../stores/App';
import Bookmarks from '../stores/Bookmarks';
import { getAuthTheme } from '../theme/authTheme';

const SCREEN_HORIZONTAL_PADDING = 20;
const LIST_TOP_PADDING = 12;
const LIST_BOTTOM_PADDING = 28;
const BOOKMARK_AVATAR_SIZE = 28;
const BOOKMARK_AVATAR_TRANSITION_MS = 180;

function BookmarksScreen({ navigation, isDark = false }) {
  const accent_palette_id = AppStore.accent_palette_id;
  const theme = getAuthTheme(isDark, accent_palette_id);
  const bookmark_entries = Bookmarks.bookmark_entries();
  const error_message = Bookmarks.error_message;
  const has_bookmarks = bookmark_entries.length > 0;
  const is_loading_initial =
    Bookmarks.is_loading && !Bookmarks.has_loaded && !has_bookmarks;
  const is_refreshing = Bookmarks.is_loading && Bookmarks.has_loaded;
  const background_intensity = has_bookmarks ? 0.14 : 1;

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

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.canvas }]}>
      <AuthBackground intensity={background_intensity} theme={theme} />
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        {is_loading_initial ? (
          <View
            style={[
              styles.stateScreen,
              {
                paddingHorizontal: SCREEN_HORIZONTAL_PADDING,
                paddingTop: LIST_TOP_PADDING,
              },
            ]}
          >
            <AuthCard style={styles.stateCard} theme={theme}>
              <View
                style={[
                  styles.loadingOrb,
                  {
                    backgroundColor: theme.colors.accentSoft,
                    borderColor: theme.colors.line,
                  },
                ]}
              >
                <ActivityIndicator color={theme.colors.accentStrong} size="small" />
              </View>
              <View style={styles.stateCopy}>
                <Text style={[styles.stateTitle, { color: theme.colors.ink }]}>
                  Loading your bookmarks
                </Text>
                <Text style={[styles.stateBody, { color: theme.colors.inkSoft }]}>
                  Recent saved posts will show up here as soon as Micro.blog responds.
                </Text>
              </View>
            </AuthCard>
          </View>
        ) : (
          <FlatList
            contentContainerStyle={[
              styles.listContent,
              {
                paddingBottom: LIST_BOTTOM_PADDING,
                paddingHorizontal: SCREEN_HORIZONTAL_PADDING,
                paddingTop: LIST_TOP_PADDING,
              },
              !has_bookmarks ? styles.listContentEmpty : null,
            ]}
            data={bookmark_entries}
            keyExtractor={(item) => item.id}
            ListHeaderComponent={
              <BookmarksSummaryCard theme={theme} />
            }
            ListEmptyComponent={
              error_message ? (
                <AuthCard style={styles.stateCard} theme={theme}>
                  <View style={styles.stateCopy}>
                    <Text style={[styles.stateTitle, { color: theme.colors.ink }]}>
                      Couldn't load your bookmarks
                    </Text>
                    <Text style={[styles.stateBody, { color: theme.colors.inkSoft }]}>
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
                    <Text style={[styles.stateTitle, { color: theme.colors.ink }]}>
                      No bookmarks yet
                    </Text>
                    <Text style={[styles.stateBody, { color: theme.colors.inkSoft }]}>
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
                progressViewOffset={LIST_TOP_PADDING}
                refreshing={is_refreshing}
                tintColor={theme.colors.accentStrong}
              />
            }
            renderItem={({ item }) => {
              return (
                <BookmarkTimelineRow
                  entry={item}
                  onPress={handle_entry_press}
                  theme={theme}
                />
              );
            }}
            showsVerticalScrollIndicator={false}
            style={styles.list}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

function BookmarksSummaryCard({ theme }) {
  return (
    <View
      style={[
        styles.summaryCard,
        {
          backgroundColor: resolve_summary_card_background_color(theme),
          borderColor: theme.colors.line,
          shadowColor: theme.colors.shadow,
        },
      ]}
    >
      <View style={styles.summaryRow}>
        <View
          style={[
            styles.summaryBadge,
            {
              backgroundColor: theme.colors.accentSoft,
              borderColor: theme.colors.line,
            },
          ]}
        >
          <MaterialIcons
            color={theme.colors.accentStrong}
            name="bookmark"
            size={16}
          />
          <Text
            style={[
              styles.summaryBadgeLabel,
              { color: theme.colors.accentStrong },
            ]}
          >
            Bookmarks
          </Text>
        </View>
        <Text style={[styles.summaryCopy, { color: theme.colors.inkSoft }]}>
          Showing recent bookmarks
        </Text>
      </View>
    </View>
  );
}

function BookmarkTimelineRow({ entry, onPress, theme }) {
  const source_label = entry.source || 'Bookmarked';
  const title = resolve_entry_title(entry);
  const has_title = Boolean(title);
  const summary = resolve_entry_summary(entry, title);
  const should_show_body = has_title || Boolean(summary);
  const timestamp = format_entry_timestamp(entry.published_at);

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
            opacity: pressed ? 0.9 : 1,
          },
        ];
      }}
    >
      <View style={styles.rowHeader}>
        <View style={styles.sourceWrap}>
          <BookmarkSourceAvatar
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

      {should_show_body ? (
        <View style={styles.rowBody}>
          {has_title ? (
            <Text
              numberOfLines={2}
              style={[styles.rowTitle, { color: theme.colors.ink }]}
            >
              {title}
            </Text>
          ) : null}
          {summary ? (
            <Text
              numberOfLines={3}
              style={[styles.rowSummary, { color: theme.colors.inkSoft }]}
            >
              {summary}
            </Text>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}

function BookmarkSourceAvatar({ avatar_url = '', source = '', theme }) {
  const trimmed_avatar_url = `${avatar_url || ''}`.trim();
  const [did_fail_to_load, set_did_fail_to_load] = React.useState(false);
  const [is_image_loaded, set_is_image_loaded] = React.useState(false);
  const should_show_image = trimmed_avatar_url && !did_fail_to_load;
  const should_show_initial =
    !trimmed_avatar_url || did_fail_to_load || !is_image_loaded;
  const initial = get_source_avatar_initial(source);

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
          transition={BOOKMARK_AVATAR_TRANSITION_MS}
        />
      ) : null}
    </View>
  );
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
  listContent: {
    gap: 14,
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
  summaryCard: {
    borderWidth: 1,
    borderRadius: 24,
    marginBottom: 14,
    paddingHorizontal: 20,
    paddingVertical: 16,
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 3,
  },
  summaryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
    columnGap: 12,
  },
  summaryBadge: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 34,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  summaryBadgeLabel: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 16,
  },
  summaryCopy: {
    flexShrink: 1,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'right',
  },
  stateCopy: {
    alignItems: 'center',
    gap: 10,
  },
  loadingOrb: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
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
    maxWidth: 320,
    textAlign: 'center',
  },
  rowCard: {
    borderWidth: 1,
    borderRadius: 24,
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  rowHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  sourceWrap: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 10,
  },
  sourceAvatarFrame: {
    width: BOOKMARK_AVATAR_SIZE,
    height: BOOKMARK_AVATAR_SIZE,
    borderRadius: BOOKMARK_AVATAR_SIZE / 2,
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

export default observer(BookmarksScreen);

function resolve_summary_card_background_color(theme) {
  return theme?.colors?.badge || theme?.colors?.paper || '#ffffff';
}

function resolve_entry_title(entry = null) {
  const title = normalize_entry_text(entry?.title);

  if (title.toLowerCase() === 'untitled') {
    return '';
  } else {
    return title;
  }
}

function resolve_entry_summary(entry = null, title = '') {
  const normalized_title = normalize_entry_text(title || entry?.title);
  const summary =
    normalize_entry_text(entry?.summary) ||
    extract_preview_text(entry?.content);

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

function extract_preview_text(content = '') {
  const html = `${content || ''}`.trim();

  if (!html) {
    return '';
  }

  const text = decode_html_entities(
    html
      .replace(/<\s*br\s*\/?>/gi, ' ')
      .replace(/<\s*\/\s*p\s*>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  );

  if (text.length <= 280) {
    return text;
  } else {
    return `${text.slice(0, 277).trimEnd()}...`;
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
      day: 'numeric',
      month: 'short',
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

function get_source_avatar_initial(source = '') {
  const trimmed_source = `${source || ''}`.trim();
  const initial = trimmed_source.charAt(0).toUpperCase();

  if (initial) {
    return initial;
  } else {
    return 'B';
  }
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
