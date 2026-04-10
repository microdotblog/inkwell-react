import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useHeaderHeight } from '@react-navigation/elements';
import { observer } from 'mobx-react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AuthBackground from '../components/auth/AuthBackground';
import AuthCard from '../components/auth/AuthCard';
import PrimaryButton from '../components/auth/PrimaryButton';
import FeedTimelineCard from '../components/timeline/FeedTimelineCard';
import { resolve_bookmark_timeline_entry_content } from '../components/timeline/timelineEntryContent';
import AppStore from '../stores/App';
import Bookmarks from '../stores/Bookmarks';
import { getAuthTheme } from '../theme/authTheme';
import { createScaledTextStyles } from '../theme/textScale';

const SCREEN_HORIZONTAL_PADDING = 20;
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
                  Loading your bookmarks
                </Text>
                <Text
                  style={[
                    styles.stateBody,
                    scaled_text_styles.stateBody,
                    { color: theme.colors.inkSoft },
                  ]}
                >
                  Recent saved posts will show up here as soon as Micro.blog responds.
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
                <FeedTimelineCard
                  accessibility_label={`Open ${timeline_entry_content.display_title}`}
                  avatar_url={item.avatar_url}
                  display_title={timeline_entry_content.display_title}
                  onPress={() => handle_entry_press(item.id)}
                  row_opacity={timeline_entry_content.row_opacity}
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
});

export default observer(BookmarksScreen);
