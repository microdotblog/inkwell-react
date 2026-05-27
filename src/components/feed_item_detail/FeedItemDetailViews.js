import React from "react";
import {
  ActivityIndicator,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Slider from "@react-native-community/slider";
import { MenuView } from "@react-native-menu/menu";
import { MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { observer } from "mobx-react";
import { WebView } from "react-native-webview";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import HighlightItem from "../highlights/HighlightItem";
import AppStore from "../../stores/App";
import Highlights from "../../stores/Highlights";
import {
  DEFAULT_TEXT_SCALE,
  MAX_TEXT_SCALE,
  MIN_TEXT_SCALE,
  TEXT_SCALE_PRESET_COUNT,
  createScaledTextStyles,
  formatTextScaleLabel,
  scaleTextMetric,
} from "../../theme/textScale";
import {
  READER_AVATAR_SIZE,
  READER_AVATAR_TRANSITION_MS,
  READER_COLUMN_MAX_WIDTH,
  READER_HORIZONTAL_PADDING,
  READER_IMAGE_MODAL_BACKGROUND,
  READER_IMAGE_MODAL_CLOSE_BUTTON_SIZE,
  READER_PANE_BUTTON_HEIGHT,
  READER_PANE_BUTTON_RADIUS,
  READER_PANE_CONTROL_HEIGHT,
  READER_PANE_CONTROL_INSET,
  READER_PANE_CONTROL_RADIUS,
  READER_PANE_LAYOUT_TRANSITION,
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
  REPLY_AVATAR_SIZE,
  TEXT_STYLE_NAMES,
  create_reader_body_html,
  create_reader_image_viewer_document_html,
  create_reader_post_document_html,
  create_reply_document_html,
  format_reader_date,
  format_reply_date,
  get_highlight_count_label,
  get_reply_author_name,
  get_reply_count_label,
  get_source_avatar_initial,
  normalize_http_url,
  open_external_url,
  resolve_host_label,
  resolve_reply_key,
  resolve_reader_text_metrics,
  resolve_reader_text_size_backdrop_color,
  resolve_reader_title,
  resolve_reply_html,
  sanitize_reader_html,
  with_color_opacity,
} from "./feedItemDetailUtils";
import { RecapReaderView } from "./ReadingRecapView";
import { resolve_reader_image_viewer_payload } from "./readerImagePayload";

const READER_PANE_TABS_ENTERING = FadeInDown.duration(220);

export function useFeedItemDetailScaledTextStyles() {
  return React.useMemo(() => {
    return createScaledTextStyles(styles, TEXT_STYLE_NAMES);
  }, []);
}

const EntryReaderView = observer(function EntryReaderView({
  active_pane = "post",
  deleting_highlight_id = "",
  entry,
  onCopyHighlight,
  onDeleteHighlight,
  onPostHighlight,
  onPressFeedAvatar,
  onPressReplyProfile,
  onReaderActiveHighlightChange,
  onReaderImagePress,
  onPressHighlightsPane,
  onPressPostPane,
  onPressRepliesPane,
  onReaderSelectionChange,
  replies = [],
  reader_post_ref,
  reader_webview_reload_key = 0,
  scaled_text_styles,
  theme,
  width = 0,
}) {
  const reader_text_scale = AppStore.reader_text_scale;
  const resolved_entry_id = `${entry?.id || ""}`.trim();
  const source_label = `${entry?.source || "Feed"}`.trim() || "Feed";
  const reader_title = resolve_reader_title(entry);
  const author_label = resolve_entry_author_label(entry, source_label);
  const formatted_date = format_reader_date(entry?.published_at);
  const source_url = normalize_http_url(entry?.source_url);
  const original_url = normalize_http_url(entry?.url);
  const reader_base_url = original_url || source_url;
  const source_host = resolve_host_label(source_url || original_url);
  const should_show_reader_title = Boolean(reader_title);
  const reader_html = sanitize_reader_html(create_reader_body_html(entry), {
    base_url: reader_base_url,
  });
  const has_renderable_body = Boolean(reader_html);
  const entry_highlights = Highlights.entry_highlight_entries(resolved_entry_id);
  const reader_highlights = Highlights.entry_highlight_ranges(resolved_entry_id);
  const reply_count = replies.length;
  const highlight_count = entry_highlights.length;
  const should_show_pane_tabs = reply_count > 0 || highlight_count > 0;

  React.useEffect(() => {
    if (resolved_entry_id) {
      Highlights.load();
    }
  }, [resolved_entry_id]);

  const title_font_size = scaleTextMetric(
    READER_TITLE_FONT_SIZE,
    reader_text_scale,
  );
  const title_line_height = scaleTextMetric(
    READER_TITLE_LINE_HEIGHT,
    reader_text_scale,
  );

  return (
    <View style={styles.readerColumn}>
      <View
        style={[
          styles.masthead,
          {
            borderBottomColor: theme.colors.line,
          },
        ]}
      >
        <View style={styles.feedHeaderRow}>
          <FeedDetailAvatar
            avatar_url={entry.avatar_url}
            onPress={onPressFeedAvatar}
            source={source_label}
            size={READER_AVATAR_SIZE}
            theme={theme}
          />
          <View style={styles.feedMeta}>
            <View style={styles.feedTitleRow}>
              <MetaLink
                color={theme.colors.ink}
                label={source_label}
                onPress={
                  source_url ? () => open_external_url(source_url) : null
                }
                style={[styles.sourceLabel, scaled_text_styles.sourceLabel]}
              />
            </View>
            {source_host || formatted_date ? (
              <View style={styles.feedDetailsRow}>
                {source_host ? (
                  <Text
                    style={[
                      styles.hostLabel,
                      scaled_text_styles.hostLabel,
                      { color: theme.colors.inkSoft },
                    ]}
                  >
                    {source_host}
                  </Text>
                ) : null}
                {source_host && formatted_date ? (
                  <Text
                    style={[
                      styles.feedDetailSeparator,
                      scaled_text_styles.feedDetailSeparator,
                      { color: theme.colors.inkSoft },
                    ]}
                  >
                    •
                  </Text>
                ) : null}
                {formatted_date ? (
                  <MetaLink
                    color={theme.colors.inkSoft}
                    label={formatted_date}
                    onPress={
                      original_url
                        ? () => open_external_url(original_url)
                        : null
                    }
                    style={[styles.dateLabel, scaled_text_styles.dateLabel]}
                  />
                ) : null}
              </View>
            ) : null}
          </View>
        </View>

        {should_show_reader_title ? (
          <View style={styles.titleWrap}>
            <Text
              style={[
                styles.title,
                { color: theme.colors.ink },
                title_font_size ? { fontSize: title_font_size } : null,
                title_line_height ? { lineHeight: title_line_height } : null,
              ]}
            >
              {reader_title}
            </Text>
            {author_label ? (
              <Text
                style={[
                  styles.authorLabel,
                  scaled_text_styles.authorLabel,
                  { color: theme.colors.inkSoft },
                ]}
              >
                {author_label}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>

      {should_show_pane_tabs ? (
        <ReaderPaneTabs
          active_pane={active_pane}
          highlight_count={highlight_count}
          onPressHighlightsPane={onPressHighlightsPane}
          onPressPostPane={onPressPostPane}
          onPressRepliesPane={onPressRepliesPane}
          reply_count={reply_count}
          scaled_text_styles={scaled_text_styles}
          theme={theme}
        />
      ) : null}

      <Animated.View
        layout={READER_PANE_LAYOUT_TRANSITION}
        style={[
          styles.bodySection,
          should_show_pane_tabs ? styles.bodySectionWithPaneTabs : null,
        ]}
      >
        {active_pane === "replies" ? (
          <RepliesListView
            onPressProfile={onPressReplyProfile}
            replies={replies}
            scaled_text_styles={scaled_text_styles}
            theme={theme}
            width={width}
          />
        ) : active_pane === "highlights" ? (
          <HighlightsListView
            deleting_highlight_id={deleting_highlight_id}
            highlights={entry_highlights}
            onCopyHighlight={onCopyHighlight}
            onDeleteHighlight={onDeleteHighlight}
            onPostHighlight={onPostHighlight}
            theme={theme}
          />
        ) : has_renderable_body ? (
          <ReaderPostWebView
            base_url={reader_base_url}
            highlight_payload={reader_highlights}
            html={reader_html}
            onActiveHighlightChange={onReaderActiveHighlightChange}
            onImagePress={onReaderImagePress}
            onSelectionChange={onReaderSelectionChange}
            reload_key={reader_webview_reload_key}
            ref={reader_post_ref}
            theme={theme}
            text_scale={reader_text_scale}
            width={width}
          />
        ) : (
          <UnavailableBodyCard
            body="This item doesn't include readable body content in the current timeline payload."
            can_open_original={Boolean(original_url)}
            on_open_original={() => open_external_url(original_url)}
            scaled_text_styles={scaled_text_styles}
            theme={theme}
            title="No readable preview yet."
          />
        )}
      </Animated.View>
    </View>
  );
});

function ReaderPaneTabs({
  active_pane = "post",
  highlight_count = 0,
  onPressHighlightsPane,
  onPressPostPane,
  onPressRepliesPane,
  reply_count = 0,
  scaled_text_styles,
  theme,
}) {
  const reply_label = get_reply_count_label(reply_count);
  const highlight_label = get_highlight_count_label(highlight_count);
  const pane_options = React.useMemo(() => {
    const options = [
      {
        key: "post",
        label: "Post",
        on_press: onPressPostPane,
      },
    ];

    if (reply_count > 0) {
      options.push({
        key: "replies",
        label: reply_label,
        on_press: onPressRepliesPane,
      });
    }

    if (highlight_count > 0) {
      options.push({
        key: "highlights",
        label: highlight_label,
        on_press: onPressHighlightsPane,
      });
    }

    return options;
  }, [
    highlight_count,
    highlight_label,
    onPressHighlightsPane,
    onPressPostPane,
    onPressRepliesPane,
    reply_count,
    reply_label,
  ]);
  const [pane_frames, set_pane_frames] = React.useState({});
  const active_pane_offset = useSharedValue(0);
  const active_pane_width = useSharedValue(0);

  const update_pane_frame = React.useCallback((pane_key, layout) => {
    set_pane_frames((current_frames) => {
      const previous_frame = current_frames[pane_key];

      if (
        previous_frame &&
        previous_frame.x === layout.x &&
        previous_frame.width === layout.width
      ) {
        return current_frames;
      }

      return {
        ...current_frames,
        [pane_key]: {
          width: layout.width,
          x: layout.x,
        },
      };
    });
  }, []);

  React.useEffect(() => {
    const active_frame = pane_frames[active_pane];

    active_pane_offset.value = withTiming(active_frame?.x || 0, {
      duration: 220,
    });
    active_pane_width.value = withTiming(active_frame?.width || 0, {
      duration: 220,
    });
  }, [active_pane, active_pane_offset, active_pane_width, pane_frames]);

  const active_pane_style = useAnimatedStyle(() => {
    return {
      opacity: active_pane_width.value > 0 ? 1 : 0,
      transform: [
        {
          translateX: active_pane_offset.value,
        },
      ],
      width: active_pane_width.value,
    };
  }, []);
  const active_pane_pill_style = theme.isDark
    ? {
        backgroundColor: theme.colors.buttonGhost,
        borderWidth: 0,
      }
    : {
        backgroundColor: theme.colors.paper,
        borderColor: theme.colors.line,
      };

  return (
    <Animated.View
      entering={READER_PANE_TABS_ENTERING}
      layout={READER_PANE_LAYOUT_TRANSITION}
      style={styles.readerPaneTabsWrap}
    >
      <View
        style={[
          styles.readerPaneTabs,
          {
            backgroundColor: theme.colors.badge,
            borderColor: theme.colors.line,
            shadowColor: theme.colors.shadow,
          },
        ]}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.readerPaneActivePill,
            active_pane_pill_style,
            active_pane_style,
          ]}
        />
        {pane_options.map((option) => {
          const is_active = option.key === active_pane;

          return (
            <ReaderPaneButton
              is_active={is_active}
              key={option.key}
              label={option.label}
              onLayout={(event) => {
                update_pane_frame(option.key, event.nativeEvent.layout);
              }}
              onPress={option.on_press}
              scaled_text_styles={scaled_text_styles}
              theme={theme}
            />
          );
        })}
      </View>
    </Animated.View>
  );
}

function ReaderPaneButton({
  is_active = false,
  label = "",
  onLayout,
  onPress,
  scaled_text_styles,
  theme,
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: is_active }}
      onLayout={onLayout}
      onPress={onPress}
      style={({ pressed }) => {
        return [
          styles.readerPaneButton,
          {
            backgroundColor: "transparent",
            borderColor: "transparent",
            opacity: pressed ? 0.84 : 1,
          },
        ];
      }}
    >
      <Text
        style={[
          styles.readerPaneButtonLabel,
          scaled_text_styles.readerPaneButtonLabel,
          {
            color: is_active ? theme.colors.ink : theme.colors.inkSoft,
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function RepliesListView({
  onPressProfile,
  replies = [],
  scaled_text_styles,
  theme,
  width = 0,
}) {
  return (
    <View style={styles.repliesList}>
      {replies.map((reply, index) => {
        return (
          <ReplyRow
            key={resolve_reply_key(reply, index)}
            onPressProfile={onPressProfile}
            reply={reply}
            scaled_text_styles={scaled_text_styles}
            theme={theme}
            width={width}
          />
        );
      })}
    </View>
  );
}

function HighlightsListView({
  deleting_highlight_id = "",
  highlights = [],
  onCopyHighlight,
  onDeleteHighlight,
  onPostHighlight,
  theme,
}) {
  return (
    <View style={styles.highlightsList}>
      {highlights.map((highlight) => {
        return (
          <HighlightItem
            entry={highlight}
            is_copied={false}
            is_deleting={deleting_highlight_id === highlight.id}
            key={highlight.id}
            onCopyPress={onCopyHighlight}
            onDeletePress={onDeleteHighlight}
            onPostPress={onPostHighlight}
            theme={theme}
          />
        );
      })}
    </View>
  );
}

function ReplyRow({
  onPressProfile,
  reply,
  scaled_text_styles,
  theme,
  width = 0,
}) {
  const author_name = get_reply_author_name(reply);
  const author_url = normalize_http_url(reply?.author?.url);
  const profile_username = resolve_reply_profile_username(reply);
  const formatted_date = format_reply_date(reply?.date_published);
  const reply_html = resolve_reply_html(reply);
  const can_open_profile = Boolean(profile_username && onPressProfile);
  const avatar = (
    <FeedDetailAvatar
      avatar_url={reply?.author?.avatar}
      size={REPLY_AVATAR_SIZE}
      source={author_name}
      theme={theme}
    />
  );

  return (
    <View style={styles.replyRow}>
      {can_open_profile ? (
        <Pressable
          accessibilityLabel={`Open @${profile_username} profile`}
          accessibilityRole="button"
          hitSlop={6}
          onPress={() => {
            onPressProfile?.({
              avatar_url: `${reply?.author?.avatar || ""}`.trim(),
              display_name: author_name,
              profile_url: author_url,
              username: profile_username,
            });
          }}
          style={({ pressed }) => {
            return {
              opacity: pressed ? 0.78 : 1,
            };
          }}
        >
          {avatar}
        </Pressable>
      ) : (
        avatar
      )}
      <View style={styles.replyBody}>
        <MetaLink
          color={theme.colors.ink}
          label={author_name}
          onPress={author_url ? () => open_external_url(author_url) : null}
          style={[styles.replyAuthor, scaled_text_styles.replyAuthor]}
        />
        {reply_html ? (
          <ReplyHtml html={reply_html} theme={theme} width={width} />
        ) : null}
        {formatted_date ? (
          <Text
            style={[
              styles.replyDate,
              scaled_text_styles.replyDate,
              { color: theme.colors.inkSoft },
            ]}
          >
            {formatted_date}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function resolve_reply_profile_username(reply = null) {
  const micro_blog_username = `${reply?.author?._microblog?.username || ""}`
    .trim()
    .replace(/^@+/, "");

  if (micro_blog_username) {
    return micro_blog_username;
  }

  const author_url = normalize_http_url(reply?.author?.url);

  if (!author_url) {
    return "";
  }

  try {
    const parsed_url = new URL(author_url);
    const hostname = `${parsed_url.hostname || ""}`.toLowerCase();

    if (hostname !== "micro.blog" && hostname !== "www.micro.blog") {
      return "";
    }

    const username = `${parsed_url.pathname || ""}`
      .split("/")
      .filter(Boolean)[0];

    return `${username || ""}`.replace(/^@+/, "");
  } catch {
    return "";
  }
}

function ReplyHtml({ html = "", theme, width = 0 }) {
  const [content_height, set_content_height] = React.useState(
    READER_WEBVIEW_MIN_HEIGHT,
  );
  const content_width = Math.max(
    Math.min(
      width - READER_HORIZONTAL_PADDING * 2 - READER_REPLY_CONTENT_WIDTH_OFFSET,
      READER_COLUMN_MAX_WIDTH,
    ),
    0,
  );
  const resolved_base_url = "https://example.com/";
  const document_html = React.useMemo(() => {
    return create_reply_document_html({
      base_url: resolved_base_url,
      content_max_width: Math.max(
        Math.min(content_width, READER_WEBVIEW_CONTENT_MAX_WIDTH),
        0,
      ),
      html,
      theme,
    });
  }, [
    content_width,
    html,
    resolved_base_url,
    theme.colors.accentStrong,
    theme.colors.badge,
    theme.colors.inkSoft,
    theme.colors.line,
  ]);
  const webview_source = React.useMemo(() => {
    return {
      baseUrl: resolved_base_url,
      html: document_html,
    };
  }, [document_html, resolved_base_url]);

  React.useEffect(() => {
    set_content_height(READER_WEBVIEW_MIN_HEIGHT);
  }, [document_html]);

  const handle_message = React.useCallback((event) => {
    const raw_data = `${event?.nativeEvent?.data || ""}`.trim();

    if (!raw_data) {
      return;
    }

    try {
      const payload = JSON.parse(raw_data);

      if (payload?.type === "height") {
        const next_height = Number(payload?.value);

        if (Number.isFinite(next_height)) {
          set_content_height(Math.max(Math.ceil(next_height), 1));
        }
        return;
      }

      if (payload?.type === "link") {
        open_external_url(payload?.href);
        return;
      }

      if (payload?.type === "image") {
        open_external_url(payload?.image_url || payload?.image_src);
      }
    } catch {
      // Ignore malformed bridge events from the embedded document.
    }
  }, []);

  const handle_should_start = React.useCallback((request) => {
    const request_url = `${request?.url || ""}`.trim();
    const navigation_type = `${request?.navigationType || ""}`
      .trim()
      .toLowerCase();

    if (
      !request_url ||
      request_url.startsWith("about:") ||
      request_url.startsWith("data:text/html") ||
      request_url === resolved_base_url ||
      (navigation_type && navigation_type !== "click")
    ) {
      return true;
    }

    const normalized_url = normalize_http_url(request_url, {
      base_url: resolved_base_url,
    });

    if (!normalized_url) {
      return false;
    }

    open_external_url(normalized_url);
    return false;
  }, []);

  return (
    <View style={styles.replyWebViewFrame}>
      <WebView
        androidLayerType="hardware"
        automaticallyAdjustContentInsets={false}
        bounces={false}
        javaScriptEnabled
        onMessage={handle_message}
        onShouldStartLoadWithRequest={handle_should_start}
        originWhitelist={["*"]}
        scrollEnabled={false}
        setSupportMultipleWindows={false}
        showsVerticalScrollIndicator={false}
        source={webview_source}
        style={[
          styles.replyWebView,
          {
            height: content_height,
          },
        ]}
      />
    </View>
  );
}

function ReaderTextSizeTray({
  onDismiss,
  onSlidingComplete,
  onValueChange,
  safe_area_bottom = 0,
  slider_index = 0,
  theme,
  visible = false,
}) {
  const visibility_progress = useSharedValue(visible ? 1 : 0);
  const swipe_close_responder = React.useMemo(() => {
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_event, gesture_state) => {
        if (!visible) {
          return false;
        }

        const horizontal_distance = Math.abs(gesture_state.dx);
        const vertical_distance = Math.abs(gesture_state.dy);

        return (
          gesture_state.dy > 8 &&
          vertical_distance > horizontal_distance &&
          vertical_distance > 10
        );
      },
      onPanResponderRelease: (_event, gesture_state) => {
        if (gesture_state.dy > 56 || gesture_state.vy > 0.9) {
          onDismiss?.();
        }
      },
      onPanResponderTerminate: (_event, gesture_state) => {
        if (gesture_state.dy > 56 || gesture_state.vy > 0.9) {
          onDismiss?.();
        }
      },
    });
  }, [onDismiss, visible]);

  React.useEffect(() => {
    visibility_progress.value = withTiming(visible ? 1 : 0, {
      duration: visible ? 220 : 180,
    });
  }, [visibility_progress, visible]);

  const backdrop_style = useAnimatedStyle(() => {
    return {
      opacity: visibility_progress.value,
    };
  }, [visibility_progress]);

  const tray_style = useAnimatedStyle(() => {
    return {
      opacity: visibility_progress.value,
      transform: [
        {
          translateY: (1 - visibility_progress.value) * 48,
        },
      ],
    };
  }, [visibility_progress]);

  return (
    <View
      pointerEvents={visible ? "auto" : "none"}
      style={styles.readerTextSizeOverlay}
    >
      <Pressable
        accessibilityLabel="Close text size controls"
        accessibilityRole="button"
        onPress={onDismiss}
        style={StyleSheet.absoluteFill}
      >
        <Animated.View
          style={[
            styles.readerTextSizeBackdrop,
            backdrop_style,
            {
              backgroundColor: resolve_reader_text_size_backdrop_color(theme),
            },
          ]}
        />
      </Pressable>

      <Animated.View
        style={[
          styles.readerTextSizeTrayWrap,
          tray_style,
          {
            paddingBottom: safe_area_bottom + READER_TEXT_SIZE_TRAY_BOTTOM_GAP,
          },
        ]}
      >
        <View
          style={[
            styles.readerTextSizeTray,
            {
              backgroundColor: theme.colors.canvas,
              borderColor: theme.colors.line,
              shadowColor: theme.colors.shadow,
            },
          ]}
        >
          <View
            {...swipe_close_responder.panHandlers}
            style={styles.readerTextSizeSwipeArea}
          >
            <View
              style={[
                styles.readerTextSizeTrayHandle,
                {
                  backgroundColor: theme.colors.line,
                },
              ]}
            />

            <View style={styles.readerTextSizeTrayHeader}>
              <Text
                style={[
                  styles.readerTextSizeTrayTitle,
                  { color: theme.colors.ink },
                ]}
              >
                Text size
              </Text>
            </View>
          </View>

          <View style={styles.readerTextSizeSliderWrap}>
            <Slider
              maximumTrackTintColor={theme.colors.line}
              maximumValue={TEXT_SCALE_PRESET_COUNT - 1}
              minimumTrackTintColor={theme.colors.accent}
              minimumValue={0}
              onSlidingComplete={onSlidingComplete}
              onValueChange={onValueChange}
              step={1}
              thumbTintColor={theme.colors.accentStrong}
              value={slider_index}
            />
            <View style={styles.readerTextSizeSliderMarkersRow}>
              <Text
                style={[
                  styles.readerTextSizeSliderMarkerLabel,
                  { color: theme.colors.inkSoft },
                ]}
              >
                {formatTextScaleLabel(MIN_TEXT_SCALE)}
              </Text>
              <Text
                style={[
                  styles.readerTextSizeSliderMarkerLabel,
                  { color: theme.colors.accentStrong },
                ]}
              >
                {formatTextScaleLabel(DEFAULT_TEXT_SCALE)}
              </Text>
              <Text
                style={[
                  styles.readerTextSizeSliderMarkerLabel,
                  { color: theme.colors.inkSoft },
                ]}
              >
                {formatTextScaleLabel(MAX_TEXT_SCALE)}
              </Text>
            </View>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

function ReaderHighlightAction({
  action_group_style = "default",
  actions = [],
  safe_area_bottom = 0,
  theme,
}) {
  if (!Array.isArray(actions) || actions.length === 0) {
    return null;
  }

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.readerHighlightActionWrap,
        {
          paddingBottom: safe_area_bottom + 18,
        },
      ]}
    >
      <View
        style={[
          styles.readerHighlightActionRow,
          action_group_style === "joined"
            ? [
                styles.readerHighlightActionRowJoined,
                {
                  backgroundColor: theme.colors.canvas,
                  borderColor: theme.colors.line,
                  shadowColor: theme.colors.shadow,
                },
              ]
            : null,
        ]}
      >
        {actions.map((action, index) => {
          return (
            <ReaderHighlightActionButton
              action={action}
              action_group_style={action_group_style}
              is_primary={index === 0}
              key={`${action?.label || "reader-action"}-${index}`}
              theme={theme}
            />
          );
        })}
      </View>
    </View>
  );
}

function ReaderHighlightActionButton({
  action = {},
  action_group_style = "default",
  is_primary = false,
  theme,
}) {
  const is_destructive = action?.is_destructive === true;
  const is_loading = action?.is_loading === true;
  const is_disabled = action?.is_disabled === true || is_loading;
  const resolved_label = is_loading
    ? action?.loading_label || action?.label || "Working..."
    : action?.label || "Reader action";
  const accessibility_label = is_loading
    ? action?.loading_label || resolved_label
    : action?.label || resolved_label;
  const background_color = resolve_reader_highlight_action_background_color({
    is_destructive,
    is_primary,
    theme,
  });
  const border_color = resolve_reader_highlight_action_border_color({
    is_destructive,
    is_primary,
    theme,
  });
  const label_color = resolve_reader_highlight_action_label_color({
    is_destructive,
    is_loading,
    is_primary,
    theme,
  });
  const resolved_background_color =
    action_group_style === "joined"
      ? resolve_reader_highlight_toolbar_action_background_color({
          is_destructive,
          is_primary,
          theme,
        })
      : background_color;
  const resolved_border_color =
    action_group_style === "joined" ? "transparent" : border_color;
  const resolved_label_color =
    action_group_style === "joined"
      ? resolve_reader_highlight_toolbar_action_label_color({
          is_destructive,
          is_loading,
          is_primary,
          theme,
        })
      : label_color;
  const resolved_shadow_color =
    action_group_style === "joined" ? "transparent" : theme.colors.shadow;

  return (
    <Pressable
      accessibilityLabel={accessibility_label}
      accessibilityRole="button"
      disabled={is_disabled}
      onPress={action?.onPress}
      style={({ pressed }) => {
        return [
          styles.readerHighlightActionButton,
          !is_primary ? styles.readerHighlightActionButtonSecondary : null,
          action_group_style === "joined"
            ? styles.readerHighlightActionButtonJoined
            : null,
          action_group_style === "joined" && is_primary
            ? styles.readerHighlightActionButtonJoinedLeading
            : null,
          action_group_style === "joined" && !is_primary
            ? styles.readerHighlightActionButtonJoinedTrailing
            : null,
          action_group_style === "joined" && !is_primary
            ? styles.readerHighlightActionButtonJoinedAfterLeading
            : null,
          {
            backgroundColor: resolved_background_color,
            borderColor: resolved_border_color,
            opacity: is_disabled ? 0.72 : pressed ? 0.86 : 1,
            shadowColor: resolved_shadow_color,
          },
        ];
      }}
    >
      <Text
        style={[
          styles.readerHighlightActionLabel,
          {
            color: resolved_label_color,
          },
        ]}
      >
        {resolved_label}
      </Text>
    </Pressable>
  );
}

function resolve_reader_highlight_action_background_color({
  is_destructive = false,
  is_primary = false,
  theme,
}) {
  if (is_destructive) {
    return theme.isDark
      ? "rgba(72, 24, 37, 0.92)"
      : "rgba(255, 246, 249, 0.96)";
  }

  if (is_primary) {
    return theme.colors.accentStrong;
  }

  return theme.colors.canvas;
}

function resolve_reader_highlight_action_border_color({
  is_destructive = false,
  is_primary = false,
  theme,
}) {
  if (is_destructive) {
    return theme.isDark
      ? "rgba(255, 178, 197, 0.42)"
      : "rgba(166, 47, 73, 0.28)";
  }

  if (is_primary) {
    return theme.colors.accentStrong;
  }

  return theme.colors.line;
}

function resolve_reader_highlight_action_label_color({
  is_destructive = false,
  is_loading = false,
  is_primary = false,
  theme,
}) {
  if (is_loading) {
    return is_primary ? theme.colors.white : theme.colors.inkSoft;
  }

  if (is_destructive) {
    return theme.isDark ? "#ffd5df" : "#8f2341";
  }

  if (is_primary) {
    return theme.colors.white;
  }

  return theme.colors.accentStrong;
}

function resolve_reader_highlight_toolbar_action_background_color({
  is_destructive = false,
  is_primary = false,
  theme,
}) {
  if (is_destructive) {
    return "transparent";
  }

  if (is_primary) {
    return theme.isDark ? "rgba(255, 255, 255, 0.08)" : theme.colors.paper;
  }

  return "transparent";
}

function resolve_reader_highlight_toolbar_action_label_color({
  is_destructive = false,
  is_loading = false,
  is_primary = false,
  theme,
}) {
  if (is_destructive) {
    return theme.isDark ? "#ffd5df" : "#8f2341";
  }

  if (is_loading || is_primary) {
    return theme.colors.ink;
  }

  return theme.colors.inkSoft;
}

function ReaderImageViewerModal({
  image_alt = "",
  image_url = "",
  onRequestClose,
  safe_area_top = 0,
  theme,
  visible = false,
}) {
  const normalized_image_url = `${image_url || ""}`.trim();
  const [is_loading, set_is_loading] = React.useState(false);
  const [did_fail_to_load, set_did_fail_to_load] = React.useState(false);

  React.useEffect(() => {
    if (!visible || !normalized_image_url) {
      set_is_loading(false);
      set_did_fail_to_load(false);
      return;
    }

    set_is_loading(true);
    set_did_fail_to_load(false);
  }, [normalized_image_url, visible]);

  const viewer_source = React.useMemo(() => {
    if (!normalized_image_url) {
      return null;
    }

    return {
      baseUrl: normalized_image_url,
      html: create_reader_image_viewer_document_html({
        image_alt,
        image_url: normalized_image_url,
      }),
    };
  }, [image_alt, normalized_image_url]);

  const handle_load_end = React.useCallback(() => {
    set_is_loading(false);
  }, []);

  const handle_error = React.useCallback(() => {
    set_is_loading(false);
    set_did_fail_to_load(true);
  }, []);

  return (
    <Modal
      animationType="fade"
      onRequestClose={onRequestClose}
      presentationStyle="overFullScreen"
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View
        style={[
          styles.readerImageViewerOverlay,
          {
            backgroundColor: READER_IMAGE_MODAL_BACKGROUND,
          },
        ]}
      >
        <View
          pointerEvents="box-none"
          style={[
            styles.readerImageViewerHeader,
            {
              paddingTop: safe_area_top + 8,
            },
          ]}
        >
          <Pressable
            accessibilityLabel="Close image viewer"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onRequestClose}
            style={({ pressed }) => {
              return [
                styles.readerImageViewerCloseButton,
                {
                  backgroundColor: with_color_opacity(
                    theme?.colors?.canvas || "#ffffff",
                    theme?.isDark ? 0.18 : 0.82,
                  ),
                  borderColor: with_color_opacity(
                    theme?.colors?.line || "#d2d2d7",
                    theme?.isDark ? 0.34 : 0.76,
                  ),
                  opacity: pressed ? 0.82 : 1,
                },
              ];
            }}
          >
            <MaterialIcons
              color={theme?.colors?.ink || "#1d1d1f"}
              name="close"
              size={20}
            />
          </Pressable>
        </View>

        {viewer_source ? (
          <WebView
            androidLayerType="hardware"
            bounces={false}
            key={`reader-image-viewer-${normalized_image_url}`}
            onError={handle_error}
            onLoadEnd={handle_load_end}
            originWhitelist={["*"]}
            overScrollMode="never"
            scalesPageToFit
            scrollEnabled
            setBuiltInZoomControls
            setDisplayZoomControls={false}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            source={viewer_source}
            style={styles.readerImageViewerWebView}
          />
        ) : null}

        {is_loading ? (
          <View pointerEvents="none" style={styles.readerImageViewerLoading}>
            <ActivityIndicator color="#ffffff" size="small" />
          </View>
        ) : null}

        {did_fail_to_load ? (
          <View pointerEvents="none" style={styles.readerImageViewerError}>
            <Text style={styles.readerImageViewerErrorTitle}>
              We couldn&apos;t load this image.
            </Text>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const ReaderPostWebView = React.forwardRef(function ReaderPostWebView(
  {
    base_url = "",
    highlight_payload = [],
    html = "",
    onActiveHighlightChange,
    onImagePress,
    onSelectionChange,
    reload_key = 0,
    theme,
    text_scale = 1,
    width = 0,
  },
  forwarded_ref,
) {
  const webview_ref = React.useRef(null);
  const pending_selection_request_ref = React.useRef(null);
  const selection_request_id_ref = React.useRef(0);
  const [content_height, set_content_height] = React.useState(
    READER_WEBVIEW_MIN_HEIGHT,
  );
  const [did_finish_load, set_did_finish_load] = React.useState(false);
  const content_width = Math.max(
    Math.min(width - READER_HORIZONTAL_PADDING * 2, READER_COLUMN_MAX_WIDTH),
    0,
  );
  const serialized_highlight_payload = JSON.stringify(
    Array.isArray(highlight_payload) ? highlight_payload : [],
  );
  const resolved_base_url = React.useMemo(() => {
    return normalize_http_url(base_url) || "https://example.com/";
  }, [base_url]);
  const text_metrics = React.useMemo(() => {
    return resolve_reader_text_metrics(text_scale);
  }, [text_scale]);

  const document_html = React.useMemo(() => {
    return create_reader_post_document_html({
      base_url: resolved_base_url,
      caption_font_size: text_metrics.caption_font_size,
      caption_line_height: text_metrics.caption_line_height,
      content_max_width: Math.max(
        Math.min(content_width, READER_WEBVIEW_CONTENT_MAX_WIDTH),
        0,
      ),
      content_font_size: text_metrics.content_font_size,
      content_line_height: text_metrics.content_line_height,
      html,
      theme,
    });
  }, [
    text_metrics.caption_font_size,
    text_metrics.caption_line_height,
    content_width,
    html,
    resolved_base_url,
    text_metrics.content_font_size,
    text_metrics.content_line_height,
    theme.colors.accentStrong,
    theme.colors.badge,
    theme.colors.canvas,
    theme.colors.ink,
    theme.colors.inkSoft,
    theme.colors.line,
    theme.isDark,
  ]);
  const webview_source = React.useMemo(() => {
    return {
      baseUrl: resolved_base_url,
      html: document_html,
    };
  }, [document_html, resolved_base_url]);

  const apply_highlights = React.useCallback(() => {
    if (!webview_ref.current || !did_finish_load) {
      return;
    }

    webview_ref.current.injectJavaScript(
      `window.inkwellDetail?.restoreHighlights(${serialized_highlight_payload}); true;`,
    );
  }, [did_finish_load, serialized_highlight_payload]);

  const apply_text_scale = React.useCallback(() => {
    if (!webview_ref.current || !did_finish_load) {
      return;
    }

    webview_ref.current.injectJavaScript(
      `window.inkwellDetail?.applyTextScale(${JSON.stringify(
        text_metrics,
      )}); true;`,
    );
  }, [did_finish_load, text_metrics]);

  React.useEffect(() => {
    set_content_height(READER_WEBVIEW_MIN_HEIGHT);
    set_did_finish_load(false);
  }, [document_html]);

  React.useEffect(() => {
    apply_highlights();
  }, [apply_highlights]);

  React.useEffect(() => {
    apply_text_scale();
  }, [apply_text_scale]);

  React.useEffect(() => {
    return () => {
      if (pending_selection_request_ref.current?.resolve) {
        pending_selection_request_ref.current.resolve(null);
      }

      pending_selection_request_ref.current = null;
    };
  }, []);

  React.useImperativeHandle(
    forwarded_ref,
    () => ({
      clearSelection() {
        if (!webview_ref.current || !did_finish_load) {
          return Promise.resolve();
        }

        webview_ref.current.injectJavaScript(
          "window.inkwellDetail?.clearSelection(); true;",
        );
        return Promise.resolve();
      },

      requestSelectionPayload() {
        if (!webview_ref.current || !did_finish_load) {
          return Promise.resolve(null);
        }

        if (pending_selection_request_ref.current?.resolve) {
          pending_selection_request_ref.current.resolve(null);
        }

        selection_request_id_ref.current += 1;
        const request_id = `selection-${selection_request_id_ref.current}`;

        return new Promise((resolve) => {
          pending_selection_request_ref.current = {
            request_id,
            resolve,
          };

          webview_ref.current.injectJavaScript(
            `window.inkwellDetail?.requestSelectionPayload(${JSON.stringify(
              request_id,
            )}); true;`,
          );
        });
      },
    }),
    [did_finish_load],
  );

  const handle_message = React.useCallback(
    (event) => {
      const raw_data = `${event?.nativeEvent?.data || ""}`.trim();

      if (!raw_data) {
        return;
      }

      try {
        const payload = JSON.parse(raw_data);

        if (payload?.type === "height") {
          const next_height = Number(payload?.value);

          if (Number.isFinite(next_height)) {
            set_content_height(Math.max(Math.ceil(next_height), 1));
          }
          return;
        }

        if (payload?.type === "selection") {
          onSelectionChange?.(Boolean(payload?.has_selection));
          return;
        }

        if (payload?.type === "active_highlight") {
          onActiveHighlightChange?.(payload?.highlight_id || "");
          return;
        }

        if (payload?.type === "selection_payload") {
          const request_id = `${payload?.request_id || ""}`;
          const pending_request = pending_selection_request_ref.current;

          if (
            pending_request &&
            pending_request.request_id &&
            pending_request.request_id === request_id
          ) {
            pending_selection_request_ref.current = null;
            pending_request.resolve(payload?.value || null);
          }
          return;
        }

        if (payload?.type === "link") {
          open_external_url(payload?.href);
          return;
        }

        if (payload?.type === "image") {
          onImagePress?.(payload);
        }
      } catch {
        // Ignore malformed bridge events from the embedded document.
      }
    },
    [onActiveHighlightChange, onImagePress, onSelectionChange],
  );

  const handle_load_end = React.useCallback(() => {
    set_did_finish_load(true);
  }, []);

  const handle_should_start = React.useCallback(
    (request) => {
      const request_url = `${request?.url || ""}`.trim();
      const navigation_type = `${request?.navigationType || ""}`
        .trim()
        .toLowerCase();

      if (
        !request_url ||
        request_url.startsWith("about:") ||
        request_url.startsWith("data:text/html") ||
        request_url === resolved_base_url ||
        (navigation_type && navigation_type !== "click")
      ) {
        return true;
      }

      const normalized_url = normalize_http_url(request_url, {
        base_url,
      });

      if (!normalized_url) {
        return false;
      }

      open_external_url(normalized_url);
      return false;
    },
    [base_url, resolved_base_url],
  );

  return (
    <View style={styles.readerPostWebViewFrame}>
      <WebView
        androidLayerType="hardware"
        allowsFullscreenVideo
        allowsInlineMediaPlayback
        automaticallyAdjustContentInsets={false}
        bounces={false}
        containerStyle={styles.readerPostWebViewContainer}
        javaScriptEnabled
        key={`reader-post-webview-${reload_key}-${text_scale}`}
        onLoadEnd={handle_load_end}
        onMessage={handle_message}
        onShouldStartLoadWithRequest={handle_should_start}
        originWhitelist={["*"]}
        ref={webview_ref}
        scrollEnabled={false}
        setSupportMultipleWindows={false}
        showsVerticalScrollIndicator={false}
        source={webview_source}
        style={[
          styles.readerPostWebView,
          {
            height: content_height,
          },
        ]}
      />
    </View>
  );
});

function get_entry_menu_actions({
  entry = null,
  entry_source = "feed",
  is_bookmarked = false,
  original_url = "",
  theme,
}) {
  if (!entry) {
    return [];
  }

  const icon_color = theme?.colors?.ink;
  const bookmark_title =
    entry_source === "bookmark" || is_bookmarked ? "Unbookmark" : "Bookmark";
  const read_title = entry?.is_read ? "Mark as Unread" : "Mark as Read";
  const actions = [];

  if (original_url) {
    actions.push({
      id: "new_post",
      image: Platform.select({
        ios: "square.and.pencil",
      }),
      imageColor: icon_color,
      title: "New Post...",
    });
  }

  if (original_url) {
    actions.push({
      id: "copy_link",
      image: Platform.select({
        ios: "link",
      }),
      imageColor: icon_color,
      title: "Copy Link",
    });
  }

  if (entry_source !== "bookmark") {
    actions.push({
      id: "toggle_read",
      image: Platform.select({
        ios: entry?.is_read ? "button.programmable" : "circle",
      }),
      imageColor: icon_color,
      title: read_title,
    });
  }

  actions.push({
    id: "toggle_bookmark",
    image: Platform.select({
      ios: "star",
    }),
    imageColor: icon_color,
    title: bookmark_title,
  });

  actions.push({
    id: "text_size",
    image: Platform.select({
      ios: "textformat.size",
    }),
    imageColor: icon_color,
    title: "Text size",
  });

  if (original_url) {
    actions.push({
      id: "open_web",
      image: Platform.select({
        ios: "safari",
      }),
      imageColor: icon_color,
      title: "Open on Web",
    });
  }

  actions.push({
    id: "report_blog",
    image: Platform.select({
      ios: "exclamationmark.triangle",
    }),
    imageColor: icon_color,
    title: "Report",
  });

  return actions;
}

function HeaderEntryMenuButton({
  accessibility_label = "Open post actions",
  is_dark = false,
  menu_actions = [],
  onMenuAction,
  onMenuClose,
  onMenuOpen,
  theme,
}) {
  if (menu_actions.length === 0) {
    return null;
  }

  return (
    <MenuView
      accessibilityLabel={accessibility_label}
      actions={menu_actions}
      onCloseMenu={onMenuClose}
      onOpenMenu={onMenuOpen}
      onPressAction={({ nativeEvent }) => {
        onMenuAction?.(nativeEvent.event);
      }}
      shouldOpenOnLongPress={false}
      themeVariant={is_dark ? "dark" : "light"}
    >
      <View accessibilityRole="button" style={styles.headerMenuButton}>
        <MaterialIcons
          color={theme.colors.accentStrong}
          name="more-horiz"
          size={24}
        />
      </View>
    </MenuView>
  );
}

function MetaLink({ color, label, onPress, style }) {
  if (!label) {
    return null;
  }

  if (!onPress) {
    return <Text style={[style, { color }]}>{label}</Text>;
  } else {
    return (
      <Pressable accessibilityRole="link" hitSlop={6} onPress={onPress}>
        <Text style={[style, { color }]}>{label}</Text>
      </Pressable>
    );
  }
}

function resolve_entry_author_label(entry = null, source_label = "") {
  const author = normalize_reader_label(entry?.author);
  const source = normalize_reader_label(source_label);

  if (!author) {
    return "";
  }

  if (author.toLowerCase() === source.toLowerCase()) {
    return "";
  }

  return author;
}

function normalize_reader_label(value = "") {
  return `${value || ""}`.trim().replace(/\s+/g, " ");
}

function UnavailableScreen({
  body = "",
  scaled_text_styles,
  theme,
  title = "",
}) {
  return (
    <View style={styles.unavailableScreen}>
      <View style={styles.unavailableCopy}>
        <Text
          style={[
            styles.unavailableTitle,
            scaled_text_styles.unavailableTitle,
            { color: theme.colors.ink },
          ]}
        >
          {title}
        </Text>
        <Text
          style={[
            styles.unavailableBody,
            scaled_text_styles.unavailableBody,
            { color: theme.colors.inkSoft },
          ]}
        >
          {body}
        </Text>
      </View>
    </View>
  );
}

function UnavailableBodyCard({
  body = "",
  can_open_original = false,
  on_open_original,
  scaled_text_styles,
  theme,
  title = "",
}) {
  return (
    <View
      style={[
        styles.unavailableBodyCard,
        {
          backgroundColor: theme.colors.badge,
          borderColor: theme.colors.line,
        },
      ]}
    >
      <View style={styles.unavailableCopy}>
        <Text
          style={[
            styles.unavailableTitle,
            scaled_text_styles.unavailableTitle,
            { color: theme.colors.ink },
          ]}
        >
          {title}
        </Text>
        <Text
          style={[
            styles.unavailableBody,
            scaled_text_styles.unavailableBody,
            { color: theme.colors.inkSoft },
          ]}
        >
          {body}
        </Text>
      </View>

      {can_open_original ? (
        <Pressable
          accessibilityRole="link"
          onPress={on_open_original}
          style={[
            styles.openOriginalButton,
            {
              backgroundColor: theme.colors.buttonGhost,
              borderColor: theme.colors.line,
            },
          ]}
        >
          <Text
            style={[
              styles.openOriginalLabel,
              scaled_text_styles.openOriginalLabel,
              { color: theme.colors.ink },
            ]}
          >
            Open original post
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function FeedDetailAvatar({
  avatar_url = "",
  onPress,
  source = "",
  size = READER_AVATAR_SIZE,
  theme,
}) {
  const trimmed_avatar_url = `${avatar_url || ""}`.trim();
  const [did_fail_to_load, set_did_fail_to_load] = React.useState(false);
  const [is_image_loaded, set_is_image_loaded] = React.useState(false);
  const initial = get_source_avatar_initial(source);
  const should_show_image = trimmed_avatar_url && !did_fail_to_load;
  const should_show_initial =
    !trimmed_avatar_url || did_fail_to_load || !is_image_loaded;

  React.useEffect(() => {
    set_did_fail_to_load(false);
    set_is_image_loaded(false);
  }, [trimmed_avatar_url]);

  const avatar = (
    <View
      style={[
        styles.avatarFrame,
        {
          backgroundColor: theme.colors.accentSoft,
          borderRadius: size / 2,
          height: size,
          width: size,
        },
      ]}
    >
      <View style={styles.avatarPlaceholder}>
        {should_show_initial ? (
          <Text
            style={[
              styles.avatarInitial,
              {
                color: theme.colors.accentStrong,
                fontSize: Math.max(Math.round(size * 0.48), 12),
                lineHeight: Math.max(Math.round(size * 0.54), 14),
              },
            ]}
          >
            {initial}
          </Text>
        ) : null}
      </View>
      {should_show_image ? (
        <Image
          cachePolicy="memory-disk"
          contentFit="cover"
          onError={() => set_did_fail_to_load(true)}
          onLoad={() => set_is_image_loaded(true)}
          source={{ uri: trimmed_avatar_url }}
          style={styles.avatarImage}
          transition={READER_AVATAR_TRANSITION_MS}
        />
      ) : null}
    </View>
  );

  if (!onPress) {
    return avatar;
  }

  return (
    <Pressable
      accessibilityLabel={`Show posts from ${source || "this blog"}`}
      accessibilityRole="button"
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => {
        return {
          opacity: pressed ? 0.78 : 1,
        };
      }}
    >
      {avatar}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    alignItems: "center",
    flexGrow: 1,
  },
  headerBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  readerColumn: {
    maxWidth: READER_COLUMN_MAX_WIDTH,
    width: "100%",
  },
  masthead: {
    borderBottomWidth: 1,
    paddingBottom: 16,
    paddingTop: Platform.OS === "ios" ? 0 : 10,
  },
  feedHeaderRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
  },
  feedMeta: {
    flex: 1,
    gap: 4,
  },
  feedTitleRow: {
    alignItems: "center",
    flexDirection: "row",
  },
  sourceLabel: {
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 24,
  },
  feedDetailsRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  hostLabel: {
    fontSize: 14,
    lineHeight: 20,
  },
  feedDetailSeparator: {
    fontSize: 13,
    lineHeight: 18,
  },
  dateLabel: {
    fontSize: 14,
    lineHeight: 20,
  },
  title: {
    // fontFamily: "Newsreader_600SemiBold",
    fontSize: READER_TITLE_FONT_SIZE,
    lineHeight: READER_TITLE_LINE_HEIGHT,
  },
  authorLabel: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
  },
  titleWrap: {
    marginTop: READER_TITLE_TOP_MARGIN,
  },
  bodySection: {
    paddingTop: Platform.OS === "ios" ? 20 : 24,
  },
  readerPostWebViewFrame: {
    width: "100%",
  },
  readerPostWebViewContainer: {
    backgroundColor: "transparent",
  },
  readerPostWebView: {
    backgroundColor: "transparent",
    width: "100%",
  },
  bodySectionWithPaneTabs: {
    paddingTop: 18,
  },
  readerPaneTabsWrap: {
    paddingTop: 18,
  },
  readerPaneTabs: {
    position: "relative",
    borderRadius: READER_PANE_CONTROL_RADIUS,
    borderWidth: 1,
    elevation: 2,
    flexDirection: "row",
    minHeight: READER_PANE_CONTROL_HEIGHT,
    padding: READER_PANE_CONTROL_INSET,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.08,
    shadowRadius: 14,
  },
  readerPaneActivePill: {
    position: "absolute",
    top: READER_PANE_CONTROL_INSET,
    bottom: READER_PANE_CONTROL_INSET,
    left: 0,
    borderRadius: READER_PANE_BUTTON_RADIUS,
    borderWidth: 1,
  },
  readerPaneButton: {
    alignItems: "center",
    borderRadius: READER_PANE_BUTTON_RADIUS,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: READER_PANE_BUTTON_HEIGHT,
    paddingHorizontal: 12,
    position: "relative",
    zIndex: 1,
  },
  readerPaneButtonLabel: {
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 16,
  },
  repliesList: {
    gap: 18,
  },
  highlightsList: {
    gap: 16,
  },
  replyRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
  },
  replyBody: {
    flex: 1,
    gap: 6,
    minWidth: 0,
  },
  replyWebViewFrame: {
    width: "100%",
  },
  replyWebView: {
    backgroundColor: "transparent",
    width: "100%",
  },
  replyAuthor: {
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
  },
  replyDate: {
    fontSize: 12,
    lineHeight: 18,
  },
  recapSettingsCard: {
    borderRadius: 22,
    borderWidth: 1,
    gap: 16,
    marginBottom: 22,
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  recapSettingsHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  recapSettingsCopy: {
    flex: 1,
    gap: 8,
  },
  recapSettingsTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },
  recapSettingsTitle: {
    // fontFamily: "Newsreader_600SemiBold",
    fontSize: 18,
    lineHeight: 28,
  },
  recapSettingsBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  recapDayWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  recapDayChip: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    minWidth: 54,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  recapDayChipCompact: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  recapDayChipWithIcon: {
    paddingRight: 10,
  },
  recapDayChipLabel: {
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 16,
    textAlign: "center",
  },
  recapBookmarkError: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  recapCard: {
    borderRadius: 24,
    borderWidth: 1,
    marginBottom: 22,
    overflow: "hidden",
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  recapHeaderGroup: {
    alignItems: "center",
    columnGap: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 14,
    rowGap: 8,
  },
  recapHeader: {
    alignItems: "center",
    flexDirection: "row",
    flexShrink: 1,
    gap: 10,
    minWidth: 0,
  },
  recapHeaderTitle: {
    flexShrink: 1,
    fontFamily: "Newsreader_600SemiBold",
    fontSize: 28,
    lineHeight: 32,
  },
  recapFaviconFrame: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    overflow: "hidden",
  },
  recapFaviconInitial: {
    fontFamily: "Newsreader_700Bold",
    fontSize: 13,
    lineHeight: 15,
  },
  recapFaviconImage: {
    ...StyleSheet.absoluteFillObject,
  },
  recapTopics: {
    alignItems: "center",
    flexDirection: "row",
    flexShrink: 1,
    flexWrap: "wrap",
    gap: 6,
    marginLeft: "auto",
  },
  recapTopicPill: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 34,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  recapTopicLabel: {
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 16,
  },
  recapPhotoStrip: {
    alignItems: "flex-start",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 20,
    marginTop: 2,
  },
  recapPhotoTile: {
    borderRadius: 14,
    height: 96,
    overflow: "hidden",
    width: 96,
  },
  recapPhotoTileImage: {
    height: "100%",
    width: "100%",
  },
  recapPhotoTileFallback: {
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    height: "100%",
    justifyContent: "center",
    paddingHorizontal: 10,
    width: "100%",
  },
  recapPhotoTileFallbackLabel: {
    fontSize: 11,
    lineHeight: 15,
    textAlign: "center",
  },
  recapQuoteRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    width: "100%",
  },
  recapQuoteMain: {
    flex: 1,
    minWidth: 0,
  },
  recapQuoteButton: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 34,
    paddingHorizontal: 12,
  },
  recapQuoteButtonLabel: {
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
  },
  headerMenuButton: {
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  unavailableBodyCard: {
    gap: 16,
    paddingBottom: 12,
    paddingTop: 6,
  },
  unavailableScreen: {
    maxWidth: READER_COLUMN_MAX_WIDTH,
    paddingTop: 40,
    width: "100%",
  },
  unavailableCopy: {
    gap: 8,
  },
  unavailableTitle: {
    fontFamily: "Newsreader_600SemiBold",
    fontSize: 24,
    lineHeight: 30,
  },
  unavailableBody: {
    fontSize: 15,
    lineHeight: 23,
  },
  openOriginalButton: {
    alignSelf: "flex-start",
    paddingVertical: 6,
  },
  openOriginalLabel: {
    fontSize: 15,
    fontWeight: "700",
  },
  readerTextSizeOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    zIndex: 4,
  },
  readerImageViewerOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  readerImageViewerHeader: {
    left: 0,
    paddingHorizontal: READER_HORIZONTAL_PADDING,
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 2,
  },
  readerImageViewerCloseButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: READER_IMAGE_MODAL_CLOSE_BUTTON_SIZE / 2,
    borderWidth: 1,
    height: READER_IMAGE_MODAL_CLOSE_BUTTON_SIZE,
    justifyContent: "center",
    width: READER_IMAGE_MODAL_CLOSE_BUTTON_SIZE,
  },
  readerImageViewerWebView: {
    backgroundColor: "transparent",
    flex: 1,
  },
  readerImageViewerLoading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  readerImageViewerError: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  readerImageViewerErrorTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 22,
    textAlign: "center",
  },
  readerHighlightActionWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingHorizontal: READER_HORIZONTAL_PADDING,
    zIndex: 3,
  },
  readerHighlightActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "center",
  },
  readerHighlightActionRowJoined: {
    alignSelf: "center",
    borderRadius: 20,
    borderWidth: 1,
    flexWrap: "nowrap",
    gap: 4,
    justifyContent: "center",
    maxWidth: 320,
    padding: 4,
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    width: "100%",
    elevation: 4,
  },
  readerHighlightActionButton: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    minWidth: 112,
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 5,
  },
  readerHighlightActionButtonJoined: {
    borderRadius: 14,
    borderWidth: 0,
    flex: 1,
    minWidth: 0,
    minHeight: 36,
    paddingHorizontal: 14,
    paddingVertical: 8,
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  readerHighlightActionButtonJoinedLeading: {
    borderBottomRightRadius: 14,
    borderTopRightRadius: 14,
  },
  readerHighlightActionButtonJoinedTrailing: {
    borderBottomLeftRadius: 14,
    borderTopLeftRadius: 14,
  },
  readerHighlightActionButtonJoinedAfterLeading: {
    marginLeft: 0,
  },
  readerHighlightActionButtonSecondary: {
    minWidth: 120,
  },
  readerHighlightActionLabel: {
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 16,
    textAlign: "center",
  },
  readerTextSizeBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  readerTextSizeTrayWrap: {
    paddingHorizontal: READER_HORIZONTAL_PADDING,
  },
  readerTextSizeTray: {
    borderBottomLeftRadius: READER_TEXT_SIZE_TRAY_RADIUS,
    borderBottomRightRadius: READER_TEXT_SIZE_TRAY_RADIUS,
    borderTopLeftRadius: READER_TEXT_SIZE_TRAY_RADIUS,
    borderTopRightRadius: READER_TEXT_SIZE_TRAY_RADIUS,
    borderWidth: 1,
    overflow: "hidden",
    paddingBottom: 18,
    paddingHorizontal: 18,
    paddingTop: 10,
    shadowOffset: {
      width: 0,
      height: READER_TEXT_SIZE_TRAY_SHADOW_HEIGHT,
    },
    shadowOpacity: 0.14,
    shadowRadius: READER_TEXT_SIZE_TRAY_SHADOW_RADIUS,
    elevation: 6,
  },
  readerTextSizeSwipeArea: {
    paddingBottom: 4,
  },
  readerTextSizeTrayHandle: {
    alignSelf: "center",
    borderRadius: 999,
    height: 5,
    marginBottom: 16,
    width: 42,
  },
  readerTextSizeTrayHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
  },
  readerTextSizeTrayTitle: {
    fontSize: 22,
    fontWeight: "700",
    lineHeight: 28,
  },
  readerTextSizeSliderWrap: {
    marginTop: 10,
  },
  readerTextSizeSliderMarkersRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  readerTextSizeSliderMarkerLabel: {
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 16,
  },
  avatarFrame: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    fontFamily: "Newsreader_700Bold",
  },
  avatarImage: {
    ...StyleSheet.absoluteFillObject,
  },
});

export {
  EntryReaderView,
  FeedDetailAvatar,
  HeaderEntryMenuButton,
  ReaderHighlightAction,
  ReaderImageViewerModal,
  ReaderTextSizeTray,
  RecapReaderView,
  UnavailableScreen,
  get_entry_menu_actions,
};
