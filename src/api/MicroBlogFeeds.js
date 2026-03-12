import { MICRO_BLOG_AUTH_URL } from './MicroBlogAuth';

const MICRO_BLOG_FEEDS_BASE_URL = new URL(MICRO_BLOG_AUTH_URL).origin;
const DAY_MS = 24 * 60 * 60 * 1000;
const TIMELINE_WINDOW_DAYS = 7;

export function get_micro_blog_feeds_base_url() {
  return MICRO_BLOG_FEEDS_BASE_URL;
}

export async function fetch_micro_blog_feed_subscriptions({ token = '' } = {}) {
  return fetch_micro_blog_feeds_json(
    '/feeds/v2/subscriptions.json?mode=extended',
    {
      token,
    },
  );
}

export async function fetch_micro_blog_feed_entries({ token = '' } = {}) {
  const trimmed_token = `${token || ''}`.trim();
  const per_page = 50;
  const entries = [];
  const oldest_timeline_midnight = get_oldest_timeline_midnight();
  let page = 1;
  let has_more = true;

  while (has_more) {
    const params = new URLSearchParams({
      per_page: String(per_page),
      page: String(page),
    });
    const page_entries = await fetch_micro_blog_feeds_json(
      `/feeds/v2/entries.json?${params.toString()}`,
      {
        token: trimmed_token,
      },
    );

    if (!Array.isArray(page_entries) || page_entries.length === 0) {
      break;
    }

    let stop_index = page_entries.length;

    for (let index = 0; index < page_entries.length; index += 1) {
      const entry = page_entries[index];
      const raw_date = `${entry?.published || entry?.created_at || ''}`.trim();

      if (!raw_date) {
        continue;
      }

      if (is_older_than_timeline_window(raw_date, oldest_timeline_midnight)) {
        stop_index = index;
        has_more = false;
        break;
      }
    }

    const page_slice = page_entries.slice(0, stop_index);
    entries.push(...page_slice);

    if (!has_more) {
      break;
    }

    page += 1;
  }

  return entries;
}

export async function fetch_micro_blog_feed_unread_entry_ids({
  token = '',
} = {}) {
  return fetch_micro_blog_feeds_json('/feeds/v2/unread_entries.json', {
    token,
  });
}

export async function fetch_micro_blog_feed_icons({ token = '' } = {}) {
  return fetch_micro_blog_feeds_json('/feeds/v2/icons.json', {
    token,
  });
}

async function fetch_micro_blog_feeds_json(
  path,
  { token = '', headers: custom_headers, ...options } = {},
) {
  const trimmed_token = `${token || ''}`.trim();

  if (!trimmed_token) {
    throw create_request_error('A Micro.blog token is required to load feeds.');
  }

  const url = new URL(path, `${MICRO_BLOG_FEEDS_BASE_URL}/`);
  const headers = new Headers(custom_headers || {});
  headers.set('Accept', 'application/json');
  headers.set('Authorization', `Bearer ${trimmed_token}`);

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const response_text = await response.text();
    throw create_request_error(
      'Feeds request failed.',
      response.status,
      response_text,
    );
  }

  return response.json();
}

function get_oldest_timeline_midnight() {
  const now = new Date();
  const today_midnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  return today_midnight.getTime() - (TIMELINE_WINDOW_DAYS - 1) * DAY_MS;
}

function get_local_midnight_time(raw_date = '') {
  const trimmed_date = `${raw_date || ''}`.trim();
  if (!trimmed_date) {
    return null;
  }

  const entry_date = new Date(trimmed_date);
  if (Number.isNaN(entry_date.getTime())) {
    return null;
  }

  const entry_midnight = new Date(
    entry_date.getFullYear(),
    entry_date.getMonth(),
    entry_date.getDate(),
  );

  return entry_midnight.getTime();
}

function is_older_than_timeline_window(raw_date, oldest_timeline_midnight) {
  const entry_midnight = get_local_midnight_time(raw_date);
  if (entry_midnight == null) {
    return false;
  }

  return entry_midnight < oldest_timeline_midnight;
}

function create_request_error(message, status = null, response_text = '') {
  const error = new Error(message);
  error.status = status;
  error.response_text = response_text;
  return error;
}
