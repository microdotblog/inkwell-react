import { Linking, Platform } from "react-native";
import {
  FadeInDown,
  FadeOutUp,
  LinearTransition,
} from "react-native-reanimated";
import { DEFAULT_TEXT_SCALE, scaleTextMetric } from "../../theme/textScale";

const READER_HORIZONTAL_PADDING = 20;
const READER_BOTTOM_PADDING = 32;
const READER_COLUMN_MAX_WIDTH = 760;
const READER_WEBVIEW_CONTENT_MAX_WIDTH = 600;
const READER_WEBVIEW_MIN_HEIGHT = 1;
const READER_HIGHLIGHT_LIGHT_BACKGROUND = "#FFF9D6";
const READER_HIGHLIGHT_DARK_BACKGROUND = "#D98C3A";
const READER_IMAGE_MODAL_BACKGROUND = "rgba(5, 7, 12, 0.96)";
const READER_IMAGE_MODAL_CLOSE_BUTTON_SIZE = 40;
const READER_IMAGE_MODAL_VIEWPORT_PADDING = 20;
const READER_IMAGE_MODAL_MAXIMUM_SCALE = 8;
const READER_AVATAR_SIZE = 42;
const READER_AVATAR_TRANSITION_MS = 180;
const READER_TITLE_FONT_SIZE = 22;
const READER_TITLE_LINE_HEIGHT = 30;
const READER_TITLE_TOP_MARGIN = 20;
const READER_PARAGRAPH_SPACING = 18;
const RECAP_FAVICON_SIZE = 22;
const RECAP_SETTINGS_LAYOUT_TRANSITION = LinearTransition.duration(180);
const RECAP_SETTINGS_ROW_ENTERING = FadeInDown.duration(180);
const RECAP_SETTINGS_ROW_EXITING = FadeOutUp.duration(140);
const REPLY_AVATAR_SIZE = 30;
const READER_TEXT_SIZE_TRAY_RADIUS = 22;
const READER_TEXT_SIZE_TRAY_SHADOW_RADIUS = 18;
const READER_TEXT_SIZE_TRAY_SHADOW_HEIGHT = 12;
const READER_TEXT_SIZE_TRAY_BOTTOM_GAP = 2;
const READER_PANE_CONTROL_INSET = 3;
const READER_PANE_CONTROL_HEIGHT = 40;
const READER_PANE_CONTROL_RADIUS = READER_PANE_CONTROL_HEIGHT / 2;
const READER_PANE_LAYOUT_TRANSITION = LinearTransition.duration(220);
const READER_PANE_BUTTON_HEIGHT =
  READER_PANE_CONTROL_HEIGHT - READER_PANE_CONTROL_INSET * 2;
const READER_PANE_BUTTON_RADIUS = READER_PANE_BUTTON_HEIGHT / 2;
const READER_REPLY_CONTENT_WIDTH_OFFSET = 64;
const RECAP_EMAIL_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const TEXT_STYLE_NAMES = [
  "sourceLabel",
  "hostLabel",
  "feedDetailSeparator",
  "dateLabel",
  "title",
  "recapBody",
  "readerPaneButtonLabel",
  "replyAuthor",
  "replyDate",
  "recapSettingsTitle",
  "recapSettingsBody",
  "recapDayChipLabel",
  "recapBookmarkError",
  "recapHeaderTitle",
  "recapFaviconInitial",
  "recapTopicLabel",
  "recapPhotoTileFallbackLabel",
  "recapQuoteButtonLabel",
  "unavailableTitle",
  "unavailableBody",
  "openOriginalLabel",
];

function resolve_reader_text_size_backdrop_color(theme) {
  return with_color_opacity(theme?.colors?.canvas, theme?.isDark ? 0.58 : 0.3);
}

function with_color_opacity(color_value = "", opacity = 1) {
  const normalized_color = `${color_value || ""}`.trim();
  const normalized_opacity = Number.isFinite(opacity)
    ? Math.min(Math.max(opacity, 0), 1)
    : 1;
  const hex_match = normalized_color.match(/^#([0-9a-f]{6})$/i);

  if (!hex_match) {
    return normalized_color || "rgba(255, 255, 255, 0.84)";
  }

  const hex = hex_match[1];
  const red = parseInt(hex.slice(0, 2), 16);
  const green = parseInt(hex.slice(2, 4), 16);
  const blue = parseInt(hex.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${normalized_opacity})`;
}

function create_reader_body_html(entry = null) {
  const content = `${entry?.content || ""}`.trim();

  if (content) {
    return content;
  }

  const summary = `${entry?.summary || ""}`.trim();

  if (summary) {
    return `<p>${escape_html(summary)}</p>`;
  }

  return "";
}

function resolve_reader_text_metrics(text_scale = DEFAULT_TEXT_SCALE) {
  const content_font_size = scaleTextMetric(18, text_scale) ?? 18;
  const content_line_height = scaleTextMetric(29, text_scale) ?? 29;
  const caption_font_size = Math.max(content_font_size - 2, 12);
  const caption_line_height = Math.max(content_line_height - 4, 16);

  return {
    caption_font_size,
    caption_line_height,
    content_font_size,
    content_line_height,
  };
}

function create_reader_post_document_html({
  base_url = "",
  caption_font_size = 16,
  caption_line_height = 25,
  content_max_width = READER_WEBVIEW_CONTENT_MAX_WIDTH,
  content_font_size = 18,
  content_line_height = 29,
  html = "",
  theme,
}) {
  const resolved_base_url =
    normalize_http_url(base_url) || "https://example.com/";
  const page_background_color = "transparent";
  const text_color = theme?.colors?.ink || "#1d1d1f";
  const link_color = theme?.colors?.accentStrong || "#0b57d0";
  const quote_color = theme?.colors?.inkSoft || "#4d4d4f";
  const quote_border_color = theme?.colors?.line || "#d2d2d7";
  const pre_background_color = theme?.colors?.badge || "#f5f5f7";
  const pre_border_color = theme?.colors?.line || "#d2d2d7";
  const highlight_background_color = theme?.isDark
    ? READER_HIGHLIGHT_DARK_BACKGROUND
    : READER_HIGHLIGHT_LIGHT_BACKGROUND;

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover"
  >
  <base href="${escape_html_attribute(resolved_base_url)}">
  <style>
    :root {
      --reader-highlight-background: ${highlight_background_color};
      --page-background: ${page_background_color};
      --text-color: ${text_color};
      --link-color: ${link_color};
      --quote-color: ${quote_color};
      --quote-border-color: ${quote_border_color};
      --pre-background-color: ${pre_background_color};
      --pre-border-color: ${pre_border_color};
      --content-font-size: ${content_font_size}px;
      --content-line-height: ${content_line_height}px;
      --caption-font-size: ${caption_font_size}px;
      --caption-line-height: ${caption_line_height}px;
    }

    html {
      background-color: var(--page-background);
    }

    body {
      background-color: var(--page-background);
      color: var(--text-color);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      margin: 0;
      padding: 0;
      -webkit-text-size-adjust: 100%;
    }

    .content {
      box-sizing: border-box;
      width: 100%;
    }

    .post-content {
      color: var(--text-color);
      font-size: var(--content-font-size);
      line-height: var(--content-line-height);
      overflow-wrap: break-word;
      word-break: break-word;
    }

    .post-content .reader-highlight-text {
      background: var(--reader-highlight-background);
      border-radius: 2px;
      box-decoration-break: clone;
      -webkit-box-decoration-break: clone;
    }

    .post-content:empty {
      display: none;
    }

    p, li, td, th, pre, blockquote {
      color: var(--text-color);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: var(--content-font-size);
      line-height: var(--content-line-height);
    }

    p, ul, ol, blockquote, pre, table, figure {
      margin-top: 0;
      margin-bottom: ${READER_PARAGRAPH_SPACING}px;
    }

    ul, ol {
      padding-left: 1.35em;
    }

    img, video {
      border-radius: 5px;
      height: auto;
      max-width: 100%;
    }

    video {
      background: #000;
      display: block;
      width: 100%;
    }

    figure {
      margin-left: 0;
      margin-right: 0;
      padding: 0;
    }

    figcaption {
      color: var(--quote-color);
      font-size: var(--caption-font-size);
      line-height: var(--caption-line-height);
      margin-top: 8px;
    }

    pre {
      background-color: var(--pre-background-color);
      border: 1px solid var(--pre-border-color);
      border-radius: 16px;
      box-sizing: border-box;
      overflow-x: auto;
      padding: 16px;
      white-space: pre-wrap;
    }

    code {
      font-family: "SFMono-Regular", "SF Mono", Menlo, Monaco, Consolas, monospace;
    }

    blockquote {
      border-left: 3px solid var(--quote-border-color);
      color: var(--quote-color);
      margin-left: 0;
      padding-left: 16px;
    }

    a {
      color: var(--link-color);
      text-decoration: none;
    }

    table {
      border-collapse: collapse;
      display: block;
      max-width: 100%;
      overflow-x: auto;
      width: 100%;
    }

    th, td {
      text-align: left;
      vertical-align: top;
    }
  </style>
</head>
<body>
  <div class="content">
    <article class="post-content">${html}</article>
  </div>
  <script>
    ${create_reader_post_bridge_script()}
  </script>
</body>
</html>`;
}

function create_reader_static_bridge_script(options = {}) {
  const supports_bookmark_actions =
    options?.supports_bookmark_actions === true ? "true" : "false";
  const ignores_header_images =
    options?.ignores_header_images === true ? "true" : "false";

  return `(function() {
    if (window.__inkwellStaticBridgeInstalled) {
      return;
    }

    window.__inkwellStaticBridgeInstalled = true;

    function postBridgeMessage(type, payload) {
      if (
        !window.ReactNativeWebView ||
        typeof window.ReactNativeWebView.postMessage !== 'function'
      ) {
        return;
      }

      try {
        window.ReactNativeWebView.postMessage(
          JSON.stringify({
            type: type,
            ...(payload || {}),
          })
        );
      } catch (error) {
        return;
      }
    }

    function currentHeight() {
      var bodyHeight = document.body ? document.body.scrollHeight : 0;
      var docHeight = document.documentElement
        ? document.documentElement.scrollHeight
        : 0;
      var content = document.querySelector('.content');
      var contentHeight = content ? content.scrollHeight : 0;
      return Math.max(bodyHeight, docHeight, contentHeight, 1);
    }

    function postHeight() {
      postBridgeMessage('height', {
        value: currentHeight(),
      });
    }

    function absoluteURL(rawValue) {
      var value = String(rawValue || '').trim();
      if (!value) {
        return '';
      }

      try {
        return new URL(value, document.baseURI).toString();
      } catch (error) {
        return '';
      }
    }

    function imageLikeURL(rawValue) {
      var value = absoluteURL(rawValue);

      if (!value) {
        return '';
      }

      try {
        var parsedURL = new URL(value);

        if (
          /\\.(apng|avif|bmp|gif|heic|heif|jpe?g|png|svg|tiff?|webp)$/i.test(
            parsedURL.pathname || ''
          )
        ) {
          return value;
        }
      } catch (error) {
        return '';
      }

      return '';
    }

    function registerImageObservers() {
      Array.prototype.forEach.call(document.images || [], function(image) {
        if (!image) {
          return;
        }

        if (!image.complete) {
          image.addEventListener('load', postHeight);
          image.addEventListener('error', postHeight);
        }
      });
    }

    document.addEventListener('click', function(event) {
      if (!event.target || !event.target.closest) {
        return;
      }

      if (${supports_bookmark_actions}) {
        var bookmarkButton = event.target.closest(
          'button.reading-recap-quote-bookmark-button[data-bookmark-url]'
        );

        if (bookmarkButton) {
          var bookmarkURL = absoluteURL(
            bookmarkButton.getAttribute('data-bookmark-url')
          );

          if (!bookmarkURL || bookmarkButton.disabled) {
            return;
          }

          event.preventDefault();
          event.stopPropagation();
          postBridgeMessage('bookmark', {
            bookmark_url: bookmarkURL,
          });
          return;
        }
      }

      var image = event.target.closest('img');

      if (image) {
        if (
          ${ignores_header_images} &&
          image.closest('.reading-recap .reading-header h2')
        ) {
          return;
        }

        var imageSrc = absoluteURL(image.currentSrc || image.src);

        if (!imageSrc) {
          return;
        }

        var imageLink = image.closest('a[href]');
        var anchorHref = imageLink
          ? absoluteURL(imageLink.getAttribute('href'))
          : '';
        var imageURL = imageLikeURL(anchorHref) || imageSrc;

        event.preventDefault();
        event.stopPropagation();
        postBridgeMessage('image', {
          image_alt: String(image.getAttribute('alt') || '').trim(),
          image_src: imageSrc,
          image_url: imageURL,
        });
        return;
      }

      var link = event.target.closest('a[href]');

      if (!link) {
        return;
      }

      var href = absoluteURL(link.getAttribute('href'));

      if (!href) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      postBridgeMessage('link', {
        href: href,
      });
    }, true);

    window.addEventListener('resize', postHeight);
    window.addEventListener('load', function() {
      registerImageObservers();
      postHeight();
    });

    if (typeof ResizeObserver === 'function') {
      var resizeObserver = new ResizeObserver(function() {
        postHeight();
      });

      if (document.body) {
        resizeObserver.observe(document.body);
      }

      var content = document.querySelector('.content');

      if (content) {
        resizeObserver.observe(content);
      }
    }

    setTimeout(postHeight, 0);
    setTimeout(postHeight, 60);
    setTimeout(postHeight, 240);

    window.inkwellStaticContent = {
      postHeight: postHeight,
    };
  })();`;
}

function create_reply_document_html({
  base_url = "",
  content_max_width = READER_WEBVIEW_CONTENT_MAX_WIDTH,
  html = "",
  theme,
}) {
  const resolved_base_url =
    normalize_http_url(base_url) || "https://example.com/";
  const text_color = theme?.colors?.inkSoft || "#4d4d4f";
  const link_color = theme?.colors?.accentStrong || "#0b57d0";
  const quote_border_color = theme?.colors?.line || "#d2d2d7";
  const pre_background_color = theme?.colors?.badge || "#f5f5f7";
  const pre_border_color = theme?.colors?.line || "#d2d2d7";

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover"
  >
  <base href="${escape_html_attribute(resolved_base_url)}">
  <style>
    :root {
      --page-background: transparent;
      --text-color: ${text_color};
      --link-color: ${link_color};
      --quote-border-color: ${quote_border_color};
      --pre-background-color: ${pre_background_color};
      --pre-border-color: ${pre_border_color};
    }

    html {
      background: var(--page-background);
    }

    body {
      background: var(--page-background);
      color: var(--text-color);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      margin: 0;
      padding: 0;
      -webkit-text-size-adjust: 100%;
    }

    .content {
      box-sizing: border-box;
      margin-top: 5px;
      // margin-left: auto;
      // margin-right: auto;
      max-width: ${Math.max(Math.round(content_max_width), 0)}px;
      width: 100%;
    }

    .reply-content {
      color: var(--text-color);
      font-size: 15px;
      line-height: 23px;
      overflow-wrap: break-word;
      word-break: break-word;
    }

    .reply-content:empty {
      display: none;
    }

    p, li, td, th, pre, blockquote {
      color: var(--text-color);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 15px;
      line-height: 23px;
    }

    p {
      margin-top: 0;
      margin-bottom: 10px;
    }

    ul, ol {
      margin-top: 0;
      margin-bottom: 10px;
      padding-left: 1.35em;
    }

    img, video {
      border-radius: 5px;
      height: auto;
      max-width: 100%;
    }

    blockquote {
      border-left: 3px solid var(--quote-border-color);
      margin: 0 0 10px 0;
      padding-left: 12px;
    }

    pre {
      background: var(--pre-background-color);
      border: 1px solid var(--pre-border-color);
      border-radius: 12px;
      box-sizing: border-box;
      overflow-x: auto;
      padding: 12px;
      white-space: pre-wrap;
    }

    a {
      color: var(--link-color);
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="content">
    <article class="reply-content">${html}</article>
  </div>
  <script>
    ${create_reader_static_bridge_script()}
  </script>
</body>
</html>`;
}

function create_recap_runtime_script({ is_dark = false } = {}) {
  const uses_dark_theme = is_dark ? "true" : "false";

  return `(function() {
    function normalizeRecapColor(rawColor) {
      var value = String(rawColor || '').trim();

      if (
        !/^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value)
      ) {
        return '';
      }

      var hex = value.slice(1);

      if (hex.length === 3 || hex.length === 4) {
        return '#' + hex.split('').map(function(character) {
          return character + character;
        }).join('');
      }

      return '#' + hex;
    }

    function withRecapColorOpacity(colorValue, opacityHex) {
      var normalizedColor = normalizeRecapColor(colorValue);

      if (!normalizedColor) {
        return '';
      }

      var baseColor =
        normalizedColor.length === 9
          ? normalizedColor.slice(0, 7)
          : normalizedColor;
      var safeOpacity = /^[0-9a-f]{2}$/i.test(String(opacityHex || ''))
        ? String(opacityHex || '').toLowerCase()
        : '80';

      return baseColor + safeOpacity;
    }

    function applyRecapColors() {
      var isDarkTheme = ${uses_dark_theme};
      var recapElements = document.querySelectorAll('.reading-recap');

      Array.prototype.forEach.call(recapElements, function(recapElement) {
        var lightColor = normalizeRecapColor(
          recapElement.getAttribute('data-color-light')
        );
        var darkColor = normalizeRecapColor(
          recapElement.getAttribute('data-color-dark') ||
            recapElement.getAttribute('data-color-right')
        );
        var baseColor = isDarkTheme
          ? (darkColor || lightColor)
          : (lightColor || darkColor);

        if (!baseColor) {
          return;
        }

        var backgroundColor = withRecapColorOpacity(
          baseColor,
          isDarkTheme ? 'd9' : 'a6'
        );
        var borderColor = withRecapColorOpacity(
          baseColor,
          isDarkTheme ? 'ff' : 'bf'
        );
        var quoteBackgroundColor = withRecapColorOpacity(
          baseColor,
          isDarkTheme ? 'ee' : 'cc'
        );
        var quoteBorderColor = withRecapColorOpacity(baseColor, 'ff');
        var topicsBackgroundColor = withRecapColorOpacity(
          baseColor,
          isDarkTheme ? 'ff' : 'f0'
        );
        var topicsBorderColor = withRecapColorOpacity(baseColor, 'ff');

        if (backgroundColor) {
          recapElement.style.setProperty('--recap-card-background', backgroundColor);
        }

        if (borderColor) {
          recapElement.style.setProperty('--recap-card-border', borderColor);
        }

        if (quoteBackgroundColor) {
          recapElement.style.setProperty(
            '--recap-blockquote-background',
            quoteBackgroundColor
          );
        }

        if (quoteBorderColor) {
          recapElement.style.setProperty(
            '--recap-blockquote-border',
            quoteBorderColor
          );
        }

        if (topicsBackgroundColor) {
          recapElement.style.setProperty(
            '--recap-topics-background',
            topicsBackgroundColor
          );
        }

        if (topicsBorderColor) {
          recapElement.style.setProperty(
            '--recap-topics-border',
            topicsBorderColor
          );
        }
      });
    }

    window.addEventListener('load', applyRecapColors);
    setTimeout(applyRecapColors, 0);
    setTimeout(applyRecapColors, 60);
  })();`;
}

function create_recap_document_html({
  base_url = "",
  content_max_width = READER_WEBVIEW_CONTENT_MAX_WIDTH,
  html = "",
  theme,
}) {
  const resolved_base_url =
    normalize_http_url(base_url) || "https://example.com/";
  const text_color = theme?.colors?.ink || "#1d1d1f";
  const muted_text_color = theme?.colors?.inkSoft || "#6b7280";
  const link_color = theme?.colors?.accentStrong || "#0b57d0";
  const card_background_color = theme?.colors?.badge || "#f5f5f7";
  const border_color = theme?.colors?.line || "#d2d2d7";
  const button_background_color = theme?.colors?.paper || "#ffffff";

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover"
  >
  <base href="${escape_html_attribute(resolved_base_url)}">
  <style>
    :root {
      --page-background: transparent;
      --recap-text: ${text_color};
      --recap-muted: ${muted_text_color};
      --recap-list-text: ${muted_text_color};
      --recap-link: ${link_color};
      --recap-card-background: ${card_background_color};
      --recap-card-border: ${border_color};
      --recap-topics-background: rgba(0, 0, 0, 0.08);
      --recap-topics-border: ${border_color};
      --recap-blockquote-background: ${card_background_color};
      --recap-blockquote-border: ${border_color};
      --recap-button-background: ${button_background_color};
      --recap-button-border: ${border_color};
    }

    html {
      background: var(--page-background);
    }

    body {
      background: var(--page-background);
      color: var(--recap-text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      margin: 0;
      padding: 0;
      -webkit-text-size-adjust: 100%;
    }

    .content {
      box-sizing: border-box;
      margin-left: auto;
      margin-right: auto;
      max-width: ${Math.max(Math.round(content_max_width), 0)}px;
      width: 100%;
    }

    .reading-recap {
      background: var(--recap-card-background);
      border: 1px solid var(--recap-card-border);
      border-radius: 24px;
      box-sizing: border-box;
      color: var(--recap-text);
      margin: 0 0 22px 0;
      overflow: hidden;
      padding: 18px;
    }

    .reading-recap .reading-header {
      align-items: center;
      column-gap: 10px;
      display: flex;
      flex-direction: row;
      flex-wrap: wrap;
      margin-bottom: 14px;
      row-gap: 8px;
    }

    .reading-recap .reading-header h2 {
      align-items: center;
      color: var(--recap-text);
      display: flex;
      flex: 1 1 auto;
      font-family: Georgia, "Times New Roman", serif;
      font-size: 28px;
      gap: 10px;
      line-height: 32px;
      margin: 0;
      min-width: 0;
    }

    .reading-recap .reading-header h2 img {
      border-radius: 999px;
      flex: 0 0 auto;
      height: 20px;
      object-fit: cover;
      width: 20px;
    }

    .reading-recap .reading-header .topics {
      align-items: center;
      display: flex;
      flex: 0 1 auto;
      flex-direction: row;
      flex-wrap: wrap;
      gap: 6px;
      justify-content: flex-end;
      margin-left: auto;
    }

    .reading-recap .reading-header .topics span {
      align-items: center;
      background: var(--recap-topics-background);
      border: 1px solid var(--recap-topics-border);
      border-radius: 999px;
      display: inline-flex;
      font-size: 13px;
      font-weight: 700;
      justify-content: center;
      line-height: 16px;
      min-height: 34px;
      padding: 6px 14px;
      white-space: nowrap;
    }

    .reading-recap p {
      color: var(--recap-text);
      font-size: 15px;
      line-height: 23px;
      margin: 0 0 18px 0;
    }

    .reading-recap a {
      color: var(--recap-link);
      text-decoration: none;
    }

    .reading-recap blockquote {
      background: var(--recap-blockquote-background);
      border-left: 3px solid var(--recap-blockquote-border);
      color: var(--recap-text);
      margin: 0 0 20px 0;
      padding: 14px 16px;
    }

    .reading-recap blockquote p:last-child {
      margin-bottom: 0;
    }

    .reading-recap ul {
      margin: 0;
      padding-left: 18px;
    }

    .reading-recap li {
      color: var(--recap-list-text);
      font-size: 15px;
      line-height: 22px;
      margin-bottom: 8px;
    }

    .reading-recap li a {
      font-weight: 600;
    }

    .reading-recap-photos {
      display: flex;
      flex-direction: row;
      flex-wrap: wrap;
      gap: 10px;
      margin: 2px 0 20px 0 !important;
    }

    .reading-recap-photos a {
      border-radius: 14px;
      display: inline-flex;
      overflow: hidden;
    }

    .reading-recap-photos a img {
      display: block;
      height: 96px;
      object-fit: cover;
      width: 96px;
    }

    .reading-recap-quote {
      align-items: flex-start;
      display: flex;
      gap: 12px;
      justify-content: space-between;
      width: 100%;
    }

    .reading-recap-quote-main {
      flex: 1 1 auto;
      min-width: 0;
    }

    .reading-recap-quote-main p {
      margin-bottom: 0;
    }

    .reading-recap-quote-bookmark {
      display: inline-flex;
      flex: 0 0 auto;
      white-space: nowrap;
    }

    .reading-recap-quote-bookmark-button {
      align-items: center;
      background: var(--recap-button-background);
      border: 1px solid var(--recap-button-border);
      border-radius: 999px;
      color: var(--recap-muted);
      display: inline-flex;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 12px;
      font-weight: 700;
      justify-content: center;
      line-height: 16px;
      min-height: 34px;
      padding: 0 12px;
      white-space: nowrap;
    }

    .reading-recap-quote-bookmark-button.is-bookmarked {
      color: var(--recap-link);
    }

    .reading-recap-quote-bookmark-button:disabled {
      opacity: 0.72;
    }
  </style>
</head>
<body>
  <div class="content">
    ${html}
  </div>
  <script>
    ${create_recap_runtime_script({ is_dark: theme?.isDark === true })}
  </script>
  <script>
    ${create_reader_static_bridge_script({
      ignores_header_images: true,
      supports_bookmark_actions: true,
    })}
  </script>
</body>
</html>`;
}

function create_reader_image_viewer_document_html({
  image_alt = "",
  image_url = "",
}) {
  const safe_image_url = escape_html_attribute(image_url);
  const safe_image_alt = escape_html_attribute(image_alt || "Reader image");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=${READER_IMAGE_MODAL_MAXIMUM_SCALE}, user-scalable=yes, viewport-fit=cover"
  >
  <style>
    html, body {
      background: #05070c;
      height: 100%;
      margin: 0;
      overflow: auto;
      padding: 0;
      width: 100%;
    }

    body {
      align-items: center;
      box-sizing: border-box;
      display: flex;
      justify-content: center;
      padding: ${READER_IMAGE_MODAL_VIEWPORT_PADDING}px;
    }

    img {
      display: block;
      height: auto;
      margin: 0 auto;
      max-height: calc(100vh - ${READER_IMAGE_MODAL_VIEWPORT_PADDING * 2}px);
      max-width: calc(100vw - ${READER_IMAGE_MODAL_VIEWPORT_PADDING * 2}px);
      object-fit: contain;
      width: auto;
    }
  </style>
</head>
<body>
  <img alt="${safe_image_alt}" src="${safe_image_url}">
</body>
</html>`;
}

function create_reader_post_bridge_script() {
  return `(function() {
    if (window.__inkwellReaderBridgeInstalled) {
      return;
    }

    window.__inkwellReaderBridgeInstalled = true;

    function postBridgeMessage(type, payload) {
      if (
        !window.ReactNativeWebView ||
        typeof window.ReactNativeWebView.postMessage !== 'function'
      ) {
        return;
      }

      try {
        window.ReactNativeWebView.postMessage(
          JSON.stringify({
            type: type,
            ...(payload || {}),
          })
        );
      } catch (error) {
        return;
      }
    }

    function currentHeight() {
      var bodyHeight = document.body ? document.body.scrollHeight : 0;
      var docHeight = document.documentElement
        ? document.documentElement.scrollHeight
        : 0;
      var content = document.querySelector('.content');
      var contentHeight = content ? content.scrollHeight : 0;
      return Math.max(bodyHeight, docHeight, contentHeight, 1);
    }

    function contentElement() {
      return document.querySelector('.post-content');
    }

    function numericValue(value, fallbackValue) {
      var parsedValue = Number(value);
      if (!isFinite(parsedValue) || parsedValue <= 0) {
        return Number(fallbackValue) || 0;
      }

      return parsedValue;
    }

    function currentScrollFraction() {
      var currentMaxScrollTop = maxScrollTop();

      if (currentMaxScrollTop <= 0) {
        return 0;
      }

      return Math.max(0, Math.min(1, currentScrollTop() / currentMaxScrollTop));
    }

    function restoreScrollFraction(scrollFraction) {
      var parsedScrollFraction = Number(scrollFraction);

      if (!isFinite(parsedScrollFraction)) {
        return;
      }

      var currentMaxScrollTop = maxScrollTop();

      if (currentMaxScrollTop <= 0) {
        return;
      }

      window.scrollTo({
        top: currentMaxScrollTop * Math.max(0, Math.min(parsedScrollFraction, 1)),
        behavior: 'auto',
      });
    }

    function currentSelectionRange() {
      var selection = window.getSelection();
      if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
        return null;
      }

      return selection.getRangeAt(0);
    }

    function getSelectionPayload() {
      var content = contentElement();
      var range = currentSelectionRange();
      if (!content || !range || !content.contains(range.commonAncestorContainer)) {
        return null;
      }

      var rawText = window.getSelection().toString();
      var trimmedText = String(rawText || '').trim();
      if (!trimmedText) {
        return null;
      }

      try {
        var rootRange = document.createRange();
        rootRange.selectNodeContents(content);
        rootRange.setEnd(range.startContainer, range.startOffset);
        var startOffset = rootRange.toString().length;
        var selectionText = range.toString();
        var endOffset = startOffset + selectionText.length;
        return {
          selection_text: selectionText,
          start_offset: startOffset,
          end_offset: endOffset,
        };
      } catch (error) {
        return {
          selection_text: rawText,
          start_offset: null,
          end_offset: null,
        };
      }
    }

    function clearSelection() {
      var selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
      }
    }

    function clearReaderHighlightMarkup(content) {
      if (!content) {
        return;
      }

      var highlightNodes = Array.from(
        content.querySelectorAll('span.reader-highlight-text')
      );

      highlightNodes.forEach(function(highlightNode) {
        var parentNode = highlightNode.parentNode;
        if (!parentNode) {
          return;
        }

        while (highlightNode.firstChild) {
          parentNode.insertBefore(highlightNode.firstChild, highlightNode);
        }

        parentNode.removeChild(highlightNode);
      });

      content.normalize();
    }

    function parseHighlightID(item) {
      if (!item || typeof item !== 'object') {
        return '';
      }

      var rawID =
        item.highlight_id != null
          ? item.highlight_id
          : item.id != null
            ? item.id
            : item.local_id;

      return String(rawID || '').trim();
    }

    function parseOffsetRange(item) {
      if (!item || typeof item !== 'object') {
        return null;
      }

      var rawStart =
        item.start_offset != null
          ? item.start_offset
          : item.selection_start != null
            ? item.selection_start
            : item.start;
      var rawEnd =
        item.end_offset != null
          ? item.end_offset
          : item.selection_end != null
            ? item.selection_end
            : item.end;
      var startOffset = Number(rawStart);
      var endOffset = Number(rawEnd);

      if (!Number.isFinite(startOffset) || !Number.isFinite(endOffset)) {
        return null;
      }

      var normalizedStart = Math.max(0, Math.floor(startOffset));
      var normalizedEnd = Math.max(0, Math.floor(endOffset));

      if (normalizedEnd <= normalizedStart) {
        return null;
      }

      return {
        start_offset: normalizedStart,
        end_offset: normalizedEnd,
        highlight_id: parseHighlightID(item),
      };
    }

    function buildMergedOffsetRanges(items) {
      var ranges = (Array.isArray(items) ? items : [])
        .map(function(item) {
          return parseOffsetRange(item);
        })
        .filter(Boolean)
        .sort(function(left, right) {
          return left.start_offset - right.start_offset;
        });

      if (ranges.length === 0) {
        return [];
      }

      var merged = [ranges[0]];
      for (var index = 1; index < ranges.length; index += 1) {
        var range = ranges[index];
        var lastRange = merged[merged.length - 1];
        var sameHighlightID = range.highlight_id === lastRange.highlight_id;

        if (!sameHighlightID || range.start_offset > lastRange.end_offset) {
          merged.push(range);
          continue;
        }

        if (range.end_offset > lastRange.end_offset) {
          lastRange.end_offset = range.end_offset;
        }
      }

      return merged;
    }

    function buildReaderHighlightSegments(content, ranges) {
      var segments = [];
      var walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT, null);
      var node = walker.nextNode();
      var absoluteOffset = 0;

      while (node) {
        var text = node.textContent || '';
        var textLength = text.length;
        var nodeStart = absoluteOffset;
        var nodeEnd = absoluteOffset + textLength;

        if (textLength > 0) {
          ranges.forEach(function(range) {
            if (range.end_offset <= nodeStart) {
              return;
            }

            if (range.start_offset >= nodeEnd) {
              return;
            }

            var overlapStart = Math.max(range.start_offset, nodeStart);
            var overlapEnd = Math.min(range.end_offset, nodeEnd);

            if (overlapEnd <= overlapStart) {
              return;
            }

            segments.push({
              node: node,
              start_offset: overlapStart - nodeStart,
              end_offset: overlapEnd - nodeStart,
              absolute_start: overlapStart,
              highlight_id: range.highlight_id,
            });
          });
        }

        absoluteOffset = nodeEnd;
        node = walker.nextNode();
      }

      return segments;
    }

    function wrapReaderHighlightRange(range, highlightID) {
      var span = document.createElement('span');
      span.className = 'reader-highlight-text';

      if (highlightID && highlightID.length > 0) {
        span.dataset.highlightId = highlightID;
      }

      try {
        range.surroundContents(span);
      } catch (error) {
        var fragment = range.extractContents();
        span.appendChild(fragment);
        range.insertNode(span);
      }
    }

    function restoreHighlights(items) {
      var content = contentElement();
      if (!content) {
        return;
      }

      clearReaderHighlightMarkup(content);

      var ranges = buildMergedOffsetRanges(items);
      if (ranges.length === 0) {
        postHeight();
        return;
      }

      var segments = buildReaderHighlightSegments(content, ranges);
      if (segments.length === 0) {
        postHeight();
        return;
      }

      segments
        .sort(function(left, right) {
          return right.absolute_start - left.absolute_start;
        })
        .forEach(function(segment) {
          if (!segment.node || !segment.node.parentNode) {
            return;
          }

          var textLength = segment.node.textContent.length;
          var startOffset = Math.max(
            0,
            Math.min(segment.start_offset, textLength)
          );
          var endOffset = Math.max(0, Math.min(segment.end_offset, textLength));

          if (endOffset <= startOffset) {
            return;
          }

          var range = document.createRange();
          range.setStart(segment.node, startOffset);
          range.setEnd(segment.node, endOffset);
          wrapReaderHighlightRange(range, segment.highlight_id);
        });

      postHeight();
    }

    function postHeight() {
      postBridgeMessage('height', {
        value: currentHeight(),
      });
    }

    function applyTextScale(payload) {
      payload = payload || {};

      var scrollFraction = currentScrollFraction();
      var contentFontSize = numericValue(payload.content_font_size, 18);
      var contentLineHeight = numericValue(payload.content_line_height, 29);
      var captionFontSize = numericValue(payload.caption_font_size, 16);
      var captionLineHeight = numericValue(payload.caption_line_height, 25);
      var root = document.documentElement;
      if (!root) {
        return;
      }

      root.style.setProperty('--content-font-size', contentFontSize + 'px');
      root.style.setProperty('--content-line-height', contentLineHeight + 'px');
      root.style.setProperty('--caption-font-size', captionFontSize + 'px');
      root.style.setProperty('--caption-line-height', captionLineHeight + 'px');
      restoreScrollFraction(scrollFraction);
      postHeight();

      setTimeout(function() {
        restoreScrollFraction(scrollFraction);
        postHeight();
      }, 0);

      setTimeout(function() {
        restoreScrollFraction(scrollFraction);
        postHeight();
      }, 80);
    }

    function absoluteURL(rawValue) {
      var value = String(rawValue || '').trim();
      if (!value) {
        return '';
      }

      try {
        return new URL(value, document.baseURI).toString();
      } catch (error) {
        return '';
      }
    }

    function imageLikeURL(rawValue) {
      var value = absoluteURL(rawValue);

      if (!value) {
        return '';
      }

      try {
        var parsedURL = new URL(value);

        if (
          /\.(apng|avif|bmp|gif|heic|heif|jpe?g|png|svg|tiff?|webp)$/i.test(
            parsedURL.pathname || ''
          )
        ) {
          return value;
        }
      } catch (error) {
        return '';
      }

      return '';
    }

    function hasContentSelection() {
      var selection = window.getSelection();
      if (
        !selection ||
        selection.isCollapsed ||
        selection.rangeCount === 0 ||
        selection.toString().trim().length === 0
      ) {
        return false;
      }

      var content = document.querySelector('.post-content');
      if (!content) {
        return false;
      }

      try {
        return content.contains(selection.getRangeAt(0).commonAncestorContainer);
      } catch (error) {
        return false;
      }
    }

    var previousSelectionState = null;
    var previousActiveHighlightID = '';
    var tappedHighlightID = '';
    var pendingTouchHighlightID = '';

    function highlightNodeFromTarget(target) {
      if (!target) {
        return null;
      }

      var node = target.nodeType === Node.TEXT_NODE ? target.parentNode : target;
      if (!node || typeof node.closest !== 'function') {
        return null;
      }

      return node.closest('span.reader-highlight-text');
    }

    function highlightIDFromNode(node) {
      if (!node || !node.dataset) {
        return '';
      }

      return String(node.dataset.highlightId || '').trim();
    }

    function postActiveHighlight(highlightID) {
      var nextHighlightID = String(highlightID || '').trim();

      if (nextHighlightID === previousActiveHighlightID) {
        return;
      }

      previousActiveHighlightID = nextHighlightID;
      postBridgeMessage('active_highlight', {
        highlight_id: nextHighlightID,
      });
    }

    function activateTappedHighlight(highlightID) {
      tappedHighlightID = String(highlightID || '').trim();
      postSelectionFlag(false);
      postActiveHighlight(tappedHighlightID);
    }

    function postSelectionFlag(nextState) {
      var normalizedState = Boolean(nextState);

      if (normalizedState === previousSelectionState) {
        return;
      }

      previousSelectionState = normalizedState;
      postBridgeMessage('selection', {
        has_selection: normalizedState,
      });
    }

    function postSelectionState() {
      var nextState = hasContentSelection();

      if (nextState) {
        tappedHighlightID = '';
        postSelectionFlag(true);
        postActiveHighlight('');
        return;
      }

      postSelectionFlag(false);

      if (tappedHighlightID) {
        postActiveHighlight(tappedHighlightID);
        return;
      }

      postActiveHighlight('');
    }

    function registerImageObservers() {
      Array.prototype.forEach.call(document.images || [], function(image) {
        if (!image) {
          return;
        }

        if (image.complete) {
          return;
        }

        image.addEventListener('load', postHeight);
        image.addEventListener('error', postHeight);
      });
    }

    document.addEventListener('click', function(event) {
      if (!event.target || !event.target.closest) {
        return;
      }

      var image = event.target.closest('img');
      if (!image) {
        return;
      }

      var imageSrc = absoluteURL(image.currentSrc || image.src);
      if (!imageSrc) {
        return;
      }

      var imageLink = image.closest('a[href]');
      var anchorHref = imageLink ? absoluteURL(imageLink.getAttribute('href')) : '';
      var imageURL = imageLikeURL(anchorHref) || imageSrc;

      event.preventDefault();
      event.stopPropagation();
      postBridgeMessage('image', {
        image_alt: String(image.getAttribute('alt') || '').trim(),
        image_src: imageSrc,
        image_url: imageURL,
      });
    }, true);

    document.addEventListener('click', function(event) {
      if (!event.target || !event.target.closest) {
        return;
      }

      var link = event.target.closest('a[href]');
      if (!link) {
        return;
      }

      var href = absoluteURL(link.getAttribute('href'));
      if (!href) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      postBridgeMessage('link', {
        href: href,
      });
    }, true);

    document.addEventListener('touchstart', function(event) {
      if (!event.target || !event.target.closest || event.target.closest('a[href]')) {
        pendingTouchHighlightID = '';
        return;
      }

      var highlightNode = event.target.closest('span.reader-highlight-text');
      pendingTouchHighlightID = highlightIDFromNode(highlightNode);
    }, true);

    document.addEventListener('touchmove', function() {
      pendingTouchHighlightID = '';
    }, true);

    document.addEventListener('touchcancel', function() {
      pendingTouchHighlightID = '';
    }, true);

    document.addEventListener('touchend', function() {
      var highlightID = pendingTouchHighlightID;
      pendingTouchHighlightID = '';

      if (!highlightID) {
        return;
      }

      setTimeout(function() {
        if (hasContentSelection()) {
          postSelectionState();
          return;
        }

        activateTappedHighlight(highlightID);
      }, 0);
    }, true);

    document.addEventListener('click', function(event) {
      if (!event.target || !event.target.closest) {
        tappedHighlightID = '';
        postSelectionState();
        return;
      }

      if (event.target.closest('a[href]')) {
        tappedHighlightID = '';
        postSelectionState();
        return;
      }

      var highlightNode = event.target.closest('span.reader-highlight-text');
      var highlightID = highlightIDFromNode(highlightNode);

      if (!highlightID) {
        tappedHighlightID = '';
        postSelectionState();
        return;
      }

      if (hasContentSelection()) {
        postSelectionState();
        return;
      }

      activateTappedHighlight(highlightID);
    });

    document.addEventListener('selectionchange', function() {
      postSelectionState();
    });
    document.addEventListener('mouseup', function() {
      postSelectionState();
    });
    document.addEventListener('keyup', function() {
      postSelectionState();
    });
    window.addEventListener('resize', postHeight);
    window.addEventListener('load', function() {
      registerImageObservers();
      postSelectionState();
      postHeight();
    });

    if (typeof ResizeObserver === 'function') {
      var resizeObserver = new ResizeObserver(function() {
        postHeight();
      });
      if (document.body) {
        resizeObserver.observe(document.body);
      }
      var content = document.querySelector('.content');
      if (content) {
        resizeObserver.observe(content);
      }
    }

    setTimeout(postHeight, 0);
    setTimeout(postHeight, 60);
    setTimeout(postHeight, 240);

    window.inkwellDetail = {
      applyTextScale: applyTextScale,
      clearSelection: clearSelection,
      getSelectionPayload: getSelectionPayload,
      requestSelectionPayload: function(requestId) {
        postBridgeMessage('selection_payload', {
          request_id: String(requestId || ''),
          value: getSelectionPayload(),
        });
      },
      restoreHighlights: function(payload) {
        tappedHighlightID = '';
        restoreHighlights(Array.isArray(payload) ? payload : []);
        postSelectionState();
      },
      postHeight: postHeight,
    };
  })();`;
}

function decorate_recap_html(markup = "", options = {}) {
  const trimmed_markup = `${markup || ""}`.trim();
  const bookmarked_quote_url_set = new Set(
    (Array.isArray(options?.bookmarked_quote_urls)
      ? options.bookmarked_quote_urls
      : []
    )
      .map((url) => normalize_http_url(url))
      .filter(Boolean),
  );
  const bookmarking_quote_url = normalize_http_url(
    options?.bookmarking_quote_url,
  );

  if (!trimmed_markup) {
    return "";
  }

  return trimmed_markup.replace(
    /<p>(\s*💬\s*Quoting from\s*<a[\s\S]*?<\/a>)<\/p>/gi,
    (_match, quote_markup) => {
      const href_match =
        quote_markup.match(/\shref\s*=\s*(['"])(.*?)\1/i) ||
        quote_markup.match(/\shref\s*=\s*([^\s>"']+)/i);
      const raw_url = href_match?.[2] || href_match?.[1] || "";
      const bookmark_url = normalize_http_url(raw_url);
      const is_bookmarked = bookmark_url
        ? bookmarked_quote_url_set.has(bookmark_url)
        : false;
      const is_loading =
        Boolean(bookmark_url) && bookmark_url === bookmarking_quote_url;
      const label = is_bookmarked
        ? "Bookmarked"
        : is_loading
          ? "Saving..."
          : "Bookmark";
      const button_markup = bookmark_url
        ? `<span class="reading-recap-quote-bookmark"><button type="button" class="reading-recap-quote-bookmark-button${
            is_bookmarked ? " is-bookmarked" : ""
          }${is_loading ? " is-loading" : ""}" data-bookmark-url="${escape_html_attribute(
            bookmark_url,
          )}"${
            is_bookmarked || is_loading ? " disabled" : ""
          }>${escape_html(label)}</button></span>`
        : "";

      return `<div class="reading-recap-quote"><div class="reading-recap-quote-main"><p>${quote_markup}</p></div>${button_markup}</div>`;
    },
  );
}

function sanitize_reader_html(markup = "", options = {}) {
  const trimmed_markup = `${markup || ""}`.trim();
  const base_url =
    typeof options === "string" ? options : options?.base_url || "";

  if (!trimmed_markup) {
    return "";
  }

  const stripped_markup = trimmed_markup
    .replace(
      /<\s*(script|style|iframe|embed|object|form|input|button|select|textarea|audio|link|meta|base)\b[^>]*>[\s\S]*?<\s*\/\s*\1>/gi,
      "",
    )
    .replace(
      /<\s*(script|style|iframe|embed|object|form|input|button|select|textarea|audio|link|meta|base)\b[^>]*\/?>/gi,
      "",
    )
    .replace(/<!--[\s\S]*?-->/g, "");

  return stripped_markup.replace(
    /<([a-z0-9:-]+)(\s[^<>]*?)?(\/?)>/gi,
    (match, tag_name, raw_attributes = "", self_closing_marker = "") => {
      const normalized_tag_name = `${tag_name || ""}`.toLowerCase();

      if (!normalized_tag_name) {
        return "";
      }

      const normalized_attributes = sanitize_reader_html_attributes(
        raw_attributes,
        {
          base_url,
        },
      );
      const media_attributes =
        normalized_tag_name === "video"
          ? append_missing_video_attributes(normalized_attributes)
          : normalized_attributes;

      if (self_closing_marker === "/") {
        return `<${normalized_tag_name}${media_attributes} />`;
      }

      return `<${normalized_tag_name}${media_attributes}>`;
    },
  );
}

function resolve_detail_mode(raw_mode = "") {
  const normalized_mode = `${raw_mode || ""}`.trim().toLowerCase();

  if (normalized_mode === "recap") {
    return "recap";
  } else {
    return "entry";
  }
}

function resolve_entry_source(raw_source = "") {
  const normalized_source = `${raw_source || ""}`.trim().toLowerCase();

  if (normalized_source === "bookmark") {
    return "bookmark";
  }

  if (normalized_source === "subscription_feed") {
    return "subscription_feed";
  } else {
    return "feed";
  }
}

function resolve_reader_title(entry = null) {
  const title = normalize_reader_text(entry?.title);

  if (title) {
    if (title.toLowerCase() === "untitled") {
      return "";
    }

    const summary = normalize_reader_text(entry?.summary);

    if (summary) {
      if (summary === title) {
        return "";
      }

      const shared_prefix =
        title.startsWith(summary) || summary.startsWith(title);
      const prefix_length = Math.min(title.length, summary.length);

      if (shared_prefix && prefix_length >= 40) {
        return "";
      }
    }

    return title;
  }

  return "";
}

function normalize_reader_text(value = "") {
  return `${value || ""}`.trim().replace(/\s+/g, " ");
}

function format_reader_date(raw_date = "") {
  const trimmed_date = `${raw_date || ""}`.trim();

  if (!trimmed_date) {
    return "";
  }

  const date = new Date(trimmed_date);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString([], {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function normalize_conversation_replies(items = []) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.filter((item) => {
    return item && typeof item === "object";
  });
}

function get_reply_count_label(count = 0) {
  const normalized_count = Number.isFinite(count) ? Math.max(count, 0) : 0;
  return `${normalized_count} repl${normalized_count === 1 ? "y" : "ies"}`;
}

function get_highlight_count_label(count = 0) {
  const normalized_count = Number.isFinite(count) ? Math.max(count, 0) : 0;
  return `${normalized_count} highlight${normalized_count === 1 ? "" : "s"}`;
}

function resolve_reply_key(reply = null, index = 0) {
  const reply_id = `${reply?.id || ""}`.trim();

  if (reply_id) {
    return reply_id;
  }

  const author_name = get_reply_author_name(reply);
  const published_at = `${reply?.date_published || ""}`.trim();
  const content_key = `${reply?.content_text || reply?.content_html || ""}`
    .trim()
    .slice(0, 40);

  return `${author_name}-${published_at}-${content_key || index}`;
}

function get_reply_author_name(reply = null) {
  const name = `${reply?.author?.name || ""}`.trim();

  if (name) {
    return name;
  }

  const username = `${reply?.author?._microblog?.username || ""}`.trim();

  if (username) {
    return username;
  }

  return "Unknown";
}

function format_reply_date(raw_date = "") {
  const trimmed_date = `${raw_date || ""}`.trim();

  if (!trimmed_date) {
    return "";
  }

  const date = new Date(trimmed_date);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const date_text = date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });
  const time_text = date
    .toLocaleTimeString("en-US", {
      hour: "numeric",
      hour12: true,
      minute: "2-digit",
    })
    .toLowerCase();

  return `${date_text} ${time_text}`;
}

function resolve_reply_html(reply = null) {
  const content_html = sanitize_reader_html(
    `${reply?.content_html || ""}`.trim(),
  );

  if (content_html) {
    return content_html;
  }

  const content_text = `${reply?.content_text || ""}`.trim();

  if (!content_text) {
    return "";
  }

  const safe_text = escape_html(content_text).replace(/\r?\n/g, "<br>");

  return `<p>${safe_text}</p>`;
}

function get_recap_day_chip_label(dayofweek = "") {
  const trimmed_dayofweek = `${dayofweek || ""}`.trim();

  if (!trimmed_dayofweek) {
    return "";
  }

  return trimmed_dayofweek.slice(0, 3);
}

function get_recap_day_summary_label(dayofweek = "") {
  return `${dayofweek || ""}`.trim();
}

function resolve_entry_highlight_by_identifier(highlights = [], identifier = "") {
  const normalized_identifier = `${identifier || ""}`.trim();

  if (!normalized_identifier || !Array.isArray(highlights)) {
    return null;
  }

  return (
    highlights.find((highlight) => {
      return highlight_matches_identifier(highlight, normalized_identifier);
    }) || null
  );
}

function resolve_entry_highlight_range(highlight = null) {
  const start_offset = Number(highlight?.start_offset);
  const end_offset = Number(highlight?.end_offset);

  if (!Number.isFinite(start_offset) || !Number.isFinite(end_offset)) {
    return null;
  }

  const normalized_start_offset = Math.max(0, Math.floor(start_offset));
  const normalized_end_offset = Math.max(0, Math.floor(end_offset));

  if (normalized_end_offset <= normalized_start_offset) {
    return null;
  }

  return {
    end_offset: normalized_end_offset,
    highlight_id: resolve_highlight_identifier(highlight),
    start_offset: normalized_start_offset,
  };
}

function resolve_highlight_identifier(highlight = null) {
  return `${highlight?.highlight_id || highlight?.id || ""}`.trim();
}

function highlight_matches_identifier(highlight = null, identifier = "") {
  const normalized_identifier = `${identifier || ""}`.trim();

  if (!normalized_identifier) {
    return false;
  }

  return (
    `${highlight?.id || ""}`.trim() === normalized_identifier ||
    `${highlight?.highlight_id || ""}`.trim() === normalized_identifier
  );
}

function sanitize_reader_html_attributes(raw_attributes = "", options = {}) {
  const sanitized_attributes = [];
  const base_url =
    typeof options === "string" ? options : options?.base_url || "";
  const attribute_pattern =
    /([^\s"'<>\/=]+)(?:\s*=\s*(".*?"|'.*?'|[^\s"'=<>`]+))?/g;
  let attribute_match = attribute_pattern.exec(raw_attributes);

  while (attribute_match) {
    const attribute_name = `${attribute_match[1] || ""}`.trim();
    const normalized_attribute_name = attribute_name.toLowerCase();
    let attribute_value = attribute_match[2];

    if (
      normalized_attribute_name &&
      !normalized_attribute_name.startsWith("on") &&
      normalized_attribute_name !== "target" &&
      normalized_attribute_name !== "rel" &&
      normalized_attribute_name !== "srcdoc" &&
      normalized_attribute_name !== "srcset"
    ) {
      if (attribute_value === undefined) {
        sanitized_attributes.push(attribute_name);
      } else {
        attribute_value = attribute_value.replace(/^['"]|['"]$/g, "");

        if (
          normalized_attribute_name === "href" ||
          normalized_attribute_name === "src"
        ) {
          const safe_url = normalize_http_url(attribute_value, {
            base_url,
          });

          if (safe_url) {
            sanitized_attributes.push(
              `${attribute_name}="${escape_html_attribute(safe_url)}"`,
            );
          }
        } else {
          sanitized_attributes.push(
            `${attribute_name}="${escape_html_attribute(
              decode_html_entities(attribute_value),
            )}"`,
          );
        }
      }
    }

    attribute_match = attribute_pattern.exec(raw_attributes);
  }

  if (sanitized_attributes.length === 0) {
    return "";
  }

  return ` ${sanitized_attributes.join(" ")}`;
}

function append_missing_video_attributes(attributes = "") {
  const normalized_attributes = `${attributes || ""}`;
  let next_attributes = normalized_attributes;

  if (!/\bplaysinline\b/i.test(next_attributes)) {
    next_attributes = `${next_attributes} playsinline`;
  }

  if (!/\bwebkit-playsinline\b/i.test(next_attributes)) {
    next_attributes = `${next_attributes} webkit-playsinline`;
  }

  return next_attributes;
}

function normalize_http_url(raw_url = "", options = {}) {
  const trimmed_url = decode_html_entities(`${raw_url || ""}`).trim();
  const base_url =
    typeof options === "string" ? options : options?.base_url || "";

  if (!trimmed_url) {
    return "";
  }

  try {
    const parsed_url = base_url
      ? new URL(trimmed_url, base_url)
      : new URL(trimmed_url);

    if (parsed_url.protocol === "http:" || parsed_url.protocol === "https:") {
      return parsed_url.toString();
    }
  } catch {
    return "";
  }

  return "";
}

function resolve_host_label(raw_url = "") {
  const normalized_url = normalize_http_url(raw_url);

  if (!normalized_url) {
    return "";
  }

  try {
    return new URL(normalized_url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

async function open_external_url(raw_url = "") {
  const normalized_url = normalize_http_url(raw_url);

  if (!normalized_url) {
    return;
  }

  try {
    await Linking.openURL(normalized_url);
  } catch {
    // Ignore failed external open attempts for now.
  }
}

function get_source_avatar_initial(source = "") {
  const trimmed_source = `${source || ""}`.trim();
  const initial = trimmed_source.charAt(0).toUpperCase();

  if (initial) {
    return initial;
  } else {
    return "F";
  }
}

function escape_html(value = "") {
  return `${value || ""}`
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escape_html_attribute(value = "") {
  return escape_html(value);
}

function decode_html_entities(value = "") {
  return `${value || ""}`.replace(
    /&(#x[0-9a-f]+|#\d+|amp|apos|gt|lt|nbsp|quot);/gi,
    (match, entity) => {
      const normalized_entity = `${entity || ""}`.toLowerCase();

      if (normalized_entity === "amp") {
        return "&";
      } else if (normalized_entity === "apos") {
        return "'";
      } else if (normalized_entity === "gt") {
        return ">";
      } else if (normalized_entity === "lt") {
        return "<";
      } else if (normalized_entity === "nbsp") {
        return " ";
      } else if (normalized_entity === "quot") {
        return '"';
      } else if (normalized_entity.startsWith("#x")) {
        const code_point = Number.parseInt(normalized_entity.slice(2), 16);

        if (Number.isInteger(code_point)) {
          return String.fromCodePoint(code_point);
        }
      } else if (normalized_entity.startsWith("#")) {
        const code_point = Number.parseInt(normalized_entity.slice(1), 10);

        if (Number.isInteger(code_point)) {
          return String.fromCodePoint(code_point);
        }
      }

      return match;
    },
  );
}

export {
  READER_AVATAR_SIZE,
  READER_AVATAR_TRANSITION_MS,
  READER_BOTTOM_PADDING,
  READER_COLUMN_MAX_WIDTH,
  READER_HORIZONTAL_PADDING,
  READER_HIGHLIGHT_DARK_BACKGROUND,
  READER_HIGHLIGHT_LIGHT_BACKGROUND,
  READER_IMAGE_MODAL_BACKGROUND,
  READER_IMAGE_MODAL_CLOSE_BUTTON_SIZE,
  READER_IMAGE_MODAL_MAXIMUM_SCALE,
  READER_IMAGE_MODAL_VIEWPORT_PADDING,
  READER_PANE_BUTTON_HEIGHT,
  READER_PANE_BUTTON_RADIUS,
  READER_PANE_CONTROL_HEIGHT,
  READER_PANE_CONTROL_INSET,
  READER_PANE_CONTROL_RADIUS,
  READER_PANE_LAYOUT_TRANSITION,
  READER_PARAGRAPH_SPACING,
  READER_REPLY_CONTENT_WIDTH_OFFSET,
  READER_TEXT_SIZE_TRAY_BOTTOM_GAP,
  READER_TEXT_SIZE_TRAY_RADIUS,
  READER_TEXT_SIZE_TRAY_SHADOW_HEIGHT,
  READER_TEXT_SIZE_TRAY_SHADOW_RADIUS,
  READER_TITLE_FONT_SIZE,
  READER_TITLE_LINE_HEIGHT,
  READER_TITLE_TOP_MARGIN,
  READER_WEBVIEW_CONTENT_MAX_WIDTH,
  READER_WEBVIEW_MIN_HEIGHT,
  RECAP_EMAIL_DAYS,
  RECAP_FAVICON_SIZE,
  RECAP_SETTINGS_LAYOUT_TRANSITION,
  RECAP_SETTINGS_ROW_ENTERING,
  RECAP_SETTINGS_ROW_EXITING,
  REPLY_AVATAR_SIZE,
  TEXT_STYLE_NAMES,
  create_reader_body_html,
  create_reader_static_bridge_script,
  create_reader_image_viewer_document_html,
  create_reader_post_document_html,
  create_recap_document_html,
  create_reply_document_html,
  decorate_recap_html,
  format_reader_date,
  format_reply_date,
  get_highlight_count_label,
  get_recap_day_chip_label,
  get_recap_day_summary_label,
  get_reply_author_name,
  get_reply_count_label,
  get_source_avatar_initial,
  normalize_conversation_replies,
  normalize_http_url,
  normalize_reader_text,
  open_external_url,
  resolve_detail_mode,
  resolve_entry_highlight_by_identifier,
  resolve_entry_highlight_range,
  resolve_entry_source,
  resolve_highlight_identifier,
  resolve_host_label,
  resolve_reply_key,
  resolve_reader_text_metrics,
  resolve_reader_text_size_backdrop_color,
  resolve_reader_title,
  resolve_reply_html,
  sanitize_reader_html,
  with_color_opacity,
};
