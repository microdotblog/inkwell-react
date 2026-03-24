import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { observer } from 'mobx-react';
import { SafeAreaView } from 'react-native-safe-area-context';

import AuthBackground from '../components/auth/AuthBackground';
import AuthCard from '../components/auth/AuthCard';
import PrimaryButton from '../components/auth/PrimaryButton';
import AppStore from '../stores/App';
import Highlights, { resolve_highlight_post_label } from '../stores/Highlights';
import { getAuthTheme } from '../theme/authTheme';

const SCREEN_HORIZONTAL_PADDING = 20;
const LIST_TOP_PADDING = 12;
const LIST_BOTTOM_PADDING = 28;
const COPIED_FEEDBACK_DURATION_MS = 1600;

function HighlightsScreen({ isDark = false }) {
  const accent_palette_id = AppStore.accent_palette_id;
  const theme = getAuthTheme(isDark, accent_palette_id);
  const highlight_entries = Highlights.highlight_entries();
  const total_highlights = Highlights.highlights_count();
  const search_query = Highlights.search_query;
  const error_message = Highlights.error_message;
  const has_highlights = total_highlights > 0;
  const has_search_query = Highlights.has_search_query();
  const is_loading_initial =
    Highlights.is_loading && !Highlights.has_loaded && !has_highlights;
  const is_refreshing = Highlights.is_loading && Highlights.has_loaded;
  const background_intensity = has_highlights ? 0.14 : 1;
  const [copied_highlight_id, set_copied_highlight_id] = React.useState('');
  const copied_timeout_ref = React.useRef(null);

  React.useEffect(() => {
    Highlights.load();

    return () => {
      if (copied_timeout_ref.current) {
        clearTimeout(copied_timeout_ref.current);
      }
    };
  }, []);

  const handle_search_query_change = React.useCallback((next_query = '') => {
    Highlights.set_search_query(next_query);
  }, []);

  const handle_copy_press = React.useCallback(async (highlight_id = '', text = '') => {
    const normalized_highlight_id = `${highlight_id || ''}`.trim();
    const normalized_text = `${text || ''}`.trim();

    if (!normalized_highlight_id || !normalized_text) {
      return;
    }

    try {
      await Clipboard.setStringAsync(normalized_text);

      if (copied_timeout_ref.current) {
        clearTimeout(copied_timeout_ref.current);
      }

      set_copied_highlight_id(normalized_highlight_id);
      copied_timeout_ref.current = setTimeout(() => {
        set_copied_highlight_id('');
        copied_timeout_ref.current = null;
      }, COPIED_FEEDBACK_DURATION_MS);
    } catch (error) {
      console.warn('Failed to copy highlight', error);
    }
  }, []);

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
                  Loading your highlights
                </Text>
                <Text style={[styles.stateBody, { color: theme.colors.inkSoft }]}>
                  Saved passages will show up here as soon as Micro.blog responds.
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
              highlight_entries.length === 0 ? styles.listContentEmpty : null,
            ]}
            data={highlight_entries}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={
              <HighlightsEmptyState
                error_message={error_message}
                has_highlights={has_highlights}
                has_search_query={has_search_query}
                onRetry={Highlights.refresh}
                theme={theme}
              />
            }
            ListHeaderComponent={
              <HighlightsHeader
                matching_count={highlight_entries.length}
                onChangeSearch={handle_search_query_change}
                search_query={search_query}
                theme={theme}
                total_count={total_highlights}
              />
            }
            refreshControl={
              <RefreshControl
                colors={[theme.colors.accentStrong]}
                onRefresh={Highlights.refresh}
                progressViewOffset={LIST_TOP_PADDING}
                refreshing={is_refreshing}
                tintColor={theme.colors.accentStrong}
              />
            }
            renderItem={({ item }) => {
              return (
                <HighlightRow
                  entry={item}
                  is_copied={copied_highlight_id === item.id}
                  onCopyPress={handle_copy_press}
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

function HighlightsHeader({
  matching_count = 0,
  onChangeSearch,
  search_query = '',
  theme,
  total_count = 0,
}) {
  const summary_copy = resolve_summary_copy(total_count, matching_count, search_query);

  return (
    <View style={styles.headerContent}>
      <SearchField
        onChangeText={onChangeSearch}
        theme={theme}
        value={search_query}
      />
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
              name="format-quote"
              size={16}
            />
            <Text
              style={[
                styles.summaryBadgeLabel,
                { color: theme.colors.accentStrong },
              ]}
            >
              Highlights
            </Text>
          </View>
          <Text style={[styles.summaryCopy, { color: theme.colors.inkSoft }]}>
            {summary_copy}
          </Text>
        </View>
      </View>
    </View>
  );
}

function SearchField({
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
        clearButtonMode="while-editing"
        onChangeText={onChangeText}
        onSubmitEditing={Keyboard.dismiss}
        placeholder="Search highlights"
        placeholderTextColor={theme.colors.inkSoft}
        returnKeyType="search"
        selectionColor={theme.colors.accentStrong}
        style={[styles.searchInput, { color: theme.colors.ink }]}
        value={value}
      />
    </View>
  );
}

function HighlightsEmptyState({
  error_message = '',
  has_highlights = false,
  has_search_query = false,
  onRetry,
  theme,
}) {
  if (has_highlights && has_search_query) {
    return (
      <AuthCard style={styles.stateCard} theme={theme}>
        <View style={styles.stateCopy}>
          <Text style={[styles.stateTitle, { color: theme.colors.ink }]}>
            No matching highlights
          </Text>
          <Text style={[styles.stateBody, { color: theme.colors.inkSoft }]}>
            Try a different phrase, title, or source to narrow the list another way.
          </Text>
        </View>
      </AuthCard>
    );
  }

  if (error_message) {
    return (
      <AuthCard style={styles.stateCard} theme={theme}>
        <View style={styles.stateCopy}>
          <Text style={[styles.stateTitle, { color: theme.colors.ink }]}>
            Couldn't load your highlights
          </Text>
          <Text style={[styles.stateBody, { color: theme.colors.inkSoft }]}>
            {error_message}
          </Text>
        </View>
        <PrimaryButton
          label="Try again"
          onPress={onRetry}
          theme={theme}
        />
      </AuthCard>
    );
  }

  return (
    <AuthCard style={styles.stateCard} theme={theme}>
      <View style={styles.stateCopy}>
        <Text style={[styles.stateTitle, { color: theme.colors.ink }]}>
          No highlights yet
        </Text>
        <Text style={[styles.stateBody, { color: theme.colors.inkSoft }]}>
          Highlights you save on Micro.blog will collect here for later reference.
        </Text>
      </View>
    </AuthCard>
  );
}

function HighlightRow({
  entry,
  is_copied = false,
  onCopyPress,
  theme,
}) {
  const post_label = resolve_highlight_post_label(entry);
  const timestamp = format_highlight_date(entry);

  return (
    <View
      style={[
        styles.rowCard,
        {
          backgroundColor: theme.colors.paper,
          borderColor: theme.colors.line,
        },
      ]}
    >
      <View
        style={[
          styles.highlightTextWrap,
          {
            backgroundColor: theme.colors.accentSoft,
            borderColor: theme.colors.line,
          },
        ]}
      >
        <Text style={[styles.highlightText, { color: theme.colors.ink }]}>
          {entry.text}
        </Text>
      </View>

      <View style={styles.rowMeta}>
        <Text style={[styles.postLabel, { color: theme.colors.ink }]}>
          {post_label}
        </Text>
        {timestamp ? (
          <Text style={[styles.timestamp, { color: theme.colors.inkSoft }]}>
            {timestamp}
          </Text>
        ) : null}
      </View>

      <View style={styles.rowActions}>
        <Pressable
          accessibilityLabel={is_copied ? 'Copied highlight text' : 'Copy highlight text'}
          accessibilityRole="button"
          onPress={() => onCopyPress?.(entry.id, entry.text)}
          style={({ pressed }) => {
            return [
              styles.copyButton,
              {
                backgroundColor: is_copied
                  ? theme.colors.accentSoft
                  : theme.colors.buttonGhost,
                borderColor: theme.colors.line,
                opacity: pressed ? 0.84 : 1,
              },
            ];
          }}
        >
          <Text
            style={[
              styles.copyButtonLabel,
              {
                color: is_copied
                  ? theme.colors.accentStrong
                  : theme.colors.inkSoft,
              },
            ]}
          >
            {is_copied ? 'Copied' : 'Copy'}
          </Text>
        </Pressable>
      </View>
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
  headerContent: {
    gap: 14,
    marginBottom: 14,
  },
  searchField: {
    minHeight: 52,
    borderRadius: 24,
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
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  highlightTextWrap: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  highlightText: {
    fontSize: 16,
    lineHeight: 25,
  },
  rowMeta: {
    gap: 4,
  },
  postLabel: {
    fontFamily: 'Newsreader_600SemiBold',
    fontSize: 22,
    lineHeight: 28,
  },
  timestamp: {
    fontSize: 13,
    lineHeight: 18,
  },
  rowActions: {
    alignItems: 'flex-start',
  },
  copyButton: {
    minHeight: 34,
    minWidth: 72,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  copyButtonLabel: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 16,
  },
});

export default observer(HighlightsScreen);

function resolve_summary_card_background_color(theme) {
  return theme?.colors?.badge || theme?.colors?.paper || '#ffffff';
}

function resolve_summary_copy(total_count = 0, matching_count = 0, search_query = '') {
  const has_search_query = `${search_query || ''}`.trim().length > 0;

  if (total_count === 0) {
    return 'Search saved highlights';
  }

  if (has_search_query) {
    return `${matching_count} matching highlight${matching_count === 1 ? '' : 's'}`;
  }

  return `Showing ${total_count} highlight${total_count === 1 ? '' : 's'}`;
}

function format_highlight_date(highlight = null) {
  const date = resolve_highlight_date(highlight);

  if (!date) {
    return '';
  }

  const date_text = date.toLocaleDateString([], {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  });
  const time_text = date
    .toLocaleTimeString([], {
      hour: 'numeric',
      hour12: true,
      minute: '2-digit',
    })
    .toLowerCase();

  return `${date_text} ${time_text}`;
}

function resolve_highlight_date(highlight = null) {
  const created_at = parse_date(highlight?.created_at);

  if (created_at) {
    return created_at;
  }

  const published_at = parse_date(highlight?.post_published_at);

  if (published_at) {
    return published_at;
  }

  const local_id = typeof highlight?.id === 'string' ? highlight.id : '';
  const local_match = local_id.match(/^hl-(\d+)$/);

  if (!local_match) {
    return null;
  }

  const timestamp = Number(local_match[1]);

  if (!Number.isFinite(timestamp)) {
    return null;
  }

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function parse_date(raw_value = '') {
  if (!raw_value) {
    return null;
  }

  const date = new Date(raw_value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}
