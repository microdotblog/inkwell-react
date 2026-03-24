import { flow, getSnapshot, types } from 'mobx-state-tree';

import {
  bookmark_micro_blog_feed_entries,
  create_micro_blog_bookmark,
  fetch_recap_email_settings,
  fetch_micro_blog_feed_entries,
  fetch_micro_blog_feed_icons,
  fetch_micro_blog_feed_starred_entry_ids,
  fetch_micro_blog_feed_subscriptions,
  fetch_micro_blog_feed_unread_entry_ids,
  mark_micro_blog_feed_entries_read,
  mark_micro_blog_feed_entries_unread,
  summarize_micro_blog_feed_entries,
  unbookmark_micro_blog_feed_entries,
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

const Feed = types
  .model('Feed', {
    active_segment: types.optional(types.string, 'today'),
    is_search_active: types.optional(types.boolean, false),
    search_query: types.optional(types.string, ''),
    subscriptions: types.optional(types.array(FeedSubscription), []),
    timeline_entries: types.optional(types.array(TimelineEntry), []),
    is_bootstrapping: types.optional(types.boolean, false),
    has_bootstrapped: types.optional(types.boolean, false),
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
  }))
  .actions((self) => ({
    clear_error() {
      self.error_message = null;
    },

    clear_feed_data() {
      self.subscriptions.replace([]);
      self.timeline_entries.replace([]);
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

    reset() {
      self.active_segment = 'today';
      self.is_search_active = false;
      self.search_query = '';
      self.is_bootstrapping = false;
      self.has_bootstrapped = false;
      self.error_message = null;
      self.clear_local_entry_state();
      self.clear_feed_data();
      self.clear_active_recap();
    },

    set_active_segment(segment = 'today') {
      const next_segment = normalize_segment(segment);
      self.active_segment = next_segment;
    },

    show_search() {
      self.is_search_active = true;
    },

    hide_search() {
      self.is_search_active = false;
      self.search_query = '';
    },

    set_search_query(search_query = '') {
      self.search_query = `${search_query || ''}`;
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

      const summary_entries = self.visible_timeline_entries();
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
      const normalized_subscriptions = normalize_subscriptions(
        subscriptions,
        icons,
      );
      const normalized_entries = normalize_timeline_entries(
        entries,
        normalized_subscriptions,
        unread_ids,
        starred_ids,
        self.local_read_entry_ids,
        self.local_unread_entry_ids,
        self.local_bookmarked_entry_ids,
        self.local_unbookmarked_entry_ids,
      );

      self.subscriptions.replace(normalized_subscriptions);
      self.timeline_entries.replace(normalized_entries);
      self.error_message = null;
    },

    bootstrap: flow(function* () {
      if (self.is_bootstrapping) {
        return true;
      }

      self.is_bootstrapping = true;
      self.clear_error();

      try {
        yield Tokens.hydrate();

        const user_token = Tokens.get_user_token();
        if (!user_token) {
          self.reset();
          return false;
        }

        const [
          subscriptions_result,
          unread_entry_ids_result,
          starred_entry_ids_result,
          entries_result,
          icons_result,
        ] = yield Promise.allSettled([
          fetch_micro_blog_feed_subscriptions({ token: user_token }),
          fetch_micro_blog_feed_unread_entry_ids({ token: user_token }),
          fetch_micro_blog_feed_starred_entry_ids({ token: user_token }),
          fetch_micro_blog_feed_entries({ token: user_token }),
          fetch_micro_blog_feed_icons({ token: user_token }),
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
        const entries = entries_result.value;
        const icons =
          icons_result.status === 'fulfilled' ? icons_result.value : [];

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

      const timeline_entry = self.timeline_entries.find((entry) => {
        return entry.id === normalized_entry_id;
      });

      if (!timeline_entry || timeline_entry.is_read === next_is_read) {
        return false;
      }

      timeline_entry.is_read = next_is_read;

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

      const timeline_entry = self.timeline_entries.find((entry) => {
        return entry.id === normalized_entry_id;
      });

      if (
        !timeline_entry ||
        timeline_entry.is_bookmarked === next_is_bookmarked
      ) {
        return false;
      }

      timeline_entry.is_bookmarked = next_is_bookmarked;

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
      const did_mark_read = self.mark_entry_read_locally(entry_id);

      if (!did_mark_read) {
        return false;
      }

      self.sync_read_entries([entry_id]);
      return true;
    },

    mark_entry_unread(entry_id = '') {
      const did_mark_unread = self.mark_entry_unread_locally(entry_id);

      if (!did_mark_unread) {
        return false;
      }

      self.sync_unread_entries([entry_id]);
      return true;
    },

    bookmark_entry(entry_id = '') {
      const did_bookmark_entry = self.mark_entry_bookmarked_locally(entry_id);

      if (!did_bookmark_entry) {
        return false;
      }

      self.sync_bookmarked_entries([entry_id]);
      return true;
    },

    unbookmark_entry(entry_id = '') {
      const did_unbookmark_entry =
        self.mark_entry_unbookmarked_locally(entry_id);

      if (!did_unbookmark_entry) {
        return false;
      }

      self.sync_unbookmarked_entries([entry_id]);
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

      return self.visible_timeline_entries().length > 0;
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

    visible_timeline_entries() {
      const normalized_search_query = normalize_search_query(self.search_query);
      let timeline_entries = self.timeline_entries;

      if (self.is_search_active) {
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

      if (!timeline_entry) {
        return null;
      }

      return getSnapshot(timeline_entry);
    },
  }))
  .create();

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

function normalize_timeline_entries(
  entries = [],
  subscriptions = [],
  unread_entry_ids = [],
  starred_entry_ids = [],
  local_read_entry_ids = new Set(),
  local_unread_entry_ids = new Set(),
  local_bookmarked_entry_ids = new Set(),
  local_unbookmarked_entry_ids = new Set(),
) {
  if (!Array.isArray(entries)) {
    return [];
  }

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

  const normalized_entries = entries.map((entry, index) => {
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
  if (!Array.isArray(icons)) {
    return new Map();
  }

  const icon_pairs = icons
    .map((icon) => {
      return [
        normalize_string(icon?.host).toLowerCase(),
        normalize_string(icon?.url),
      ];
    })
    .filter(([host, url]) => host && url);

  return new Map(icon_pairs);
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
    return new URL(raw_url).hostname.toLowerCase();
  } catch (error) {
    try {
      return new URL(`https://${raw_url}`).hostname.toLowerCase();
    } catch (fallback_error) {
      return '';
    }
  }
}

function resolve_published_at(entry = null) {
  const published_at = normalize_string(entry?.published);
  if (published_at) {
    return published_at;
  }

  const created_at = normalize_string(entry?.created_at);
  if (created_at) {
    return created_at;
  }

  return new Date().toISOString();
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

function normalize_unique_entry_ids(entry_ids = []) {
  if (!Array.isArray(entry_ids)) {
    return [];
  }

  return [...new Set(entry_ids.map((entry_id) => normalize_string(entry_id)).filter(Boolean))];
}
