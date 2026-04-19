import React from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MenuView } from '@react-native-menu/menu';
import { useHeaderHeight } from '@react-navigation/elements';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { observer } from 'mobx-react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AuthBackground from '../components/auth/AuthBackground';
import AuthCard from '../components/auth/AuthCard';
import PrimaryButton from '../components/auth/PrimaryButton';
import AppStore from '../stores/App';
import Feed from '../stores/Feed';
import { getAuthTheme } from '../theme/authTheme';
import { createScaledTextStyles } from '../theme/textScale';

const SCREEN_HORIZONTAL_PADDING = 16;
const LIST_TOP_PADDING = 12;
const LIST_BOTTOM_PADDING = 28;
const FEED_AVATAR_SIZE = 28;
const FEED_AVATAR_TRANSITION_MS = 180;
const READ_ROW_OPACITY = 0.4;
const MENU_DISMISS_TOUCH_OVERLAY_DELAY_MS = 160;
const TEXT_STYLE_NAMES = [
  'editActionButtonLabel',
  'editInput',
  'editingLabel',
  'inlineStateBody',
  'inlineStateTitle',
  'renameError',
  'rowSummary',
  'rowTitle',
  'sourceAvatarInitial',
  'sourceLabel',
  'stateBody',
  'stateTitle',
  'summaryBadgeLabel',
  'summaryCopy',
  'summaryLink',
  'timestamp',
];

function SubscriptionFeedScreen({ navigation, route, isDark = false }) {
  const accent_palette_id = AppStore.accent_palette_id;
  const theme = getAuthTheme(isDark, accent_palette_id);
  const scaled_text_styles = React.useMemo(() => {
    return createScaledTextStyles(styles, TEXT_STYLE_NAMES);
  }, []);
  const header_height = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const feed_id = normalize_string(route?.params?.feed_id);
  const subscription = Feed.subscription_snapshot(feed_id);
  const subscription_title = resolve_subscription_title(subscription);
  const has_matching_feed = Feed.active_subscription_feed_id === feed_id;
  const subscription_feed_entries = has_matching_feed
    ? Feed.active_subscription_feed_entries()
    : [];
  const error_message =
    has_matching_feed ? Feed.subscription_feed_error_message : '';
  const is_waiting_for_initial_load =
    Boolean(feed_id) &&
    !has_matching_feed &&
    !Feed.has_loaded_subscription_feed;
  const is_loading_initial =
    (Feed.is_loading_subscription_feed || is_waiting_for_initial_load) &&
    !Feed.has_loaded_subscription_feed &&
    subscription_feed_entries.length === 0;
  const is_refreshing =
    Feed.is_loading_subscription_feed &&
    has_matching_feed &&
    Feed.has_loaded_subscription_feed;
  const content_top_padding = header_height + LIST_TOP_PADDING;
  const list_bottom_inset = insets.bottom + LIST_BOTTOM_PADDING;
  const toast_top_offset = header_height + 10;
  const subscription_id = normalize_string(subscription?.id);
  const [is_rename_open, set_is_rename_open] = React.useState(false);
  const [rename_value, set_rename_value] = React.useState('');
  const [rename_error_message, set_rename_error_message] = React.useState('');
  const [is_renaming, set_is_renaming] = React.useState(false);
  const [is_removing, set_is_removing] = React.useState(false);
  const menu_touch_overlay_timeout_ref = React.useRef(null);
  const [is_menu_touch_overlay_active, set_is_menu_touch_overlay_active] =
    React.useState(false);
  const is_busy = is_renaming || is_removing;
  const subscription_menu_actions = React.useMemo(() => {
    return get_subscription_menu_actions(theme);
  }, [theme]);

  React.useEffect(() => {
    if (!feed_id) {
      return undefined;
    }

    Feed.load_subscription_feed(feed_id);

    return () => {
      Feed.clear_active_subscription_feed();
    };
  }, [feed_id]);

  const handle_refresh = React.useCallback(() => {
    if (!feed_id) {
      return;
    }

    Feed.refresh_subscription_feed(feed_id);
  }, [feed_id]);

  const handle_entry_press = React.useCallback(
    (entry_id = '') => {
      const normalized_entry_id = normalize_string(entry_id);

      if (!normalized_entry_id) {
        return;
      }

      Feed.open_entry(normalized_entry_id);
      navigation.navigate('FeedItemDetail', {
        entry_id: normalized_entry_id,
        entry_source: 'subscription_feed',
      });
    },
    [navigation],
  );

  const handle_start_rename = React.useCallback(() => {
    if (!subscription_id || is_busy) {
      return;
    }

    set_is_rename_open(true);
    set_rename_value(subscription_title);
    set_rename_error_message('');
  }, [is_busy, subscription_id, subscription_title]);

  const handle_cancel_rename = React.useCallback(() => {
    set_is_rename_open(false);
    set_rename_value('');
    set_rename_error_message('');
  }, []);

  const handle_save_rename = React.useCallback(async () => {
    const normalized_title = normalize_string(rename_value);

    if (!subscription_id) {
      return;
    }

    if (!normalized_title) {
      set_rename_error_message('Enter a title before saving.');
      return;
    }

    set_is_renaming(true);
    set_rename_error_message('');

    try {
      const result = await Feed.rename_subscription(subscription_id, normalized_title);

      if (!result?.ok) {
        set_rename_error_message(
          result?.error_message || 'We could not rename that subscription.',
        );
        return;
      }

      handle_cancel_rename();
      AppStore.show_toast('Subscription renamed', {
        top_offset: toast_top_offset,
      });
    } finally {
      set_is_renaming(false);
    }
  }, [
    handle_cancel_rename,
    rename_value,
    subscription_id,
    toast_top_offset,
  ]);

  const confirm_remove_subscription = React.useCallback(() => {
    if (!subscription_id || is_busy) {
      return;
    }

    Alert.alert(
      'Remove subscription?',
      'This removes the feed from your subscriptions.',
      [
        {
          style: 'cancel',
          text: 'Cancel',
        },
        {
          style: 'destructive',
          text: 'Remove',
          onPress: async () => {
            set_is_removing(true);

            try {
              const result = await Feed.delete_subscription(subscription_id);

              if (!result?.ok) {
                AppStore.show_toast(
                  result?.error_message || 'We could not remove that subscription.',
                  {
                    top_offset: toast_top_offset,
                  },
                );
                return;
              }

              handle_cancel_rename();
              AppStore.show_toast('Subscription removed', {
                top_offset: toast_top_offset,
              });
              navigation.goBack();
            } finally {
              set_is_removing(false);
            }
          },
        },
      ],
    );
  }, [
    handle_cancel_rename,
    is_busy,
    navigation,
    subscription_id,
    toast_top_offset,
  ]);

  const handle_header_menu_action = React.useCallback(
    (action_id = '') => {
      if (action_id === 'rename') {
        handle_start_rename();
        return;
      }

      if (action_id === 'remove') {
        confirm_remove_subscription();
      }
    },
    [confirm_remove_subscription, handle_start_rename],
  );

  const handle_menu_open = React.useCallback(() => {
    if (menu_touch_overlay_timeout_ref.current) {
      clearTimeout(menu_touch_overlay_timeout_ref.current);
      menu_touch_overlay_timeout_ref.current = null;
    }

    set_is_menu_touch_overlay_active(true);
  }, []);

  const handle_menu_close = React.useCallback(() => {
    if (menu_touch_overlay_timeout_ref.current) {
      clearTimeout(menu_touch_overlay_timeout_ref.current);
    }

    menu_touch_overlay_timeout_ref.current = setTimeout(() => {
      set_is_menu_touch_overlay_active(false);
      menu_touch_overlay_timeout_ref.current = null;
    }, MENU_DISMISS_TOUCH_OVERLAY_DELAY_MS);
  }, []);

  React.useEffect(() => {
    return () => {
      if (menu_touch_overlay_timeout_ref.current) {
        clearTimeout(menu_touch_overlay_timeout_ref.current);
      }
    };
  }, []);

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: subscription_id
        ? () => (
            <HeaderSubscriptionMenuButton
              is_dark={isDark}
              is_disabled={is_busy}
              menu_actions={subscription_menu_actions}
              onMenuAction={handle_header_menu_action}
              onMenuClose={handle_menu_close}
              onMenuOpen={handle_menu_open}
              theme={theme}
            />
          )
        : undefined,
      title: subscription_title,
    });
  }, [
    handle_header_menu_action,
    isDark,
    is_busy,
    handle_menu_close,
    handle_menu_open,
    navigation,
    subscription_id,
    subscription_menu_actions,
    subscription_title,
    theme,
  ]);

  if (!feed_id) {
    return (
      <View style={[styles.screen, { backgroundColor: theme.colors.canvas }]}>
        <AuthBackground theme={theme} />
        <View style={styles.safeArea}>
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
              <View style={styles.stateCopy}>
                <Text
                  style={[
                    styles.stateTitle,
                    scaled_text_styles.stateTitle,
                    { color: theme.colors.ink },
                  ]}
                >
                  No subscription selected
                </Text>
                <Text
                  style={[
                    styles.stateBody,
                    scaled_text_styles.stateBody,
                    { color: theme.colors.inkSoft },
                  ]}
                >
                  Go back and choose a subscription to browse its entries.
                </Text>
              </View>
            </AuthCard>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.canvas }]}>
      <AuthBackground
        intensity={subscription_feed_entries.length > 0 ? 0.14 : 1}
        theme={theme}
      />
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
                <ActivityIndicator
                  color={theme.colors.accentStrong}
                  size="small"
                />
              </View>
              <View style={styles.stateCopy}>
                <Text
                  style={[
                    styles.stateTitle,
                    scaled_text_styles.stateTitle,
                    { color: theme.colors.ink },
                  ]}
                >
                  Loading feed entries
                </Text>
                <Text
                  style={[
                    styles.stateBody,
                    scaled_text_styles.stateBody,
                    { color: theme.colors.inkSoft },
                  ]}
                >
                  Recent posts from this subscription will show up here shortly.
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
              subscription_feed_entries.length === 0
                ? styles.listContentEmpty
                : null,
            ]}
            data={subscription_feed_entries}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={
              <SubscriptionFeedEmptyState
                error_message={error_message}
                onRetry={handle_refresh}
                scaled_text_styles={scaled_text_styles}
                theme={theme}
              />
            }
            ListHeaderComponent={
              <SubscriptionFeedHeader
                error_message={
                  subscription_feed_entries.length > 0 ? error_message : ''
                }
                is_busy={is_busy}
                is_editing={is_rename_open}
                onCancelRename={handle_cancel_rename}
                onChangeRenameValue={set_rename_value}
                onSaveRename={handle_save_rename}
                rename_error_message={rename_error_message}
                rename_value={rename_value}
                scaled_text_styles={scaled_text_styles}
                subscription={subscription}
                theme={theme}
              />
            }
            refreshControl={
              <RefreshControl
                colors={[theme.colors.accentStrong]}
                onRefresh={handle_refresh}
                progressViewOffset={content_top_padding}
                refreshing={is_refreshing}
                tintColor={theme.colors.accentStrong}
              />
            }
            renderItem={({ item }) => {
              return (
                <FeedTimelineRow
                  entry={item}
                  onPress={handle_entry_press}
                  scaled_text_styles={scaled_text_styles}
                  theme={theme}
                />
              );
            }}
            showsVerticalScrollIndicator={false}
            style={styles.list}
          />
        )}
      </View>
      {is_menu_touch_overlay_active ? (
        <Pressable
          accessibilityElementsHidden
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          onPress={() => {}}
          style={styles.menuDismissTouchOverlay}
        />
      ) : null}
    </View>
  );
}

function SubscriptionFeedHeader({
  error_message = '',
  is_busy = false,
  is_editing = false,
  onCancelRename,
  onChangeRenameValue,
  onSaveRename,
  rename_error_message = '',
  rename_value = '',
  scaled_text_styles,
  subscription = null,
  theme,
}) {
  const supporting_url =
    normalize_string(subscription?.site_url) ||
    normalize_string(subscription?.feed_url);

  return (
    <View style={styles.headerContent}>
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
              name="rss-feed"
              size={16}
            />
            <Text
              style={[
                styles.summaryBadgeLabel,
                scaled_text_styles.summaryBadgeLabel,
                { color: theme.colors.accentStrong },
              ]}
            >
              Feed
            </Text>
          </View>
          <Text
            style={[
              styles.summaryCopy,
              scaled_text_styles.summaryCopy,
              { color: theme.colors.inkSoft },
            ]}
          >
            Latest entries
          </Text>
        </View>
        {supporting_url ? (
          <Text
            style={[
              styles.summaryLink,
              scaled_text_styles.summaryLink,
              { color: theme.colors.inkSoft },
            ]}
          >
            {supporting_url}
          </Text>
        ) : null}
      </View>

      {is_editing ? (
        <SubscriptionRenameCard
          is_busy={is_busy}
          onCancelRename={onCancelRename}
          onChangeRenameValue={onChangeRenameValue}
          onSaveRename={onSaveRename}
          rename_error_message={rename_error_message}
          rename_value={rename_value}
          scaled_text_styles={scaled_text_styles}
          subscription={subscription}
          theme={theme}
        />
      ) : null}

      {error_message ? (
        <AuthCard style={styles.inlineStateCard} theme={theme}>
          <Text
            style={[
              styles.inlineStateTitle,
              scaled_text_styles.inlineStateTitle,
              { color: theme.colors.ink },
            ]}
          >
            {"Couldn't refresh this feed"}
          </Text>
          <Text
            style={[
              styles.inlineStateBody,
              scaled_text_styles.inlineStateBody,
              { color: theme.colors.inkSoft },
            ]}
          >
            {error_message}
          </Text>
        </AuthCard>
      ) : null}
    </View>
  );
}

function SubscriptionRenameCard({
  is_busy = false,
  onCancelRename,
  onChangeRenameValue,
  onSaveRename,
  rename_error_message = '',
  rename_value = '',
  scaled_text_styles,
  subscription = null,
  theme,
}) {
  const title = resolve_subscription_title(subscription);

  return (
    <View
      style={[
        styles.renameCard,
        {
          backgroundColor: theme.colors.paper,
          borderColor: theme.colors.line,
        },
      ]}
    >
      <View style={styles.renameHeader}>
        <Text
          style={[
            styles.editingLabel,
            scaled_text_styles.editingLabel,
            { color: theme.colors.inkSoft },
          ]}
        >
          Rename subscription
        </Text>
        <Text
          numberOfLines={1}
          style={[
            styles.renameTitle,
            scaled_text_styles.summaryCopy,
            { color: theme.colors.ink },
          ]}
        >
          {title}
        </Text>
      </View>
      <View
        style={[
          styles.editInputWrap,
          {
            backgroundColor: theme.colors.canvas,
            borderColor: theme.colors.line,
          },
        ]}
      >
        <TextInput
          autoCapitalize="sentences"
          autoCorrect={false}
          autoFocus
          editable={!is_busy}
          onChangeText={onChangeRenameValue}
          onSubmitEditing={onSaveRename}
          placeholder="Subscription title"
          placeholderTextColor={theme.colors.inkSoft}
          returnKeyType="done"
          selectionColor={theme.colors.accentStrong}
          style={[
            styles.editInput,
            scaled_text_styles.editInput,
            { color: theme.colors.ink },
          ]}
          value={rename_value}
        />
      </View>
      {rename_error_message ? (
        <Text
          style={[
            styles.renameError,
            scaled_text_styles.renameError,
            { color: theme.colors.danger },
          ]}
        >
          {rename_error_message}
        </Text>
      ) : null}
      <View style={styles.editActions}>
        <Pressable
          accessibilityRole="button"
          disabled={is_busy}
          onPress={onSaveRename}
          style={({ pressed }) => {
            return [
              styles.editActionButton,
              {
                backgroundColor: theme.colors.accentSoft,
                borderColor: theme.colors.line,
                opacity: is_busy ? 0.56 : pressed ? 0.84 : 1,
              },
            ];
          }}
        >
          <Text
            style={[
              styles.editActionButtonLabel,
              scaled_text_styles.editActionButtonLabel,
              { color: theme.colors.accentStrong },
            ]}
          >
            Save
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={is_busy}
          onPress={onCancelRename}
          style={({ pressed }) => {
            return [
              styles.editActionButton,
              {
                backgroundColor: theme.colors.canvas,
                borderColor: theme.colors.line,
                opacity: is_busy ? 0.56 : pressed ? 0.84 : 1,
              },
            ];
          }}
        >
          <Text
            style={[
              styles.editActionButtonLabel,
              scaled_text_styles.editActionButtonLabel,
              { color: theme.colors.inkSoft },
            ]}
          >
            Cancel
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function FeedTimelineRow({ entry, onPress, scaled_text_styles, theme }) {
  const source_label = entry.source || 'Feed';
  const title = resolve_entry_title(entry);
  const has_title = Boolean(title);
  const summary = resolve_entry_summary(entry, title);
  const should_show_body = has_title || Boolean(summary);
  const timestamp = format_entry_timestamp(entry.published_at);
  const row_opacity = entry.is_read ? READ_ROW_OPACITY : 1;

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
            opacity: pressed ? Math.max(row_opacity - 0.08, 0.42) : row_opacity,
          },
        ];
      }}
    >
      <View style={styles.rowHeader}>
        <View style={styles.sourceWrap}>
          <FeedSourceAvatar
            avatar_url={entry.avatar_url}
            scaled_text_styles={scaled_text_styles}
            source={source_label}
            theme={theme}
          />
          <Text
            numberOfLines={1}
            style={[
              styles.sourceLabel,
              scaled_text_styles.sourceLabel,
              { color: theme.colors.inkSoft },
            ]}
          >
            {source_label}
          </Text>
        </View>
        <Text
          style={[
            styles.timestamp,
            scaled_text_styles.timestamp,
            { color: theme.colors.inkSoft },
          ]}
        >
          {timestamp}
        </Text>
      </View>

      {should_show_body ? (
        <View style={styles.rowBody}>
          {has_title ? (
            <Text
              numberOfLines={2}
              style={[
                styles.rowTitle,
                scaled_text_styles.rowTitle,
                { color: theme.colors.ink },
              ]}
            >
              {title}
            </Text>
          ) : null}
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
        </View>
      ) : null}
    </Pressable>
  );
}

function FeedSourceAvatar({
  avatar_url = '',
  scaled_text_styles,
  source = '',
  theme,
}) {
  const trimmed_avatar_url = normalize_string(avatar_url);
  const [did_fail_to_load, set_did_fail_to_load] = React.useState(false);
  const [is_image_loaded, set_is_image_loaded] = React.useState(false);
  const initial = get_source_avatar_initial(source);
  const should_show_image = trimmed_avatar_url && !did_fail_to_load;
  const should_show_initial =
    !trimmed_avatar_url || did_fail_to_load || !is_image_loaded;

  return (
    <View
      style={[
        styles.sourceAvatarWrap,
        {
          backgroundColor: theme.colors.accentSoft,
          borderColor: theme.colors.line,
        },
      ]}
    >
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

function HeaderSubscriptionMenuButton({
  is_dark = false,
  is_disabled = false,
  menu_actions = [],
  onMenuAction,
  onMenuClose,
  onMenuOpen,
  theme,
}) {
  if (menu_actions.length === 0) {
    return null;
  }

  const button = (
    <View
      accessibilityRole="button"
      style={[
        styles.headerMenuButton,
        is_disabled ? styles.headerMenuButtonDisabled : null,
      ]}
    >
      <MaterialIcons
        color={theme.colors.accentStrong}
        name="more-horiz"
        size={24}
      />
    </View>
  );

  if (is_disabled) {
    return button;
  }

  return (
    <MenuView
      accessibilityLabel="Open subscription actions"
      actions={menu_actions}
      onCloseMenu={onMenuClose}
      onOpenMenu={onMenuOpen}
      onPressAction={({ nativeEvent }) => {
        onMenuAction?.(nativeEvent.event);
      }}
      shouldOpenOnLongPress={false}
      themeVariant={is_dark ? 'dark' : 'light'}
    >
      {button}
    </MenuView>
  );
}

function SubscriptionFeedEmptyState({
  error_message = '',
  onRetry,
  scaled_text_styles,
  theme,
}) {
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
            {"Couldn't load this feed"}
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
          No entries yet
        </Text>
        <Text
          style={[
            styles.stateBody,
            scaled_text_styles.stateBody,
            { color: theme.colors.inkSoft },
          ]}
        >
          This subscription does not have any recent entries right now.
        </Text>
      </View>
    </AuthCard>
  );
}

const styles = StyleSheet.create({
  editActionButton: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 16,
  },
  editActionButtonLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  editActions: {
    flexDirection: 'row',
    gap: 10,
  },
  editInput: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  editInputWrap: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  editingLabel: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  headerContent: {
    gap: 14,
    marginBottom: 14,
  },
  headerMenuButton: {
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  headerMenuButtonDisabled: {
    opacity: 0.42,
  },
  inlineStateBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  inlineStateCard: {
    gap: 6,
  },
  inlineStateTitle: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  list: {
    flex: 1,
  },
  menuDismissTouchOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 4,
  },
  listContent: {
    flexGrow: 1,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  loadingOrb: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  renameCard: {
    borderRadius: 22,
    borderWidth: 1,
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  renameError: {
    fontSize: 13,
    lineHeight: 18,
  },
  renameHeader: {
    gap: 4,
  },
  renameTitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  rowBody: {
    gap: 8,
  },
  rowCard: {
    borderRadius: 22,
    borderWidth: 1,
    gap: 14,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rowSummary: {
    fontSize: 15,
    lineHeight: 21,
  },
  rowTitle: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
  },
  safeArea: {
    flex: 1,
  },
  screen: {
    flex: 1,
  },
  sourceAvatarImage: {
    borderRadius: 999,
    height: FEED_AVATAR_SIZE,
    left: 0,
    position: 'absolute',
    top: 0,
    width: FEED_AVATAR_SIZE,
  },
  sourceAvatarInitial: {
    fontSize: 12,
    fontWeight: '700',
  },
  sourceAvatarWrap: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    height: FEED_AVATAR_SIZE,
    justifyContent: 'center',
    overflow: 'hidden',
    width: FEED_AVATAR_SIZE,
  },
  sourceLabel: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 17,
  },
  sourceWrap: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    marginRight: 12,
  },
  stateBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  stateCard: {
    gap: 18,
  },
  stateCopy: {
    gap: 8,
  },
  stateScreen: {
    flex: 1,
    justifyContent: 'center',
  },
  stateTitle: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
  },
  summaryBadge: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  summaryBadgeLabel: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 14,
  },
  summaryCard: {
    borderRadius: 22,
    borderWidth: 1,
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowOffset: {
      height: 16,
      width: 0,
    },
    shadowOpacity: 0.08,
    shadowRadius: 32,
  },
  summaryCopy: {
    fontSize: 13,
    lineHeight: 18,
  },
  summaryLink: {
    fontSize: 13,
    lineHeight: 18,
  },
  summaryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timestamp: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
});

function normalize_string(value = '') {
  return `${value || ''}`.trim();
}

function resolve_subscription_title(subscription = null) {
  return (
    normalize_string(subscription?.title) ||
    normalize_string(subscription?.site_url) ||
    normalize_string(subscription?.feed_url) ||
    'Feed'
  );
}

function resolve_entry_title(entry) {
  const title = normalize_entry_text(entry?.title);

  if (title) {
    return title;
  } else {
    return '';
  }
}

function resolve_entry_summary(entry, title = '') {
  const normalized_title = normalize_entry_text(title || entry?.title);
  const summary = normalize_entry_text(entry?.summary);

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

function get_source_avatar_initial(source = '') {
  const trimmed_source = `${source || ''}`.trim();
  const initial = trimmed_source.charAt(0).toUpperCase();

  if (initial) {
    return initial;
  } else {
    return 'F';
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

function resolve_summary_card_background_color(theme) {
  return theme.isDark
    ? 'rgba(255, 255, 255, 0.03)'
    : 'rgba(255, 255, 255, 0.72)';
}

function get_subscription_menu_actions(theme) {
  return [
    {
      id: 'rename',
      image: Platform.select({
        ios: 'pencil',
      }),
      imageColor: theme.colors.inkSoft,
      title: 'Rename',
    },
    {
      attributes: {
        destructive: true,
      },
      id: 'remove',
      image: Platform.select({
        ios: 'trash',
      }),
      imageColor: theme.colors.danger,
      title: 'Remove',
    },
  ];
}

export default observer(SubscriptionFeedScreen);
