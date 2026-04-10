import { Linking, Platform } from "react-native";
import {
  HTMLContentModel,
  HTMLElementModel,
  defaultHTMLElementModels,
} from "react-native-render-html";
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
const READER_TITLE_FONT_SIZE = 34;
const READER_TITLE_LINE_HEIGHT = 40;
const READER_TITLE_TOP_MARGIN = 18;
const READER_PARAGRAPH_SPACING = 18;
const IOS_HEADER_TITLE_REVEAL_OFFSET = 12;
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
const READER_IGNORED_DOM_TAGS = [
  "script",
  "style",
  "iframe",
  "embed",
  "object",
  "form",
  "input",
  "button",
  "select",
  "textarea",
  "source",
  "link",
  "meta",
];
const READER_HTML_MODELS = {
  img: defaultHTMLElementModels.img.extend({
    contentModel: HTMLContentModel.mixed,
  }),
  "recap-card": HTMLElementModel.fromCustomModel({
    tagName: "recap-card",
    contentModel: HTMLContentModel.block,
  }),
  "recap-header-group": HTMLElementModel.fromCustomModel({
    tagName: "recap-header-group",
    contentModel: HTMLContentModel.block,
  }),
  "recap-header": HTMLElementModel.fromCustomModel({
    tagName: "recap-header",
    contentModel: HTMLContentModel.mixed,
  }),
  "recap-topics": HTMLElementModel.fromCustomModel({
    tagName: "recap-topics",
    contentModel: HTMLContentModel.block,
  }),
  "recap-photo-strip": HTMLElementModel.fromCustomModel({
    tagName: "recap-photo-strip",
    contentModel: HTMLContentModel.block,
  }),
  "recap-quote": HTMLElementModel.fromCustomModel({
    tagName: "recap-quote",
    contentModel: HTMLContentModel.block,
  }),
};
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

function resolve_translucent_header_background_color(
  theme,
  platform = Platform.OS,
) {
  if (platform === "ios") {
    return with_color_opacity(
      theme?.colors?.canvas,
      theme?.isDark ? 0.18 : 0.14,
    );
  }

  return with_color_opacity(theme?.colors?.canvas, theme?.isDark ? 0.78 : 0.84);
}

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
      margin-left: auto;
      margin-right: auto;
      max-width: ${Math.max(Math.round(content_max_width), 0)}px;
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

function decorate_recap_html(markup = "") {
  const trimmed_markup = `${markup || ""}`.trim();

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
      const bookmark_attribute = bookmark_url
        ? ` data-bookmark-url="${escape_html_attribute(bookmark_url)}"`
        : "";

      return `<recap-quote${bookmark_attribute}><p>${quote_markup}</p></recap-quote>`;
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

function build_recap_classes_styles(theme) {
  return {
    "recap-summary": {
      color: theme.colors.inkSoft,
      fontSize: 15,
      lineHeight: 23,
      marginBottom: 18,
      marginTop: 0,
    },
    "recap-topic": {
      borderWidth: 1,
      borderRadius: 999,
      color: theme.colors.ink,
      fontSize: 11,
      fontWeight: "700",
      lineHeight: 14,
      overflow: "hidden",
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    "recap-photo-link": {
      borderRadius: 14,
      overflow: "hidden",
    },
    "recap-photo-image": {
      borderRadius: 14,
      height: 96,
      width: 96,
    },
    "recap-blockquote": {
      color: theme.colors.ink,
      marginBottom: 20,
      marginLeft: 0,
      marginTop: 0,
      paddingBottom: 14,
      paddingLeft: 16,
      paddingRight: 16,
      paddingTop: 14,
    },
    "recap-posts-label": {
      color: theme.colors.ink,
      fontFamily: "Newsreader_600SemiBold",
      fontSize: 18,
      lineHeight: 24,
      marginBottom: 10,
      marginTop: 4,
    },
    "recap-post-list": {
      marginBottom: 0,
      marginTop: 0,
      paddingLeft: 18,
    },
    "recap-post-item": {
      color: theme.colors.inkSoft,
      fontSize: 15,
      lineHeight: 22,
      marginBottom: 8,
    },
    "recap-post-link": {
      color: theme.colors.accentStrong,
      fontWeight: "600",
    },
  };
}

function create_recap_dom_visitors(theme) {
  return {
    onElement(element) {
      if (!element || !element.attribs) {
        return;
      }

      if (is_recap_card_element(element)) {
        rename_dom_element(element, "recap-card");
        append_dom_class(element, "recap-card");
      }

      const recap_element = is_recap_dom_node(element)
        ? element
        : find_recap_dom_ancestor(element);

      if (!recap_element) {
        return;
      }

      if (has_dom_class_name(element, "reading-header")) {
        rename_dom_element(element, "recap-header-group");
      }

      if (element.name === "h2") {
        rename_dom_element(element, "recap-header");
      }

      if (has_dom_class_name(element, "topics")) {
        rename_dom_element(element, "recap-topics");
      }

      if (
        element.name === "p" &&
        has_dom_class_name(element, "reading-recap-photos")
      ) {
        rename_dom_element(element, "recap-photo-strip");
      }

      if (
        element.name === "a" &&
        element.parent?.name === "recap-photo-strip"
      ) {
        append_dom_class(element, "recap-photo-link");
      }

      if (
        element.name === "img" &&
        element.parent?.name === "a" &&
        element.parent?.parent?.name === "recap-photo-strip"
      ) {
        append_dom_class(element, "recap-photo-image");
      }

      if (element.name === "span" && element.parent?.name === "recap-topics") {
        const recap_colors = resolve_recap_colors(
          recap_element?.attribs,
          theme,
        );

        append_dom_class(element, "recap-topic");

        if (recap_colors.topics_background_color) {
          append_dom_style(
            element,
            `background-color: ${recap_colors.topics_background_color};`,
          );
        }

        if (recap_colors.topics_border_color) {
          append_dom_style(
            element,
            `border-color: ${recap_colors.topics_border_color};`,
          );
        }
      }

      if (is_recap_summary_paragraph(element)) {
        append_dom_class(element, "recap-summary");
      }

      if (is_recap_recent_posts_label(element)) {
        append_dom_class(element, "recap-posts-label");
      }

      if (element.name === "blockquote") {
        const recap_colors = resolve_recap_colors(
          recap_element?.attribs,
          theme,
        );

        append_dom_class(element, "recap-blockquote");

        if (recap_colors.blockquote_background_color) {
          append_dom_style(
            element,
            `background-color: ${recap_colors.blockquote_background_color};`,
          );
        }

        if (recap_colors.blockquote_border_color) {
          append_dom_style(
            element,
            `border-left-color: ${recap_colors.blockquote_border_color}; border-left-width: 3px;`,
          );
        }
      }

      if (element.name === "ul" && is_direct_child_of_recap_card(element)) {
        append_dom_class(element, "recap-post-list");
      }

      if (
        element.name === "li" &&
        element.parent?.name === "ul" &&
        is_direct_child_of_recap_card(element.parent)
      ) {
        append_dom_class(element, "recap-post-item");
      }

      if (element.name === "a" && is_recap_post_link(element)) {
        append_dom_class(element, "recap-post-link");
      }
    },
  };
}

function resolve_recap_colors(attribs = {}, theme) {
  const light_color = normalize_recap_color(attribs?.["data-color-light"]);
  const dark_color = normalize_recap_color(
    attribs?.["data-color-dark"] || attribs?.["data-color-right"],
  );
  const recap_base_color = theme.isDark
    ? dark_color || light_color
    : light_color || dark_color;

  return {
    background_color: with_recap_color_opacity(
      recap_base_color,
      theme.isDark ? "d9" : "a6",
    ),
    border_color: with_recap_color_opacity(
      recap_base_color,
      theme.isDark ? "ff" : "bf",
    ),
    blockquote_background_color: with_recap_color_opacity(
      recap_base_color,
      theme.isDark ? "ee" : "cc",
    ),
    blockquote_border_color: with_recap_color_opacity(recap_base_color, "ff"),
    topics_background_color: with_recap_color_opacity(
      recap_base_color,
      theme.isDark ? "ff" : "f0",
    ),
    topics_border_color: with_recap_color_opacity(recap_base_color, "ff"),
  };
}

function has_dom_class_name(element, class_name = "") {
  const class_names = `${element?.attribs?.class || ""}`
    .split(/\s+/)
    .map((value) => value.trim())
    .filter(Boolean);

  return class_names.includes(class_name);
}

function is_recap_card_element(element) {
  if (!element?.attribs) {
    return false;
  }

  return Boolean(
    has_dom_class_name(element, "reading-recap") ||
      normalize_recap_color(element.attribs?.["data-color-light"]) ||
      normalize_recap_color(
        element.attribs?.["data-color-dark"] ||
          element.attribs?.["data-color-right"],
      ),
  );
}

function is_recap_dom_node(element) {
  if (!element) {
    return false;
  }

  return (
    element.name === "recap-card" ||
    has_dom_class_name(element, "reading-recap")
  );
}

function find_recap_dom_ancestor(element) {
  let current_element = element?.parent || null;

  while (current_element) {
    if (is_recap_dom_node(current_element)) {
      return current_element;
    }

    current_element = current_element.parent || null;
  }

  return null;
}

function is_direct_child_of_recap_card(element) {
  return is_recap_dom_node(element?.parent);
}

function find_previous_dom_tag_sibling(element) {
  let current_element = element?.prev || null;

  while (current_element) {
    if (current_element.type === "tag") {
      return current_element;
    }

    current_element = current_element.prev || null;
  }

  return null;
}

function is_recap_summary_paragraph(element) {
  if (element?.name !== "p" || !is_direct_child_of_recap_card(element)) {
    return false;
  }

  if (
    has_dom_class_name(element, "reading-recap-photos") ||
    is_recap_recent_posts_label(element)
  ) {
    return false;
  }

  const previous_tag_sibling = find_previous_dom_tag_sibling(element);

  if (!previous_tag_sibling) {
    return false;
  }

  return (
    previous_tag_sibling.name === "h2" ||
    previous_tag_sibling.name === "recap-header" ||
    has_dom_class_name(previous_tag_sibling, "reading-header") ||
    previous_tag_sibling.name === "recap-header-group"
  );
}

function is_recap_recent_posts_label(element) {
  if (element?.name !== "p" || !is_direct_child_of_recap_card(element)) {
    return false;
  }

  return normalize_dom_text_content(element).toLowerCase() === "recent posts:";
}

function normalize_dom_text_content(element) {
  return get_dom_text_content(element).replace(/\s+/g, " ").trim();
}

function get_dom_text_content(element) {
  if (!element) {
    return "";
  }

  if (element.type === "text") {
    return `${element.data || ""}`;
  }

  if (!Array.isArray(element.children)) {
    return "";
  }

  return element.children.map((child) => get_dom_text_content(child)).join("");
}

function is_recap_post_link(element) {
  if (element?.name !== "a" || element.parent?.name !== "li") {
    return false;
  }

  return (
    element.parent?.parent?.name === "ul" &&
    is_direct_child_of_recap_card(element.parent.parent)
  );
}

function rename_dom_element(element, next_name = "") {
  if (!element || !next_name) {
    return;
  }

  element.name = next_name;
}

function append_dom_class(element, class_name = "") {
  const existing_class_name = `${element?.attribs?.class || ""}`.trim();

  if (!class_name || has_dom_class_name(element, class_name)) {
    return;
  }

  if (existing_class_name) {
    element.attribs.class = `${existing_class_name} ${class_name}`;
  } else {
    element.attribs.class = class_name;
  }
}

function append_dom_style(element, next_style = "") {
  const trimmed_next_style = `${next_style || ""}`.trim();

  if (!trimmed_next_style) {
    return;
  }

  const existing_style = `${element?.attribs?.style || ""}`.trim();

  if (!existing_style) {
    element.attribs.style = trimmed_next_style;
  } else if (existing_style.endsWith(";")) {
    element.attribs.style = `${existing_style} ${trimmed_next_style}`;
  } else {
    element.attribs.style = `${existing_style}; ${trimmed_next_style}`;
  }
}

function extract_tnode_text(tnode) {
  if (!tnode) {
    return "";
  }

  if (tnode.type === "text") {
    return `${tnode.data || ""}`;
  }

  return (tnode.children || [])
    .map((child) => extract_tnode_text(child))
    .join("");
}

function extract_recap_topic_labels(tnode) {
  if (!tnode) {
    return [];
  }

  const direct_labels = (tnode.children || [])
    .map((child) => normalize_reader_text(extract_tnode_text(child)))
    .filter(Boolean);

  if (direct_labels.length > 0) {
    return [...new Set(direct_labels)];
  }

  const fallback_label = normalize_reader_text(extract_tnode_text(tnode));

  if (!fallback_label) {
    return [];
  }

  return [fallback_label];
}

function extract_recap_photo_items(tnode) {
  if (!tnode) {
    return [];
  }

  const photo_items = [];
  const seen_keys = new Set();

  traverse_tnode_descendants(tnode, (child) => {
    if (child?.tagName !== "img") {
      return;
    }

    const image_url = normalize_http_url(child?.attributes?.src);

    if (!image_url) {
      return;
    }

    const photo_link = find_tnode_ancestor_by_tag(child, "a");
    const href = normalize_http_url(photo_link?.attributes?.href);
    const image_alt = `${child?.attributes?.alt || ""}`.trim();
    const key = `${href || image_url || "recap-photo"}-${photo_items.length}`;

    if (seen_keys.has(key)) {
      return;
    }

    seen_keys.add(key);

    photo_items.push({
      href,
      image_alt,
      image_url,
      key,
    });
  });

  return photo_items;
}

function find_tnode_ancestor_by_tag(tnode, tag_name = "") {
  let current_tnode = tnode?.parent || null;

  while (current_tnode) {
    if (current_tnode.tagName === tag_name) {
      return current_tnode;
    }

    current_tnode = current_tnode.parent || null;
  }

  return null;
}

function find_tnode_image_source(tnode) {
  if (!tnode) {
    return "";
  }

  if (tnode.tagName === "img") {
    return normalize_http_url(tnode.attributes?.src);
  }

  for (const child of tnode.children || []) {
    const child_source = find_tnode_image_source(child);

    if (child_source) {
      return child_source;
    }
  }

  return "";
}

function traverse_tnode_descendants(tnode, on_visit) {
  if (!tnode || typeof on_visit !== "function") {
    return;
  }

  for (const child of tnode.children || []) {
    on_visit(child);
    traverse_tnode_descendants(child, on_visit);
  }
}

function normalize_recap_color(raw_color = "") {
  const normalized_color = `${raw_color || ""}`.trim();

  if (
    !/^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(
      normalized_color,
    )
  ) {
    return "";
  }

  const hex = normalized_color.slice(1);

  if (hex.length === 3 || hex.length === 4) {
    return `#${[...hex]
      .map((character) => `${character}${character}`)
      .join("")}`;
  } else {
    return `#${hex}`;
  }
}

function with_recap_color_opacity(color_value = "", opacity_hex = "80") {
  const normalized_color = normalize_recap_color(color_value);

  if (!normalized_color) {
    return "";
  }

  const base_color =
    normalized_color.length === 9
      ? normalized_color.slice(0, 7)
      : normalized_color;
  const safe_opacity = /^[0-9a-f]{2}$/i.test(`${opacity_hex || ""}`)
    ? `${opacity_hex}`.toLowerCase()
    : "80";

  return `${base_color}${safe_opacity}`;
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

function get_recap_summary_copy(count = 0) {
  const normalized_count = Number.isFinite(count) ? Math.max(count, 0) : 0;
  const noun = normalized_count === 1 ? "post" : "posts";

  return `${normalized_count} older ${noun}, grouped into one recap.`;
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

function get_recap_email_settings_copy({
  is_enabled = false,
  is_expanded = false,
  is_showing_loading_summary = false,
  selected_day = "",
} = {}) {
  if (is_showing_loading_summary) {
    return "Loading your weekly email setting.";
  }

  if (is_expanded) {
    return "Choose a day for Reading Recap, or turn weekly email off.";
  }

  if (is_enabled && selected_day) {
    return `Reading Recap is included in weekly email every ${selected_day}.`;
  }

  return "Reading Recap is not included in weekly email.";
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
  IOS_HEADER_TITLE_REVEAL_OFFSET,
  READER_AVATAR_SIZE,
  READER_AVATAR_TRANSITION_MS,
  READER_BOTTOM_PADDING,
  READER_COLUMN_MAX_WIDTH,
  READER_HORIZONTAL_PADDING,
  READER_HTML_MODELS,
  READER_HIGHLIGHT_DARK_BACKGROUND,
  READER_HIGHLIGHT_LIGHT_BACKGROUND,
  READER_IGNORED_DOM_TAGS,
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
  build_recap_classes_styles,
  create_reader_body_html,
  create_reader_image_viewer_document_html,
  create_reader_post_document_html,
  create_recap_dom_visitors,
  decorate_recap_html,
  extract_recap_photo_items,
  extract_recap_topic_labels,
  extract_tnode_text,
  find_tnode_ancestor_by_tag,
  find_tnode_image_source,
  format_reader_date,
  format_reply_date,
  get_highlight_count_label,
  get_recap_day_chip_label,
  get_recap_day_summary_label,
  get_recap_email_settings_copy,
  get_recap_summary_copy,
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
  resolve_recap_colors,
  resolve_reply_html,
  resolve_translucent_header_background_color,
  sanitize_reader_html,
  with_color_opacity,
};
