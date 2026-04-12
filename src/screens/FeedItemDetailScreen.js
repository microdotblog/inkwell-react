import React from "react";
import {
  Alert,
  Platform,
  ScrollView,
  View,
  useWindowDimensions,
} from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import * as Clipboard from "expo-clipboard";
import { observer } from "mobx-react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fetch_micro_blog_conversation_replies } from "../api/MicroBlogFeeds";
import AuthBackground from "../components/auth/AuthBackground";
import {
  EntryReaderView,
  HeaderEntryMenuButton,
  ReaderHighlightAction,
  ReaderImageViewerModal,
  ReaderTextSizeTray,
  RecapReaderView,
  UnavailableScreen,
  get_entry_menu_actions,
  useFeedItemDetailScaledTextStyles,
} from "../components/feed_item_detail/FeedItemDetailViews";
import {
  open_micro_blog_entry_post,
  open_micro_blog_highlight_post,
} from "../components/highlights/highlightPostUtils";
import {
  READER_BOTTOM_PADDING,
  READER_HORIZONTAL_PADDING,
  create_reader_body_html,
  normalize_conversation_replies,
  normalize_http_url,
  open_external_url,
  resolve_detail_mode,
  resolve_entry_source,
  resolve_highlight_identifier,
  sanitize_reader_html,
} from "../components/feed_item_detail/feedItemDetailUtils";
import AppStore from "../stores/App";
import Bookmarks from "../stores/Bookmarks";
import Feed from "../stores/Feed";
import Highlights from "../stores/Highlights";
import Tokens from "../stores/Tokens";
import { getAuthTheme } from "../theme/authTheme";
import {
  getTextScaleForSliderIndex,
  getTextScaleSliderIndex,
} from "../theme/textScale";

function FeedItemDetailScreen({ navigation, route, isDark = false }) {
  const accent_palette_id = AppStore.accent_palette_id;
  const reader_text_scale = AppStore.reader_text_scale;
  const reader_text_scale_slider_index = React.useMemo(() => {
    return getTextScaleSliderIndex(reader_text_scale);
  }, [reader_text_scale]);
  const theme = getAuthTheme(isDark, accent_palette_id);
  const scaled_text_styles = useFeedItemDetailScaledTextStyles();
  const header_height = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const detail_mode = resolve_detail_mode(route?.params?.mode);
  const entry_source = resolve_entry_source(route?.params?.entry_source);
  const entry_id = `${route?.params?.entry_id || ""}`.trim();
  const entry =
    detail_mode === "entry"
      ? resolve_detail_entry_snapshot(entry_id, entry_source)
      : null;
  const recap = detail_mode === "recap" ? Feed.active_recap_snapshot() : null;
  const resolved_entry_id = `${entry?.id || entry_id || ""}`.trim();
  const source_label = `${entry?.source || "Feed"}`.trim() || "Feed";
  const source_url = normalize_http_url(entry?.source_url);
  const original_url = normalize_http_url(entry?.url);
  const reader_base_url = original_url || source_url;
  const has_entry_body = Boolean(
    sanitize_reader_html(create_reader_body_html(entry), {
      base_url: reader_base_url,
    }),
  );
  const header_title = detail_mode === "recap" ? "Reading Recap" : source_label;
  const has_entry_menu =
    detail_mode === "entry" && Boolean(entry) && Boolean(resolved_entry_id);
  const is_entry_bookmarked =
    entry_source === "bookmark"
      ? Boolean(entry)
      : Boolean(entry?.is_bookmarked);
  const toast_top_offset = header_height + 10;
  const content_top_padding = 12;
  const [active_pane, set_active_pane] = React.useState("post");
  const [deleting_highlight_id, set_deleting_highlight_id] = React.useState("");
  const [, set_is_loading_replies] = React.useState(false);
  const [replies, set_replies] = React.useState([]);
  const [has_reader_selection, set_has_reader_selection] = React.useState(false);
  const [active_reader_highlight_id, set_active_reader_highlight_id] =
    React.useState("");
  const [is_creating_highlight, set_is_creating_highlight] =
    React.useState(false);
  const [is_opening_reader_post, set_is_opening_reader_post] =
    React.useState(false);
  const [is_text_size_tray_visible, set_is_text_size_tray_visible] =
    React.useState(false);
  const [reader_image_viewer, set_reader_image_viewer] = React.useState(null);
  const [reader_webview_reload_key, set_reader_webview_reload_key] =
    React.useState(0);
  const replies_request_token_ref = React.useRef(0);
  const reader_post_ref = React.useRef(null);
  const active_reader_highlight = Highlights.entry_highlight_snapshot_by_identifier(
    resolved_entry_id,
    active_reader_highlight_id,
  );
  const highlight_count = Highlights.entry_highlight_entries(resolved_entry_id).length;
  const reply_count = replies.length;
  const reader_image_url = `${reader_image_viewer?.image_url || ""}`.trim();
  const is_reader_image_viewer_visible = Boolean(reader_image_url);
  const is_deleting_reader_highlight =
    Boolean(active_reader_highlight) &&
    deleting_highlight_id === active_reader_highlight.id;
  const should_show_highlight_action =
    detail_mode === "entry" &&
    Boolean(entry) &&
    active_pane === "post" &&
    has_entry_body &&
    !is_text_size_tray_visible &&
    (Boolean(active_reader_highlight) ||
      has_reader_selection ||
      is_creating_highlight);
  const entry_menu_actions = React.useMemo(() => {
    return get_entry_menu_actions({
      entry,
      entry_source,
      is_bookmarked: is_entry_bookmarked,
      original_url,
      theme,
    });
  }, [entry, entry_source, is_entry_bookmarked, original_url, theme]);

  React.useEffect(() => {
    const unsubscribe = navigation.addListener("blur", () => {
      set_is_text_size_tray_visible(false);
      set_reader_image_viewer(null);
    });

    return unsubscribe;
  }, [navigation]);

  React.useEffect(() => {
    if (detail_mode !== "entry" || !entry) {
      set_is_text_size_tray_visible(false);
    }
  }, [detail_mode, entry, resolved_entry_id]);

  React.useEffect(() => {
    set_reader_image_viewer(null);
  }, [detail_mode, recap?.requested_at, resolved_entry_id]);

  React.useEffect(() => {
    if (
      detail_mode !== "entry" ||
      !entry ||
      active_pane !== "post" ||
      !has_entry_body
    ) {
      set_has_reader_selection(false);
      set_active_reader_highlight_id("");
      set_is_creating_highlight(false);
    }
  }, [active_pane, detail_mode, entry, has_entry_body, resolved_entry_id]);

  React.useEffect(() => {
    if (
      active_reader_highlight_id &&
      !active_reader_highlight &&
      !is_deleting_reader_highlight
    ) {
      set_active_reader_highlight_id("");
    }
  }, [
    active_reader_highlight,
    active_reader_highlight_id,
    is_deleting_reader_highlight,
  ]);

  React.useEffect(() => {
    replies_request_token_ref.current += 1;
    const request_token = replies_request_token_ref.current;

    set_active_pane("post");
    set_replies([]);
    set_is_loading_replies(false);

    if (detail_mode !== "entry" || !original_url) {
      return;
    }

    let did_cancel = false;
    set_is_loading_replies(true);

    async function load_replies() {
      try {
        await Tokens.hydrate();
        const user_token = Tokens.get_user_token();

        if (!user_token) {
          return;
        }

        const payload = await fetch_micro_blog_conversation_replies({
          token: user_token,
          post_url: original_url,
        });

        if (did_cancel || replies_request_token_ref.current !== request_token) {
          return;
        }

        set_replies(normalize_conversation_replies(payload?.items));
      } catch (error) {
        if (did_cancel || replies_request_token_ref.current !== request_token) {
          return;
        }

        console.warn("Failed to load conversation replies", error);
        set_replies([]);
      } finally {
        if (did_cancel || replies_request_token_ref.current !== request_token) {
          return;
        }

        set_is_loading_replies(false);
      }
    }

    load_replies();

    return () => {
      did_cancel = true;
    };
  }, [detail_mode, entry_id, original_url]);

  React.useEffect(() => {
    if (active_pane === "replies" && reply_count === 0) {
      set_active_pane("post");
    } else if (active_pane === "highlights" && highlight_count === 0) {
      set_active_pane("post");
    }
  }, [active_pane, highlight_count, reply_count]);

  const handle_post_pane_press = React.useCallback(() => {
    set_active_pane("post");
  }, []);

  const handle_replies_pane_press = React.useCallback(() => {
    if (reply_count === 0) {
      return;
    }

    set_active_pane("replies");
  }, [reply_count]);

  const handle_highlights_pane_press = React.useCallback(() => {
    if (highlight_count === 0) {
      return;
    }

    set_active_pane("highlights");
  }, [highlight_count]);

  const handle_copy_highlight = React.useCallback(
    async (highlight_entry = null) => {
      const normalized_text = `${highlight_entry?.text || ""}`.trim();

      if (!normalized_text) {
        return;
      }

      try {
        await Clipboard.setStringAsync(normalized_text);
        AppStore.show_toast("Highlight copied", {
          top_offset: toast_top_offset,
        });
      } catch (error) {
        console.warn("Failed to copy highlight", error);
      }
    },
    [toast_top_offset],
  );

  const handle_delete_highlight = React.useCallback(
    (highlight_entry = null) => {
      const normalized_highlight_id = `${highlight_entry?.id || ""}`.trim();
      const active_highlight_identifier =
        active_reader_highlight_id || normalized_highlight_id;

      if (!normalized_highlight_id || deleting_highlight_id) {
        return;
      }

      Alert.alert(
        "Delete highlight?",
        "This removes the saved passage from your highlights.",
        [
          {
            style: "cancel",
            text: "Cancel",
          },
          {
            style: "destructive",
            text: "Delete",
            onPress: async () => {
              set_deleting_highlight_id(normalized_highlight_id);

              try {
                const result = await Highlights.delete_highlight(
                  normalized_highlight_id,
                );

                if (!result?.ok) {
                  AppStore.show_toast(
                    result?.error_message ||
                      "We could not delete that highlight.",
                    {
                      top_offset: toast_top_offset,
                    },
                  );
                  return;
                }

                AppStore.show_toast("Highlight deleted", {
                  top_offset: toast_top_offset,
                });
                set_reader_webview_reload_key((current_key) => current_key + 1);

                if (
                  does_highlight_match_identifier(
                    highlight_entry,
                    active_highlight_identifier,
                  )
                ) {
                  set_active_reader_highlight_id("");
                }
              } finally {
                set_deleting_highlight_id("");
              }
            },
          },
        ],
      );
    },
    [active_reader_highlight_id, deleting_highlight_id, toast_top_offset],
  );

  const handle_copy_link = React.useCallback(async () => {
    if (!original_url) {
      return false;
    }

    try {
      await Clipboard.setStringAsync(original_url);
      AppStore.show_toast("Link copied", {
        top_offset: toast_top_offset,
      });
      return true;
    } catch (error) {
      console.warn("Failed to copy link", error);
      return false;
    }
  }, [original_url, toast_top_offset]);

  const handle_text_size_tray_dismiss = React.useCallback(() => {
    set_is_text_size_tray_visible(false);
  }, []);

  const handle_reader_image_press = React.useCallback((payload = {}) => {
    const image_url = normalize_http_url(
      payload?.image_url || payload?.image_src,
    );

    if (!image_url) {
      return;
    }

    reader_post_ref.current?.clearSelection?.();
    set_has_reader_selection(false);
    set_active_reader_highlight_id("");
    set_is_text_size_tray_visible(false);
    set_reader_image_viewer({
      image_alt: `${payload?.image_alt || ""}`.trim(),
      image_url,
    });
  }, []);

  const handle_reader_image_viewer_dismiss = React.useCallback(() => {
    set_reader_image_viewer(null);
  }, []);

  const handle_reader_selection_change = React.useCallback(
    (next_has_selection = false) => {
      set_has_reader_selection(Boolean(next_has_selection));
    },
    [],
  );

  const handle_reader_active_highlight_change = React.useCallback(
    (next_highlight_id = "") => {
      set_active_reader_highlight_id(`${next_highlight_id || ""}`.trim());
    },
    [],
  );

  const handle_create_highlight = React.useCallback(async () => {
    if (
      is_creating_highlight ||
      !entry ||
      !resolved_entry_id ||
      !reader_post_ref.current
    ) {
      return;
    }

    const selection_payload =
      await reader_post_ref.current.requestSelectionPayload?.();
    const selection_text = `${selection_payload?.selection_text || ""}`;
    const trimmed_selection_text = selection_text.trim();
    const normalized_post_title = `${entry?.title || ""}`.trim();

    if (!trimmed_selection_text) {
      return;
    }

    set_is_creating_highlight(true);

    try {
      const result = await Highlights.create_highlight({
        end_offset: selection_payload?.end_offset,
        post_has_title:
          Boolean(normalized_post_title) &&
          normalized_post_title.toLowerCase() !== "untitled",
        post_id: resolved_entry_id,
        post_published_at: entry?.published_at,
        post_source: source_label,
        post_title: entry?.title,
        post_url: original_url,
        start_offset: selection_payload?.start_offset,
        text: selection_text,
      });

      if (!result?.ok) {
        AppStore.show_toast(
          result?.error_message || "We could not save that highlight.",
          {
            top_offset: toast_top_offset,
          },
        );
        return;
      }

      AppStore.show_toast("Highlight saved", {
        top_offset: toast_top_offset,
      });
    } finally {
      set_is_creating_highlight(false);
    }
  }, [
    entry,
    is_creating_highlight,
    original_url,
    resolved_entry_id,
    source_label,
    toast_top_offset,
  ]);

  const handle_create_post_from_selection = React.useCallback(async () => {
    if (
      is_opening_reader_post ||
      !entry ||
      !resolved_entry_id ||
      !reader_post_ref.current
    ) {
      return;
    }

    const selection_payload =
      await reader_post_ref.current.requestSelectionPayload?.();
    const selection_text = `${selection_payload?.selection_text || ""}`;
    const trimmed_selection_text = selection_text.trim();
    const normalized_post_title = `${entry?.title || ""}`.trim();

    if (!trimmed_selection_text) {
      return;
    }

    set_is_opening_reader_post(true);

    try {
      const did_open = await open_micro_blog_highlight_post(
        {
          text: selection_text,
        },
        {
          post_has_title:
            Boolean(normalized_post_title) &&
            normalized_post_title.toLowerCase() !== "untitled",
          post_source: source_label,
          post_title: entry?.title,
          post_url: original_url,
        },
      );

      if (!did_open) {
        AppStore.show_toast("We could not open Micro.blog.", {
          top_offset: toast_top_offset,
        });
      }
    } finally {
      set_is_opening_reader_post(false);
    }
  }, [
    entry,
    is_opening_reader_post,
    original_url,
    resolved_entry_id,
    source_label,
    toast_top_offset,
  ]);

  const handle_delete_reader_highlight = React.useCallback(() => {
    if (!active_reader_highlight || is_deleting_reader_highlight) {
      return;
    }

    handle_delete_highlight(active_reader_highlight);
  }, [
    active_reader_highlight,
    handle_delete_highlight,
    is_deleting_reader_highlight,
  ]);

  const handle_post_highlight = React.useCallback(
    async (highlight_entry = null) => {
      const normalized_post_title = `${entry?.title || ""}`.trim();
      const did_open = await open_micro_blog_highlight_post(highlight_entry, {
        post_has_title:
          Boolean(normalized_post_title) &&
          normalized_post_title.toLowerCase() !== "untitled",
        post_source: source_label,
        post_title: entry?.title,
        post_url: original_url,
      });

      if (!did_open) {
        AppStore.show_toast("We could not open Micro.blog.", {
          top_offset: toast_top_offset,
        });
      }
    },
    [entry?.title, original_url, source_label, toast_top_offset],
  );

  const handle_post_reader_highlight = React.useCallback(() => {
    if (!active_reader_highlight || is_deleting_reader_highlight) {
      return;
    }

    handle_post_highlight(active_reader_highlight);
  }, [
    active_reader_highlight,
    handle_post_highlight,
    is_deleting_reader_highlight,
  ]);

  const handle_reader_text_scale_change = React.useCallback(
    (next_slider_index = 0) => {
      AppStore.apply_reader_text_scale(
        getTextScaleForSliderIndex(next_slider_index),
      );
    },
    [],
  );

  const handle_reader_text_scale_commit = React.useCallback(
    (next_slider_index = 0) => {
      AppStore.set_reader_text_scale(
        getTextScaleForSliderIndex(next_slider_index),
      );
      set_reader_webview_reload_key((current_key) => current_key + 1);
    },
    [],
  );

  const handle_entry_menu_action = React.useCallback(
    async (menu_action_id = "") => {
      if (!has_entry_menu) {
        return;
      }

      if (menu_action_id === "text_size") {
        set_is_text_size_tray_visible(true);
        return;
      }

      set_is_text_size_tray_visible(false);

      if (menu_action_id === "copy_link") {
        await handle_copy_link();
        return;
      }

      if (menu_action_id === "new_post") {
        const normalized_post_title = `${entry?.title || ""}`.trim();
        const did_open = await open_micro_blog_entry_post(entry, {
          post_has_title:
            Boolean(normalized_post_title) &&
            normalized_post_title.toLowerCase() !== "untitled",
          post_source: source_label,
          post_title: entry?.title,
          post_url: original_url,
        });

        if (!did_open) {
          AppStore.show_toast("We could not open Micro.blog.", {
            top_offset: toast_top_offset,
          });
        }
        return;
      }

      if (menu_action_id === "open_web") {
        await open_external_url(original_url);
        return;
      }

      if (menu_action_id === "toggle_read") {
        if (entry_source === "bookmark") {
          return;
        }

        if (entry?.is_read) {
          const did_mark_unread = Feed.mark_entry_unread(resolved_entry_id);

          if (did_mark_unread) {
            AppStore.show_toast("Marked as unread", {
              top_offset: toast_top_offset,
            });
          }
        } else {
          const did_mark_read = Feed.mark_entry_read(resolved_entry_id);

          if (did_mark_read) {
            AppStore.show_toast("Marked as read", {
              top_offset: toast_top_offset,
            });
          }
        }
        return;
      }

      if (menu_action_id !== "toggle_bookmark") {
        return;
      }

      if (entry_source === "bookmark") {
        const did_delete = await Bookmarks.delete_bookmark(resolved_entry_id);

        if (did_delete) {
          AppStore.show_toast("Bookmark removed", {
            top_offset: toast_top_offset,
          });

          if (
            typeof navigation.canGoBack === "function" &&
            navigation.canGoBack()
          ) {
            navigation.goBack();
          } else {
            navigation.navigate("Bookmarks");
          }
        }
        return;
      }

      if (is_entry_bookmarked) {
        const did_unbookmark = Feed.unbookmark_entry(resolved_entry_id);

        if (did_unbookmark) {
          AppStore.show_toast("Bookmark removed", {
            top_offset: toast_top_offset,
          });
        }
      } else {
        const did_bookmark = Feed.bookmark_entry(resolved_entry_id);

        if (did_bookmark) {
          AppStore.show_toast("Bookmarked", {
            top_offset: toast_top_offset,
          });
        }
      }
    },
    [
      entry?.is_read,
      entry_source,
      handle_copy_link,
      has_entry_menu,
      is_entry_bookmarked,
      navigation,
      original_url,
      resolved_entry_id,
      toast_top_offset,
    ],
  );

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: has_entry_menu
        ? () => (
            <HeaderEntryMenuButton
              is_dark={isDark}
              menu_actions={entry_menu_actions}
              onMenuAction={handle_entry_menu_action}
              theme={theme}
            />
          )
        : undefined,
      title: header_title,
    });
  }, [
    entry_menu_actions,
    handle_entry_menu_action,
    header_title,
    has_entry_menu,
    isDark,
    navigation,
  ]);

  return (
    <View style={{ backgroundColor: theme.colors.canvas, flex: 1 }}>
      <AuthBackground
        intensity={detail_mode === "recap" || entry ? 0.1 : 1}
        theme={theme}
      />
      <ScrollView
        alwaysBounceVertical
        bounces
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{
          alignItems: "center",
          flexGrow: 1,
          paddingBottom: insets.bottom + READER_BOTTOM_PADDING,
          paddingHorizontal: READER_HORIZONTAL_PADDING,
          paddingTop: content_top_padding,
        }}
        showsVerticalScrollIndicator={false}
      >
        {detail_mode === "entry" && entry ? (
          <EntryReaderView
            active_pane={active_pane}
            deleting_highlight_id={deleting_highlight_id}
            entry={entry}
            onCopyHighlight={handle_copy_highlight}
            onDeleteHighlight={handle_delete_highlight}
            onPostHighlight={handle_post_highlight}
            onPressHighlightsPane={handle_highlights_pane_press}
            onPressPostPane={handle_post_pane_press}
            onPressRepliesPane={handle_replies_pane_press}
            onReaderActiveHighlightChange={handle_reader_active_highlight_change}
            onReaderImagePress={handle_reader_image_press}
            onReaderSelectionChange={handle_reader_selection_change}
            reader_post_ref={reader_post_ref}
            reader_webview_reload_key={reader_webview_reload_key}
            replies={replies}
            scaled_text_styles={scaled_text_styles}
            theme={theme}
            width={width}
          />
        ) : null}

        {detail_mode === "recap" && recap ? (
          <RecapReaderView
            scaled_text_styles={scaled_text_styles}
            theme={theme}
            width={width}
          />
        ) : null}

        {detail_mode === "entry" && !entry ? (
          <UnavailableScreen
            body={
              entry_source === "bookmark"
                ? "It may have been removed from your bookmarks, or the list refreshed before the reader finished opening it."
                : "It may have scrolled out of the current timeline, or the feed refreshed before the reader finished opening it."
            }
            scaled_text_styles={scaled_text_styles}
            theme={theme}
            title={
              entry_source === "bookmark"
                ? "This bookmark isn't available right now."
                : "This post isn't available right now."
            }
          />
        ) : null}

        {detail_mode === "recap" && !recap ? (
          <UnavailableScreen
            body="Build a Reading Recap from the Fading segment first, then open it here."
            scaled_text_styles={scaled_text_styles}
            theme={theme}
            title="This recap isn't available right now."
          />
        ) : null}
      </ScrollView>

      {should_show_highlight_action ? (
        <ReaderHighlightAction
          actions={
            active_reader_highlight
              ? [
                  {
                    is_disabled: is_deleting_reader_highlight,
                    label: "Post highlight",
                    onPress: handle_post_reader_highlight,
                  },
                  {
                    is_destructive: true,
                    is_loading: is_deleting_reader_highlight,
                    label: "Delete highlight",
                    loading_label: "Deleting...",
                    onPress: handle_delete_reader_highlight,
                  },
                ]
              : [
                  {
                    is_disabled: is_opening_reader_post,
                    is_loading: is_creating_highlight,
                    label: "Highlight",
                    loading_label: "Saving...",
                    onPress: handle_create_highlight,
                  },
                  {
                    is_disabled: is_creating_highlight,
                    is_loading: is_opening_reader_post,
                    label: "New post...",
                    loading_label: "Opening...",
                    onPress: handle_create_post_from_selection,
                  },
                ]
          }
          action_group_style="joined"
          safe_area_bottom={insets.bottom}
          theme={theme}
        />
      ) : null}

      {detail_mode === "entry" && entry ? (
        <ReaderTextSizeTray
          onDismiss={handle_text_size_tray_dismiss}
          onSlidingComplete={handle_reader_text_scale_commit}
          onValueChange={handle_reader_text_scale_change}
          safe_area_bottom={insets.bottom}
          slider_index={reader_text_scale_slider_index}
          text_scale={reader_text_scale}
          theme={theme}
          visible={is_text_size_tray_visible}
        />
      ) : null}

      <ReaderImageViewerModal
        image_alt={reader_image_viewer?.image_alt}
        image_url={reader_image_url}
        onRequestClose={handle_reader_image_viewer_dismiss}
        safe_area_top={insets.top}
        theme={theme}
        visible={is_reader_image_viewer_visible}
      />
    </View>
  );
}

function resolve_detail_entry_snapshot(entry_id = "", entry_source = "feed") {
  if (!entry_id) {
    return null;
  }

  if (entry_source === "bookmark") {
    return Bookmarks.bookmark_entry_snapshot(entry_id);
  }

  if (entry_source === "subscription_feed") {
    return Feed.subscription_feed_entry_snapshot(entry_id);
  }

  return Feed.timeline_entry_snapshot(entry_id);
}

function does_highlight_match_identifier(highlight = null, identifier = "") {
  const normalized_identifier = `${identifier || ""}`.trim();
  const highlight_identifier = resolve_highlight_identifier(highlight);
  const highlight_id = `${highlight?.id || ""}`.trim();

  if (!normalized_identifier) {
    return false;
  }

  return (
    normalized_identifier === highlight_identifier ||
    normalized_identifier === highlight_id
  );
}

export default observer(FeedItemDetailScreen);
