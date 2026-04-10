const MICRO_BLOG_APP_POST_BASE_URL = 'microblog://post?text=';
const MICRO_BLOG_WEB_POST_BASE_URL = 'https://micro.blog/post?text=';

export function build_highlight_post_markdown(highlight = null, fallback = {}) {
  const highlight_text = normalize_string(highlight?.text);
  const post_link_markdown = build_micro_blog_post_link_markdown(
    highlight,
    fallback,
  );

  if (!highlight_text || !post_link_markdown) {
    return '';
  }

  const quoted_text = format_highlight_quote_markdown(highlight_text);

  if (!quoted_text) {
    return '';
  }

  return `${post_link_markdown}:\n\n${quoted_text}`;
}

export function build_micro_blog_post_link_markdown(
  post = null,
  fallback = {},
) {
  const post_url = resolve_micro_blog_post_url(post, fallback);

  if (!post_url) {
    return '';
  }

  const link_label = resolve_micro_blog_post_title(post, fallback);

  return `[${link_label}](${post_url})`;
}

export function build_micro_blog_post_urls(markdown = '') {
  const normalized_markdown = normalize_string(markdown);

  if (!normalized_markdown) {
    return {
      app_url: '',
      web_url: '',
    };
  }

  // The Micro.blog mobile app currently decodes incoming post text with
  // `decodeURI`, so the app deep link must preserve reserved URL characters.
  const app_encoded_markdown = encodeURI(normalized_markdown);
  const web_encoded_markdown = encodeURIComponent(normalized_markdown);

  return {
    app_url: `${MICRO_BLOG_APP_POST_BASE_URL}${app_encoded_markdown}`,
    web_url: `${MICRO_BLOG_WEB_POST_BASE_URL}${web_encoded_markdown}`,
  };
}

export async function open_micro_blog_highlight_post(
  highlight = null,
  fallback = {},
) {
  const markdown = build_highlight_post_markdown(highlight, fallback);

  return open_micro_blog_post_markdown(markdown);
}

export async function open_micro_blog_entry_post(entry = null, fallback = {}) {
  const markdown = build_micro_blog_post_link_markdown(entry, fallback);

  return open_micro_blog_post_markdown(markdown);
}

async function open_micro_blog_post_markdown(markdown = '') {
  const { Linking } = require('react-native');
  const { app_url, web_url } = build_micro_blog_post_urls(markdown);

  if (!app_url || !web_url) {
    return false;
  }

  let has_micro_blog_app = false;

  try {
    has_micro_blog_app = await Linking.canOpenURL(app_url);
  } catch {
    has_micro_blog_app = false;
  }

  if (has_micro_blog_app) {
    try {
      await Linking.openURL(app_url);
      return true;
    } catch {
      // Fall through to the web composer when the app deep link fails.
    }
  }

  try {
    await Linking.openURL(web_url);
    return true;
  } catch {
    return false;
  }
}

function resolve_micro_blog_post_title(post = null, fallback = {}) {
  const highlight_title = normalize_string(post?.post_title || post?.title);
  const fallback_title = normalize_string(
    fallback?.post_title || fallback?.title,
  );
  const highlight_source = normalize_string(post?.post_source || post?.source);
  const fallback_source = normalize_string(
    fallback?.post_source || fallback?.source,
  );
  const has_highlight_title = has_valid_post_title(
    highlight_title,
    post?.post_has_title,
  );
  const has_fallback_title = has_valid_post_title(
    fallback_title,
    fallback?.post_has_title,
  );

  if (has_highlight_title) {
    return highlight_title;
  }

  if (has_fallback_title) {
    return fallback_title;
  }

  if (highlight_source) {
    return highlight_source;
  }

  if (fallback_source) {
    return fallback_source;
  }

  return 'Post';
}

function resolve_micro_blog_post_url(post = null, fallback = {}) {
  return (
    normalize_web_url(post?.post_url || post?.url) ||
    normalize_web_url(fallback?.post_url || fallback?.url)
  );
}

function has_valid_post_title(title = '', post_has_title = false) {
  const normalized_title = normalize_string(title);

  if (!normalized_title || normalized_title.toLowerCase() === 'untitled') {
    return false;
  }

  return post_has_title !== false;
}

function format_highlight_quote_markdown(text = '') {
  const normalized_text = normalize_string(text)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  if (!normalized_text) {
    return '';
  }

  return normalized_text
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n');
}

function normalize_string(value = '') {
  return `${value || ''}`.trim();
}

function normalize_web_url(value = '') {
  const normalized_value = normalize_string(value);

  if (!normalized_value) {
    return '';
  }

  try {
    const parsed_url = new URL(normalized_value);

    if (parsed_url.protocol === 'http:' || parsed_url.protocol === 'https:') {
      return parsed_url.toString();
    }
  } catch {
    return '';
  }

  return '';
}
