import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { WebView } from "react-native-webview";

import {
  READER_AVATAR_TRANSITION_MS,
  READER_COLUMN_MAX_WIDTH,
  READER_HORIZONTAL_PADDING,
  READER_REPLY_CONTENT_WIDTH_OFFSET,
  READER_WEBVIEW_CONTENT_MAX_WIDTH,
  READER_WEBVIEW_MIN_HEIGHT,
  REPLY_AVATAR_SIZE,
  create_reply_document_html,
  format_reply_date,
  get_reply_author_name,
  get_source_avatar_initial,
  normalize_http_url,
  open_external_url,
  resolve_reply_html,
  resolve_reply_key,
} from "./feedItemDetailUtils";

export default function RepliesListView({
  onPressProfile,
  onPressReply,
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
            onPressReply={onPressReply}
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

function ReplyRow({
  onPressProfile,
  onPressReply,
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
  const can_reply = Boolean(profile_username && onPressReply);
  const reply_post_id = `${reply?.id || ""}`.trim();
  const should_show_footer = Boolean(formatted_date || can_reply);
  const avatar = (
    <ReplyAvatar
      avatar_url={reply?.author?.avatar}
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
        {should_show_footer ? (
          <View style={styles.replyFooterRow}>
            {formatted_date ? (
              <Text
                numberOfLines={1}
                style={[
                  styles.replyDate,
                  scaled_text_styles.replyDate,
                  { color: theme.colors.inkSoft },
                ]}
              >
                {formatted_date}
              </Text>
            ) : (
              <View />
            )}
            {can_reply ? (
              <Pressable
                accessibilityLabel={`Reply to @${profile_username}`}
                accessibilityRole="button"
                disabled={!reply_post_id}
                hitSlop={6}
                onPress={() => {
                  onPressReply?.({
                    display_name: author_name,
                    post_id: reply_post_id,
                    username: profile_username,
                  });
                }}
                style={({ pressed }) => {
                  return [
                    styles.replyButton,
                    {
                      backgroundColor: theme.colors.buttonGhost,
                      borderColor: theme.colors.line,
                      opacity: !reply_post_id ? 0.5 : pressed ? 0.78 : 1,
                    },
                  ];
                }}
              >
                <Text
                  style={[
                    styles.replyButtonLabel,
                    { color: theme.colors.accentStrong },
                  ]}
                >
                  Reply
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

function MetaLink({ color, label, onPress, style }) {
  if (!label) {
    return null;
  }

  const content = <Text style={[style, { color }]}>{label}</Text>;

  if (!onPress) {
    return content;
  } else {
    return (
      <Pressable
        accessibilityRole="link"
        hitSlop={6}
        onPress={onPress}
        style={({ pressed }) => (pressed ? styles.pressedMetaLink : null)}
      >
        {content}
      </Pressable>
    );
  }
}

function ReplyAvatar({ avatar_url = "", source = "", theme }) {
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

  return (
    <View
      style={[
        styles.avatarFrame,
        {
          backgroundColor: theme.colors.accentSoft,
          borderRadius: REPLY_AVATAR_SIZE / 2,
          height: REPLY_AVATAR_SIZE,
          width: REPLY_AVATAR_SIZE,
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
                fontSize: Math.max(Math.round(REPLY_AVATAR_SIZE * 0.48), 12),
                lineHeight: Math.max(Math.round(REPLY_AVATAR_SIZE * 0.54), 14),
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

const styles = StyleSheet.create({
  repliesList: {
    gap: 18,
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
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
  replyFooterRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
  },
  replyButton: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 30,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  replyButtonLabel: {
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
  },
  pressedMetaLink: {
    opacity: 0.72,
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
