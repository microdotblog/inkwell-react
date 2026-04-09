import { flow, getSnapshot, types } from 'mobx-state-tree';

import {
  create_micro_blog_highlight,
  delete_micro_blog_highlight,
  fetch_micro_blog_highlights,
} from '../api/MicroBlogFeeds';
import Tokens from './Tokens';

const HighlightEntry = types.model('HighlightEntry', {
  id: types.optional(types.string, ''),
  highlight_id: types.optional(types.string, ''),
  post_id: types.optional(types.string, ''),
  post_url: types.optional(types.string, ''),
  post_title: types.optional(types.string, ''),
  post_source: types.optional(types.string, ''),
  post_has_title: types.optional(types.boolean, false),
  text: types.optional(types.string, ''),
  created_at: types.optional(types.string, ''),
  post_published_at: types.optional(types.string, ''),
  start_offset: types.maybeNull(types.number),
  end_offset: types.maybeNull(types.number),
});

const Highlights = types
  .model('Highlights', {
    items: types.optional(types.array(HighlightEntry), []),
    is_loading: types.optional(types.boolean, false),
    has_loaded: types.optional(types.boolean, false),
    error_message: types.maybeNull(types.string),
    search_query: types.optional(types.string, ''),
  })
  .volatile(() => ({
    request_token: 0,
  }))
  .actions((self) => ({
    reset() {
      self.request_token += 1;
      self.items.replace([]);
      self.is_loading = false;
      self.has_loaded = false;
      self.error_message = null;
      self.search_query = '';
    },

    apply_items(items = []) {
      self.items.replace(normalize_highlight_entries(items));
      self.has_loaded = true;
      self.error_message = null;
    },

    insert_highlight_entry_locally(item = null) {
      const normalized_item = normalize_local_highlight_entry(item);

      if (!normalized_item) {
        return false;
      }

      const next_items = self.items.map((entry) => {
        return getSnapshot(entry);
      });

      next_items.push(normalized_item);
      next_items.sort(compare_highlight_entries_by_created_at);

      self.items.replace(next_items);
      self.has_loaded = true;
      self.error_message = null;
      return true;
    },

    remove_highlight_entry_locally(highlight_id = '') {
      const normalized_highlight_id = normalize_string(highlight_id);

      if (!normalized_highlight_id) {
        return false;
      }

      const remaining_items = self.items.filter((item) => {
        return item.id !== normalized_highlight_id;
      });

      if (remaining_items.length === self.items.length) {
        return false;
      }

      self.items.replace(remaining_items);
      return true;
    },

    assign_remote_highlight_id(highlight_id = '', remote_highlight_id = '') {
      const normalized_highlight_id = normalize_string(highlight_id);
      const normalized_remote_highlight_id = normalize_string(remote_highlight_id);

      if (!normalized_highlight_id || !normalized_remote_highlight_id) {
        return false;
      }

      const highlight_entry = self.items.find((item) => {
        return item.id === normalized_highlight_id;
      });

      if (!highlight_entry) {
        return false;
      }

      highlight_entry.highlight_id = normalized_remote_highlight_id;
      return true;
    },

    set_search_query(search_query = '') {
      self.search_query = `${search_query || ''}`;
    },

    load: flow(function* () {
      if (self.is_loading) {
        return false;
      }

      if (self.has_loaded && !self.error_message) {
        return true;
      }

      return yield self.fetch_highlights();
    }),

    refresh: flow(function* () {
      return yield self.fetch_highlights();
    }),

    create_highlight: flow(function* ({
      end_offset = null,
      post_has_title = false,
      post_id = '',
      post_published_at = '',
      post_source = '',
      post_title = '',
      post_url = '',
      start_offset = null,
      text = '',
    } = {}) {
      const normalized_post_id = normalize_string(post_id);
      const normalized_text = normalize_string(text);

      if (!normalized_post_id || !normalized_text) {
        return {
          error_message: 'We could not save that highlight.',
          ok: false,
        };
      }

      const local_highlight_id = `hl-${Date.now()}`;
      const created_at = new Date().toISOString();
      const local_highlight = {
        id: local_highlight_id,
        highlight_id: '',
        post_id: normalized_post_id,
        post_url: normalize_web_url(post_url),
        post_title: normalize_string(post_title),
        post_source: normalize_string(post_source),
        post_has_title: post_has_title === true,
        text: normalized_text,
        created_at,
        post_published_at: normalize_string(post_published_at) || created_at,
        start_offset: parse_highlight_offset(start_offset),
        end_offset: parse_highlight_offset(end_offset),
      };

      if (
        local_highlight.start_offset != null &&
        local_highlight.end_offset != null &&
        local_highlight.end_offset <= local_highlight.start_offset
      ) {
        local_highlight.end_offset = null;
        local_highlight.start_offset = null;
      }

      const did_insert_local_highlight =
        self.insert_highlight_entry_locally(local_highlight);

      if (!did_insert_local_highlight) {
        return {
          error_message: 'We could not save that highlight.',
          ok: false,
        };
      }

      try {
        yield Tokens.hydrate();

        const user_token = Tokens.get_user_token();

        if (!user_token) {
          self.remove_highlight_entry_locally(local_highlight_id);
          return {
            error_message: 'Your Micro.blog session expired. Please sign in again.',
            ok: false,
          };
        }

        const payload = yield create_micro_blog_highlight({
          token: user_token,
          post_id: normalized_post_id,
          text,
          start_offset: local_highlight.start_offset,
          end_offset: local_highlight.end_offset,
        });
        const remote_highlight_id = normalize_string(payload?.id);

        if (!remote_highlight_id) {
          self.remove_highlight_entry_locally(local_highlight_id);
          return {
            error_message: 'We could not save that highlight.',
            ok: false,
          };
        }

        self.assign_remote_highlight_id(local_highlight_id, remote_highlight_id);

        return {
          ok: true,
        };
      } catch (error) {
        self.remove_highlight_entry_locally(local_highlight_id);

        return {
          error_message:
            error?.status === 401 || error?.status === 403
              ? 'Your Micro.blog session expired. Please sign in again.'
              : 'We could not save that highlight.',
          ok: false,
        };
      }
    }),

    delete_highlight: flow(function* (highlight_id = '') {
      const normalized_highlight_id = normalize_string(highlight_id);

      if (!normalized_highlight_id) {
        return {
          error_message: 'We could not delete that highlight.',
          ok: false,
        };
      }

      const highlight_entry = self.items.find((item) => {
        return item.id === normalized_highlight_id;
      });
      const post_id = normalize_string(highlight_entry?.post_id);
      const remote_highlight_id = normalize_string(
        highlight_entry?.highlight_id,
      );

      if (!highlight_entry || !post_id || !remote_highlight_id) {
        return {
          error_message: 'We could not delete that highlight.',
          ok: false,
        };
      }

      try {
        yield Tokens.hydrate();

        const user_token = Tokens.get_user_token();

        if (!user_token) {
          return {
            error_message: 'Your Micro.blog session expired. Please sign in again.',
            ok: false,
          };
        }

        yield delete_micro_blog_highlight({
          token: user_token,
          post_id,
          highlight_id: remote_highlight_id,
        });

        self.remove_highlight_entry_locally(normalized_highlight_id);

        return {
          ok: true,
        };
      } catch (error) {
        return {
          error_message:
            error?.status === 401 || error?.status === 403
              ? 'Your Micro.blog session expired. Please sign in again.'
              : 'We could not delete that highlight.',
          ok: false,
        };
      }
    }),

    fetch_highlights: flow(function* () {
      if (self.is_loading) {
        return false;
      }

      self.is_loading = true;
      self.error_message = null;
      self.request_token += 1;
      const request_token = self.request_token;

      try {
        yield Tokens.hydrate();

        const user_token = Tokens.get_user_token();

        if (!user_token) {
          self.reset();
          return false;
        }

        const payload = yield fetch_micro_blog_highlights({
          token: user_token,
        });

        if (self.request_token !== request_token) {
          return false;
        }

        const items = Array.isArray(payload?.items) ? payload.items : payload;
        self.apply_items(items);
        return true;
      } catch (error) {
        if (self.request_token === request_token) {
          self.has_loaded = true;
          self.error_message =
            error?.status === 401 || error?.status === 403
              ? 'Your Micro.blog session expired. Please sign in again.'
              : 'We could not load your highlights. Please try again.';
        }

        return false;
      } finally {
        if (self.request_token === request_token) {
          self.is_loading = false;
        }
      }
    }),
  }))
  .views((self) => ({
    highlight_entries() {
      const normalized_query = normalize_search_query(self.search_query);
      const visible_items = normalized_query
        ? self.items.filter((item) => {
            return matches_highlight_query(item, normalized_query);
          })
        : self.items;

      return visible_items.map((item) => {
        return getSnapshot(item);
      });
    },

    entry_highlight_entries(post_id = '') {
      const normalized_post_id = normalize_string(post_id);

      if (!normalized_post_id) {
        return [];
      }

      return self.items
        .filter((item) => {
          return normalize_string(item?.post_id) === normalized_post_id;
        })
        .map((item) => {
          return getSnapshot(item);
        });
    },

    entry_highlight_ranges(post_id = '') {
      return self.entry_highlight_entries(post_id)
        .map((highlight) => {
          return resolve_highlight_range(highlight);
        })
        .filter(Boolean);
    },

    entry_highlight_snapshot_by_identifier(post_id = '', identifier = '') {
      const normalized_post_id = normalize_string(post_id);
      const normalized_identifier = normalize_string(identifier);

      if (!normalized_post_id || !normalized_identifier) {
        return null;
      }

      const highlight = self.items.find((item) => {
        return (
          normalize_string(item?.post_id) === normalized_post_id &&
          highlight_matches_identifier(item, normalized_identifier)
        );
      });

      if (!highlight) {
        return null;
      }

      return getSnapshot(highlight);
    },

    highlights_count() {
      return self.items.length;
    },

    has_search_query() {
      return normalize_search_query(self.search_query).length > 0;
    },
  }))
  .create();

export default Highlights;

export function resolve_highlight_post_label(highlight = null) {
  const post_title = normalize_string(highlight?.post_title);
  const post_source = normalize_string(highlight?.post_source);
  const has_valid_title =
    highlight?.post_has_title === true &&
    Boolean(post_title) &&
    post_title.toLowerCase() !== 'untitled';

  if (has_valid_title) {
    return post_title;
  } else if (post_source) {
    return post_source;
  } else {
    return 'Post';
  }
}

function normalize_highlight_entries(items = []) {
  if (!Array.isArray(items)) {
    return [];
  }

  const normalized_entries = items
    .map((item) => {
      return normalize_highlight_entry(item);
    })
    .filter(Boolean);

  normalized_entries.sort(compare_highlight_entries_by_created_at);

  return normalized_entries;
}

function normalize_highlight_entry(item = null) {
  if (!item || typeof item !== 'object') {
    return null;
  }

  const microblog_data =
    item?._microblog && typeof item._microblog === 'object'
      ? item._microblog
      : {};
  const post_id =
    microblog_data?.entry_id == null
      ? ''
      : normalize_string(microblog_data.entry_id);
  const text = normalize_string(item?.content_text);

  if (!post_id || !text) {
    return null;
  }

  const post_title = normalize_string(item?.title);
  const start_offset = parse_highlight_offset(microblog_data?.selection_start);
  const end_offset = parse_highlight_offset(microblog_data?.selection_end);
  const created_at =
    normalize_string(item?.date_published) ||
    normalize_string(item?.date_modified);
  const remote_highlight_id =
    item?.id == null ? '' : normalize_string(item.id);
  const fallback_id = `mb-${post_id}-${start_offset ?? 'x'}-${end_offset ?? 'x'}-${created_at || 'unknown'}`;

  return {
    id: remote_highlight_id || fallback_id,
    highlight_id: remote_highlight_id,
    post_id,
    post_url: normalize_web_url(item?.url),
    post_title,
    post_source: resolve_highlight_source(item, microblog_data),
    post_published_at: created_at,
    post_has_title:
      Boolean(post_title) && post_title.toLowerCase() !== 'untitled',
    text,
    created_at,
    start_offset,
    end_offset,
  };
}

function normalize_local_highlight_entry(item = null) {
  if (!item || typeof item !== 'object') {
    return null;
  }

  const id = normalize_string(item?.id);
  const post_id = normalize_string(item?.post_id);
  const text = normalize_string(item?.text);

  if (!id || !post_id || !text) {
    return null;
  }

  const start_offset = parse_highlight_offset(item?.start_offset);
  const end_offset = parse_highlight_offset(item?.end_offset);
  const created_at = normalize_string(item?.created_at) || new Date().toISOString();
  const post_title = normalize_string(item?.post_title);

  return {
    id,
    highlight_id: normalize_string(item?.highlight_id),
    post_id,
    post_url: normalize_web_url(item?.post_url),
    post_title,
    post_source: normalize_string(item?.post_source),
    post_published_at: normalize_string(item?.post_published_at) || created_at,
    post_has_title:
      item?.post_has_title === true &&
      Boolean(post_title) &&
      post_title.toLowerCase() !== 'untitled',
    text,
    created_at,
    start_offset,
    end_offset,
  };
}

function resolve_highlight_source(item = null, microblog_data = {}) {
  const author = resolve_highlight_author(item);

  return (
    normalize_string(author?.name) ||
    normalize_string(microblog_data?.site_name) ||
    normalize_string(microblog_data?.feed_title) ||
    ''
  );
}

function resolve_highlight_author(item = null) {
  if (item?.author && typeof item.author === 'object') {
    return item.author;
  }

  const authors = Array.isArray(item?.authors) ? item.authors : [];

  return (
    authors.find((entry) => {
      return entry && typeof entry === 'object';
    }) || null
  );
}

function parse_highlight_offset(raw_value = null) {
  const numeric_value = Number(raw_value);

  if (!Number.isFinite(numeric_value)) {
    return null;
  }

  return Math.max(0, Math.floor(numeric_value));
}

function compare_highlight_entries_by_created_at(left_entry, right_entry) {
  const left_timestamp = resolve_highlight_sort_timestamp(left_entry);
  const right_timestamp = resolve_highlight_sort_timestamp(right_entry);

  return right_timestamp - left_timestamp;
}

function resolve_highlight_sort_timestamp(highlight = null) {
  const created_at = resolve_timestamp(highlight?.created_at);

  if (created_at > 0) {
    return created_at;
  }

  const published_at = resolve_timestamp(highlight?.post_published_at);

  if (published_at > 0) {
    return published_at;
  }

  const local_id = typeof highlight?.id === 'string' ? highlight.id : '';
  const local_match = local_id.match(/^hl-(\d+)$/);

  if (!local_match) {
    return 0;
  }

  const timestamp = Number(local_match[1]);

  if (!Number.isFinite(timestamp)) {
    return 0;
  }

  return timestamp;
}

function resolve_timestamp(raw_date = '') {
  const timestamp = new Date(raw_date).getTime();

  if (Number.isNaN(timestamp)) {
    return 0;
  } else {
    return timestamp;
  }
}

function matches_highlight_query(highlight = null, query = '') {
  if (!highlight) {
    return false;
  }

  const search_query = normalize_search_query(query);

  if (!search_query) {
    return true;
  }

  const text = normalize_search_target(highlight?.text);
  const post_label = normalize_search_target(resolve_highlight_post_label(highlight));
  const post_source = normalize_search_target(highlight?.post_source);
  const post_url = normalize_search_target(highlight?.post_url);

  return (
    text.includes(search_query) ||
    post_label.includes(search_query) ||
    post_source.includes(search_query) ||
    post_url.includes(search_query)
  );
}

function resolve_highlight_range(highlight = null) {
  const start_offset = parse_highlight_offset(highlight?.start_offset);
  const end_offset = parse_highlight_offset(highlight?.end_offset);

  if (start_offset == null || end_offset == null || end_offset <= start_offset) {
    return null;
  }

  return {
    end_offset,
    highlight_id: resolve_highlight_identifier(highlight),
    start_offset,
  };
}

function resolve_highlight_identifier(highlight = null) {
  return normalize_string(highlight?.highlight_id || highlight?.id);
}

function highlight_matches_identifier(highlight = null, identifier = '') {
  const normalized_identifier = normalize_string(identifier);

  if (!normalized_identifier) {
    return false;
  }

  return (
    normalize_string(highlight?.id) === normalized_identifier ||
    normalize_string(highlight?.highlight_id) === normalized_identifier
  );
}

function normalize_search_query(value = '') {
  return normalize_search_target(value);
}

function normalize_search_target(value = '') {
  return `${value || ''}`.trim().toLowerCase();
}

function normalize_web_url(raw_url = '') {
  const trimmed_url = normalize_string(raw_url);

  if (!trimmed_url) {
    return '';
  }

  try {
    return new URL(trimmed_url).toString();
  } catch {
    try {
      return new URL(`https://${trimmed_url}`).toString();
    } catch {
      return '';
    }
  }
}

function normalize_string(value = '') {
  return `${value || ''}`.trim();
}
