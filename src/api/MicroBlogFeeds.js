import { MICRO_BLOG_AUTH_URL } from './MicroBlogAuth';

const MICRO_BLOG_FEEDS_BASE_URL = new URL(MICRO_BLOG_AUTH_URL).origin;
const DAY_MS = 24 * 60 * 60 * 1000;
const RECAP_POLL_DELAY_MS = 5000;
const RECAP_POLL_MAX_ATTEMPTS = 25;
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

export async function create_micro_blog_feed_subscription({
  token = '',
  feed_url = '',
} = {}) {
  const trimmed_token = `${token || ''}`.trim();
  const trimmed_feed_url = `${feed_url || ''}`.trim();

  if (!trimmed_token) {
    throw create_request_error(
      'A Micro.blog token is required to create subscriptions.',
    );
  }

  if (!trimmed_feed_url) {
    throw create_request_error('A feed URL is required to subscribe.');
  }

  const url = new URL('/feeds/v2/subscriptions.json', `${MICRO_BLOG_FEEDS_BASE_URL}/`);
  const headers = new Headers({
    'Content-Type': 'application/json',
    Accept: 'application/json',
    Authorization: `Bearer ${trimmed_token}`,
  });
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      feed_url: trimmed_feed_url,
    }),
  });
  const response_text = await response.text();

  if (response.status === 300) {
    return {
      kind: 'choices',
      choices: parse_json_response_text(
        response_text,
        response.status,
        'Feeds response parsing failed.',
      ),
    };
  }

  if (!response.ok) {
    throw create_request_error(
      'Feeds subscription create request failed.',
      response.status,
      response_text,
    );
  }

  return {
    kind: 'subscription',
    subscription: parse_json_response_text(
      response_text,
      response.status,
      'Feeds response parsing failed.',
    ),
  };
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

export async function fetch_micro_blog_feed_entries_for_feed({
  token = '',
  feed_id = '',
} = {}) {
  const trimmed_token = `${token || ''}`.trim();
  const trimmed_feed_id = `${feed_id || ''}`.trim();
  const per_page = 100;
  const entries = [];
  let page = 1;

  if (!trimmed_feed_id) {
    return [];
  }

  while (true) {
    const params = new URLSearchParams({
      per_page: String(per_page),
      page: String(page),
    });
    const encoded_feed_id = encodeURIComponent(trimmed_feed_id);
    const page_entries = await fetch_micro_blog_feeds_json(
      `/feeds/v2/feeds/${encoded_feed_id}/entries.json?${params.toString()}`,
      {
        token: trimmed_token,
      },
    );

    if (!Array.isArray(page_entries) || page_entries.length === 0) {
      break;
    }

    entries.push(...page_entries);

    if (page_entries.length < per_page) {
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

export async function fetch_micro_blog_feed_starred_entry_ids({
  token = '',
} = {}) {
  return fetch_micro_blog_feeds_json('/feeds/v2/starred_entries.json', {
    token,
  });
}

export async function fetch_micro_blog_feed_icons({ token = '' } = {}) {
  return fetch_micro_blog_feeds_json('/feeds/v2/icons.json', {
    token,
  });
}

export async function update_micro_blog_feed_subscription({
  token = '',
  subscription_id = '',
  title = '',
} = {}) {
  const trimmed_subscription_id = `${subscription_id || ''}`.trim();
  const trimmed_title = `${title || ''}`.trim();

  if (!trimmed_subscription_id) {
    throw create_request_error(
      'A subscription id is required to rename a subscription.',
    );
  }

  return fetch_micro_blog_feeds_json(
    `/feeds/v2/subscriptions/${encodeURIComponent(trimmed_subscription_id)}.json`,
    {
      token,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: trimmed_title,
      }),
    },
  );
}

export async function delete_micro_blog_feed_subscription({
  token = '',
  subscription_id = '',
} = {}) {
  const trimmed_token = `${token || ''}`.trim();
  const trimmed_subscription_id = `${subscription_id || ''}`.trim();

  if (!trimmed_token) {
    throw create_request_error(
      'A Micro.blog token is required to delete subscriptions.',
    );
  }

  if (!trimmed_subscription_id) {
    throw create_request_error(
      'A subscription id is required to delete a subscription.',
    );
  }

  const url = new URL(
    `/feeds/v2/subscriptions/${encodeURIComponent(trimmed_subscription_id)}.json`,
    `${MICRO_BLOG_FEEDS_BASE_URL}/`,
  );
  const headers = new Headers({
    Accept: 'application/json',
    Authorization: `Bearer ${trimmed_token}`,
  });
  const response = await fetch(url, {
    method: 'DELETE',
    headers,
  });
  const response_text = await response.text();

  if (!response.ok) {
    throw create_request_error(
      'Feeds subscription delete request failed.',
      response.status,
      response_text,
    );
  }

  if (!response_text.trim()) {
    return null;
  }

  return parse_json_response_text(
    response_text,
    response.status,
    'Feeds response parsing failed.',
  );
}

export async function fetch_micro_blog_bookmarks({ token = '' } = {}) {
  return fetch_micro_blog_feeds_json('/posts/bookmarks', {
    token,
  });
}

export async function fetch_micro_blog_highlights({ token = '' } = {}) {
  return fetch_micro_blog_feeds_json('/feeds/highlights', {
    token,
  });
}

export async function create_micro_blog_highlight({
  token = '',
  post_id = '',
  text = '',
  start_offset = null,
  end_offset = null,
} = {}) {
  const trimmed_token = `${token || ''}`.trim();
  const trimmed_post_id = `${post_id || ''}`.trim();
  const raw_text = `${text || ''}`;
  const trimmed_text = raw_text.trim();

  if (!trimmed_token) {
    throw create_request_error(
      'A Micro.blog token is required to create highlights.',
    );
  }

  if (!trimmed_post_id) {
    throw create_request_error('A post id is required to create a highlight.');
  }

  if (!trimmed_text) {
    throw create_request_error(
      'Highlighted text is required to create a highlight.',
    );
  }

  const url = new URL(
    `/feeds/${encodeURIComponent(trimmed_post_id)}/highlights`,
    `${MICRO_BLOG_FEEDS_BASE_URL}/`,
  );
  const headers = new Headers({
    'Content-Type': 'application/x-www-form-urlencoded',
    Accept: 'application/json',
    Authorization: `Bearer ${trimmed_token}`,
  });
  const body = new URLSearchParams({
    text: raw_text || trimmed_text,
  });

  if (start_offset != null) {
    body.set('start', String(start_offset));
  }

  if (end_offset != null) {
    body.set('end', String(end_offset));
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: body.toString(),
  });
  const response_text = await response.text();

  if (!response.ok) {
    throw create_request_error(
      'Micro.blog highlight create request failed.',
      response.status,
      response_text,
    );
  }

  if (!response_text.trim()) {
    return null;
  }

  try {
    return JSON.parse(response_text);
  } catch (error) {
    return null;
  }
}

export async function delete_micro_blog_highlight({
  token = '',
  post_id = '',
  highlight_id = '',
} = {}) {
  const trimmed_token = `${token || ''}`.trim();
  const trimmed_post_id = `${post_id || ''}`.trim();
  const trimmed_highlight_id = `${highlight_id || ''}`.trim();

  if (!trimmed_token) {
    throw create_request_error(
      'A Micro.blog token is required to delete highlights.',
    );
  }

  if (!trimmed_post_id) {
    throw create_request_error('A post id is required to delete a highlight.');
  }

  if (!trimmed_highlight_id) {
    throw create_request_error(
      'A highlight id is required to delete a highlight.',
    );
  }

  const url = new URL(
    `/feeds/${encodeURIComponent(trimmed_post_id)}/highlights/${encodeURIComponent(trimmed_highlight_id)}`,
    `${MICRO_BLOG_FEEDS_BASE_URL}/`,
  );
  const headers = new Headers({
    Accept: 'application/json',
    Authorization: `Bearer ${trimmed_token}`,
  });
  const response = await fetch(url, {
    method: 'DELETE',
    headers,
  });
  const response_text = await response.text();

  if (!response.ok) {
    throw create_request_error(
      'Micro.blog highlight delete request failed.',
      response.status,
      response_text,
    );
  }

  if (!response_text.trim()) {
    return null;
  }

  try {
    return JSON.parse(response_text);
  } catch (error) {
    return null;
  }
}

export async function fetch_micro_blog_conversation_replies({
  token = '',
  post_url = '',
} = {}) {
  const trimmed_token = `${token || ''}`.trim();
  const trimmed_post_url = `${post_url || ''}`.trim();

  if (!trimmed_token) {
    throw create_request_error(
      'A Micro.blog token is required to load conversation replies.',
    );
  }

  if (!trimmed_post_url) {
    return {
      items: [],
      home_page_url: '',
      not_found: false,
    };
  }

  const params = new URLSearchParams({
    url: trimmed_post_url,
    format: 'jsonfeed',
  });
  const url = new URL(
    `/conversation.js?${params.toString()}`,
    `${MICRO_BLOG_FEEDS_BASE_URL}/`,
  );
  const headers = new Headers({
    Accept: 'application/json',
    Authorization: `Bearer ${trimmed_token}`,
  });
  const response = await fetch(url, {
    method: 'GET',
    headers,
  });

  if (response.status === 404) {
    return {
      items: [],
      home_page_url: '',
      not_found: true,
    };
  }

  const response_text = await response.text();

  if (!response.ok) {
    throw create_request_error(
      'Feeds conversation request failed.',
      response.status,
      response_text,
    );
  }

  if (!response_text.trim()) {
    return {
      items: [],
      home_page_url: '',
      not_found: false,
    };
  }

  try {
    const payload = JSON.parse(response_text);

    return {
      ...payload,
      not_found: false,
    };
  } catch (error) {
    return {
      items: [],
      home_page_url: '',
      not_found: false,
    };
  }
}

export async function mark_micro_blog_feed_entries_read({
  token = '',
  entry_ids = [],
} = {}) {
  const unread_entries = normalize_entry_payload_ids(entry_ids);

  if (unread_entries.length === 0) {
    return [];
  }

  const payload = await fetch_micro_blog_feeds_json(
    '/feeds/v2/unread_entries.json',
    {
      token,
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ unread_entries }),
    },
  );

  if (Array.isArray(payload)) {
    return payload;
  } else {
    return [];
  }
}

export async function mark_micro_blog_feed_entries_unread({
  token = '',
  entry_ids = [],
} = {}) {
  const unread_entries = normalize_entry_payload_ids(entry_ids);

  if (unread_entries.length === 0) {
    return [];
  }

  const payload = await fetch_micro_blog_feeds_json(
    '/feeds/v2/unread_entries.json',
    {
      token,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ unread_entries }),
    },
  );

  if (Array.isArray(payload)) {
    return payload;
  } else {
    return [];
  }
}

export async function bookmark_micro_blog_feed_entries({
  token = '',
  entry_ids = [],
} = {}) {
  const starred_entries = normalize_entry_payload_ids(entry_ids);

  if (starred_entries.length === 0) {
    return [];
  }

  const payload = await fetch_micro_blog_feeds_json(
    '/feeds/v2/starred_entries.json',
    {
      token,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ starred_entries }),
    },
  );

  if (Array.isArray(payload)) {
    return payload;
  } else {
    return [];
  }
}

export async function unbookmark_micro_blog_feed_entries({
  token = '',
  entry_ids = [],
} = {}) {
  const starred_entries = normalize_entry_payload_ids(entry_ids);

  if (starred_entries.length === 0) {
    return [];
  }

  const payload = await fetch_micro_blog_feeds_json(
    '/feeds/v2/starred_entries.json',
    {
      token,
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ starred_entries }),
    },
  );

  if (Array.isArray(payload)) {
    return payload;
  } else {
    return [];
  }
}

export async function summarize_micro_blog_feed_entries({
  token = '',
  entry_ids = [],
} = {}) {
  const normalized_entry_ids = normalize_entry_payload_ids(entry_ids);

  if (normalized_entry_ids.length === 0) {
    return '';
  }

  const trimmed_token = `${token || ''}`.trim();

  if (!trimmed_token) {
    throw create_request_error('A Micro.blog token is required to summarize feeds.');
  }

  const url = new URL('/feeds/recap', `${MICRO_BLOG_FEEDS_BASE_URL}/`);
  const headers = new Headers({
    'Content-Type': 'application/json',
    Accept: 'text/html',
    Authorization: `Bearer ${trimmed_token}`,
  });

  for (let attempt = 1; attempt <= RECAP_POLL_MAX_ATTEMPTS; attempt += 1) {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(normalized_entry_ids),
    });

    if (response.status === 202) {
      if (attempt < RECAP_POLL_MAX_ATTEMPTS) {
        await delay(RECAP_POLL_DELAY_MS);
        continue;
      }

      return '';
    }

    const response_text = await response.text();

    if (!response.ok) {
      throw create_request_error(
        'Feeds recap request failed.',
        response.status,
        response_text,
      );
    }

    return response_text;
  }

  return '';
}

export async function fetch_recap_email_settings({ token = '' } = {}) {
  const payload = await fetch_micro_blog_feeds_json('/feeds/recap/email', {
    token,
  });

  return {
    dayofweek: `${payload?.dayofweek || ''}`.trim(),
  };
}

export async function update_recap_email_settings({
  token = '',
  dayofweek = '',
} = {}) {
  const trimmed_token = `${token || ''}`.trim();
  const normalized_dayofweek = `${dayofweek || ''}`.trim();

  if (!trimmed_token) {
    throw create_request_error(
      'A Micro.blog token is required to update recap email settings.',
    );
  }

  const url = new URL('/feeds/recap/email', `${MICRO_BLOG_FEEDS_BASE_URL}/`);
  const headers = new Headers({
    'Content-Type': 'application/x-www-form-urlencoded',
    Accept: 'application/json',
    Authorization: `Bearer ${trimmed_token}`,
  });
  const body = new URLSearchParams({
    dayofweek: normalized_dayofweek,
  });
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: body.toString(),
  });
  const response_text = await response.text();

  if (!response.ok) {
    throw create_request_error(
      'Feeds recap email settings update failed.',
      response.status,
      response_text,
    );
  }

  if (!response_text.trim()) {
    return {
      dayofweek: normalized_dayofweek,
    };
  }

  try {
    const payload = JSON.parse(response_text);

    return {
      dayofweek: `${payload?.dayofweek || normalized_dayofweek}`.trim(),
    };
  } catch (error) {
    return {
      dayofweek: normalized_dayofweek,
    };
  }
}

export async function create_micro_blog_bookmark({
  token = '',
  bookmark_url = '',
} = {}) {
  const trimmed_token = `${token || ''}`.trim();
  const trimmed_bookmark_url = `${bookmark_url || ''}`.trim();

  if (!trimmed_token) {
    throw create_request_error('A Micro.blog token is required to create bookmarks.');
  }

  if (!trimmed_bookmark_url) {
    throw create_request_error('A bookmark URL is required to create a bookmark.');
  }

  const headers = new Headers({
    'Content-Type': 'application/x-www-form-urlencoded',
    Accept: 'application/json',
    Authorization: `Bearer ${trimmed_token}`,
  });
  const body = new URLSearchParams({
    'bookmark-of': trimmed_bookmark_url,
  });
  const response = await fetch('https://micro.blog/micropub', {
    method: 'POST',
    headers,
    body: body.toString(),
  });
  const response_text = await response.text();

  if (!response.ok) {
    throw create_request_error(
      'Micro.blog bookmark request failed.',
      response.status,
      response_text,
    );
  }

  if (!response_text.trim()) {
    return {};
  }

  try {
    return JSON.parse(response_text);
  } catch (error) {
    return {};
  }
}

export async function delete_micro_blog_bookmark({
  token = '',
  bookmark_id = '',
} = {}) {
  const trimmed_token = `${token || ''}`.trim();
  const trimmed_bookmark_id = `${bookmark_id || ''}`.trim();

  if (!trimmed_token) {
    throw create_request_error('A Micro.blog token is required to delete bookmarks.');
  }

  if (!trimmed_bookmark_id) {
    throw create_request_error('A bookmark id is required to delete a bookmark.');
  }

  const encoded_bookmark_id = encodeURIComponent(trimmed_bookmark_id);
  const url = new URL(
    `/posts/bookmarks/${encoded_bookmark_id}`,
    `${MICRO_BLOG_FEEDS_BASE_URL}/`,
  );
  const headers = new Headers({
    Accept: 'application/json',
    Authorization: `Bearer ${trimmed_token}`,
  });
  const response = await fetch(url, {
    method: 'DELETE',
    headers,
  });
  const response_text = await response.text();

  if (!response.ok) {
    throw create_request_error(
      'Micro.blog bookmark delete request failed.',
      response.status,
      response_text,
    );
  }

  if (!response_text.trim()) {
    return null;
  }

  try {
    return JSON.parse(response_text);
  } catch (error) {
    return null;
  }
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

  const response_text = await response.text();

  if (!response.ok) {
    throw create_request_error(
      'Feeds request failed.',
      response.status,
      response_text,
    );
  }

  if (!response_text.trim()) {
    return null;
  }

  return parse_json_response_text(
    response_text,
    response.status,
    'Feeds response parsing failed.',
  );
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

function parse_json_response_text(
  response_text = '',
  status = null,
  message = 'Feeds response parsing failed.',
) {
  if (!`${response_text || ''}`.trim()) {
    return null;
  }

  try {
    return JSON.parse(response_text);
  } catch (error) {
    throw create_request_error(
      message,
      status,
      response_text,
    );
  }
}

function delay(duration_ms = 0) {
  return new Promise((resolve) => {
    setTimeout(resolve, duration_ms);
  });
}

function normalize_entry_payload_ids(entry_ids = []) {
  if (!Array.isArray(entry_ids)) {
    return [];
  }

  return entry_ids
    .map((entry_id) => {
      const trimmed_entry_id = `${entry_id || ''}`.trim();

      if (!trimmed_entry_id) {
        return null;
      }

      const numeric_entry_id = Number(trimmed_entry_id);

      if (!Number.isNaN(numeric_entry_id)) {
        return numeric_entry_id;
      } else {
        return trimmed_entry_id;
      }
    })
    .filter(Boolean);
}
