import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { observer } from "mobx-react";
import { WebView } from "react-native-webview";
import Animated from "react-native-reanimated";

import Feed from "../../stores/Feed";
import {
  READER_COLUMN_MAX_WIDTH,
  READER_HORIZONTAL_PADDING,
  READER_WEBVIEW_CONTENT_MAX_WIDTH,
  READER_WEBVIEW_MIN_HEIGHT,
  RECAP_EMAIL_DAYS,
  RECAP_SETTINGS_LAYOUT_TRANSITION,
  RECAP_SETTINGS_ROW_ENTERING,
  RECAP_SETTINGS_ROW_EXITING,
  create_recap_document_html,
  decorate_recap_html,
  get_recap_day_chip_label,
  get_recap_day_summary_label,
  normalize_http_url,
  open_external_url,
  sanitize_reader_html,
} from "./feedItemDetailUtils";

const RecapReaderView = observer(function RecapReaderView({
  onReaderImagePress,
  scaled_text_styles,
  theme,
  width = 0,
}) {
  const recap = Feed.active_recap_snapshot();
  const recap_email_day = Feed.recap_email_day;
  const is_loading_recap_email_settings = Feed.is_loading_recap_email_settings;
  const is_saving_recap_email_settings = Feed.is_saving_recap_email_settings;
  const is_recap_email_enabled = Feed.is_recap_email_enabled();
  const recap_bookmark_error_message = Feed.recap_bookmark_error_message;
  const recap_bookmarked_quote_urls = Feed.recap_bookmarked_quote_urls.slice();
  const bookmarking_recap_quote_url =
    `${Feed.bookmarking_recap_quote_url || ""}`.trim();
  const sanitized_recap_html = sanitize_reader_html(`${recap?.html || ""}`.trim());
  const recap_html = decorate_recap_html(sanitized_recap_html, {
    bookmarked_quote_urls: recap_bookmarked_quote_urls,
    bookmarking_quote_url: bookmarking_recap_quote_url,
  });
  const has_renderable_body = Boolean(recap_html);

  React.useEffect(() => {
    if (recap) {
      Feed.load_recap_email_settings();
    }
  }, [recap?.requested_at]);

  if (!recap) {
    return null;
  }

  return (
    <View style={styles.readerColumn}>
      <View>
        <RecapEmailSettingsCard
          is_enabled={is_recap_email_enabled}
          is_loading={is_loading_recap_email_settings}
          is_saving={is_saving_recap_email_settings}
          selected_day={recap_email_day}
          scaled_text_styles={scaled_text_styles}
          theme={theme}
          onSelectDay={(dayofweek) => Feed.update_recap_email_day(dayofweek)}
        />

        {recap_bookmark_error_message ? (
          <Text
            style={[
              styles.recapBookmarkError,
              scaled_text_styles.recapBookmarkError,
              { color: theme.colors.accentStrong },
            ]}
          >
            {recap_bookmark_error_message}
          </Text>
        ) : null}

        {has_renderable_body ? (
          <RecapContentWebView
            bookmarked_quote_urls={recap_bookmarked_quote_urls}
            bookmarking_quote_url={bookmarking_recap_quote_url}
            html={recap_html}
            onBookmarkPress={(bookmark_url) => Feed.bookmark_recap_quote(bookmark_url)}
            onImagePress={onReaderImagePress}
            theme={theme}
            width={width}
          />
        ) : (
          <RecapUnavailableCard
            body="We couldn't render the current recap payload."
            scaled_text_styles={scaled_text_styles}
            theme={theme}
            title="No recap yet."
          />
        )}
      </View>
    </View>
  );
});

function RecapContentWebView({
  bookmarked_quote_urls = [],
  bookmarking_quote_url = "",
  html = "",
  onBookmarkPress,
  onImagePress,
  theme,
  width = 0,
}) {
  const [content_height, set_content_height] = React.useState(
    READER_WEBVIEW_MIN_HEIGHT,
  );
  const content_width = Math.max(
    Math.min(width - READER_HORIZONTAL_PADDING * 2, READER_COLUMN_MAX_WIDTH),
    0,
  );
  const normalized_base_url = "https://example.com/";
  const document_key = React.useMemo(() => {
    return [
      "recap-webview",
      bookmarking_quote_url,
      bookmarked_quote_urls.join("|"),
      Math.round(content_width),
      html.length,
    ].join("-");
  }, [bookmarked_quote_urls, bookmarking_quote_url, content_width, html.length]);
  const document_html = React.useMemo(() => {
    return create_recap_document_html({
      base_url: normalized_base_url,
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
    normalized_base_url,
    theme.colors.accentStrong,
    theme.colors.badge,
    theme.colors.ink,
    theme.colors.inkSoft,
    theme.colors.line,
    theme.colors.paper,
    theme.isDark,
  ]);
  const webview_source = React.useMemo(() => {
    return {
      baseUrl: normalized_base_url,
      html: document_html,
    };
  }, [document_html, normalized_base_url]);

  React.useEffect(() => {
    set_content_height(READER_WEBVIEW_MIN_HEIGHT);
  }, [document_html]);

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

        if (payload?.type === "link") {
          open_external_url(payload?.href);
          return;
        }

        if (payload?.type === "bookmark") {
          const bookmark_url = normalize_http_url(payload?.bookmark_url);

          if (bookmark_url) {
            onBookmarkPress?.(bookmark_url);
          }
          return;
        }

        if (payload?.type === "image") {
          if (typeof onImagePress === "function") {
            onImagePress(payload);
          } else {
            open_external_url(payload?.image_url || payload?.image_src);
          }
        }
      } catch {
        // Ignore malformed bridge events from the embedded document.
      }
    },
    [onBookmarkPress, onImagePress],
  );

  const handle_should_start = React.useCallback((request) => {
    const request_url = `${request?.url || ""}`.trim();
    const navigation_type = `${request?.navigationType || ""}`
      .trim()
      .toLowerCase();

    if (
      !request_url ||
      request_url.startsWith("about:") ||
      request_url.startsWith("data:text/html") ||
      request_url === normalized_base_url ||
      (navigation_type && navigation_type !== "click")
    ) {
      return true;
    }

    const normalized_url = normalize_http_url(request_url, {
      base_url: normalized_base_url,
    });

    if (!normalized_url) {
      return false;
    }

    open_external_url(normalized_url);
    return false;
  }, []);

  return (
    <View style={styles.recapWebViewFrame}>
      <WebView
        androidLayerType="hardware"
        automaticallyAdjustContentInsets={false}
        bounces={false}
        key={document_key}
        javaScriptEnabled
        onMessage={handle_message}
        onShouldStartLoadWithRequest={handle_should_start}
        originWhitelist={["*"]}
        scrollEnabled={false}
        setSupportMultipleWindows={false}
        showsVerticalScrollIndicator={false}
        source={webview_source}
        style={[
          styles.recapWebView,
          {
            height: content_height,
          },
        ]}
      />
    </View>
  );
}

function RecapEmailSettingsCard({
  is_enabled = false,
  is_loading = false,
  is_saving = false,
  onSelectDay,
  scaled_text_styles,
  selected_day = "",
  theme,
}) {
  const [is_expanded, set_is_expanded] = React.useState(false);
  const is_busy = is_loading || is_saving;
  const is_showing_loading_summary = is_loading && !is_saving && !selected_day;
  const summary_label = is_showing_loading_summary
    ? "Loading..."
    : is_enabled
      ? get_recap_day_summary_label(selected_day)
      : "Off";
  const collapsed_summary_selection_kind = is_enabled ? "accent" : "neutral";
  const expanded_summary_selection_kind = is_enabled ? "accent-soft" : "neutral";
  const helper_copy = "Send Reading Recap in a weekly email on:";

  async function handle_day_selection(next_dayofweek = "") {
    if (typeof onSelectDay !== "function" || is_busy) {
      return;
    }

    if (`${next_dayofweek || ""}`.trim() === `${selected_day || ""}`.trim()) {
      set_is_expanded(false);
      return;
    }

    const did_save = await onSelectDay(next_dayofweek);

    if (did_save) {
      set_is_expanded(false);
    }
  }

  return (
    <Animated.View
      layout={RECAP_SETTINGS_LAYOUT_TRANSITION}
      style={[
        styles.recapSettingsCard,
        {
          backgroundColor: theme.colors.badge,
          borderColor: theme.colors.line,
        },
      ]}
    >
      <View style={styles.recapSettingsHeader}>
        <View style={styles.recapSettingsCopy}>
          <Animated.View
            layout={RECAP_SETTINGS_LAYOUT_TRANSITION}
            style={styles.recapSettingsTitleRow}
          >
            <Text
              style={[
                styles.recapSettingsTitle,
                scaled_text_styles.recapSettingsTitle,
                { color: theme.colors.ink },
              ]}
            >
              Weekly email
            </Text>
            {!is_expanded ? (
              <Animated.View
                entering={RECAP_SETTINGS_ROW_ENTERING}
                exiting={RECAP_SETTINGS_ROW_EXITING}
                layout={RECAP_SETTINGS_LAYOUT_TRANSITION}
              >
                <RecapDayChip
                  disabled={is_showing_loading_summary || is_busy}
                  icon_name="expand-more"
                  is_compact
                  is_selected
                  label={summary_label}
                  onPress={() => set_is_expanded(true)}
                  scaled_text_styles={scaled_text_styles}
                  selection_kind={collapsed_summary_selection_kind}
                  theme={theme}
                />
              </Animated.View>
            ) : (
              <Animated.View
                entering={RECAP_SETTINGS_ROW_ENTERING}
                exiting={RECAP_SETTINGS_ROW_EXITING}
                layout={RECAP_SETTINGS_LAYOUT_TRANSITION}
              >
                <RecapDayChip
                  accessibility_label="Collapse weekly email settings"
                  disabled={is_busy}
                  icon_name="expand-less"
                  is_compact
                  is_selected
                  label={summary_label}
                  onPress={() => set_is_expanded(false)}
                  scaled_text_styles={scaled_text_styles}
                  selection_kind={expanded_summary_selection_kind}
                  theme={theme}
                />
              </Animated.View>
            )}
          </Animated.View>
          {is_expanded ? (
            <Text
              style={[
                styles.recapSettingsBody,
                scaled_text_styles.recapSettingsBody,
                { color: theme.colors.inkSoft },
              ]}
            >
              {helper_copy}
            </Text>
          ) : null}
        </View>
        {is_loading || is_saving ? (
          <ActivityIndicator color={theme.colors.accentStrong} size="small" />
        ) : null}
      </View>

      {is_expanded ? (
        <Animated.View
          entering={RECAP_SETTINGS_ROW_ENTERING}
          exiting={RECAP_SETTINGS_ROW_EXITING}
          layout={RECAP_SETTINGS_LAYOUT_TRANSITION}
          style={styles.recapDayWrap}
        >
          {RECAP_EMAIL_DAYS.map((dayofweek) => {
            return (
              <RecapDayChip
                disabled={is_busy}
                is_selected={selected_day === dayofweek}
                key={dayofweek}
                label={get_recap_day_chip_label(dayofweek)}
                onPress={() => handle_day_selection(dayofweek)}
                scaled_text_styles={scaled_text_styles}
                selection_kind="accent"
                theme={theme}
              />
            );
          })}

          <RecapDayChip
            disabled={is_busy}
            is_selected={!selected_day}
            label="Off"
            onPress={() => handle_day_selection("")}
            scaled_text_styles={scaled_text_styles}
            selection_kind="destructive"
            theme={theme}
          />
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

function RecapDayChip({
  accessibility_label = "",
  disabled = false,
  icon_name = "",
  is_compact = false,
  is_selected = false,
  label = "",
  onPress,
  scaled_text_styles,
  selection_kind = "accent",
  theme,
}) {
  const has_label = Boolean(label);
  const uses_accent_selection = is_selected && selection_kind === "accent";
  const uses_accent_soft_selection =
    is_selected && selection_kind === "accent-soft";
  const uses_neutral_selection = is_selected && selection_kind === "neutral";
  const uses_destructive_selection =
    is_selected && selection_kind === "destructive";
  const uses_destructive_treatment = selection_kind === "destructive";
  let background_color = theme.colors.paper;
  let border_color = theme.colors.line;
  let label_color = theme.colors.inkSoft;

  if (uses_accent_selection) {
    background_color = theme.colors.accent;
    border_color = theme.colors.accent;
    label_color = theme.colors.white;
  } else if (uses_accent_soft_selection) {
    background_color = theme.colors.accentSoft;
    border_color = theme.colors.accent;
    label_color = theme.colors.accentStrong;
  } else if (uses_neutral_selection) {
    background_color = theme.colors.paperMuted;
    border_color = theme.colors.inkSoft;
    label_color = theme.colors.ink;
  } else if (uses_destructive_selection) {
    background_color = theme.isDark
      ? "rgba(188, 84, 110, 0.28)"
      : "rgba(166, 47, 73, 0.12)";
    border_color = theme.isDark
      ? "rgba(255, 160, 182, 0.4)"
      : "rgba(166, 47, 73, 0.3)";
    label_color = theme.isDark ? "#ffb5c6" : "#942c49";
  } else if (uses_destructive_treatment) {
    background_color = theme.isDark
      ? "rgba(188, 84, 110, 0.12)"
      : "rgba(166, 47, 73, 0.05)";
    border_color = theme.isDark
      ? "rgba(255, 160, 182, 0.22)"
      : "rgba(166, 47, 73, 0.18)";
    label_color = theme.isDark ? "#f2a6ba" : "#a63b58";
  }

  return (
    <Pressable
      accessibilityLabel={accessibility_label || undefined}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => {
        return [
          styles.recapDayChip,
          is_compact ? styles.recapDayChipCompact : null,
          icon_name ? styles.recapDayChipWithIcon : null,
          {
            backgroundColor: background_color,
            borderColor: border_color,
            opacity: disabled ? 0.48 : pressed ? 0.84 : 1,
          },
        ];
      }}
    >
      {has_label ? (
        <Text
          style={[
            styles.recapDayChipLabel,
            scaled_text_styles.recapDayChipLabel,
            {
              color: label_color,
            },
          ]}
        >
          {label}
        </Text>
      ) : null}
      {icon_name ? (
        <MaterialIcons
          color={label_color}
          name={icon_name}
          size={is_compact ? 16 : 18}
        />
      ) : null}
    </Pressable>
  );
}

function RecapUnavailableCard({
  body = "",
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
    </View>
  );
}

const styles = StyleSheet.create({
  readerColumn: {
    maxWidth: READER_COLUMN_MAX_WIDTH,
    width: "100%",
  },
  recapWebViewFrame: {
    width: "100%",
  },
  recapWebView: {
    backgroundColor: "transparent",
    width: "100%",
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
  unavailableBodyCard: {
    gap: 16,
    paddingBottom: 12,
    paddingTop: 6,
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
});

export { RecapReaderView };
