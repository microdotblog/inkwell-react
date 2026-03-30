import React from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
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

const SCREEN_HORIZONTAL_PADDING = 20;
const LIST_TOP_PADDING = 12;
const LIST_BOTTOM_PADDING = 28;
const SUBSCRIPTION_AVATAR_SIZE = 30;
const SUBSCRIPTION_AVATAR_TRANSITION_MS = 180;
const TEXT_STYLE_NAMES = [
  'avatarInitial',
  'choiceSubtitle',
  'choiceTitle',
  'composerBody',
  'composerTitle',
  'editActionButtonLabel',
  'editInput',
  'editingLabel',
  'inlineStateBody',
  'inlineStateTitle',
  'inlineUtilityButtonLabel',
  'renameError',
  'rowHint',
  'searchInput',
  'secondaryActionButtonLabel',
  'stateBody',
  'stateTitle',
  'statusText',
  'subscriptionDetailLabel',
  'subscriptionSupportingUrl',
  'subscriptionTitle',
  'summaryBadgeLabel',
  'summaryCopy',
];

function SubscriptionsScreen({ navigation, route, isDark = false }) {
  const accent_palette_id = AppStore.accent_palette_id;
  const text_scale = AppStore.text_scale;
  const theme = getAuthTheme(isDark, accent_palette_id);
  const scaled_text_styles = React.useMemo(() => {
    return createScaledTextStyles(styles, TEXT_STYLE_NAMES, text_scale);
  }, [text_scale]);
  const header_height = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const subscriptions = Feed.subscription_snapshots();
  const subscriptions_error_message = Feed.subscriptions_error_message;
  const is_loading_initial =
    Feed.is_loading_subscriptions &&
    subscriptions.length === 0 &&
    !subscriptions_error_message;
  const is_refreshing =
    Feed.is_loading_subscriptions && subscriptions.length > 0;
  const content_top_padding = header_height + LIST_TOP_PADDING;
  const list_bottom_inset = insets.bottom + LIST_BOTTOM_PADDING;
  const toast_top_offset = header_height + 10;
  const add_input_ref = React.useRef(null);
  const [search_query, set_search_query] = React.useState('');
  const [is_composer_open, set_is_composer_open] = React.useState(
    resolve_is_subscribe_mode(route),
  );
  const [feed_url, set_feed_url] = React.useState(
    normalize_string(route?.params?.feed_url),
  );
  const [submit_status, set_submit_status] = React.useState(null);
  const [feed_choices, set_feed_choices] = React.useState([]);
  const [is_submitting, set_is_submitting] = React.useState(false);
  const [editing_subscription_id, set_editing_subscription_id] =
    React.useState('');
  const [rename_value, set_rename_value] = React.useState('');
  const [rename_error_message, set_rename_error_message] = React.useState('');
  const [renaming_subscription_id, set_renaming_subscription_id] =
    React.useState('');
  const [removing_subscription_id, set_removing_subscription_id] =
    React.useState('');

  React.useEffect(() => {
    Feed.refresh_subscriptions();
  }, []);

  React.useEffect(() => {
    const next_feed_url = normalize_string(route?.params?.feed_url);

    if (next_feed_url) {
      set_feed_url(next_feed_url);
    }

    if (!resolve_is_subscribe_mode(route)) {
      return;
    }

    set_is_composer_open(true);

    requestAnimationFrame(() => {
      add_input_ref.current?.focus?.();
    });
  }, [
    route?.params?.feed_url,
    route?.params?.mode,
    route?.params?.open_request_id,
  ]);

  const filtered_subscriptions = React.useMemo(() => {
    const normalized_query = normalize_search_query(search_query);

    return [...subscriptions]
      .filter((subscription) => {
        if (!normalized_query) {
          return true;
        }

        return subscription_matches_search(subscription, normalized_query);
      })
      .sort(compare_subscriptions);
  }, [search_query, subscriptions]);

  const handle_refresh = React.useCallback(() => {
    Feed.refresh_subscriptions();
  }, []);

  const handle_open_composer = React.useCallback(() => {
    set_is_composer_open(true);
    set_submit_status(null);

    requestAnimationFrame(() => {
      add_input_ref.current?.focus?.();
    });
  }, []);

  const handle_close_composer = React.useCallback(() => {
    set_is_composer_open(false);
    set_feed_choices([]);
    set_submit_status(null);
  }, []);

  const handle_add_subscription = React.useCallback(
    async (next_feed_url = feed_url) => {
      const normalized_feed_url = normalize_string(next_feed_url);

      if (!normalized_feed_url) {
        set_submit_status({
          tone: 'error',
          message: 'Enter a site or feed URL to subscribe.',
        });
        set_feed_choices([]);
        return;
      }

      Keyboard.dismiss();
      set_is_submitting(true);
      set_submit_status(null);

      try {
        const result = await Feed.create_subscription(normalized_feed_url);

        if (result?.kind === 'choices') {
          const normalized_choices = normalize_feed_choices(result?.choices);

          set_feed_choices(normalized_choices);
          set_submit_status({
            tone: normalized_choices.length > 0 ? 'info' : 'error',
            message:
              normalized_choices.length > 0
                ? 'Choose which feed you want to subscribe to.'
                : 'We found multiple feeds, but could not show the options.',
          });
          return;
        }

        if (!result?.ok) {
          set_feed_choices([]);
          set_submit_status({
            tone: 'error',
            message:
              result?.error_message ||
              'We could not subscribe to that feed.',
          });
          return;
        }

        set_feed_url('');
        set_feed_choices([]);
        set_submit_status({
          tone: result?.warning_message ? 'info' : 'success',
          message: result?.warning_message || 'Subscribed.',
        });
        AppStore.show_toast('Subscribed', {
          top_offset: toast_top_offset,
        });
      } finally {
        set_is_submitting(false);
      }
    },
    [feed_url, toast_top_offset],
  );

  const handle_feed_choice_press = React.useCallback(
    (choice_feed_url = '') => {
      const normalized_feed_url = normalize_string(choice_feed_url);

      if (!normalized_feed_url) {
        return;
      }

      set_feed_url(normalized_feed_url);
      handle_add_subscription(normalized_feed_url);
    },
    [handle_add_subscription],
  );

  const handle_subscription_press = React.useCallback(
    (subscription) => {
      const feed_id = normalize_string(subscription?.feed_id);

      if (
        !feed_id ||
        removing_subscription_id ||
        renaming_subscription_id ||
        editing_subscription_id
      ) {
        return;
      }

      navigation.navigate('SubscriptionFeed', {
        feed_id,
      });
    },
    [
      editing_subscription_id,
      navigation,
      removing_subscription_id,
      renaming_subscription_id,
    ],
  );

  const handle_start_rename = React.useCallback((subscription) => {
    const subscription_id = normalize_string(subscription?.id);

    if (!subscription_id) {
      return;
    }

    setEditingState({
      rename_error_message: set_rename_error_message,
      rename_value: set_rename_value,
      editing_subscription_id: set_editing_subscription_id,
      subscription,
    });
  }, []);

  const handle_cancel_rename = React.useCallback(() => {
    set_editing_subscription_id('');
    set_rename_value('');
    set_rename_error_message('');
  }, []);

  const handle_save_rename = React.useCallback(async () => {
    const normalized_subscription_id = normalize_string(editing_subscription_id);
    const normalized_title = normalize_string(rename_value);

    if (!normalized_subscription_id) {
      return;
    }

    if (!normalized_title) {
      set_rename_error_message('Enter a title before saving.');
      return;
    }

    set_renaming_subscription_id(normalized_subscription_id);
    set_rename_error_message('');

    try {
      const result = await Feed.rename_subscription(
        normalized_subscription_id,
        normalized_title,
      );

      if (!result?.ok) {
        set_rename_error_message(
          result?.error_message ||
            'We could not rename that subscription.',
        );
        return;
      }

      handle_cancel_rename();
      AppStore.show_toast('Subscription renamed', {
        top_offset: toast_top_offset,
      });
    } finally {
      set_renaming_subscription_id('');
    }
  }, [
    editing_subscription_id,
    handle_cancel_rename,
    rename_value,
    toast_top_offset,
  ]);

  const confirm_remove_subscription = React.useCallback(
    (subscription) => {
      const subscription_id = normalize_string(subscription?.id);

      if (!subscription_id) {
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
              set_removing_subscription_id(subscription_id);

              try {
                const result = await Feed.delete_subscription(subscription_id);

                if (!result?.ok) {
                  AppStore.show_toast(
                    result?.error_message ||
                      'We could not remove that subscription.',
                    {
                      top_offset: toast_top_offset,
                    },
                  );
                  return;
                }

                if (editing_subscription_id === subscription_id) {
                  handle_cancel_rename();
                }

                AppStore.show_toast('Subscription removed', {
                  top_offset: toast_top_offset,
                });
              } finally {
                set_removing_subscription_id('');
              }
            },
          },
        ],
      );
    },
    [
      editing_subscription_id,
      handle_cancel_rename,
      toast_top_offset,
    ],
  );

  const handle_row_menu_action = React.useCallback(
    (subscription, action_id = '') => {
      if (action_id === 'rename') {
        handle_start_rename(subscription);
        return;
      }

      if (action_id === 'remove') {
        confirm_remove_subscription(subscription);
      }
    },
    [confirm_remove_subscription, handle_start_rename],
  );

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.canvas }]}>
      <AuthBackground
        intensity={subscriptions.length > 0 ? 0.14 : 1}
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
                  Loading your subscriptions
                </Text>
                <Text
                  style={[
                    styles.stateBody,
                    scaled_text_styles.stateBody,
                    { color: theme.colors.inkSoft },
                  ]}
                >
                  Your feeds will show up here as soon as Micro.blog responds.
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
              filtered_subscriptions.length === 0
                ? styles.listContentEmpty
                : null,
            ]}
            data={filtered_subscriptions}
            keyExtractor={(item) => item.id || item.feed_id}
            ListEmptyComponent={
              <SubscriptionsEmptyState
                has_search_query={Boolean(normalize_search_query(search_query))}
                onRetry={handle_refresh}
                scaled_text_styles={scaled_text_styles}
                subscriptions_count={subscriptions.length}
                theme={theme}
                error_message={
                  filtered_subscriptions.length === 0
                    ? subscriptions_error_message
                    : ''
                }
              />
            }
            ListHeaderComponent={
              <SubscriptionsHeader
                add_input_ref={add_input_ref}
                feed_choices={feed_choices}
                feed_url={feed_url}
                is_composer_open={is_composer_open}
                is_submitting={is_submitting}
                onAddSubscription={handle_add_subscription}
                onChangeFeedUrl={set_feed_url}
                onChangeSearchQuery={set_search_query}
                onCloseComposer={handle_close_composer}
                onFeedChoicePress={handle_feed_choice_press}
                onOpenComposer={handle_open_composer}
                scaled_text_styles={scaled_text_styles}
                search_query={search_query}
                submit_status={submit_status}
                subscriptions={subscriptions}
                subscriptions_error_message={
                  subscriptions.length > 0 ? subscriptions_error_message : ''
                }
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
                <SubscriptionRow
                  isDark={isDark}
                  is_busy={
                    removing_subscription_id === item.id ||
                    renaming_subscription_id === item.id
                  }
                  is_editing={editing_subscription_id === item.id}
                  onCancelRename={handle_cancel_rename}
                  onChangeRenameValue={set_rename_value}
                  onMenuAction={handle_row_menu_action}
                  onPress={handle_subscription_press}
                  onSaveRename={handle_save_rename}
                  rename_error_message={rename_error_message}
                  rename_value={rename_value}
                  scaled_text_styles={scaled_text_styles}
                  subscription={item}
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

function SubscriptionsHeader({
  add_input_ref,
  feed_choices = [],
  feed_url = '',
  is_composer_open = false,
  is_submitting = false,
  onAddSubscription,
  onChangeFeedUrl,
  onChangeSearchQuery,
  onCloseComposer,
  onFeedChoicePress,
  onOpenComposer,
  scaled_text_styles,
  search_query = '',
  submit_status = null,
  subscriptions = [],
  subscriptions_error_message = '',
  theme,
}) {
  const total_count = subscriptions.length;
  const summary_copy =
    total_count === 1 ? '1 subscription' : `${total_count} subscriptions`;

  return (
    <View style={styles.headerContent}>
      <NewFeedComposerCard
        add_input_ref={add_input_ref}
        feed_choices={feed_choices}
        feed_url={feed_url}
        is_open={is_composer_open}
        is_submitting={is_submitting}
        onChangeFeedUrl={onChangeFeedUrl}
        onClose={onCloseComposer}
        onFeedChoicePress={onFeedChoicePress}
        onOpen={onOpenComposer}
        onSubmit={onAddSubscription}
        scaled_text_styles={scaled_text_styles}
        status={submit_status}
        theme={theme}
      />

      {total_count > 0 || search_query ? (
        <SearchField
          onChangeText={onChangeSearchQuery}
          scaled_text_styles={scaled_text_styles}
          theme={theme}
          value={search_query}
        />
      ) : null}

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
              Subscriptions
            </Text>
          </View>
          <Text
            style={[
              styles.summaryCopy,
              scaled_text_styles.summaryCopy,
              { color: theme.colors.inkSoft },
            ]}
          >
            {summary_copy}
          </Text>
        </View>
      </View>

      {subscriptions_error_message ? (
        <AuthCard style={styles.inlineStateCard} theme={theme}>
          <Text
            style={[
              styles.inlineStateTitle,
              scaled_text_styles.inlineStateTitle,
              { color: theme.colors.ink },
            ]}
          >
            {"Couldn't refresh your subscriptions"}
          </Text>
          <Text
            style={[
              styles.inlineStateBody,
              scaled_text_styles.inlineStateBody,
              { color: theme.colors.inkSoft },
            ]}
          >
            {subscriptions_error_message}
          </Text>
        </AuthCard>
      ) : null}
    </View>
  );
}

function NewFeedComposerCard({
  add_input_ref,
  feed_choices = [],
  feed_url = '',
  is_open = false,
  is_submitting = false,
  onChangeFeedUrl,
  onClose,
  onFeedChoicePress,
  onOpen,
  onSubmit,
  scaled_text_styles,
  status = null,
  theme,
}) {
  const has_choices = feed_choices.length > 0;

  return (
    <AuthCard style={styles.composerCard} theme={theme}>
      <View style={styles.composerHeader}>
        <View style={styles.composerCopy}>
          <Text
            style={[
              styles.composerTitle,
              scaled_text_styles.composerTitle,
              { color: theme.colors.ink },
            ]}
          >
            New Feed...
          </Text>
          <Text
            style={[
              styles.composerBody,
              scaled_text_styles.composerBody,
              { color: theme.colors.inkSoft },
            ]}
          >
            Subscribe with a site URL or a direct feed URL.
          </Text>
        </View>
        {!is_open ? (
          <Pressable
            accessibilityRole="button"
            onPress={onOpen}
            style={({ pressed }) => {
              return [
                styles.inlineUtilityButton,
                {
                  backgroundColor: theme.colors.accentSoft,
                  borderColor: theme.colors.line,
                  opacity: pressed ? 0.84 : 1,
                },
              ];
            }}
          >
            <MaterialIcons
              color={theme.colors.accentStrong}
              name="add"
              size={18}
            />
            <Text
              style={[
                styles.inlineUtilityButtonLabel,
                scaled_text_styles.inlineUtilityButtonLabel,
                { color: theme.colors.accentStrong },
              ]}
            >
              Add
            </Text>
          </Pressable>
        ) : null}
      </View>

      {is_open ? (
        <View style={styles.composerStack}>
          <View
            style={[
              styles.searchField,
              styles.composerInputWrap,
              {
                backgroundColor: theme.colors.paper,
                borderColor: theme.colors.line,
                shadowColor: theme.colors.shadow,
              },
            ]}
          >
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={onChangeFeedUrl}
              onSubmitEditing={() => onSubmit?.()}
              placeholder="https://example.com"
              placeholderTextColor={theme.colors.inkSoft}
              ref={add_input_ref}
              returnKeyType="go"
              selectionColor={theme.colors.accentStrong}
              style={[
                styles.searchInput,
                scaled_text_styles.searchInput,
                { color: theme.colors.ink },
              ]}
              value={feed_url}
            />
          </View>

          <View style={styles.composerActions}>
            <PrimaryButton
              disabled={is_submitting || !is_valid_url(feed_url)}
              label={is_submitting ? 'Subscribing...' : 'Subscribe'}
              onPress={() => onSubmit?.()}
              style={[styles.composerPrimaryButton, styles.noShadow]}
              textStyle={styles.composerPrimaryButtonText}
              theme={theme}
            />
            <Pressable
              accessibilityRole="button"
              disabled={is_submitting}
              onPress={onClose}
              style={({ pressed }) => {
                return [
                  styles.composerCancelButton,
                  {
                    opacity: is_submitting ? 0.56 : pressed ? 0.84 : 1,
                  },
                ];
              }}
            >
              <Text
                style={[
                  styles.composerCancelButtonLabel,
                  scaled_text_styles.secondaryActionButtonLabel,
                  { color: theme.colors.inkSoft },
                ]}
              >
                Cancel
              </Text>
            </Pressable>
          </View>

          {status?.message ? (
            <Text
              style={[
                styles.statusText,
                scaled_text_styles.statusText,
                {
                  color: resolve_status_color(theme, status?.tone),
                },
              ]}
            >
              {status.message}
            </Text>
          ) : null}

          {has_choices ? (
            <View style={styles.choiceList}>
              {feed_choices.map((choice) => {
                return (
                  <Pressable
                    accessibilityRole="button"
                    key={choice.feed_url}
                    onPress={() => onFeedChoicePress?.(choice.feed_url)}
                    style={({ pressed }) => {
                      return [
                        styles.choiceButton,
                        {
                          backgroundColor: theme.colors.paper,
                          borderColor: theme.colors.line,
                          opacity: pressed ? 0.84 : 1,
                        },
                      ];
                    }}
                  >
                    <Text
                      numberOfLines={2}
                      style={[
                        styles.choiceTitle,
                        scaled_text_styles.choiceTitle,
                        { color: theme.colors.ink },
                      ]}
                    >
                      {choice.title}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.choiceSubtitle,
                        scaled_text_styles.choiceSubtitle,
                        { color: theme.colors.inkSoft },
                      ]}
                    >
                      {choice.feed_url}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>
      ) : null}
    </AuthCard>
  );
}

function SearchField({
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
        onChangeText={onChangeText}
        placeholder="Search subscriptions"
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

function SubscriptionRow({
  isDark = false,
  is_busy = false,
  is_editing = false,
  onCancelRename,
  onChangeRenameValue,
  onMenuAction,
  onPress,
  onSaveRename,
  rename_error_message = '',
  rename_value = '',
  scaled_text_styles,
  subscription,
  theme,
}) {
  const subscription_id = normalize_string(subscription?.id);
  const title = resolve_subscription_title(subscription);
  const supporting_url = resolve_subscription_supporting_url(subscription);
  const detail_label = resolve_subscription_detail_label(subscription);
  const row_menu_actions = React.useMemo(() => {
    return get_subscription_row_actions(theme);
  }, [theme]);

  if (is_editing) {
    return (
      <View
        style={[
          styles.rowCard,
          styles.editingCard,
          {
            backgroundColor: theme.colors.paper,
            borderColor: theme.colors.line,
          },
        ]}
      >
        <View style={styles.rowHeader}>
          <SubscriptionAvatar
            avatar_url={subscription?.avatar_url}
            scaled_text_styles={scaled_text_styles}
            source={title}
            theme={theme}
          />
          <Text
            style={[
              styles.editingLabel,
              scaled_text_styles.editingLabel,
              { color: theme.colors.inkSoft },
            ]}
          >
            Rename subscription
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
              {
                color: theme.colors.danger,
              },
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

  return (
    <View
      style={[
        styles.rowCard,
        {
          backgroundColor: theme.colors.paper,
          borderColor: theme.colors.line,
          opacity: is_busy ? 0.64 : 1,
        },
      ]}
    >
      <View style={styles.subscriptionRow}>
        <Pressable
          accessibilityRole="button"
          disabled={is_busy}
          onPress={() => onPress?.(subscription)}
          style={({ pressed }) => {
            return [
              styles.subscriptionPressArea,
              {
                opacity: pressed ? 0.9 : 1,
              },
            ];
          }}
        >
          <SubscriptionAvatar
            avatar_url={subscription?.avatar_url}
            scaled_text_styles={scaled_text_styles}
            source={title}
            theme={theme}
          />

          <View style={styles.subscriptionMeta}>
            <Text
              numberOfLines={2}
              style={[
                styles.subscriptionTitle,
                scaled_text_styles.subscriptionTitle,
                { color: theme.colors.ink },
              ]}
            >
              {title}
            </Text>
            {supporting_url ? (
              <Text
                numberOfLines={1}
                style={[
                  styles.subscriptionSupportingUrl,
                  scaled_text_styles.subscriptionSupportingUrl,
                  { color: theme.colors.inkSoft },
                ]}
              >
                {supporting_url}
              </Text>
            ) : null}
            {detail_label ? (
              <Text
                numberOfLines={1}
                style={[
                  styles.subscriptionDetailLabel,
                  scaled_text_styles.subscriptionDetailLabel,
                  { color: theme.colors.inkSoft },
                ]}
              >
                {detail_label}
              </Text>
            ) : null}
          </View>
        </Pressable>

        {is_busy ? (
          <View style={styles.rowActivityWrap}>
            <ActivityIndicator color={theme.colors.accentStrong} size="small" />
          </View>
        ) : (
          <MenuView
            accessibilityLabel={`More options for ${title}`}
            actions={row_menu_actions}
            onPressAction={({ nativeEvent }) => {
              onMenuAction?.(subscription, nativeEvent.event);
            }}
            shouldOpenOnLongPress={false}
            themeVariant={isDark ? 'dark' : 'light'}
          >
            <View
              accessibilityRole="button"
              style={[
                styles.rowMenuButton,
                {
                  backgroundColor: theme.colors.canvas,
                  borderColor: theme.colors.line,
                },
              ]}
            >
              <MaterialIcons
                color={theme.colors.inkSoft}
                name="more-horiz"
                size={18}
              />
            </View>
          </MenuView>
        )}
      </View>
      {subscription_id ? (
        <Text
          numberOfLines={1}
          style={[
            styles.rowHint,
            scaled_text_styles.rowHint,
            { color: theme.colors.inkSoft },
          ]}
        >
          Open feed
        </Text>
      ) : null}
    </View>
  );
}

function SubscriptionAvatar({
  avatar_url = '',
  scaled_text_styles,
  source = '',
  theme,
}) {
  const trimmed_avatar_url = normalize_string(avatar_url);
  const [did_fail_to_load, set_did_fail_to_load] = React.useState(false);
  const [is_image_loaded, set_is_image_loaded] = React.useState(false);
  const should_show_image = trimmed_avatar_url && !did_fail_to_load;
  const should_show_initial =
    !trimmed_avatar_url || did_fail_to_load || !is_image_loaded;

  return (
    <View
      style={[
        styles.avatarWrap,
        {
          backgroundColor: theme.colors.accentSoft,
          borderColor: theme.colors.line,
        },
      ]}
    >
      {should_show_initial ? (
        <Text
          style={[
            styles.avatarInitial,
            scaled_text_styles.avatarInitial,
            { color: theme.colors.accentStrong },
          ]}
        >
          {get_avatar_initial(source)}
        </Text>
      ) : null}
      {should_show_image ? (
        <Image
          cachePolicy="memory-disk"
          contentFit="cover"
          onError={() => set_did_fail_to_load(true)}
          onLoad={() => set_is_image_loaded(true)}
          source={{ uri: trimmed_avatar_url }}
          style={styles.avatarImage}
          transition={SUBSCRIPTION_AVATAR_TRANSITION_MS}
        />
      ) : null}
    </View>
  );
}

function SubscriptionsEmptyState({
  error_message = '',
  has_search_query = false,
  onRetry,
  scaled_text_styles,
  subscriptions_count = 0,
  theme,
}) {
  if (error_message && subscriptions_count === 0) {
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
            {"Couldn't load your subscriptions"}
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

  if (has_search_query) {
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
            No matching subscriptions
          </Text>
          <Text
            style={[
              styles.stateBody,
              scaled_text_styles.stateBody,
              { color: theme.colors.inkSoft },
            ]}
          >
            Try a different title, site URL, or feed URL.
          </Text>
        </View>
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
          No subscriptions yet
        </Text>
        <Text
          style={[
            styles.stateBody,
            scaled_text_styles.stateBody,
            { color: theme.colors.inkSoft },
          ]}
        >
          Add a site or feed URL above to start building your reader.
        </Text>
      </View>
    </AuthCard>
  );
}

const styles = StyleSheet.create({
  avatarImage: {
    borderRadius: 999,
    height: SUBSCRIPTION_AVATAR_SIZE,
    left: 0,
    position: 'absolute',
    top: 0,
    width: SUBSCRIPTION_AVATAR_SIZE,
  },
  avatarInitial: {
    fontSize: 12,
    fontWeight: '700',
  },
  avatarWrap: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    height: SUBSCRIPTION_AVATAR_SIZE,
    justifyContent: 'center',
    overflow: 'hidden',
    width: SUBSCRIPTION_AVATAR_SIZE,
  },
  choiceButton: {
    borderRadius: 18,
    borderWidth: 1,
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  choiceList: {
    gap: 10,
  },
  choiceSubtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  choiceTitle: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
  },
  composerActions: {
    flexDirection: 'column',
    gap: 8,
  },
  composerBody: {
    fontSize: 13,
    lineHeight: 18,
  },
  composerCancelButton: {
    alignItems: 'center',
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  composerCancelButtonLabel: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
  },
  composerCard: {
    gap: 16,
  },
  composerCopy: {
    flex: 1,
    gap: 4,
  },
  composerHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  composerInputWrap: {
    minHeight: 52,
  },
  composerPrimaryButton: {
    width: '100%',
  },
  composerPrimaryButtonText: {
    fontSize: 18,
    fontWeight: '700',
  },
  composerStack: {
    gap: 12,
  },
  composerTitle: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
  },
  editActionButton: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    minHeight: 40,
    justifyContent: 'center',
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
  editingCard: {
    gap: 12,
  },
  editingLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  headerContent: {
    gap: 14,
    marginBottom: 14,
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
  inlineUtilityButton: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 38,
    paddingHorizontal: 14,
  },
  inlineUtilityButtonLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  list: {
    flex: 1,
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
  renameError: {
    fontSize: 13,
    lineHeight: 18,
  },
  rowActivityWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
    minWidth: 34,
  },
  rowCard: {
    borderRadius: 22,
    borderWidth: 1,
    gap: 8,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowHint: {
    fontSize: 12,
    lineHeight: 16,
    marginLeft: SUBSCRIPTION_AVATAR_SIZE + 12,
  },
  rowHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  rowMenuButton: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  safeArea: {
    flex: 1,
  },
  screen: {
    flex: 1,
  },
  noShadow: {
    shadowOpacity: 0,
    elevation: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
  },
  searchField: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 52,
    overflow: 'hidden',
    paddingLeft: 14,
    paddingRight: 10,
  },
  searchFieldIcon: {
    marginRight: 10,
    marginTop: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    minHeight: 50,
    paddingVertical: 12,
  },
  secondaryActionButton: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 18,
  },
  secondaryActionButtonLabel: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
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
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  subscriptionDetailLabel: {
    fontSize: 12,
    lineHeight: 16,
  },
  subscriptionMeta: {
    flex: 1,
    gap: 3,
  },
  subscriptionPressArea: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 12,
  },
  subscriptionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  subscriptionSupportingUrl: {
    fontSize: 13,
    lineHeight: 17,
  },
  subscriptionTitle: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 21,
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
  summaryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});

function resolve_is_subscribe_mode(route) {
  const normalized_mode = normalize_string(route?.params?.mode).toLowerCase();

  return normalized_mode === 'subscribe';
}

function setEditingState({
  rename_error_message,
  rename_value,
  editing_subscription_id,
  subscription,
}) {
  editing_subscription_id(normalize_string(subscription?.id));
  rename_value(resolve_subscription_title(subscription));
  rename_error_message('');
}

function get_subscription_row_actions(theme) {
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

function subscription_matches_search(subscription, normalized_query = '') {
  const fields = [
    subscription?.title,
    subscription?.site_url,
    subscription?.feed_url,
  ];

  return fields.some((field) => {
    return normalize_string(field).toLowerCase().includes(normalized_query);
  });
}

function compare_subscriptions(left_subscription, right_subscription) {
  const left_title = resolve_subscription_title(left_subscription).toLowerCase();
  const right_title = resolve_subscription_title(right_subscription).toLowerCase();

  if (left_title < right_title) {
    return -1;
  }

  if (left_title > right_title) {
    return 1;
  }

  const left_url = resolve_subscription_supporting_url(left_subscription).toLowerCase();
  const right_url = resolve_subscription_supporting_url(right_subscription).toLowerCase();

  if (left_url < right_url) {
    return -1;
  }

  if (left_url > right_url) {
    return 1;
  }

  return 0;
}

function normalize_feed_choices(choices = []) {
  if (!Array.isArray(choices)) {
    return [];
  }

  const seen = new Set();

  return choices
    .map((choice) => {
      const normalized_feed_url = normalize_string(
        choice?.feed_url || choice?.url || choice?.xml_url,
      );

      if (!normalized_feed_url) {
        return null;
      }

      return {
        feed_url: normalized_feed_url,
        title:
          normalize_string(choice?.title) ||
          normalize_string(choice?.site_url) ||
          normalized_feed_url,
      };
    })
    .filter((choice) => {
      if (!choice?.feed_url) {
        return false;
      }

      const key = choice.feed_url.toLowerCase();

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
}

function normalize_search_query(value = '') {
  return normalize_string(value).toLowerCase();
}

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

function resolve_subscription_supporting_url(subscription = null) {
  return (
    normalize_string(subscription?.site_url) ||
    normalize_string(subscription?.feed_url)
  );
}

function resolve_subscription_detail_label(subscription = null) {
  const site_url = normalize_string(subscription?.site_url);
  const feed_url = normalize_string(subscription?.feed_url);

  if (site_url && feed_url && site_url !== feed_url) {
    return feed_url;
  }

  return '';
}

function get_avatar_initial(source = '') {
  const normalized_source = normalize_string(source);

  if (!normalized_source) {
    return 'F';
  }

  return normalized_source.charAt(0).toUpperCase();
}

function is_valid_url(value = '') {
  const normalized = normalize_string(value);
  if (!normalized) {
    return false;
  }
  
  // Simple URL regex that supports http, https, and feed protocols
  const url_regex = /^(https?:\/\/|feed:\/\/)[\w.-]+(\.\w+)+.*$/i;
  return url_regex.test(normalized);
}

function resolve_summary_card_background_color(theme) {
  return theme.isDark
    ? 'rgba(255, 255, 255, 0.03)'
    : 'rgba(255, 255, 255, 0.72)';
}

function resolve_status_color(theme, tone = 'info') {
  if (tone === 'success') {
    return theme.colors.accentStrong;
  }

  if (tone === 'error') {
    return theme.colors.danger;
  }

  return theme.colors.inkSoft;
}

export default observer(SubscriptionsScreen);
