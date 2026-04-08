import React from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useHeaderHeight } from '@react-navigation/elements';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { observer } from 'mobx-react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AuthBackground from '../components/auth/AuthBackground';
import AuthCard from '../components/auth/AuthCard';
import HighlightItem from '../components/highlights/HighlightItem';
import PrimaryButton from '../components/auth/PrimaryButton';
import AppStore from '../stores/App';
import Highlights from '../stores/Highlights';
import { getAuthTheme } from '../theme/authTheme';
import { createScaledTextStyles } from '../theme/textScale';

const SCREEN_HORIZONTAL_PADDING = 20;
const LIST_TOP_PADDING = 12;
const LIST_BOTTOM_PADDING = 28;
const COPIED_FEEDBACK_DURATION_MS = 1600;
const TEXT_STYLE_NAMES = [
  'searchInput',
  'summaryBadgeLabel',
  'summaryCopy',
  'stateTitle',
  'stateBody',
];

function HighlightsScreen({ isDark = false }) {
  const accent_palette_id = AppStore.accent_palette_id;
  const text_scale = AppStore.text_scale;
  const theme = getAuthTheme(isDark, accent_palette_id);
  const scaled_text_styles = React.useMemo(() => {
    return createScaledTextStyles(styles, TEXT_STYLE_NAMES, text_scale);
  }, [text_scale]);
  const header_height = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
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
  const content_top_padding = header_height + LIST_TOP_PADDING;
  const list_bottom_inset = insets.bottom + LIST_BOTTOM_PADDING;
  const [copied_highlight_id, set_copied_highlight_id] = React.useState('');
  const [deleting_highlight_id, set_deleting_highlight_id] = React.useState('');
  const copied_timeout_ref = React.useRef(null);
  const [is_search_open, set_is_search_open] = React.useState(false);

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={is_search_open ? 'Close search' : 'Open search'}
          onPress={() => {
            set_is_search_open((prev) => {
              if (prev) {
                // Closing search, clear the filter
                Highlights.set_search_query('');
              }
              return !prev;
            });
          }}
          style={({ pressed }) => [
            styles.headerButton,
            { opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <MaterialIcons
            color={theme.colors.ink}
            name={is_search_open ? 'close' : 'search'}
            size={24}
          />
        </Pressable>
      ),
    });
  }, [navigation, is_search_open, theme.colors.ink]);

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

  const handle_copy_press = React.useCallback(async (entry = null) => {
    const normalized_highlight_id = `${entry?.id || ''}`.trim();
    const normalized_text = `${entry?.text || ''}`.trim();

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

  const handle_delete_press = React.useCallback((entry = null) => {
    const normalized_highlight_id = `${entry?.id || ''}`.trim();

    if (!normalized_highlight_id || deleting_highlight_id) {
      return;
    }

    Alert.alert(
      'Delete highlight?',
      'This removes the saved passage from your highlights.',
      [
        {
          style: 'cancel',
          text: 'Cancel',
        },
        {
          style: 'destructive',
          text: 'Delete',
          onPress: async () => {
            set_deleting_highlight_id(normalized_highlight_id);

            try {
              const result = await Highlights.delete_highlight(
                normalized_highlight_id,
              );

              if (!result?.ok) {
                AppStore.show_toast(
                  result?.error_message ||
                    'We could not delete that highlight.',
                  {
                    top_offset: header_height + 10,
                  },
                );
                return;
              }

              if (copied_highlight_id === normalized_highlight_id) {
                set_copied_highlight_id('');
              }

              AppStore.show_toast('Highlight deleted', {
                top_offset: header_height + 10,
              });
            } finally {
              set_deleting_highlight_id('');
            }
          },
        },
      ],
    );
  }, [copied_highlight_id, deleting_highlight_id, header_height]);

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
                <Text
                  style={[
                    styles.stateTitle,
                    scaled_text_styles.stateTitle,
                    { color: theme.colors.ink },
                  ]}
                >
                  Loading your highlights
                </Text>
                <Text
                  style={[
                    styles.stateBody,
                    scaled_text_styles.stateBody,
                    { color: theme.colors.inkSoft },
                  ]}
                >
                  Saved passages will show up here as soon as Micro.blog responds.
                </Text>
              </View>
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
                scaled_text_styles={scaled_text_styles}
                theme={theme}
              />
            }
            ListHeaderComponent={
              <HighlightsHeader
                is_search_open={is_search_open}
                matching_count={highlight_entries.length}
                onChangeSearch={handle_search_query_change}
                scaled_text_styles={scaled_text_styles}
                search_query={search_query}
                theme={theme}
                total_count={total_highlights}
              />
            }
            refreshControl={
              <RefreshControl
                colors={[theme.colors.accentStrong]}
                onRefresh={Highlights.refresh}
                progressViewOffset={content_top_padding}
                refreshing={is_refreshing}
                tintColor={theme.colors.accentStrong}
              />
            }
            renderItem={({ item }) => {
              return (
                <HighlightItem
                  entry={item}
                  is_copied={copied_highlight_id === item.id}
                  is_deleting={deleting_highlight_id === item.id}
                  onCopyPress={handle_copy_press}
                  onDeletePress={handle_delete_press}
                  text_scale={text_scale}
                  theme={theme}
                />
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

function HighlightsHeader({
  is_search_open = false,
  matching_count = 0,
  onChangeSearch,
  scaled_text_styles,
  search_query = '',
  theme,
  total_count = 0,
}) {
  const display_count = is_search_open || search_query ? matching_count : total_count;
  const summary_copy =
    display_count === 1 ? '1 highlight' : `${display_count} highlights`;

  return (
    <View style={styles.headerContent}>
      {is_search_open ? (
        <SearchField
          autoFocus={true}
          onChangeText={onChangeSearch}
          scaled_text_styles={scaled_text_styles}
          theme={theme}
          value={search_query}
        />
      ) : null}
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryBadge}>
            <MaterialIcons
              color={theme.colors.accentStrong}
              name="format-quote"
              size={16}
            />
            <Text
              style={[
                styles.summaryBadgeLabel,
                scaled_text_styles.summaryBadgeLabel,
                { color: theme.colors.accentStrong },
              ]}
            >
              {summary_copy}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function SearchField({
  autoFocus = false,
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
        autoFocus={autoFocus}
        clearButtonMode="while-editing"
        onChangeText={onChangeText}
        onSubmitEditing={Keyboard.dismiss}
        placeholder="Search highlights"
        placeholderTextColor={theme.colors.inkSoft}
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

function HighlightsEmptyState({
  error_message = '',
  has_highlights = false,
  has_search_query = false,
  onRetry,
  scaled_text_styles,
  theme,
}) {
  if (has_highlights && has_search_query) {
    return (
      <AuthCard style={styles.stateCard} theme={theme}>
        <View style={styles.stateCopy}>
          <Text
            style={[
              styles.stateTitle,
              scaled_text_styles.stateTitle,
              { color: theme.colors.ink },
            ]}
          >
            No matching highlights
          </Text>
          <Text
            style={[
              styles.stateBody,
              scaled_text_styles.stateBody,
              { color: theme.colors.inkSoft },
            ]}
          >
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
          <Text
            style={[
              styles.stateTitle,
              scaled_text_styles.stateTitle,
              { color: theme.colors.ink },
            ]}
          >
            Couldn't load your highlights
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
          onPress={onRetry}
          theme={theme}
        />
      </AuthCard>
    );
  }

  return (
    <AuthCard style={styles.stateCard} theme={theme}>
      <View style={styles.stateCopy}>
        <Text
          style={[
            styles.stateTitle,
            scaled_text_styles.stateTitle,
            { color: theme.colors.ink },
          ]}
        >
          No highlights yet
        </Text>
        <Text
          style={[
            styles.stateBody,
            scaled_text_styles.stateBody,
            { color: theme.colors.inkSoft },
          ]}
        >
          Highlights you save on Micro.blog will collect here for later reference.
        </Text>
      </View>
    </AuthCard>
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
  headerButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
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
    marginRight: 10,
    marginTop: 2,
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
    borderRadius: 24,
    marginVertical: 8,
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
    flexDirection: 'row',
    gap: 6,
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
});

export default observer(HighlightsScreen);
