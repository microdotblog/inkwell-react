import React from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated as RNAnimated,
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
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { observer } from 'mobx-react';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { RectButton } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SFSymbol } from 'react-native-sfsymbols';
import Animated, {
  FadeInDown,
  FadeOutUp,
  LinearTransition,
} from 'react-native-reanimated';

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
const MENU_DISMISS_TOUCH_OVERLAY_DELAY_MS = 160;
const COMPOSER_LAYOUT_TRANSITION = LinearTransition.duration(220);
const COMPOSER_ENTERING = FadeInDown.duration(220);
const COMPOSER_EXITING = FadeOutUp.duration(160);
const IOS_TRANSPARENT_HEADER_HEIGHT = 44;
const ANDROID_TRANSPARENT_HEADER_HEIGHT = 56;
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
  'searchInput',
  'secondaryActionButtonLabel',
  'stateBody',
  'stateTitle',
  'statusText',
  'subscriptionDetailLabel',
  'subscriptionSupportingUrl',
  'subscriptionTitle',
];

function SubscriptionsScreen({ navigation, route, isDark = false }) {
  const accent_palette_id = AppStore.accent_palette_id;
  const theme = getAuthTheme(isDark, accent_palette_id);
  const scaled_text_styles = React.useMemo(() => {
    return createScaledTextStyles(styles, TEXT_STYLE_NAMES);
  }, []);
  const insets = useSafeAreaInsets();
  const subscriptions = Feed.subscription_snapshots();
  const subscriptions_error_message = Feed.subscriptions_error_message;
  const is_loading_initial =
    Feed.is_loading_subscriptions &&
    subscriptions.length === 0 &&
    !subscriptions_error_message;
  const is_refreshing =
    Feed.is_loading_subscriptions && subscriptions.length > 0;
  const header_offset = resolve_transparent_header_offset(insets);
  const content_top_padding = header_offset + LIST_TOP_PADDING;
  const list_bottom_inset = insets.bottom + LIST_BOTTOM_PADDING;
  const toast_top_offset = header_offset + 10;
  const add_input_ref = React.useRef(null);
  const menu_touch_overlay_timeout_ref = React.useRef(null);
  const [search_query, set_search_query] = React.useState('');
  const [is_search_open, set_is_search_open] = React.useState(false);
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
  const [is_menu_touch_overlay_active, set_is_menu_touch_overlay_active] =
    React.useState(false);

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
                set_search_query('');
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

  const handle_change_feed_url = React.useCallback((next_feed_url = '') => {
    set_feed_url(next_feed_url);
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

        if (result?.warning_message) {
          set_submit_status({
            tone: 'info',
            message: result.warning_message,
          });
        } else {
          set_submit_status(null);
        }

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
            <AuthCard
              style={[styles.stateCard, styles.stateCardCentered]}
              theme={theme}
            >
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
                  Your current subscribed feeds.
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
                is_refreshing={is_refreshing}
                is_search_open={is_search_open}
                is_submitting={is_submitting}
                onAddSubscription={handle_add_subscription}
                onChangeFeedUrl={handle_change_feed_url}
                onChangeSearchQuery={set_search_query}
                onCloseComposer={handle_close_composer}
                onFeedChoicePress={handle_feed_choice_press}
                onOpenComposer={handle_open_composer}
                scaled_text_styles={scaled_text_styles}
                search_query={search_query}
                submit_status={submit_status}
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
                refreshing={false}
                tintColor="transparent"
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
                  onMenuClose={handle_menu_close}
                  onMenuOpen={handle_menu_open}
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

function SubscriptionsHeader({
  add_input_ref,
  feed_choices = [],
  feed_url = '',
  is_composer_open = false,
  is_refreshing = false,
  is_search_open = false,
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
  subscriptions_error_message = '',
  theme,
}) {
  return (
    <View style={styles.headerContent}>
      {is_search_open ? (
        <SearchField
          autoFocus={true}
          onChangeText={onChangeSearchQuery}
          scaled_text_styles={scaled_text_styles}
          theme={theme}
          value={search_query}
        />
      ) : null}

      {!is_composer_open ? (
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            {!is_search_open ? (
              <View style={styles.summaryIndicatorSlot}>
                {is_refreshing ? (
                  <ActivityIndicator
                    color={theme.colors.accentStrong}
                    size="small"
                  />
                ) : null}
              </View>
            ) : null}
            {!is_search_open ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="New Feed"
                disabled={is_submitting}
                onPress={onOpenComposer}
                style={({ pressed }) => {
                  return [
                    styles.addFeedButton,
                    styles.addFeedButtonShape,
                    {
                      backgroundColor: theme.colors.accentSoft,
                      borderColor: theme.colors.line,
                      opacity: is_submitting ? 0.56 : pressed ? 0.84 : 1,
                    },
                  ];
                }}
              >
                <Text
                  style={[
                    styles.addFeedButtonLabel,
                    scaled_text_styles.secondaryActionButtonLabel,
                    { color: theme.colors.accentStrong },
                  ]}
                >
                  New Feed...
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}

      {!is_search_open && is_composer_open ? (
        <Animated.View
          entering={COMPOSER_ENTERING}
          exiting={COMPOSER_EXITING}
          layout={COMPOSER_LAYOUT_TRANSITION}
          style={styles.composerWrap}
        >
          <NewFeedComposerCard
            add_input_ref={add_input_ref}
            feed_choices={feed_choices}
            feed_url={feed_url}
            is_submitting={is_submitting}
            onChangeFeedUrl={onChangeFeedUrl}
            onClose={onCloseComposer}
            onFeedChoicePress={onFeedChoicePress}
            onSubmit={onAddSubscription}
            scaled_text_styles={scaled_text_styles}
            status={submit_status}
            theme={theme}
          />
        </Animated.View>
      ) : null}

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
  is_submitting = false,
  onChangeFeedUrl,
  onClose,
  onFeedChoicePress,
  onSubmit,
  scaled_text_styles,
  status = null,
  theme,
}) {
  const has_choices = feed_choices.length > 0;

  return (
    <AuthCard style={styles.composerCard} theme={theme}>
      <View style={styles.composerStack}>
        <View style={styles.composerHeader}>
          <Text
            style={[
              styles.composerTitle,
              scaled_text_styles.composerTitle,
              { color: theme.colors.ink },
            ]}
          >
            New Feed...
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancel"
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
                styles.composerCancelLabel,
                scaled_text_styles.secondaryActionButtonLabel,
                { color: theme.colors.danger },
              ]}
            >
              Cancel
            </Text>
          </Pressable>
        </View>
        <Text
          style={[
            styles.composerBody,
            scaled_text_styles.composerBody,
            { color: theme.colors.inkSoft },
          ]}
        >
          Subscribe with a site URL or a direct feed URL.
        </Text>
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
            autoFocus={true}
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
    </AuthCard>
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
  is_busy = false,
  is_editing = false,
  onCancelRename,
  onChangeRenameValue,
  onMenuAction,
  onMenuClose,
  onMenuOpen,
  onPress,
  onSaveRename,
  rename_error_message = '',
  rename_value = '',
  scaled_text_styles,
  subscription,
  theme,
}) {
  const title = resolve_subscription_title(subscription);
  const supporting_url = resolve_subscription_supporting_url(subscription);
  const detail_label = resolve_subscription_detail_label(subscription);
  const swipeable_ref = React.useRef(null);
  const [is_action_pressed, set_is_action_pressed] = React.useState(false);
  const row_menu_actions = React.useMemo(() => {
    return get_subscription_row_actions(theme);
  }, [theme]);
  const should_enable_swipe = Platform.OS === 'ios' && !is_busy;
  const should_show_menu =
    !is_busy &&
    row_menu_actions.length > 0 &&
    typeof onMenuAction === 'function';

  const handle_remove_press = React.useCallback(() => {
    swipeable_ref.current?.close?.();
    set_is_action_pressed(false);
    onMenuAction?.(subscription, 'remove');
  }, [onMenuAction, subscription]);

  if (is_editing) {
    return (
      <View style={styles.rowWrap}>
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
          </View>
        </View>
      </View>
    );
  }

  const row_content = (
    <View style={styles.subscriptionRow}>
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

      {is_busy ? (
        <View style={styles.rowActivityWrap}>
          <ActivityIndicator color={theme.colors.accentStrong} size="small" />
        </View>
      ) : null}
    </View>
  );

  const row_card = (
    <Pressable
      accessibilityLabel={`Open ${title}`}
      accessibilityRole="button"
      disabled={is_busy}
      onLongPress={should_show_menu ? () => {} : undefined}
      onPress={() => onPress?.(subscription)}
      style={({ pressed }) => {
        return [
          styles.rowCard,
          {
            backgroundColor: theme.colors.paper,
            borderColor: theme.colors.line,
            opacity: is_busy ? 0.64 : pressed ? 0.9 : 1,
          },
        ];
      }}
    >
      {should_show_menu ? (
        <MenuView
          accessibilityLabel={`More options for ${title}`}
          actions={row_menu_actions}
          onCloseMenu={onMenuClose}
          onOpenMenu={onMenuOpen}
          onPressAction={({ nativeEvent }) => {
            onMenuAction?.(subscription, nativeEvent.event);
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

  if (!should_enable_swipe) {
    return <View style={styles.rowWrap}>{row_card}</View>;
  }

  return (
    <Swipeable
      ref={swipeable_ref}
      containerStyle={[styles.rowWrap, styles.rowSwipeContainer]}
      enableTrackpadTwoFingerGesture={true}
      friction={1}
      overshootFriction={8}
      overshootRight={false}
      renderRightActions={(progress) => {
        const action_opacity = progress.interpolate({
          inputRange: [0, 0.2, 0.85, 1],
          outputRange: [0, 0, 1, 1],
          extrapolate: 'clamp',
        });

        return (
          <View style={styles.rowSwipeActionsWrap}>
            <RectButton
              activeOpacity={1}
              onActiveStateChange={set_is_action_pressed}
              onPress={handle_remove_press}
              rippleColor="transparent"
              style={styles.rowSwipeActionButton}
              underlayColor="transparent"
            >
              <RNAnimated.View style={{ opacity: action_opacity }}>
                <View
                  style={[
                    styles.rowSwipeActionCircle,
                    {
                      backgroundColor: theme.colors.danger,
                    },
                  ]}
                >
                  {is_action_pressed ? (
                    <View style={styles.rowSwipeActionCirclePressed} />
                  ) : null}
                  {Platform.OS === 'ios' ? (
                    <SFSymbol
                      color="#ffffff"
                      multicolor={false}
                      name="trash"
                      style={styles.rowSwipeActionSymbol}
                    />
                  ) : (
                    <MaterialIcons
                      color="#ffffff"
                      name="delete-outline"
                      size={22}
                    />
                  )}
                </View>
              </RNAnimated.View>
            </RectButton>
          </View>
        );
      }}
      rightThreshold={40}
    >
      <View style={styles.rowSwipeContent}>{row_card}</View>
    </Swipeable>
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
  addFeedButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  addFeedButtonIcon: {
    marginRight: 2,
  },
  addFeedButtonShape: {
    borderRadius: 999,
    borderWidth: 1,
  },
  addFeedButtonLabel: {
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
    justifyContent: 'space-between',
  },
  composerCancelButton: {
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
    minHeight: 32,
  },
  composerCancelLabel: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
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
  composerWrap: {
    marginBottom: 20,
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
  headerButton: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: 40,
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
  rowWrap: {
    marginBottom: 12,
  },
  rowSwipeContainer: {
    marginHorizontal: -SCREEN_HORIZONTAL_PADDING,
  },
  rowSwipeContent: {
    paddingHorizontal: SCREEN_HORIZONTAL_PADDING,
  },
  rowCard: {
    borderRadius: 22,
    borderWidth: 1,
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
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
  rowSwipeActionsWrap: {
    alignItems: 'stretch',
    justifyContent: 'center',
    marginLeft: 12,
  },
  rowSwipeActionButton: {
    alignItems: 'center',
    height: '100%',
    justifyContent: 'center',
    width: 74,
  },
  rowSwipeActionCircle: {
    alignItems: 'center',
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  rowSwipeActionCirclePressed: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
    borderRadius: 22,
  },
  rowSwipeActionSymbol: {
    height: 20,
    width: 20,
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
    textAlign: 'center',
  },
  stateCard: {
    gap: 18,
  },
  stateCardCentered: {
    alignItems: 'center',
  },
  stateCopy: {
    alignItems: 'center',
    gap: 8,
  },
  stateScreen: {
    flex: 1,
  },
  stateTitle: {
    fontSize: 18,
    lineHeight: 22,
    textAlign: 'center',
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
  summaryCard: {
    borderRadius: 22,
    marginVertical: 8,
  },
  summaryIndicatorSlot: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: 40,
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
  return strip_url_scheme(
    normalize_string(subscription?.site_url) ||
      normalize_string(subscription?.feed_url),
  );
}

function resolve_subscription_detail_label(subscription = null) {
  const site_url = normalize_string(subscription?.site_url);
  const feed_url = normalize_string(subscription?.feed_url);

  if (site_url && feed_url && site_url !== feed_url) {
    return strip_url_scheme(feed_url);
  }

  return '';
}

function strip_url_scheme(value = '') {
  return normalize_string(value).replace(/^https?:\/\//i, '');
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

function resolve_transparent_header_offset(
  insets = { top: 0 },
  platform = Platform.OS,
) {
  return (
    (Number.isFinite(insets?.top) ? insets.top : 0) +
    (platform === 'ios'
      ? IOS_TRANSPARENT_HEADER_HEIGHT
      : ANDROID_TRANSPARENT_HEADER_HEIGHT)
  );
}
