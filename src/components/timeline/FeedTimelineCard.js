import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MenuView } from '@react-native-menu/menu';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';

const FEED_AVATAR_SIZE = 26;
const FEED_AVATAR_TRANSITION_MS = 180;

export default function FeedTimelineCard({
  accessibility_label = '',
  avatar_url = '',
  display_title = '',
  is_unread = false,
  menu_actions = [],
  onMenuAction,
  onMenuClose,
  onMenuOpen,
  onPress,
  row_opacity = 1,
  scaled_text_styles = {},
  secondary_source_label = '',
  show_bookmark_indicator = false,
  source_label = 'Feed',
  summary = '',
  theme,
  timestamp = '',
}) {
  const row_content = (
    <View style={styles.rowContentWrap}>
      <FeedSourceAvatar
        avatar_url={avatar_url}
        scaled_text_styles={scaled_text_styles}
        source={source_label}
        theme={theme}
      />
      <View style={styles.rowContent}>
        <Text
          numberOfLines={2}
          style={[
            styles.rowTitle,
            scaled_text_styles.rowTitle,
            { color: theme.colors.ink },
          ]}
        >
          {display_title}
        </Text>
        {summary ? (
          <Text
            numberOfLines={3}
            style={[
              styles.rowSummary,
              scaled_text_styles.rowSummary,
              { color: theme.colors.inkSoft },
            ]}
          >
            {summary}
          </Text>
        ) : null}
        {secondary_source_label ? (
          <Text
            numberOfLines={1}
            style={[
              styles.rowSourceLabel,
              scaled_text_styles.rowSourceLabel,
              { color: theme.colors.inkSoft },
            ]}
          >
            {secondary_source_label}
          </Text>
        ) : null}
        {timestamp || show_bookmark_indicator ? (
          <View style={styles.rowFooter}>
            {timestamp ? (
              <Text
                style={[
                  styles.timestamp,
                  scaled_text_styles.timestamp,
                  { color: theme.colors.inkSoft },
                ]}
              >
                {timestamp}
              </Text>
            ) : (
              <View />
            )}
            {show_bookmark_indicator ? (
              <View style={styles.bookmarkIndicator}>
                <MaterialIcons
                  color={theme.colors.inkSoft}
                  name="star"
                  size={16}
                />
                <Text
                  style={[
                    styles.timestamp,
                    scaled_text_styles.timestamp,
                    styles.bookmarkLabel,
                    { color: theme.colors.inkSoft },
                  ]}
                >
                  Bookmarked
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
  const should_show_menu =
    menu_actions.length > 0 && typeof onMenuAction === 'function';

  return (
    <Pressable
      accessibilityLabel={accessibility_label || display_title}
      accessibilityRole="button"
      onLongPress={should_show_menu ? () => {} : undefined}
      onPress={onPress}
      style={({ pressed }) => {
        return [
          styles.rowCard,
          {
            backgroundColor: resolve_row_background_color(theme, is_unread),
            borderColor: theme.colors.line,
            opacity: pressed ? Math.max(row_opacity - 0.08, 0.42) : row_opacity,
          },
        ];
      }}
    >
      {should_show_menu ? (
        <MenuView
          accessibilityLabel={
            accessibility_label || `More options for ${display_title}`
          }
          actions={menu_actions}
          onCloseMenu={onMenuClose}
          onOpenMenu={onMenuOpen}
          onPressAction={({ nativeEvent }) => {
            onMenuAction(nativeEvent.event);
          }}
          shouldOpenOnLongPress
          themeVariant={theme.isDark ? 'dark' : 'light'}
        >
          {row_content}
        </MenuView>
      ) : (
        row_content
      )}
    </Pressable>
  );
}

function FeedSourceAvatar({
  avatar_url = '',
  scaled_text_styles,
  source = '',
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
        styles.sourceAvatarFrame,
        {
          backgroundColor: theme.colors.accentSoft,
        },
      ]}
    >
      <View style={styles.sourceAvatarPlaceholder}>
        {should_show_initial ? (
          <Text
            style={[
              styles.sourceAvatarInitial,
              scaled_text_styles.sourceAvatarInitial,
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

function get_source_avatar_initial(source = '') {
  const trimmed_source = `${source || ''}`.trim();
  const initial = trimmed_source.charAt(0).toUpperCase();

  if (initial) {
    return initial;
  } else {
    return 'F';
  }
}

function resolve_row_background_color(theme, is_unread = false) {
  if (is_unread) {
    return theme?.colors?.paperMuted || theme?.colors?.paper;
  } else {
    return theme?.colors?.paper;
  }
}

const styles = StyleSheet.create({
  rowCard: {
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  rowContentWrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  sourceAvatarFrame: {
    width: FEED_AVATAR_SIZE,
    height: FEED_AVATAR_SIZE,
    borderRadius: FEED_AVATAR_SIZE / 2,
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
  rowContent: {
    flex: 1,
    gap: 8,
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
  rowFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  bookmarkIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  bookmarkLabel: {
    flexShrink: 0,
  },
  timestamp: {
    fontSize: 13,
    lineHeight: 18,
  },
});
