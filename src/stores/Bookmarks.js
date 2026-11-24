import { flow, getSnapshot, types } from 'mobx-state-tree';

import {
  delete_micro_blog_bookmark,
  fetch_micro_blog_bookmarks,
} from '../api/MicroBlogFeeds';
import Tokens from './Tokens';

const OLDER_BOOKMARK_PAGES = 3;

const BookmarkEntry = types.model('BookmarkEntry', {
  id: types.optional(types.string, ''),
  bookmark_id: types.optional(types.string, ''),
  feed_id: types.optional(types.string, ''),
  source: types.optional(types.string, ''),
  source_url: types.optional(types.string, ''),
  avatar_url: types.optional(types.string, ''),
  title: types.optional(types.string, ''),
  summary: types.optional(types.string, ''),
  content: types.optional(types.string, ''),
  url: types.optional(types.string, ''),
  published_at: types.optional(types.string, ''),
});

const Bookmarks = types
  .model('Bookmarks', {
    items: types.optional(types.array(BookmarkEntry), []),
    is_loading: types.optional(types.boolean, false),
    has_loaded: types.optional(types.boolean, false),
    error_message: types.maybeNull(types.string),
  })
  .volatile(() => ({
    is_prefetching: false,
    next_before_id: '',
    older_pages_remaining: 0,
    request_token: 0,
  }))
  .actions((self) => ({
    reset() {
      self.request_token += 1;
      self.items.replace([]);
      self.is_loading = false;
      self.has_loaded = false;
      self.error_message = null;
      self.is_prefetching = false;
      self.next_before_id = '';
      self.older_pages_remaining = 0;
    },

    apply_items(items = []) {
      self.items.replace(normalize_bookmark_entries(items));
      self.has_loaded = true;
      self.error_message = null;
    },

    remove_bookmark_entry_locally(entry_id = '') {
      const normalized_entry_id = normalize_string(entry_id);

      if (!normalized_entry_id) {
        return false;
      }

      const bookmark_index = self.items.findIndex((item) => {
        return item.id === normalized_entry_id;
      });

      if (bookmark_index < 0) {
        return false;
      }

      self.items.splice(bookmark_index, 1);
      return true;
    },

    load: flow(function* () {
      if (self.is_loading || self.is_prefetching) {
        return false;
      }

      if (self.has_loaded && (!self.error_message || self.items.length > 0)) {
        return true;
      }

      return yield self.fetch_bookmarks();
    }),

    refresh: flow(function* () {
      return yield self.fetch_bookmarks();
    }),

    retry: flow(function* () {
      const resume = Boolean(self.next_before_id && self.older_pages_remaining > 0);
      return yield self.fetch_bookmarks({ resume });
    }),

    fetch_bookmarks: flow(function* ({ resume = false } = {}) {
      if (self.is_loading || (resume && self.is_prefetching)) {
        return false;
      }

      self.is_loading = !resume;
      self.is_prefetching = resume;
      self.error_message = null;
      if (!resume) {
        self.next_before_id = '';
        self.older_pages_remaining = 0;
      }
      self.request_token += 1;
      const request_token = self.request_token;

      try {
        yield Tokens.hydrate();

        if (self.request_token !== request_token) {
          return false;
        }

        const user_token = Tokens.get_user_token();

        if (!user_token) {
          self.reset();
          return false;
        }

        if (!resume) {
          const payload = yield fetch_micro_blog_bookmarks({ token: user_token });
          if (self.request_token !== request_token) {
            return false;
          }

          self.apply_items(payload.items);
          self.next_before_id = payload.next_before_id;
          self.older_pages_remaining = OLDER_BOOKMARK_PAGES;
          self.is_loading = false;
        }

        self.is_prefetching = Boolean(self.next_before_id);
        while (self.next_before_id && self.older_pages_remaining > 0) {
          const before_id = self.next_before_id;
          const payload = yield fetch_micro_blog_bookmarks({ token: user_token, before_id });
          if (self.request_token !== request_token) {
            return false;
          }

          const seen_ids = new Set(self.items.map((item) => item.id));
          const older_items = normalize_bookmark_entries(payload.items).filter((item) => {
            return !seen_ids.has(item.id);
          });
          self.items.push(...older_items);
          self.older_pages_remaining -= 1;
          self.next_before_id = older_items.length && payload.next_before_id !== before_id
            ? payload.next_before_id
            : '';
        }

        return true;
      } catch (error) {
        if (self.request_token === request_token) {
          self.has_loaded = true;
          if (error?.status === 401 || error?.status === 403) {
            self.error_message = 'Your Micro.blog session expired. Please sign in again.';
          } else if (error?.name === 'TimeoutError') {
            self.error_message = 'Micro.blog took too long to respond.';
          } else if (self.is_prefetching) {
            self.error_message = 'We could not load older bookmarks. Please try again.';
          } else {
            self.error_message = 'We could not load your bookmarks. Please try again.';
          }
        }

        return false;
      } finally {
        if (self.request_token === request_token) {
          self.is_loading = false;
          self.is_prefetching = false;
        }
      }
    }),

    delete_bookmark: flow(function* (entry_id = '') {
      const normalized_entry_id = normalize_string(entry_id);

      if (!normalized_entry_id) {
        return false;
      }

      const bookmark_entry = self.items.find((item) => {
        return item.id === normalized_entry_id;
      });
      const bookmark_id = normalize_string(
        bookmark_entry?.bookmark_id || bookmark_entry?.id,
      );

      if (!bookmark_id) {
        return false;
      }

      try {
        yield Tokens.hydrate();

        const user_token = Tokens.get_user_token();

        if (!user_token) {
          return false;
        }

        yield delete_micro_blog_bookmark({
          token: user_token,
          bookmark_id,
        });

        self.remove_bookmark_entry_locally(normalized_entry_id);
        return true;
      } catch (error) {
        return false;
      }
    }),
  }))
  .views((self) => ({
    get did_fail_older_page() {
      return Boolean(self.error_message && self.next_before_id);
    },

    bookmark_entries() {
      return self.items.map((item) => {
        return getSnapshot(item);
      });
    },

    bookmark_entry_snapshot(entry_id = '') {
      const normalized_entry_id = normalize_string(entry_id);

      if (!normalized_entry_id) {
        return null;
      }

      const bookmark_entry = self.items.find((item) => {
        return item.id === normalized_entry_id;
      });

      if (!bookmark_entry) {
        return null;
      }

      return getSnapshot(bookmark_entry);
    },
  }))
  .create();

export default Bookmarks;

function normalize_bookmark_entries(items = []) {
  if (!Array.isArray(items)) {
    return [];
  }

  const normalized_entries = items.map((item, index) => {
    const author = resolve_bookmark_author(item);
    const source = normalize_string(author?.name) || 'Bookmarked';
    const summary = normalize_string(item?.summary);
    const title =
      normalize_string(item?.title) ||
      summary ||
      source ||
      'Untitled';
    const published_at = resolve_bookmark_published_at(item);
    const bookmark_id = normalize_string(item?.id);

    return {
      id:
        bookmark_id ||
        normalize_string(item?.url) ||
        `bookmark-${index + 1}-${published_at}`,
      bookmark_id,
      feed_id: '',
      source,
      source_url: normalize_web_url(author?.url),
      avatar_url: normalize_string(author?.avatar),
      title,
      summary,
      content: resolve_bookmark_content(item, summary),
      url: normalize_string(item?.url),
      published_at,
    };
  });

  normalized_entries.sort(compare_bookmark_entries_by_published_at);

  return normalized_entries;
}

function resolve_bookmark_author(item = null) {
  if (item?.author && typeof item.author === 'object') {
    return item.author;
  }

  const authors = Array.isArray(item?.authors) ? item.authors : [];

  return authors.find((entry) => {
    return entry && typeof entry === 'object';
  }) || null;
}

function resolve_bookmark_published_at(item = null) {
  return (
    normalize_string(item?.date_published) ||
    normalize_string(item?.date_modified) ||
    new Date().toISOString()
  );
}

function resolve_bookmark_content(item = null, summary = '') {
  const content_html = normalize_string(item?.content_html);

  if (content_html) {
    return content_html;
  }

  if (summary) {
    return `<p>${escape_html(summary)}</p>`;
  }

  return '';
}

function compare_bookmark_entries_by_published_at(left_entry, right_entry) {
  const left_timestamp = resolve_timestamp(left_entry?.published_at);
  const right_timestamp = resolve_timestamp(right_entry?.published_at);

  return right_timestamp - left_timestamp;
}

function resolve_timestamp(raw_date = '') {
  const timestamp = new Date(raw_date).getTime();

  if (Number.isNaN(timestamp)) {
    return 0;
  } else {
    return timestamp;
  }
}

function normalize_web_url(raw_url = '') {
  const trimmed_url = normalize_string(raw_url);

  if (!trimmed_url) {
    return '';
  }

  try {
    return new URL(trimmed_url).toString();
  } catch (error) {
    try {
      return new URL(`https://${trimmed_url}`).toString();
    } catch (fallback_error) {
      return '';
    }
  }
}

function normalize_string(value = '') {
  return `${value || ''}`.trim();
}

function escape_html(value = '') {
  return `${value || ''}`
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
