import { flow, getSnapshot, types } from 'mobx-state-tree';

import {
  fetch_micro_blog_feed_entries,
  fetch_micro_blog_feed_icons,
  fetch_micro_blog_feed_subscriptions,
  fetch_micro_blog_feed_unread_entry_ids,
  mark_micro_blog_feed_entries_read,
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
  age_bucket: types.optional(types.string, 'day-7'),
});

const SEGMENT_BUCKETS = {
  today: ['day-1'],
  recent: ['day-2', 'day-3'],
  fading: ['day-4', 'day-5', 'day-6', 'day-7'],
};

const Feed = types
  .model('Feed', {
    active_segment: types.optional(types.string, 'today'),
    subscriptions: types.optional(types.array(FeedSubscription), []),
    timeline_entries: types.optional(types.array(TimelineEntry), []),
    is_bootstrapping: types.optional(types.boolean, false),
    has_bootstrapped: types.optional(types.boolean, false),
    error_message: types.maybeNull(types.string),
  })
  .volatile(() => ({
    local_read_entry_ids: new Set(),
    pending_read_sync_entry_ids: new Set(),
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
      self.pending_read_sync_entry_ids.clear();
    },

    reset() {
      self.active_segment = 'today';
      self.is_bootstrapping = false;
      self.has_bootstrapped = false;
      self.error_message = null;
      self.clear_local_read_state();
      self.clear_feed_data();
    },

    set_active_segment(segment = 'today') {
      const next_segment = normalize_segment(segment);
      self.active_segment = next_segment;
    },

    apply_bootstrap_payload(
      subscriptions = [],
      unread_entry_ids = [],
      entries = [],
      icons = [],
    ) {
      const unread_ids = Array.isArray(unread_entry_ids)
        ? unread_entry_ids
        : [];
      const normalized_subscriptions = normalize_subscriptions(
        subscriptions,
        icons,
      );
      const normalized_entries = normalize_timeline_entries(
        entries,
        normalized_subscriptions,
        unread_ids,
        self.local_read_entry_ids,
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
          entries_result,
          icons_result,
        ] = yield Promise.allSettled([
          fetch_micro_blog_feed_subscriptions({ token: user_token }),
          fetch_micro_blog_feed_unread_entry_ids({ token: user_token }),
          fetch_micro_blog_feed_entries({ token: user_token }),
          fetch_micro_blog_feed_icons({ token: user_token }),
        ]);

        if (subscriptions_result.status !== 'fulfilled') {
          throw subscriptions_result.reason;
        }

        if (unread_entry_ids_result.status !== 'fulfilled') {
          throw unread_entry_ids_result.reason;
        }

        if (entries_result.status !== 'fulfilled') {
          throw entries_result.reason;
        }

        const subscriptions = subscriptions_result.value;
        const unread_entry_ids = unread_entry_ids_result.value;
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
          entries,
          icons,
        );
        self.retry_unsynced_local_reads(unread_entry_ids);
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

    mark_entry_read_locally(entry_id = '') {
      const normalized_entry_id = normalize_string(entry_id);

      if (!normalized_entry_id) {
        return false;
      }

      const timeline_entry = self.timeline_entries.find((entry) => {
        return entry.id === normalized_entry_id;
      });

      if (!timeline_entry || timeline_entry.is_read) {
        return false;
      }

      timeline_entry.is_read = true;
      self.local_read_entry_ids.add(normalized_entry_id);
      return true;
    },

    open_entry(entry_id = '') {
      const did_mark_read = self.mark_entry_read_locally(entry_id);

      if (!did_mark_read) {
        return;
      }

      self.sync_read_entries([entry_id]);
    },

    retry_unsynced_local_reads(unread_entry_ids = []) {
      const unread_ids = Array.isArray(unread_entry_ids)
        ? unread_entry_ids.map((entry_id) => {
            return normalize_string(entry_id);
          })
        : [];
      const unsynced_entry_ids = unread_ids.filter((entry_id) => {
        return (
          entry_id &&
          self.local_read_entry_ids.has(entry_id) &&
          !self.pending_read_sync_entry_ids.has(entry_id)
        );
      });

      if (unsynced_entry_ids.length === 0) {
        return;
      }

      self.sync_read_entries(unsynced_entry_ids);
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
  }))
  .views((self) => ({
    visible_timeline_entries() {
      const segment_buckets = SEGMENT_BUCKETS[self.active_segment];
      const timeline_entries = !segment_buckets
        ? self.timeline_entries
        : self.timeline_entries.filter((timeline_entry) => {
            return segment_buckets.includes(timeline_entry.age_bucket);
          });

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
  local_read_entry_ids = new Set(),
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
      is_read:
        local_read_entry_ids.has(normalized_id) || !unread_set.has(normalized_id),
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
