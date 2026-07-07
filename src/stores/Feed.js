import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform, Settings } from 'react-native';
import { flow, getSnapshot, types } from 'mobx-state-tree';

import {
  bookmark_micro_blog_feed_entries,
  create_micro_blog_feed_subscription,
  create_micro_blog_bookmark,
  delete_micro_blog_feed_subscription,
  fetch_recap_email_settings,
  fetch_micro_blog_feed_entries,
  fetch_micro_blog_feed_entries_for_feed,
  fetch_micro_blog_feed_icons,
  fetch_micro_blog_feed_starred_entry_ids,
  fetch_micro_blog_feed_subscriptions,
  fetch_micro_blog_feed_unread_entry_ids,
  mark_micro_blog_feed_entries_read,
  mark_micro_blog_feed_entries_unread,
  summarize_micro_blog_feed_entries,
  unbookmark_micro_blog_feed_entries,
  update_micro_blog_feed_subscription,
  update_recap_email_settings,
} from '../api/MicroBlogFeeds';
import Tokens from './Tokens';

const FeedSubscription = types.model('FeedSubscription', {
  id: types.optional(types.string, ''),
  feed_id: types.optional(types.string, ''),
  title: types.optional(types.string, ''),
  feed_url: types.optional(types.string, ''),
  site_url: types.optional(types.string, ''),
  avatar_url: types.optional(types.string, ''),
});

const TimelineEntry = types.model('TimelineEntry', {
  id: types.optional(types.string, ''),
  feed_id: types.optional(types.string, ''),
  source: types.optional(types.string, ''),
  source_url: types.optional(types.string, ''),
  avatar_url: types.optional(types.string, ''),
  title: types.optional(types.string, ''),
  summary: types.optional(types.string, ''),
  content: types.optional(types.string, ''),
  author: types.optional(types.string, ''),
  url: types.optional(types.string, ''),
  published_at: types.optional(types.string, ''),
  is_read: types.optional(types.boolean, false),
  is_bookmarked: types.optional(types.boolean, false),
  age_bucket: types.optional(types.string, 'day-7'),
});

const RecapSession = types.model('RecapSession', {
  html: types.optional(types.string, ''),
  entry_ids: types.optional(types.array(types.string), []),
  requested_at: types.optional(types.string, ''),
});

const SEGMENT_BUCKETS = {
  today: ['day-1'],
  recent: ['day-2', 'day-3'],
  fading: ['day-4', 'day-5', 'day-6', 'day-7'],
};
const RECAP_EMAIL_DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];
const FEED_DAY_MS = 24 * 60 * 60 * 1000;
const FEED_TIMELINE_WINDOW_DAYS = 7;
const HIDE_READ_POSTS_SETTINGS_KEY = 'HideReadPosts';
const FEED_TIMELINE_CACHE_DIRECTORY_NAME = 'inkwell';
const FEED_TIMELINE_CACHE_FILENAME_PREFIX = 'RecentEntries';
const FEED_ICONS_CACHE_FILENAME = 'Icons.json';
const FEED_TIMELINE_CACHE_VERSION = 2;
const FEED_TIMELINE_CACHE_WRITE_DELAY_MS = 240;
const FEED_ICONS_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const Feed = types
  .model('Feed', {
    active_segment: types.optional(types.string, 'today'),
    hide_read_posts: types.optional(types.boolean, false),
    is_search_active: types.optional(types.boolean, false),
    search_query: types.optional(types.string, ''),
    active_feed_filter_feed_id: types.optional(types.string, ''),
    active_feed_filter_label: types.optional(types.string, ''),
    active_feed_filter_hostname: types.optional(types.string, ''),
    feed_filter_entries: types.optional(types.array(TimelineEntry), []),
    is_loading_feed_filter: types.optional(types.boolean, false),
    has_loaded_feed_filter: types.optional(types.boolean, false),
    feed_filter_error_message: types.maybeNull(types.string),
    subscriptions: types.optional(types.array(FeedSubscription), []),
    is_loading_subscriptions: types.optional(types.boolean, false),
    subscriptions_error_message: types.maybeNull(types.string),
    timeline_entries: types.optional(types.array(TimelineEntry), []),
    active_subscription_feed_id: types.optional(types.string, ''),
    subscription_feed_entries: types.optional(types.array(TimelineEntry), []),
    is_loading_subscription_feed: types.optional(types.boolean, false),
    has_loaded_subscription_feed: types.optional(types.boolean, false),
    subscription_feed_error_message: types.maybeNull(types.string),
    has_checked_timeline_cache: types.optional(types.boolean, false),
    is_bootstrapping: types.optional(types.boolean, false),
    has_bootstrapped: types.optional(types.boolean, false),
    has_restored_cache: types.optional(types.boolean, false),
    error_message: types.maybeNull(types.string),
    active_recap: types.maybeNull(RecapSession),
    is_generating_recap: types.optional(types.boolean, false),
    recap_error_message: types.maybeNull(types.string),
    recap_email_day: types.optional(types.string, ''),
    is_loading_recap_email_settings: types.optional(types.boolean, false),
    is_saving_recap_email_settings: types.optional(types.boolean, false),
    recap_bookmarked_quote_urls: types.optional(types.array(types.string), []),
    bookmarking_recap_quote_url: types.maybeNull(types.string),
    recap_bookmark_error_message: types.maybeNull(types.string),
  })
  .volatile(() => ({
    local_read_entry_ids: new Set(),
    local_unread_entry_ids: new Set(),
    pending_read_sync_entry_ids: new Set(),
    pending_unread_sync_entry_ids: new Set(),
    local_bookmarked_entry_ids: new Set(),
    local_unbookmarked_entry_ids: new Set(),
    pending_bookmark_sync_entry_ids: new Set(),
    pending_unbookmark_sync_entry_ids: new Set(),
    recap_request_token: 0,
    recap_email_request_token: 0,
    recap_bookmark_request_token: 0,
    subscriptions_request_token: 0,
    subscription_feed_request_token: 0,
    feed_filter_request_token: 0,
    timeline_cache_persist_timeout_id: null,
  }))
  .actions((self) => ({
    clear_error() {
      self.error_message = null;
    },

    clear_subscriptions_error() {
      self.subscriptions_error_message = null;
    },

    clear_feed_data() {
      self.subscriptions.replace([]);
      self.timeline_entries.replace([]);
      self.clear_feed_filter();
      self.clear_active_subscription_feed();
      self.is_loading_subscriptions = false;
      self.subscriptions_error_message = null;
    },

    clear_local_read_state() {
      self.local_read_entry_ids.clear();
      self.local_unread_entry_ids.clear();
      self.pending_read_sync_entry_ids.clear();
      self.pending_unread_sync_entry_ids.clear();
    },

    clear_local_bookmark_state() {
      self.local_bookmarked_entry_ids.clear();
      self.local_unbookmarked_entry_ids.clear();
      self.pending_bookmark_sync_entry_ids.clear();
      self.pending_unbookmark_sync_entry_ids.clear();
    },

    clear_local_entry_state() {
      self.clear_local_read_state();
      self.clear_local_bookmark_state();
    },

    clear_timeline_cache_persist_timer() {
      if (!self.timeline_cache_persist_timeout_id) {
        return;
      }

      clearTimeout(self.timeline_cache_persist_timeout_id);
      self.timeline_cache_persist_timeout_id = null;
    },

    restore_local_entry_state_from_cache(timeline_cache_payload = null) {
      const normalized_payload =
        timeline_cache_payload?.entries &&
        Array.isArray(timeline_cache_payload.entries)
          ? timeline_cache_payload
          : normalize_timeline_cache_payload(timeline_cache_payload);

      self.clear_local_entry_state();

      if (!normalized_payload) {
        return false;
      }

      normalized_payload.local_read_entry_ids.forEach((entry_id) => {
        self.local_read_entry_ids.add(entry_id);
      });
      normalized_payload.local_unread_entry_ids.forEach((entry_id) => {
        self.local_unread_entry_ids.add(entry_id);
      });
      normalized_payload.local_bookmarked_entry_ids.forEach((entry_id) => {
        self.local_bookmarked_entry_ids.add(entry_id);
      });
      normalized_payload.local_unbookmarked_entry_ids.forEach((entry_id) => {
        self.local_unbookmarked_entry_ids.add(entry_id);
      });

      return true;
    },

    apply_timeline_cache_payload(timeline_cache_payload = null) {
      const normalized_payload =
        normalize_timeline_cache_payload(timeline_cache_payload);

      if (!normalized_payload) {
        return false;
      }

      self.restore_local_entry_state_from_cache(normalized_payload);
      self.timeline_entries.replace(normalized_payload.entries);
      self.has_restored_cache = true;
      self.error_message = null;
      return true;
    },

    reset() {
      self.active_segment = 'today';
      self.is_search_active = false;
      self.search_query = '';
      self.clear_feed_filter();
      self.has_checked_timeline_cache = false;
      self.is_bootstrapping = false;
      self.has_bootstrapped = false;
      self.has_restored_cache = false;
      self.is_loading_subscriptions = false;
      self.subscriptions_error_message = null;
      self.error_message = null;
      self.clear_timeline_cache_persist_timer();
      self.clear_local_entry_state();
      self.clear_feed_data();
      self.clear_active_recap();
    },

    set_active_segment(segment = 'today') {
      if (self.active_feed_filter_feed_id) {
        return;
      }

      const next_segment = normalize_segment(segment);
      self.active_segment = next_segment;
    },

    set_hide_read_posts(next_hide_read_posts = false) {
      const normalized_next_hide_read_posts = Boolean(next_hide_read_posts);

      if (self.hide_read_posts === normalized_next_hide_read_posts) {
        return self.hide_read_posts;
      }

      self.hide_read_posts = normalized_next_hide_read_posts;
      persist_hide_read_posts_preference(normalized_next_hide_read_posts);
      return self.hide_read_posts;
    },

    toggle_hide_read_posts() {
      return self.set_hide_read_posts(!self.hide_read_posts);
    },

    show_search() {
      if (self.active_feed_filter_feed_id) {
        return;
      }

      self.is_search_active = true;
    },

    hide_search() {
      self.is_search_active = false;
      self.search_query = '';
    },

    set_search_query(search_query = '') {
      self.search_query = `${search_query || ''}`;
    },

    clear_feed_filter() {
      self.feed_filter_request_token += 1;
      self.active_feed_filter_feed_id = '';
      self.active_feed_filter_label = '';
      self.active_feed_filter_hostname = '';
      self.feed_filter_entries.replace([]);
      self.is_loading_feed_filter = false;
      self.has_loaded_feed_filter = false;
      self.feed_filter_error_message = null;
    },

    show_posts_for_feed: flow(function* ({
      feed_id = '',
      hostname = '',
      label = '',
    } = {}) {
      const normalized_feed_id = normalize_string(feed_id);

      if (!normalized_feed_id) {
        return false;
      }

      const normalized_hostname = normalize_hostname(hostname);
      const normalized_label = normalize_string(label);
      const subscription = self.subscription_snapshot(normalized_feed_id);
      const is_same_filter =
        self.active_feed_filter_feed_id === normalized_feed_id;

      self.is_search_active = false;
      self.search_query = '';
      self.active_feed_filter_feed_id = normalized_feed_id;
      self.active_feed_filter_label =
        normalized_label ||
        resolve_source(subscription) ||
        `Feed ${normalized_feed_id}`;
      self.active_feed_filter_hostname =
        normalized_hostname ||
        get_subscription_host(subscription) ||
        normalize_hostname(subscription?.site_url || subscription?.feed_url);
      self.feed_filter_error_message = null;

      if (!is_same_filter) {
        self.feed_filter_entries.replace([]);
        self.has_loaded_feed_filter = false;
      }

      yield self.load_feed_filter(normalized_feed_id);
      return true;
    }),

    load_feed_filter: flow(function* (feed_id = '') {
      const normalized_feed_id = normalize_string(feed_id);

      if (!normalized_feed_id) {
        self.clear_feed_filter();
        return false;
      }

      if (
        self.is_loading_feed_filter &&
        self.active_feed_filter_feed_id === normalized_feed_id
      ) {
        return true;
      }

      self.is_loading_feed_filter = true;
      self.feed_filter_error_message = null;
      self.feed_filter_request_token += 1;
      const request_token = self.feed_filter_request_token;

      try {
        yield Tokens.hydrate();

        const user_token = Tokens.get_user_token();
        if (!user_token) {
          self.reset();
          return false;
        }

        const [entries_result, unread_result, starred_result] =
          yield Promise.allSettled([
            fetch_micro_blog_feed_entries_for_feed({
              token: user_token,
              feed_id: normalized_feed_id,
            }),
            fetch_micro_blog_feed_unread_entry_ids({ token: user_token }),
            fetch_micro_blog_feed_starred_entry_ids({ token: user_token }),
          ]);

        if (entries_result.status !== 'fulfilled') {
          throw entries_result.reason;
        }

        if (unread_result.status !== 'fulfilled') {
          throw unread_result.reason;
        }

        if (starred_result.status !== 'fulfilled') {
          throw starred_result.reason;
        }

        const current_user_token = Tokens.get_user_token();
        if (current_user_token !== user_token) {
          if (!current_user_token) {
            self.reset();
          }
          return false;
        }

        if (
          self.feed_filter_request_token !== request_token ||
          self.active_feed_filter_feed_id !== normalized_feed_id
        ) {
          return false;
        }

        const known_entries = self.current_feed_filter_timeline_entries();
        const normalized_entries = normalize_timeline_entries(
          entries_result.value,
          self.subscriptions.slice(),
          unread_result.value,
          starred_result.value,
          self.local_read_entry_ids,
          self.local_unread_entry_ids,
          self.local_bookmarked_entry_ids,
          self.local_unbookmarked_entry_ids,
          { filter_timeline_window: false },
        );

        self.feed_filter_entries.replace(
          merge_normalized_timeline_entries(
            known_entries,
            normalized_entries,
          ),
        );
        self.has_loaded_feed_filter = true;
        self.feed_filter_error_message = null;
        return true;
      } catch (error) {
        if (
          self.feed_filter_request_token === request_token &&
          self.active_feed_filter_feed_id === normalized_feed_id
        ) {
          self.feed_filter_error_message =
            resolve_subscription_request_error_message(
              error,
              'We could not load posts for that blog right now.',
            );
        }
        return false;
      } finally {
        if (
          self.feed_filter_request_token === request_token &&
          self.active_feed_filter_feed_id === normalized_feed_id
        ) {
          self.is_loading_feed_filter = false;
        }
      }
    }),

    refresh_feed_filter: flow(function* () {
      const normalized_feed_id = self.active_feed_filter_feed_id;

      if (!normalized_feed_id) {
        return false;
      }

      return yield self.load_feed_filter(normalized_feed_id);
    }),

    clear_active_subscription_feed() {
      self.subscription_feed_request_token += 1;
      self.active_subscription_feed_id = '';
      self.subscription_feed_entries.replace([]);
      self.is_loading_subscription_feed = false;
      self.has_loaded_subscription_feed = false;
      self.subscription_feed_error_message = null;
    },

    sync_active_subscription_feed_metadata() {
      if (
        !self.active_subscription_feed_id ||
        self.subscription_feed_entries.length === 0
      ) {
        return;
      }

      const active_subscription = self.subscriptions.find((subscription) => {
        return subscription.feed_id === self.active_subscription_feed_id;
      });

      self.subscription_feed_entries.forEach((entry) => {
        entry.source = resolve_source(active_subscription);
        entry.source_url = resolve_source_url(active_subscription);
        entry.avatar_url = resolve_avatar_url(active_subscription);
      });
    },

    apply_subscriptions(
      subscriptions = [],
      icons = [],
    ) {
      const normalized_subscriptions = normalize_subscriptions(
        subscriptions,
        icons,
      );

      self.subscriptions.replace(normalized_subscriptions);
      self.subscriptions_error_message = null;

      if (
        self.active_subscription_feed_id &&
        !normalized_subscriptions.find((subscription) => {
          return subscription.feed_id === self.active_subscription_feed_id;
        })
      ) {
        self.clear_active_subscription_feed();
        return;
      }

      self.sync_active_subscription_feed_metadata();
    },

    refresh_timeline_in_background() {
      self.retry_bootstrap().catch(() => {
        // Keep subscription management responsive even if the home timeline refresh fails.
      });
    },

    clear_active_recap() {
      self.recap_request_token += 1;
      self.recap_email_request_token += 1;
      self.recap_bookmark_request_token += 1;
      self.active_recap = null;
      self.is_generating_recap = false;
      self.recap_error_message = null;
      self.recap_email_day = '';
      self.is_loading_recap_email_settings = false;
      self.is_saving_recap_email_settings = false;
      self.recap_bookmarked_quote_urls.replace([]);
      self.bookmarking_recap_quote_url = null;
      self.recap_bookmark_error_message = null;
    },

    open_fading_recap: flow(function* () {
      if (!self.can_open_fading_recap() || self.is_generating_recap) {
        return false;
      }

      const summary_entries = self.fading_recap_timeline_entries();
      const entry_ids = normalize_unique_entry_ids(
        summary_entries.map((timeline_entry) => {
          return timeline_entry?.id;
        }),
      );

      if (entry_ids.length === 0) {
        return false;
      }

      self.recap_error_message = null;
      self.recap_bookmark_error_message = null;
      self.bookmarking_recap_quote_url = null;
      self.is_generating_recap = true;
      self.recap_request_token += 1;
      const request_token = self.recap_request_token;

      try {
        yield Tokens.hydrate();

        const user_token = Tokens.get_user_token();

        if (!user_token) {
          self.recap_error_message =
            'Your Micro.blog session expired. Please sign in again.';
          return false;
        }

        const html = yield summarize_micro_blog_feed_entries({
          token: user_token,
          entry_ids,
        });

        if (self.recap_request_token !== request_token) {
          return false;
        }

        const normalized_html = `${html || ''}`.trim();

        if (!normalized_html) {
          self.recap_error_message =
            'We could not build a reading recap right now.';
          return false;
        }

        self.active_recap = {
          html: normalized_html,
          entry_ids,
          requested_at: new Date().toISOString(),
        };
        self.recap_email_request_token += 1;
        self.recap_bookmark_request_token += 1;
        self.recap_email_day = '';
        self.is_loading_recap_email_settings = false;
        self.is_saving_recap_email_settings = false;
        self.recap_bookmarked_quote_urls.replace([]);
        self.bookmarking_recap_quote_url = null;
        self.recap_bookmark_error_message = null;
        self.recap_error_message = null;
        return true;
      } catch (error) {
        if (self.recap_request_token === request_token) {
          self.recap_error_message =
            'We could not build a reading recap right now.';
        }
        return false;
      } finally {
        if (self.recap_request_token === request_token) {
          self.is_generating_recap = false;
        }
      }
    }),

    load_recap_email_settings: flow(function* () {
      if (!self.active_recap) {
        return false;
      }

      const active_recap_requested_at = self.active_recap.requested_at;
      self.is_loading_recap_email_settings = true;
      self.recap_email_request_token += 1;
      const request_token = self.recap_email_request_token;

      try {
        yield Tokens.hydrate();

        const user_token = Tokens.get_user_token();

        if (!user_token) {
          return false;
        }

        const settings = yield fetch_recap_email_settings({
          token: user_token,
        });

        if (
          self.recap_email_request_token !== request_token ||
          !self.active_recap ||
          self.active_recap.requested_at !== active_recap_requested_at
        ) {
          return false;
        }

        self.recap_email_day = normalize_recap_email_day(settings?.dayofweek);
        return true;
      } catch (error) {
        if (
          self.recap_email_request_token === request_token &&
          self.active_recap &&
          self.active_recap.requested_at === active_recap_requested_at
        ) {
          self.recap_email_day = '';
        }
        return false;
      } finally {
        if (
          self.recap_email_request_token === request_token &&
          self.active_recap &&
          self.active_recap.requested_at === active_recap_requested_at
        ) {
          self.is_loading_recap_email_settings = false;
        }
      }
    }),

    update_recap_email_day: flow(function* (dayofweek = '') {
      if (!self.active_recap || self.is_saving_recap_email_settings) {
        return false;
      }

      const active_recap_requested_at = self.active_recap.requested_at;
      const normalized_dayofweek = normalize_recap_email_day(dayofweek);
      const previous_dayofweek = self.recap_email_day;

      self.recap_email_day = normalized_dayofweek;
      self.is_saving_recap_email_settings = true;

      try {
        yield Tokens.hydrate();

        const user_token = Tokens.get_user_token();

        if (!user_token) {
          self.recap_email_day = previous_dayofweek;
          return false;
        }

        const settings = yield update_recap_email_settings({
          token: user_token,
          dayofweek: normalized_dayofweek,
        });

        if (
          !self.active_recap ||
          self.active_recap.requested_at !== active_recap_requested_at
        ) {
          return false;
        }

        self.recap_email_day = normalize_recap_email_day(settings?.dayofweek);
        return true;
      } catch (error) {
        if (
          self.active_recap &&
          self.active_recap.requested_at === active_recap_requested_at
        ) {
          self.recap_email_day = previous_dayofweek;
        }
        return false;
      } finally {
        if (
          self.active_recap &&
          self.active_recap.requested_at === active_recap_requested_at
        ) {
          self.is_saving_recap_email_settings = false;
        }
      }
    }),

    bookmark_recap_quote: flow(function* (bookmark_url = '') {
      const normalized_bookmark_url = normalize_string(bookmark_url);

      if (
        !self.active_recap ||
        !normalized_bookmark_url ||
        self.bookmarking_recap_quote_url === normalized_bookmark_url ||
        self.is_recap_quote_bookmarked(normalized_bookmark_url)
      ) {
        return false;
      }

      const active_recap_requested_at = self.active_recap.requested_at;
      self.recap_bookmark_error_message = null;
      self.bookmarking_recap_quote_url = normalized_bookmark_url;
      self.recap_bookmark_request_token += 1;
      const request_token = self.recap_bookmark_request_token;

      try {
        yield Tokens.hydrate();

        const user_token = Tokens.get_user_token();

        if (!user_token) {
          self.recap_bookmark_error_message =
            'Your Micro.blog session expired. Please sign in again.';
          return false;
        }

        yield create_micro_blog_bookmark({
          token: user_token,
          bookmark_url: normalized_bookmark_url,
        });

        if (
          self.recap_bookmark_request_token !== request_token ||
          !self.active_recap ||
          self.active_recap.requested_at !== active_recap_requested_at
        ) {
          return false;
        }

        self.recap_bookmarked_quote_urls.push(normalized_bookmark_url);
        return true;
      } catch (error) {
        if (
          self.recap_bookmark_request_token === request_token &&
          self.active_recap &&
          self.active_recap.requested_at === active_recap_requested_at
        ) {
          self.recap_bookmark_error_message =
            'We could not bookmark that quote right now.';
        }
        return false;
      } finally {
        if (
          self.recap_bookmark_request_token === request_token &&
          self.bookmarking_recap_quote_url === normalized_bookmark_url
        ) {
          self.bookmarking_recap_quote_url = null;
        }
      }
    }),

    apply_bootstrap_payload(
      subscriptions = [],
      unread_entry_ids = [],
      starred_entry_ids = [],
      entries = [],
      icons = [],
    ) {
      const unread_ids = Array.isArray(unread_entry_ids)
        ? unread_entry_ids
        : [];
      const starred_ids = Array.isArray(starred_entry_ids)
        ? starred_entry_ids
        : [];
      const normalized_entries = normalize_timeline_entries(
        entries,
        normalize_subscriptions(subscriptions, icons),
        unread_ids,
        starred_ids,
        self.local_read_entry_ids,
        self.local_unread_entry_ids,
        self.local_bookmarked_entry_ids,
        self.local_unbookmarked_entry_ids,
      );

      self.apply_subscriptions(subscriptions, icons);
      self.timeline_entries.replace(normalized_entries);
      self.is_loading_subscriptions = false;
      self.error_message = null;
    },

    hydrate_timeline_cache: flow(function* () {
      try {
        if (self.has_checked_timeline_cache) {
          return self.has_restored_cache;
        }

        yield Tokens.hydrate();

        const user_token = Tokens.get_user_token();
        if (!user_token) {
          return false;
        }

        const timeline_cache_uri = yield get_timeline_cache_uri(user_token);
        if (!timeline_cache_uri) {
          return false;
        }

        const cache_info = yield FileSystem.getInfoAsync(timeline_cache_uri);
        if (!cache_info.exists) {
          return false;
        }

        const raw_payload = yield FileSystem.readAsStringAsync(timeline_cache_uri);
        if (!raw_payload) {
          return false;
        }

        const parsed_payload = JSON.parse(raw_payload);
        return self.apply_timeline_cache_payload(parsed_payload);
      } catch (error) {
        return false;
      } finally {
        self.has_checked_timeline_cache = true;
      }
    }),

    persist_timeline_cache: flow(function* (
      user_token = Tokens.get_user_token(),
    ) {
      const normalized_user_token = normalize_string(user_token);

      if (!normalized_user_token) {
        return false;
      }

      const timeline_cache_directory = get_timeline_cache_directory();
      const timeline_cache_uri = yield get_timeline_cache_uri(
        normalized_user_token,
      );

      if (!timeline_cache_directory || !timeline_cache_uri) {
        return false;
      }

      try {
        const directory_info = yield FileSystem.getInfoAsync(
          timeline_cache_directory,
        );

        if (!directory_info.exists) {
          yield FileSystem.makeDirectoryAsync(
            timeline_cache_directory,
            { intermediates: true },
          );
        }

        const payload = serialize_timeline_cache_payload(self);
        yield FileSystem.writeAsStringAsync(
          timeline_cache_uri,
          JSON.stringify(payload),
        );
        return true;
      } catch (error) {
        return false;
      }
    }),

    schedule_timeline_cache_persist(
      delay_ms = FEED_TIMELINE_CACHE_WRITE_DELAY_MS,
    ) {
      self.clear_timeline_cache_persist_timer();

      self.timeline_cache_persist_timeout_id = setTimeout(() => {
        self.clear_timeline_cache_persist_timer();
        self.persist_timeline_cache().catch(() => {
          // The network-backed timeline can always recover on the next refresh.
        });
      }, delay_ms);
    },

    upsert_subscription(subscription = null, icons = []) {
      const normalized_subscription = normalize_subscriptions(
        [subscription],
        icons,
      )[0];

      if (!normalized_subscription) {
        return null;
      }

      const existing_subscription = self.subscriptions.find((entry) => {
        return (
          entry.id === normalized_subscription.id ||
          entry.feed_id === normalized_subscription.feed_id
        );
      });

      if (existing_subscription) {
        existing_subscription.feed_id = normalized_subscription.feed_id;
        existing_subscription.title = normalized_subscription.title;
        existing_subscription.feed_url = normalized_subscription.feed_url;
        existing_subscription.site_url = normalized_subscription.site_url;
        existing_subscription.avatar_url =
          normalized_subscription.avatar_url || existing_subscription.avatar_url;
      } else {
        self.subscriptions.push(normalized_subscription);
      }

      self.subscriptions_error_message = null;
      self.sync_active_subscription_feed_metadata();
      return normalized_subscription;
    },

    remove_subscription_locally(subscription_id = '') {
      const normalized_subscription_id = normalize_string(subscription_id);

      if (!normalized_subscription_id) {
        return false;
      }

      const remaining_subscriptions = self.subscriptions.filter(
        (subscription) => {
          return (
            subscription.id !== normalized_subscription_id &&
            subscription.feed_id !== normalized_subscription_id
          );
        },
      );
      const did_remove =
        remaining_subscriptions.length !== self.subscriptions.length;

      if (!did_remove) {
        return false;
      }

      self.subscriptions.replace(
        remaining_subscriptions.map((subscription) => {
          return getSnapshot(subscription);
        }),
      );

      if (
        self.active_subscription_feed_id &&
        !remaining_subscriptions.find((subscription) => {
          return subscription.feed_id === self.active_subscription_feed_id;
        })
      ) {
        self.clear_active_subscription_feed();
      } else {
        self.sync_active_subscription_feed_metadata();
      }

      return true;
    },

    load_subscriptions: flow(function* (force = false) {
      if (self.is_loading_subscriptions) {
        return true;
      }

      if (
        !force &&
        self.subscriptions.length > 0 &&
        !self.subscriptions_error_message
      ) {
        return true;
      }

      self.is_loading_subscriptions = true;
      self.clear_subscriptions_error();
      self.subscriptions_request_token += 1;
      const request_token = self.subscriptions_request_token;

      try {
        yield Tokens.hydrate();

        const user_token = Tokens.get_user_token();
        if (!user_token) {
          self.reset();
          return false;
        }
        const subscriptions_result = yield fetch_micro_blog_feed_subscriptions({
          token: user_token,
        });

        const icons = yield resolve_feed_icons_for_subscriptions({
          subscriptions: subscriptions_result,
          token: user_token,
        });

        const current_user_token = Tokens.get_user_token();
        if (current_user_token !== user_token) {
          if (!current_user_token) {
            self.reset();
          }
          return false;
        }

        if (self.subscriptions_request_token !== request_token) {
          return false;
        }

        self.apply_subscriptions(subscriptions_result, icons);
        return true;
      } catch (error) {
        if (self.subscriptions_request_token === request_token) {
          self.subscriptions_error_message =
            resolve_subscription_request_error_message(
              error,
              'We could not load your subscriptions.',
            );
        }
        return false;
      } finally {
        if (self.subscriptions_request_token === request_token) {
          self.is_loading_subscriptions = false;
        }
      }
    }),

    refresh_subscriptions: flow(function* () {
      return yield self.load_subscriptions(true);
    }),

    create_subscription: flow(function* (feed_url = '') {
      const normalized_feed_url = normalize_string(feed_url);

      if (!normalized_feed_url) {
        return {
          ok: false,
          error_message: 'Enter a site or feed URL to subscribe.',
        };
      }

      try {
        yield Tokens.hydrate();

        const user_token = Tokens.get_user_token();
        if (!user_token) {
          return {
            ok: false,
            error_message:
              'Your Micro.blog session expired. Please sign in again.',
          };
        }

        if (
          find_existing_subscription_for_feed_url(
            self.subscriptions,
            normalized_feed_url,
          )
        ) {
          return {
            ok: false,
            error_message: 'That feed is already in your subscriptions.',
          };
        }

        const result = yield create_micro_blog_feed_subscription({
          token: user_token,
          feed_url: normalized_feed_url,
        });

        if (result?.kind === 'choices') {
          return {
            ok: false,
            kind: 'choices',
            choices: Array.isArray(result?.choices) ? result.choices : [],
          };
        }

        const created_subscription = result?.subscription || null;
        const did_refresh = yield self.refresh_subscriptions();

        if (!did_refresh && created_subscription) {
          self.upsert_subscription(created_subscription);
        }

        self.refresh_timeline_in_background();

        return {
          ok: true,
          kind: 'subscription',
          subscription: created_subscription,
          warning_message: did_refresh
            ? ''
            : 'Subscribed. Pull to refresh if it does not appear right away.',
        };
      } catch (error) {
        return {
          ok: false,
          error_message: resolve_subscription_request_error_message(
            error,
            'We could not subscribe to that feed.',
          ),
        };
      }
    }),

    rename_subscription: flow(function* (
      subscription_id = '',
      title = '',
    ) {
      const normalized_subscription_id = normalize_string(subscription_id);
      const normalized_title = normalize_string(title);

      if (!normalized_subscription_id) {
        return {
          ok: false,
          error_message: 'That subscription could not be updated.',
        };
      }

      if (!normalized_title) {
        return {
          ok: false,
          error_message: 'Enter a title before saving.',
        };
      }

      try {
        yield Tokens.hydrate();

        const user_token = Tokens.get_user_token();
        if (!user_token) {
          return {
            ok: false,
            error_message:
              'Your Micro.blog session expired. Please sign in again.',
          };
        }

        const updated_subscription = yield update_micro_blog_feed_subscription({
          token: user_token,
          subscription_id: normalized_subscription_id,
          title: normalized_title,
        });

        if (updated_subscription) {
          self.upsert_subscription(updated_subscription);
        }

        const did_refresh = yield self.refresh_subscriptions();
        self.refresh_timeline_in_background();

        return {
          ok: true,
          warning_message: did_refresh
            ? ''
            : 'Saved. Pull to refresh if the new title does not appear right away.',
        };
      } catch (error) {
        return {
          ok: false,
          error_message: resolve_subscription_request_error_message(
            error,
            'We could not rename that subscription.',
          ),
        };
      }
    }),

    delete_subscription: flow(function* (subscription_id = '') {
      const normalized_subscription_id = normalize_string(subscription_id);

      if (!normalized_subscription_id) {
        return {
          ok: false,
          error_message: 'That subscription could not be removed.',
        };
      }

      try {
        yield Tokens.hydrate();

        const user_token = Tokens.get_user_token();
        if (!user_token) {
          return {
            ok: false,
            error_message:
              'Your Micro.blog session expired. Please sign in again.',
          };
        }

        yield delete_micro_blog_feed_subscription({
          token: user_token,
          subscription_id: normalized_subscription_id,
        });

        self.remove_subscription_locally(normalized_subscription_id);
        const did_refresh = yield self.refresh_subscriptions();
        self.refresh_timeline_in_background();

        return {
          ok: true,
          warning_message: did_refresh
            ? ''
            : 'Removed. Pull to refresh if the list looks out of date.',
        };
      } catch (error) {
        return {
          ok: false,
          error_message: resolve_subscription_request_error_message(
            error,
            'We could not remove that subscription.',
          ),
        };
      }
    }),

    load_subscription_feed: flow(function* (feed_id = '') {
      const normalized_feed_id = normalize_string(feed_id);

      if (!normalized_feed_id) {
        self.clear_active_subscription_feed();
        return false;
      }

      if (
        self.is_loading_subscription_feed &&
        self.active_subscription_feed_id === normalized_feed_id
      ) {
        return true;
      }

      const is_same_feed = self.active_subscription_feed_id === normalized_feed_id;

      self.active_subscription_feed_id = normalized_feed_id;
      self.is_loading_subscription_feed = true;
      self.subscription_feed_error_message = null;
      self.subscription_feed_request_token += 1;
      const request_token = self.subscription_feed_request_token;

      if (!is_same_feed) {
        self.subscription_feed_entries.replace([]);
        self.has_loaded_subscription_feed = false;
      }

      try {
        yield Tokens.hydrate();

        const user_token = Tokens.get_user_token();
        if (!user_token) {
          self.reset();
          return false;
        }

        const [entries_result, unread_result, starred_result] =
          yield Promise.allSettled([
            fetch_micro_blog_feed_entries_for_feed({
              token: user_token,
              feed_id: normalized_feed_id,
            }),
            fetch_micro_blog_feed_unread_entry_ids({ token: user_token }),
            fetch_micro_blog_feed_starred_entry_ids({ token: user_token }),
          ]);

        if (entries_result.status !== 'fulfilled') {
          throw entries_result.reason;
        }

        if (unread_result.status !== 'fulfilled') {
          throw unread_result.reason;
        }

        if (starred_result.status !== 'fulfilled') {
          throw starred_result.reason;
        }

        const current_user_token = Tokens.get_user_token();
        if (current_user_token !== user_token) {
          if (!current_user_token) {
            self.reset();
          }
          return false;
        }

        if (
          self.subscription_feed_request_token !== request_token ||
          self.active_subscription_feed_id !== normalized_feed_id
        ) {
          return false;
        }

        const normalized_entries = normalize_timeline_entries(
          entries_result.value,
          self.subscriptions.slice(),
          unread_result.value,
          starred_result.value,
          self.local_read_entry_ids,
          self.local_unread_entry_ids,
          self.local_bookmarked_entry_ids,
          self.local_unbookmarked_entry_ids,
          { filter_timeline_window: false },
        );

        self.subscription_feed_entries.replace(normalized_entries);
        self.has_loaded_subscription_feed = true;
        self.subscription_feed_error_message = null;
        self.sync_active_subscription_feed_metadata();
        return true;
      } catch (error) {
        if (
          self.subscription_feed_request_token === request_token &&
          self.active_subscription_feed_id === normalized_feed_id
        ) {
          self.has_loaded_subscription_feed = true;
          self.subscription_feed_error_message =
            resolve_subscription_request_error_message(
              error,
              'We could not load that feed right now.',
            );
        }
        return false;
      } finally {
        if (
          self.subscription_feed_request_token === request_token &&
          self.active_subscription_feed_id === normalized_feed_id
        ) {
          self.is_loading_subscription_feed = false;
        }
      }
    }),

    refresh_subscription_feed: flow(function* (feed_id = '') {
      const normalized_feed_id =
        normalize_string(feed_id) || self.active_subscription_feed_id;

      return yield self.load_subscription_feed(normalized_feed_id);
    }),

    bootstrap: flow(function* () {
      if (self.is_bootstrapping) {
        return true;
      }

      self.is_bootstrapping = true;
      self.is_loading_subscriptions = true;
      self.clear_error();

      try {
        if (!self.has_checked_timeline_cache) {
          yield self.hydrate_timeline_cache();
        }

        yield Tokens.hydrate();

        const user_token = Tokens.get_user_token();
        if (!user_token) {
          self.reset();
          return false;
        }
        const existing_entry_ids = self.timeline_entries.map((entry) => {
          return entry.id;
        });
        const existing_entries = self.timeline_entries.map((entry) => {
          return getSnapshot(entry);
        });
        const [
          subscriptions_result,
          unread_entry_ids_result,
          starred_entry_ids_result,
          entries_result,
        ] = yield Promise.allSettled([
          fetch_micro_blog_feed_subscriptions({ token: user_token }),
          fetch_micro_blog_feed_unread_entry_ids({ token: user_token }),
          fetch_micro_blog_feed_starred_entry_ids({ token: user_token }),
          fetch_micro_blog_feed_entries({
            token: user_token,
            existing_entry_ids,
          }),
        ]);

        if (subscriptions_result.status !== 'fulfilled') {
          throw subscriptions_result.reason;
        }

        if (unread_entry_ids_result.status !== 'fulfilled') {
          throw unread_entry_ids_result.reason;
        }

        if (starred_entry_ids_result.status !== 'fulfilled') {
          throw starred_entry_ids_result.reason;
        }

        if (entries_result.status !== 'fulfilled') {
          throw entries_result.reason;
        }

        const subscriptions = subscriptions_result.value;
        const unread_entry_ids = unread_entry_ids_result.value;
        const starred_entry_ids = starred_entry_ids_result.value;
        const entries = merge_timeline_entry_payloads(
          existing_entries,
          entries_result.value,
        );
        const icons = yield resolve_feed_icons_for_subscriptions({
          subscriptions,
          token: user_token,
        });

        const current_user_token = Tokens.get_user_token();
        if (current_user_token !== user_token) {
          if (!current_user_token) {
            self.reset();
          }
          return false;
        }

        self.apply_bootstrap_payload(
          subscriptions,
          unread_entry_ids,
          starred_entry_ids,
          entries,
          icons,
        );
        self.retry_unsynced_local_reads(unread_entry_ids);
        self.retry_unsynced_local_bookmarks(starred_entry_ids);
        yield self.persist_timeline_cache(user_token);
        self.has_bootstrapped = true;
        return true;
      } catch (error) {
        self.has_bootstrapped = true;

        if (error?.status === 401 || error?.status === 403) {
          self.error_message =
            'Your Micro.blog session expired. Please sign in again.';
          throw error;
        }

        self.error_message = 'We could not load your feed. Please try again.';
        return false;
      } finally {
        self.is_bootstrapping = false;
        self.is_loading_subscriptions = false;
      }
    }),

    retry_bootstrap: flow(function* () {
      return yield self.bootstrap();
    }),

    set_entry_read_state_locally(entry_id = '', next_is_read = false) {
      const normalized_entry_id = normalize_string(entry_id);

      if (!normalized_entry_id) {
        return false;
      }

      let did_change = false;

      [
        self.timeline_entries,
        self.subscription_feed_entries,
        self.feed_filter_entries,
      ].forEach(
        (entries) => {
          entries.forEach((entry) => {
            if (
              entry.id === normalized_entry_id &&
              entry.is_read !== next_is_read
            ) {
              entry.is_read = next_is_read;
              did_change = true;
            }
          });
        },
      );

      if (!did_change) {
        return false;
      }

      if (next_is_read) {
        self.local_read_entry_ids.add(normalized_entry_id);
        self.local_unread_entry_ids.delete(normalized_entry_id);
      } else {
        self.local_unread_entry_ids.add(normalized_entry_id);
        self.local_read_entry_ids.delete(normalized_entry_id);
      }

      return true;
    },

    set_entry_bookmark_state_locally(
      entry_id = '',
      next_is_bookmarked = false,
    ) {
      const normalized_entry_id = normalize_string(entry_id);

      if (!normalized_entry_id) {
        return false;
      }

      let did_change = false;

      [
        self.timeline_entries,
        self.subscription_feed_entries,
        self.feed_filter_entries,
      ].forEach(
        (entries) => {
          entries.forEach((entry) => {
            if (
              entry.id === normalized_entry_id &&
              entry.is_bookmarked !== next_is_bookmarked
            ) {
              entry.is_bookmarked = next_is_bookmarked;
              did_change = true;
            }
          });
        },
      );

      if (!did_change) {
        return false;
      }

      if (next_is_bookmarked) {
        self.local_bookmarked_entry_ids.add(normalized_entry_id);
        self.local_unbookmarked_entry_ids.delete(normalized_entry_id);
      } else {
        self.local_unbookmarked_entry_ids.add(normalized_entry_id);
        self.local_bookmarked_entry_ids.delete(normalized_entry_id);
      }

      return true;
    },

    mark_entry_read_locally(entry_id = '') {
      return self.set_entry_read_state_locally(entry_id, true);
    },

    mark_entry_unread_locally(entry_id = '') {
      return self.set_entry_read_state_locally(entry_id, false);
    },

    mark_entry_bookmarked_locally(entry_id = '') {
      return self.set_entry_bookmark_state_locally(entry_id, true);
    },

    mark_entry_unbookmarked_locally(entry_id = '') {
      return self.set_entry_bookmark_state_locally(entry_id, false);
    },

    open_entry(entry_id = '') {
      self.mark_entry_read(entry_id);
    },

    mark_entry_read(entry_id = '') {
      const did_mark_read = self.mark_entries_read([entry_id]) > 0;

      if (!did_mark_read) {
        return false;
      }
      return true;
    },

    mark_entries_read(entry_ids = []) {
      const normalized_entry_ids = normalize_unique_entry_ids(entry_ids);

      if (normalized_entry_ids.length === 0) {
        return 0;
      }

      const changed_entry_ids = [];

      normalized_entry_ids.forEach((entry_id) => {
        if (self.mark_entry_read_locally(entry_id)) {
          changed_entry_ids.push(entry_id);
        }
      });

      if (changed_entry_ids.length === 0) {
        return 0;
      }

      self.sync_read_entries(changed_entry_ids);
      self.schedule_timeline_cache_persist();
      return changed_entry_ids.length;
    },

    mark_entry_unread(entry_id = '') {
      const did_mark_unread = self.mark_entry_unread_locally(entry_id);

      if (!did_mark_unread) {
        return false;
      }

      self.sync_unread_entries([entry_id]);
      self.schedule_timeline_cache_persist();
      return true;
    },

    bookmark_entry(entry_id = '') {
      const did_bookmark_entry = self.mark_entry_bookmarked_locally(entry_id);

      if (!did_bookmark_entry) {
        return false;
      }

      self.sync_bookmarked_entries([entry_id]);
      self.schedule_timeline_cache_persist();
      return true;
    },

    unbookmark_entry(entry_id = '') {
      const did_unbookmark_entry =
        self.mark_entry_unbookmarked_locally(entry_id);

      if (!did_unbookmark_entry) {
        return false;
      }

      self.sync_unbookmarked_entries([entry_id]);
      self.schedule_timeline_cache_persist();
      return true;
    },

    retry_unsynced_local_reads(unread_entry_ids = []) {
      const unread_id_set = new Set(
        (Array.isArray(unread_entry_ids) ? unread_entry_ids : [])
          .map((entry_id) => {
            return normalize_string(entry_id);
          })
          .filter(Boolean),
      );
      const unsynced_read_entry_ids = [...self.local_read_entry_ids].filter(
        (entry_id) => {
          return (
            entry_id &&
            unread_id_set.has(entry_id) &&
            !self.pending_read_sync_entry_ids.has(entry_id)
          );
        },
      );
      const unsynced_unread_entry_ids = [...self.local_unread_entry_ids].filter(
        (entry_id) => {
          return (
            entry_id &&
            !unread_id_set.has(entry_id) &&
            !self.pending_unread_sync_entry_ids.has(entry_id)
          );
        },
      );

      if (unsynced_read_entry_ids.length > 0) {
        self.sync_read_entries(unsynced_read_entry_ids);
      }

      if (unsynced_unread_entry_ids.length > 0) {
        self.sync_unread_entries(unsynced_unread_entry_ids);
      }
    },

    retry_unsynced_local_bookmarks(starred_entry_ids = []) {
      const starred_id_set = new Set(
        (Array.isArray(starred_entry_ids) ? starred_entry_ids : [])
          .map((entry_id) => {
            return normalize_string(entry_id);
          })
          .filter(Boolean),
      );
      const unsynced_bookmarked_entry_ids = [...self.local_bookmarked_entry_ids]
        .filter((entry_id) => {
          return (
            entry_id &&
            !starred_id_set.has(entry_id) &&
            !self.pending_bookmark_sync_entry_ids.has(entry_id)
          );
        });
      const unsynced_unbookmarked_entry_ids = [
        ...self.local_unbookmarked_entry_ids,
      ].filter((entry_id) => {
        return (
          entry_id &&
          starred_id_set.has(entry_id) &&
          !self.pending_unbookmark_sync_entry_ids.has(entry_id)
        );
      });

      if (unsynced_bookmarked_entry_ids.length > 0) {
        self.sync_bookmarked_entries(unsynced_bookmarked_entry_ids);
      }

      if (unsynced_unbookmarked_entry_ids.length > 0) {
        self.sync_unbookmarked_entries(unsynced_unbookmarked_entry_ids);
      }
    },

    sync_read_entries: flow(function* (entry_ids = []) {
      const normalized_entry_ids = normalize_unique_entry_ids(entry_ids).filter(
        (entry_id) => {
          return !self.pending_read_sync_entry_ids.has(entry_id);
        },
      );

      if (normalized_entry_ids.length === 0) {
        return false;
      }

      normalized_entry_ids.forEach((entry_id) => {
        self.pending_read_sync_entry_ids.add(entry_id);
      });

      try {
        const user_token = Tokens.get_user_token();

        if (!user_token) {
          return false;
        }

        yield mark_micro_blog_feed_entries_read({
          token: user_token,
          entry_ids: normalized_entry_ids,
        });

        return true;
      } catch (error) {
        return false;
      } finally {
        normalized_entry_ids.forEach((entry_id) => {
          self.pending_read_sync_entry_ids.delete(entry_id);
        });
      }
    }),

    sync_unread_entries: flow(function* (entry_ids = []) {
      const normalized_entry_ids = normalize_unique_entry_ids(entry_ids).filter(
        (entry_id) => {
          return !self.pending_unread_sync_entry_ids.has(entry_id);
        },
      );

      if (normalized_entry_ids.length === 0) {
        return false;
      }

      normalized_entry_ids.forEach((entry_id) => {
        self.pending_unread_sync_entry_ids.add(entry_id);
      });

      try {
        const user_token = Tokens.get_user_token();

        if (!user_token) {
          return false;
        }

        yield mark_micro_blog_feed_entries_unread({
          token: user_token,
          entry_ids: normalized_entry_ids,
        });

        return true;
      } catch (error) {
        return false;
      } finally {
        normalized_entry_ids.forEach((entry_id) => {
          self.pending_unread_sync_entry_ids.delete(entry_id);
        });
      }
    }),

    sync_bookmarked_entries: flow(function* (entry_ids = []) {
      const normalized_entry_ids = normalize_unique_entry_ids(entry_ids).filter(
        (entry_id) => {
          return !self.pending_bookmark_sync_entry_ids.has(entry_id);
        },
      );

      if (normalized_entry_ids.length === 0) {
        return false;
      }

      normalized_entry_ids.forEach((entry_id) => {
        self.pending_bookmark_sync_entry_ids.add(entry_id);
      });

      try {
        const user_token = Tokens.get_user_token();

        if (!user_token) {
          return false;
        }

        yield bookmark_micro_blog_feed_entries({
          token: user_token,
          entry_ids: normalized_entry_ids,
        });

        return true;
      } catch (error) {
        return false;
      } finally {
        normalized_entry_ids.forEach((entry_id) => {
          self.pending_bookmark_sync_entry_ids.delete(entry_id);
        });
      }
    }),

    sync_unbookmarked_entries: flow(function* (entry_ids = []) {
      const normalized_entry_ids = normalize_unique_entry_ids(entry_ids).filter(
        (entry_id) => {
          return !self.pending_unbookmark_sync_entry_ids.has(entry_id);
        },
      );

      if (normalized_entry_ids.length === 0) {
        return false;
      }

      normalized_entry_ids.forEach((entry_id) => {
        self.pending_unbookmark_sync_entry_ids.add(entry_id);
      });

      try {
        const user_token = Tokens.get_user_token();

        if (!user_token) {
          return false;
        }

        yield unbookmark_micro_blog_feed_entries({
          token: user_token,
          entry_ids: normalized_entry_ids,
        });

        return true;
      } catch (error) {
        return false;
      } finally {
        normalized_entry_ids.forEach((entry_id) => {
          self.pending_unbookmark_sync_entry_ids.delete(entry_id);
        });
      }
    }),
  }))
  .views((self) => ({
    can_open_fading_recap() {
      if (self.active_segment !== 'fading' || self.is_search_active) {
        return false;
      }

      return self.fading_recap_timeline_entries().length > 0;
    },

    active_recap_snapshot() {
      if (!self.active_recap) {
        return null;
      }

      return getSnapshot(self.active_recap);
    },

    active_recap_entry_count() {
      if (!self.active_recap) {
        return 0;
      }

      return self.active_recap.entry_ids.length;
    },

    is_recap_email_enabled() {
      return Boolean(self.recap_email_day);
    },

    is_recap_quote_bookmarked(bookmark_url = '') {
      const normalized_bookmark_url = normalize_string(bookmark_url);

      if (!normalized_bookmark_url) {
        return false;
      }

      return self.recap_bookmarked_quote_urls.includes(normalized_bookmark_url);
    },

    is_feed_filter_active() {
      return Boolean(self.active_feed_filter_feed_id);
    },

    active_feed_filter_display_label() {
      return (
        self.active_feed_filter_label ||
        self.active_feed_filter_hostname ||
        ''
      );
    },

    fading_recap_timeline_entries() {
      return self.timeline_entries
        .filter((timeline_entry) => {
          return SEGMENT_BUCKETS.fading.includes(timeline_entry.age_bucket);
        })
        .map((timeline_entry) => {
          return getSnapshot(timeline_entry);
        });
    },

    current_feed_filter_timeline_entries() {
      if (!self.active_feed_filter_feed_id) {
        return [];
      }

      return self.timeline_entries
        .filter((timeline_entry) => {
          return timeline_entry.feed_id === self.active_feed_filter_feed_id;
        })
        .map((timeline_entry) => {
          return getSnapshot(timeline_entry);
        })
        .sort(compare_timeline_entries_by_published_at);
    },

    visible_timeline_entries() {
      const normalized_search_query = normalize_search_query(self.search_query);
      let timeline_entries = self.timeline_entries;

      if (self.active_feed_filter_feed_id) {
        timeline_entries =
          self.feed_filter_entries.length > 0 ||
          self.has_loaded_feed_filter
            ? self.feed_filter_entries
            : self.timeline_entries.filter((timeline_entry) => {
                return timeline_entry.feed_id === self.active_feed_filter_feed_id;
              });
      } else if (self.is_search_active) {
        if (normalized_search_query) {
          timeline_entries = timeline_entries.filter((timeline_entry) => {
            return timeline_entry_matches_search(
              timeline_entry,
              normalized_search_query,
            );
          });
        }

        timeline_entries = [...timeline_entries].sort(
          compare_timeline_entries_by_published_at,
        );
      } else {
        const segment_buckets = SEGMENT_BUCKETS[self.active_segment];
        timeline_entries = !segment_buckets
          ? self.timeline_entries
          : self.timeline_entries.filter((timeline_entry) => {
              return segment_buckets.includes(timeline_entry.age_bucket);
            });
      }

      if (self.hide_read_posts) {
        timeline_entries = timeline_entries.filter((timeline_entry) => {
          return !timeline_entry.is_read;
        });
      }

      // FlatList can temporarily hold onto older items while a refresh replaces the MST array.
      // Returning snapshots here prevents the UI from reading dead model nodes between renders.
      return timeline_entries.map((timeline_entry) => {
        return getSnapshot(timeline_entry);
      });
    },

    timeline_entry_snapshot(entry_id = '') {
      const normalized_entry_id = normalize_string(entry_id);

      if (!normalized_entry_id) {
        return null;
      }

      const timeline_entry = self.timeline_entries.find((entry) => {
        return entry.id === normalized_entry_id;
      });

      if (timeline_entry) {
        return getSnapshot(timeline_entry);
      }

      const feed_filter_entry = self.feed_filter_entries.find((entry) => {
        return entry.id === normalized_entry_id;
      });

      if (feed_filter_entry) {
        return getSnapshot(feed_filter_entry);
      }

      return null;
    },

    subscription_snapshots() {
      return self.subscriptions.map((subscription) => {
        return getSnapshot(subscription);
      });
    },

    subscription_snapshot(feed_id = '') {
      const normalized_feed_id = normalize_string(feed_id);

      if (!normalized_feed_id) {
        return null;
      }

      const subscription = self.subscriptions.find((entry) => {
        return (
          entry.feed_id === normalized_feed_id ||
          entry.id === normalized_feed_id
        );
      });

      if (!subscription) {
        return null;
      }

      return getSnapshot(subscription);
    },

    active_subscription_feed_entries() {
      if (!self.active_subscription_feed_id) {
        return [];
      }

      return self.subscription_feed_entries.map((entry) => {
        return getSnapshot(entry);
      });
    },

    subscription_feed_entry_snapshot(entry_id = '') {
      const normalized_entry_id = normalize_string(entry_id);

      if (!normalized_entry_id) {
        return null;
      }

      const subscription_feed_entry = self.subscription_feed_entries.find(
        (entry) => {
          return entry.id === normalized_entry_id;
        },
      );

      if (!subscription_feed_entry) {
        return null;
      }

      return getSnapshot(subscription_feed_entry);
    },
  }))
  .create({
    hide_read_posts: read_hide_read_posts_preference(),
  });

export default Feed;

function normalize_segment(segment = 'today') {
  const trimmed_segment = `${segment || ''}`.trim().toLowerCase();

  if (trimmed_segment === 'recent') {
    return 'recent';
  }

  if (trimmed_segment === 'fading') {
    return 'fading';
  }

  return 'today';
}

function normalize_search_query(search_query = '') {
  return `${search_query || ''}`.trim().toLowerCase();
}

function read_hide_read_posts_preference() {
  if (Platform.OS !== 'ios') {
    return false;
  }

  return normalize_hide_read_posts_setting(
    Settings.get(HIDE_READ_POSTS_SETTINGS_KEY),
  );
}

function persist_hide_read_posts_preference(next_hide_read_posts = false) {
  if (Platform.OS !== 'ios') {
    return;
  }

  Settings.set({
    [HIDE_READ_POSTS_SETTINGS_KEY]: Boolean(next_hide_read_posts),
  });
}

function normalize_recap_email_day(dayofweek = '') {
  const normalized_dayofweek = `${dayofweek || ''}`.trim().toLowerCase();

  if (!normalized_dayofweek) {
    return '';
  }

  const matching_day = RECAP_EMAIL_DAYS.find((day) => {
    return day.toLowerCase() === normalized_dayofweek;
  });

  if (matching_day) {
    return matching_day;
  } else {
    return '';
  }
}

function timeline_entry_matches_search(
  timeline_entry,
  normalized_search_query = '',
) {
  if (!normalized_search_query) {
    return true;
  }

  const search_fields = [
    timeline_entry?.title,
    timeline_entry?.summary,
    timeline_entry?.source,
    timeline_entry?.url,
  ];

  return search_fields.some((field) => {
    if (!field) {
      return false;
    }

    return `${field}`.toLowerCase().includes(normalized_search_query);
  });
}

function compare_timeline_entries_by_published_at(left_entry, right_entry) {
  const left_timestamp = resolve_published_timestamp(left_entry?.published_at);
  const right_timestamp = resolve_published_timestamp(right_entry?.published_at);

  return right_timestamp - left_timestamp;
}

function resolve_published_timestamp(raw_date = '') {
  const timestamp = new Date(raw_date).getTime();

  if (Number.isNaN(timestamp)) {
    return 0;
  } else {
    return timestamp;
  }
}

function normalize_hide_read_posts_setting(value) {
  if (typeof value === 'boolean') {
    return value;
  }

  return false;
}

function serialize_timeline_cache_payload(self) {
  return {
    version: FEED_TIMELINE_CACHE_VERSION,
    cached_at: new Date().toISOString(),
    entries: self.timeline_entries.map((timeline_entry) => {
      return getSnapshot(timeline_entry);
    }),
    local_read_entry_ids: [...self.local_read_entry_ids],
    local_unread_entry_ids: [...self.local_unread_entry_ids],
    local_bookmarked_entry_ids: [...self.local_bookmarked_entry_ids],
    local_unbookmarked_entry_ids: [...self.local_unbookmarked_entry_ids],
  };
}

function normalize_timeline_cache_payload(timeline_cache_payload = null) {
  let entries = null;
  let payload = timeline_cache_payload;

  if (Array.isArray(timeline_cache_payload)) {
    entries = timeline_cache_payload;
    payload = {};
  } else if (
    !timeline_cache_payload ||
    typeof timeline_cache_payload !== 'object'
  ) {
    return null;
  } else if (Number(payload?.version || 0) !== FEED_TIMELINE_CACHE_VERSION) {
    return null;
  } else if (Array.isArray(payload?.entries)) {
    entries = payload.entries;
  }

  if (!Array.isArray(entries)) {
    return null;
  }

  return {
    entries: normalize_cached_timeline_entries(entries),
    local_read_entry_ids: normalize_unique_entry_ids(
      payload?.local_read_entry_ids,
    ),
    local_unread_entry_ids: normalize_unique_entry_ids(
      payload?.local_unread_entry_ids,
    ),
    local_bookmarked_entry_ids: normalize_unique_entry_ids(
      payload?.local_bookmarked_entry_ids,
    ),
    local_unbookmarked_entry_ids: normalize_unique_entry_ids(
      payload?.local_unbookmarked_entry_ids,
    ),
  };
}

function normalize_cached_timeline_entries(entries = []) {
  return entries
    .map((entry, index) => {
      const published_at = resolve_published_at(entry);

      return {
        id: normalize_entry_id(entry, index),
        feed_id: normalize_feed_id(entry),
        source: normalize_string(entry?.source) || 'Feed',
        source_url: normalize_string(entry?.source_url),
        avatar_url: normalize_string(entry?.avatar_url),
        title: normalize_string(entry?.title),
        summary: normalize_string(entry?.summary),
        content: normalize_string(entry?.content),
        author: normalize_string(entry?.author),
        url: normalize_string(entry?.url),
        published_at,
        is_read: Boolean(entry?.is_read),
        is_bookmarked: Boolean(entry?.is_bookmarked),
        age_bucket: get_age_bucket(published_at),
      };
    })
    .filter((entry) => {
      return is_inside_timeline_window(entry.published_at);
    })
    .sort(compare_timeline_entries_by_published_at);
}

function get_timeline_cache_directory() {
  const cache_directory = normalize_string(FileSystem.cacheDirectory);

  if (!cache_directory) {
    return '';
  }

  return `${cache_directory}${FEED_TIMELINE_CACHE_DIRECTORY_NAME}`;
}

async function get_timeline_cache_uri(user_token = '') {
  const normalized_user_token = normalize_string(user_token);
  const timeline_cache_directory = get_timeline_cache_directory();

  if (!normalized_user_token || !timeline_cache_directory) {
    return '';
  }

  try {
    const account_key = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      normalized_user_token,
    );

    if (!account_key) {
      return '';
    }

    return `${timeline_cache_directory}/${FEED_TIMELINE_CACHE_FILENAME_PREFIX}-${account_key}.json`;
  } catch (error) {
    return '';
  }
}

async function resolve_feed_icons_for_subscriptions({
  subscriptions = [],
  token = '',
} = {}) {
  const cached_icons_result = await load_cached_feed_icons();
  let icons = cached_icons_result.icons;

  if (
    !should_fetch_feed_icons_for_subscriptions({
      did_expire: cached_icons_result.did_expire,
      icons,
      known_hosts: cached_icons_result.known_hosts,
      subscriptions,
    })
  ) {
    return icons;
  }

  try {
    icons = normalize_feed_icons(
      await fetch_micro_blog_feed_icons({ token }),
    );
    await persist_cached_feed_icons(icons, subscriptions);
  } catch (error) {
    if (cached_icons_result.did_expire) {
      icons = [];
    }
  }

  return icons;
}

async function load_cached_feed_icons() {
  const icons_cache_uri = get_feed_icons_cache_uri();

  if (!icons_cache_uri) {
    return {
      did_expire: false,
      icons: [],
      known_hosts: [],
    };
  }

  try {
    const cache_info = await FileSystem.getInfoAsync(icons_cache_uri);
    if (!cache_info.exists) {
      return {
        did_expire: false,
        icons: [],
        known_hosts: [],
      };
    }

    if (is_file_cache_expired(cache_info, FEED_ICONS_CACHE_MAX_AGE_MS)) {
      await FileSystem.deleteAsync(icons_cache_uri, { idempotent: true });
      return {
        did_expire: true,
        icons: [],
        known_hosts: [],
      };
    }

    const raw_payload = await FileSystem.readAsStringAsync(icons_cache_uri);
    const parsed_payload = JSON.parse(raw_payload);
    if (is_feed_icon_cache_payload_expired(parsed_payload)) {
      await FileSystem.deleteAsync(icons_cache_uri, { idempotent: true });
      return {
        did_expire: true,
        icons: [],
        known_hosts: [],
      };
    }

    const icons = normalize_feed_icons_from_cache_payload(parsed_payload);

    return {
      did_expire: false,
      icons,
      known_hosts: normalize_feed_icon_hosts_from_cache_payload(
        parsed_payload,
        icons,
      ),
    };
  } catch (error) {
    try {
      await FileSystem.deleteAsync(icons_cache_uri, { idempotent: true });
    } catch (delete_error) {
      // A corrupt icon cache should not block feed syncing.
    }

    return {
      did_expire: false,
      icons: [],
      known_hosts: [],
    };
  }
}

async function persist_cached_feed_icons(icons = [], subscriptions = []) {
  const icons_cache_directory = get_timeline_cache_directory();
  const icons_cache_uri = get_feed_icons_cache_uri();

  if (!icons_cache_directory || !icons_cache_uri) {
    return false;
  }

  try {
    const directory_info = await FileSystem.getInfoAsync(icons_cache_directory);
    if (!directory_info.exists) {
      await FileSystem.makeDirectoryAsync(
        icons_cache_directory,
        { intermediates: true },
      );
    }

    const payload = {
      cached_at: new Date().toISOString(),
      hosts: collect_subscription_icon_hosts(subscriptions),
      icons: normalize_feed_icons(icons),
      version: 1,
    };

    await FileSystem.writeAsStringAsync(
      icons_cache_uri,
      JSON.stringify(payload),
    );
    return true;
  } catch (error) {
    return false;
  }
}

function get_feed_icons_cache_uri() {
  const cache_directory = get_timeline_cache_directory();

  if (!cache_directory) {
    return '';
  }

  return `${cache_directory}/${FEED_ICONS_CACHE_FILENAME}`;
}

function is_file_cache_expired(cache_info = null, max_age_ms = 0) {
  const modification_time = Number(cache_info?.modificationTime);

  if (!Number.isFinite(modification_time)) {
    return false;
  }

  const modification_time_ms =
    modification_time > 1000000000000
      ? modification_time
      : modification_time * 1000;

  return Date.now() - modification_time_ms > max_age_ms;
}

function is_feed_icon_cache_payload_expired(payload = null) {
  const cached_at = normalize_string(payload?.cached_at);
  const cached_at_time = new Date(cached_at).getTime();

  if (Number.isNaN(cached_at_time)) {
    return false;
  }

  return Date.now() - cached_at_time > FEED_ICONS_CACHE_MAX_AGE_MS;
}

function should_fetch_feed_icons_for_subscriptions({
  did_expire = false,
  icons = [],
  known_hosts = [],
  subscriptions = [],
} = {}) {
  if (!Array.isArray(subscriptions) || subscriptions.length === 0) {
    return false;
  }

  if (did_expire) {
    return true;
  }

  const icon_map = build_icon_map(icons);
  const known_host_set = new Set(
    (Array.isArray(known_hosts) ? known_hosts : [])
      .map((host) => {
        return normalize_icon_host(host);
      })
      .filter(Boolean),
  );

  return subscriptions.some((subscription) => {
    if (subscription_has_embedded_avatar(subscription)) {
      return false;
    }

    const host = get_subscription_host(subscription);
    if (!host) {
      return false;
    }

    if (icon_map.has(host) || known_host_set.has(host)) {
      return false;
    }

    return true;
  });
}

function normalize_subscriptions(subscriptions = [], icons = []) {
  if (!Array.isArray(subscriptions)) {
    return [];
  }

  const icon_map = build_icon_map(icons);

  return subscriptions.map((subscription) => {
    return {
      id: normalize_subscription_id(subscription),
      feed_id: normalize_feed_id(subscription),
      title: normalize_string(subscription?.title),
      feed_url: normalize_string(subscription?.feed_url),
      site_url: normalize_string(subscription?.site_url),
      avatar_url: resolve_subscription_avatar(subscription, icon_map),
    };
  });
}

function normalize_feed_icons(icons = []) {
  if (Array.isArray(icons)) {
    return icons
      .map((icon) => {
        return {
          host: normalize_icon_host(icon?.host),
          url: normalize_string(icon?.url),
        };
      })
      .filter((icon) => {
        return icon.host && icon.url;
      });
  }

  if (!icons || typeof icons !== 'object') {
    return [];
  }

  return Object.entries(icons)
    .map(([host, url]) => {
      return {
        host: normalize_icon_host(host),
        url: normalize_string(url),
      };
    })
    .filter((icon) => {
      return icon.host && icon.url;
    });
}

function normalize_feed_icons_from_cache_payload(payload = null) {
  if (Array.isArray(payload)) {
    return normalize_feed_icons(payload);
  }

  if (!payload || typeof payload !== 'object') {
    return [];
  }

  if (Array.isArray(payload.icons)) {
    return normalize_feed_icons(payload.icons);
  }

  return normalize_feed_icons(payload);
}

function normalize_feed_icon_hosts_from_cache_payload(
  payload = null,
  icons = [],
) {
  const hosts = new Set(
    normalize_feed_icons(icons).map((icon) => {
      return icon.host;
    }),
  );

  if (payload && typeof payload === 'object' && Array.isArray(payload.hosts)) {
    payload.hosts.forEach((host) => {
      const normalized_host = normalize_icon_host(host);
      if (normalized_host) {
        hosts.add(normalized_host);
      }
    });
  }

  return [...hosts];
}

function normalize_timeline_entries(
  entries = [],
  subscriptions = [],
  unread_entry_ids = [],
  starred_entry_ids = [],
  local_read_entry_ids = new Set(),
  local_unread_entry_ids = new Set(),
  local_bookmarked_entry_ids = new Set(),
  local_unbookmarked_entry_ids = new Set(),
  options = {},
) {
  if (!Array.isArray(entries)) {
    return [];
  }

  const should_filter_timeline_window =
    options?.filter_timeline_window !== false;
  const subscription_map = build_subscription_map(subscriptions);
  const unread_set = new Set(
    (Array.isArray(unread_entry_ids) ? unread_entry_ids : []).map(
      (entry_id) => {
        return `${entry_id || ''}`.trim();
      },
    ),
  );
  const starred_set = new Set(
    (Array.isArray(starred_entry_ids) ? starred_entry_ids : []).map(
      (entry_id) => {
        return `${entry_id || ''}`.trim();
      },
    ),
  );

  const normalized_entries = entries
    .map((entry, index) => {
      const normalized_id = normalize_entry_id(entry, index);
      const subscription = subscription_map.get(normalize_feed_id(entry));
      const published_at = resolve_published_at(entry);

      return {
        id: normalized_id,
        feed_id: normalize_feed_id(entry, subscription),
        source: resolve_source(subscription),
        source_url: resolve_source_url(subscription),
        avatar_url: resolve_avatar_url(subscription),
        title: normalize_string(entry?.title),
        summary: normalize_string(entry?.summary),
        content: normalize_string(entry?.content),
        author: normalize_string(entry?.author),
        url: normalize_string(entry?.url),
        published_at,
        is_read: resolve_entry_read_state(
          normalized_id,
          unread_set,
          local_read_entry_ids,
          local_unread_entry_ids,
        ),
        is_bookmarked: resolve_entry_bookmark_state(
          normalized_id,
          starred_set,
          local_bookmarked_entry_ids,
          local_unbookmarked_entry_ids,
        ),
        age_bucket: get_age_bucket(published_at),
      };
    })
    .filter((entry) => {
      return (
        !should_filter_timeline_window ||
        is_inside_timeline_window(entry.published_at)
      );
    });

  normalized_entries.sort((left, right) => {
    const left_time = new Date(left.published_at).getTime();
    const right_time = new Date(right.published_at).getTime();

    if (Number.isNaN(left_time) && Number.isNaN(right_time)) {
      return 0;
    }

    if (Number.isNaN(left_time)) {
      return 1;
    }

    if (Number.isNaN(right_time)) {
      return -1;
    }

    return right_time - left_time;
  });

  return normalized_entries;
}

function merge_normalized_timeline_entries(
  known_entries = [],
  loaded_entries = [],
) {
  const entry_map = new Map();

  [known_entries, loaded_entries].forEach((entries) => {
    if (!Array.isArray(entries)) {
      return;
    }

    entries.forEach((entry, index) => {
      const normalized_entry = normalize_timeline_entry_snapshot(entry, index);
      const entry_id = normalize_entry_id(normalized_entry, index);

      if (entry_id && normalized_entry) {
        entry_map.set(entry_id, normalized_entry);
      }
    });
  });

  return [...entry_map.values()].sort(compare_timeline_entries_by_published_at);
}

function normalize_timeline_entry_snapshot(entry = null, index = 0) {
  if (!entry || typeof entry !== 'object') {
    return null;
  }

  const published_at = resolve_published_at(entry);

  return {
    id: normalize_entry_id(entry, index),
    feed_id: normalize_feed_id(entry),
    source: normalize_string(entry?.source) || 'Feed',
    source_url: normalize_string(entry?.source_url),
    avatar_url: normalize_string(entry?.avatar_url),
    title: normalize_string(entry?.title),
    summary: normalize_string(entry?.summary),
    content: normalize_string(entry?.content),
    author: normalize_string(entry?.author),
    url: normalize_string(entry?.url),
    published_at,
    is_read: Boolean(entry?.is_read),
    is_bookmarked: Boolean(entry?.is_bookmarked),
    age_bucket: get_age_bucket(published_at),
  };
}

function build_subscription_map(subscriptions = []) {
  const subscription_map = new Map();

  subscriptions.forEach((subscription) => {
    const feed_id = normalize_feed_id(subscription);
    if (!feed_id) {
      return;
    }

    subscription_map.set(feed_id, subscription);
  });

  return subscription_map;
}

function build_icon_map(icons = []) {
  const icon_pairs = normalize_feed_icons(icons)
    .map((icon) => {
      return [
        normalize_icon_host(icon?.host),
        normalize_string(icon?.url),
      ];
    })
    .filter(([host, url]) => host && url);

  return new Map(icon_pairs);
}

function merge_timeline_entry_payloads(
  cached_entries = [],
  remote_entries = [],
) {
  const entry_map = new Map();

  normalize_timeline_entry_payload_array(cached_entries).forEach(
    (entry, index) => {
      const entry_id = normalize_entry_id(entry, index);
      if (entry_id) {
        entry_map.set(entry_id, entry);
      }
    },
  );

  normalize_timeline_entry_payload_array(remote_entries).forEach(
    (entry, index) => {
      const entry_id = normalize_entry_id(entry, index);
      if (entry_id) {
        entry_map.set(entry_id, entry);
      }
    },
  );

  return [...entry_map.values()];
}

function normalize_timeline_entry_payload_array(entries = []) {
  if (Array.isArray(entries)) {
    return entries.filter((entry) => {
      return entry && typeof entry === 'object';
    });
  }

  return [];
}

function subscription_has_embedded_avatar(subscription = null) {
  return Boolean(
    normalize_string(subscription?.avatar_url) ||
    normalize_string(subscription?.json_feed?.icon) ||
    normalize_string(subscription?.json_feed?.favicon),
  );
}

function collect_subscription_icon_hosts(subscriptions = []) {
  return [
    ...new Set(
      (Array.isArray(subscriptions) ? subscriptions : [])
        .map((subscription) => {
          return get_subscription_host(subscription);
        })
        .filter(Boolean),
    ),
  ];
}

function normalize_subscription_id(subscription = null) {
  const id = subscription?.id;
  if (id != null) {
    const trimmed_id = `${id}`.trim();
    if (trimmed_id) {
      return trimmed_id;
    }
  }

  return normalize_feed_id(subscription);
}

function normalize_entry_id(entry = null, index = 0) {
  const id = entry?.id;
  if (id != null) {
    const trimmed_id = `${id}`.trim();
    if (trimmed_id) {
      return trimmed_id;
    }
  }

  const raw_url = normalize_string(entry?.url);
  if (raw_url) {
    return raw_url;
  }

  return `entry-${index + 1}`;
}

function normalize_feed_id(source = null, fallback_subscription = null) {
  const direct_feed_id = source?.feed_id;
  if (direct_feed_id != null) {
    const trimmed_feed_id = `${direct_feed_id}`.trim();
    if (trimmed_feed_id) {
      return trimmed_feed_id;
    }
  }

  const fallback_feed_id = fallback_subscription?.feed_id;
  if (fallback_feed_id != null) {
    const trimmed_fallback_feed_id = `${fallback_feed_id}`.trim();
    if (trimmed_fallback_feed_id) {
      return trimmed_fallback_feed_id;
    }
  }

  return '';
}

function normalize_string(value = '') {
  return `${value || ''}`.trim();
}

function normalize_icon_host(host = '') {
  let normalized_host = normalize_string(host).toLowerCase();

  if (normalized_host.startsWith('www.')) {
    normalized_host = normalized_host.slice(4);
  }

  if (normalized_host.endsWith('.')) {
    normalized_host = normalized_host.slice(0, -1);
  }

  return normalized_host;
}

function normalize_hostname(value = '') {
  const normalized_value = normalize_string(value);

  if (!normalized_value) {
    return '';
  }

  try {
    return normalize_icon_host(new URL(normalized_value).hostname);
  } catch (error) {
    try {
      return normalize_icon_host(new URL(`https://${normalized_value}`).hostname);
    } catch (fallback_error) {
      return normalize_icon_host(normalized_value);
    }
  }
}

function resolve_avatar_url(subscription = null) {
  return normalize_string(subscription?.avatar_url);
}

function resolve_source(subscription = null) {
  if (subscription?.title) {
    return subscription.title;
  }

  if (subscription?.site_url) {
    return subscription.site_url;
  }

  if (subscription?.feed_url) {
    return subscription.feed_url;
  }

  return 'Feed';
}

function resolve_source_url(subscription = null) {
  if (subscription?.site_url) {
    return normalize_string(subscription.site_url);
  }

  if (subscription?.feed_url) {
    return normalize_string(subscription.feed_url);
  }

  return '';
}

function resolve_subscription_avatar(
  subscription = null,
  icon_map = new Map(),
) {
  const existing_avatar_url = normalize_string(subscription?.avatar_url);
  if (existing_avatar_url) {
    return existing_avatar_url;
  }

  const json_feed_icon = normalize_string(subscription?.json_feed?.icon);
  if (json_feed_icon) {
    return json_feed_icon;
  }

  const json_feed_favicon = normalize_string(subscription?.json_feed?.favicon);
  if (json_feed_favicon) {
    return json_feed_favicon;
  }

  const host = get_subscription_host(subscription);
  if (!host) {
    return '';
  }

  return normalize_string(icon_map.get(host));
}

function get_subscription_host(subscription = null) {
  const raw_url = normalize_string(
    subscription?.site_url || subscription?.feed_url,
  );
  if (!raw_url) {
    return '';
  }

  try {
    return normalize_icon_host(new URL(raw_url).hostname);
  } catch (error) {
    try {
      return normalize_icon_host(new URL(`https://${raw_url}`).hostname);
    } catch (fallback_error) {
      return '';
    }
  }
}

function resolve_published_at(entry = null) {
  const normalized_published_at = normalize_string(entry?.published_at);
  const created_at = normalize_string(entry?.created_at);

  if (normalized_published_at) {
    return resolve_effective_timeline_date(
      normalized_published_at,
      created_at,
    );
  }

  const published_at = normalize_string(entry?.published);
  if (published_at) {
    return resolve_effective_timeline_date(published_at, created_at);
  } else if (created_at) {
    return created_at;
  }

  return new Date().toISOString();
}

function resolve_effective_timeline_date(
  published_at = '',
  created_at = '',
) {
  if (created_at && is_future_timeline_day(published_at)) {
    return created_at;
  } else {
    return published_at;
  }
}

function is_future_timeline_day(raw_date = '') {
  const date = new Date(raw_date);
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const now = new Date();
  const today_midnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const entry_midnight = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );

  return entry_midnight.getTime() > today_midnight.getTime();
}

function resolve_entry_read_state(
  entry_id = '',
  unread_set = new Set(),
  local_read_entry_ids = new Set(),
  local_unread_entry_ids = new Set(),
) {
  if (local_unread_entry_ids.has(entry_id)) {
    return false;
  }

  if (local_read_entry_ids.has(entry_id)) {
    return true;
  }

  return !unread_set.has(entry_id);
}

function resolve_entry_bookmark_state(
  entry_id = '',
  starred_set = new Set(),
  local_bookmarked_entry_ids = new Set(),
  local_unbookmarked_entry_ids = new Set(),
) {
  if (local_unbookmarked_entry_ids.has(entry_id)) {
    return false;
  }

  if (local_bookmarked_entry_ids.has(entry_id)) {
    return true;
  }

  return starred_set.has(entry_id);
}

function get_age_bucket(iso_date = '') {
  const date = new Date(iso_date);
  if (Number.isNaN(date.getTime())) {
    return 'day-7';
  }

  const now = new Date();
  const today_midnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const entry_midnight = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  const diff_ms = today_midnight.getTime() - entry_midnight.getTime();
  const diff_days = Math.floor(diff_ms / (24 * 60 * 60 * 1000));
  const bucket = Math.min(Math.max(diff_days, 0), 6) + 1;

  return `day-${bucket}`;
}

function is_inside_timeline_window(iso_date = '') {
  const date = new Date(iso_date);
  if (Number.isNaN(date.getTime())) {
    return true;
  }

  const now = new Date();
  const today_midnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const entry_midnight = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  const oldest_timeline_midnight =
    today_midnight.getTime() - (FEED_TIMELINE_WINDOW_DAYS - 1) * FEED_DAY_MS;

  return entry_midnight.getTime() >= oldest_timeline_midnight;
}

function normalize_unique_entry_ids(entry_ids = []) {
  if (!Array.isArray(entry_ids)) {
    return [];
  }

  return [...new Set(entry_ids.map((entry_id) => normalize_string(entry_id)).filter(Boolean))];
}

function find_existing_subscription_for_feed_url(
  subscriptions = [],
  feed_url = '',
) {
  const requested_match_keys = build_subscription_url_match_keys(feed_url);

  if (requested_match_keys.size === 0) {
    return null;
  }

  return (Array.isArray(subscriptions) ? subscriptions : []).find(
    (subscription) => {
      const subscription_match_keys = build_subscription_match_keys(
        subscription,
      );

      if (subscription_match_keys.size === 0) {
        return false;
      }

      return [...requested_match_keys].some((match_key) => {
        return subscription_match_keys.has(match_key);
      });
    },
  ) || null;
}

function resolve_subscription_request_error_message(
  error,
  fallback_message = 'We could not complete that request.',
) {
  const status = Number(error?.status);
  const normalized_error_text = resolve_subscription_error_text(error);

  if (is_duplicate_subscription_error(status, normalized_error_text)) {
    return 'That feed is already in your subscriptions.';
  }

  if (status === 401 || status === 403) {
    return 'Your Micro.blog session expired. Please sign in again.';
  }

  if (status === 404) {
    return 'We could not find a feed at that URL.';
  }

  return fallback_message;
}

function resolve_subscription_error_text(error = null) {
  const response_text = normalize_string(error?.response_text);

  if (!response_text) {
    return '';
  }

  const parsed_response = parse_json_string(response_text);

  if (parsed_response == null) {
    return response_text.toLowerCase();
  }

  return collect_error_strings(parsed_response).join(' ').toLowerCase();
}

function is_duplicate_subscription_error(status = 0, normalized_error_text = '') {
  if (status === 409) {
    return true;
  }

  if (!normalized_error_text) {
    return false;
  }

  return [
    'already in your subscriptions',
    'already subscribed',
    'already exists',
    'has already been taken',
    'duplicate',
  ].some((pattern) => {
    return normalized_error_text.includes(pattern);
  });
}

function parse_json_string(value = '') {
  const normalized_value = normalize_string(value);

  if (!normalized_value) {
    return null;
  }

  try {
    return JSON.parse(normalized_value);
  } catch (error) {
    return null;
  }
}

function collect_error_strings(value) {
  if (typeof value === 'string') {
    const normalized_value = normalize_string(value);

    if (!normalized_value) {
      return [];
    }

    return [normalized_value];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => {
      return collect_error_strings(entry);
    });
  }

  if (!value || typeof value !== 'object') {
    return [];
  }

  return Object.values(value).flatMap((entry) => {
    return collect_error_strings(entry);
  });
}

function build_subscription_match_keys(subscription = null) {
  const match_keys = new Set();

  build_subscription_url_match_keys(subscription?.site_url).forEach(
    (match_key) => {
      match_keys.add(match_key);
    },
  );
  build_subscription_url_match_keys(subscription?.feed_url).forEach(
    (match_key) => {
      match_keys.add(match_key);
    },
  );

  return match_keys;
}

function build_subscription_url_match_keys(raw_url = '') {
  const normalized_raw_url = normalize_string(raw_url);

  if (!normalized_raw_url) {
    return new Set();
  }

  const match_keys = new Set([
    normalize_subscription_match_key(normalized_raw_url),
  ]);
  const comparable_url = parse_comparable_subscription_url(normalized_raw_url);

  if (!comparable_url) {
    return match_keys;
  }

  match_keys.add(
    normalize_subscription_match_key(
      `${comparable_url.hostname}${comparable_url.pathname}`,
    ),
  );

  if (comparable_url.pathname === '/') {
    match_keys.add(
      normalize_subscription_match_key(comparable_url.hostname),
    );
  }

  return new Set([...match_keys].filter(Boolean));
}

function parse_comparable_subscription_url(raw_url = '') {
  const normalized_raw_url = normalize_string(raw_url);

  if (!normalized_raw_url) {
    return null;
  }

  const parse_url = (url) => {
    const parsed_url = new URL(url);
    const normalized_pathname =
      parsed_url.pathname.replace(/\/+$/g, '') || '/';

    return {
      hostname: parsed_url.hostname.toLowerCase(),
      pathname: normalized_pathname,
    };
  };

  try {
    return parse_url(normalized_raw_url);
  } catch (error) {
    try {
      return parse_url(`https://${normalized_raw_url}`);
    } catch (fallback_error) {
      return null;
    }
  }
}

function normalize_subscription_match_key(value = '') {
  const normalized_value = normalize_string(value)
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/g, '');

  return normalized_value.toLowerCase();
}
