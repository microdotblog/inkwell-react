import React from "react";
import {
  Button,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
} from "react-native";
import { CommonActions } from "@react-navigation/native";
import { useHeaderHeight } from "@react-navigation/elements";
import { observer } from "mobx-react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { create_micro_blog_reply } from "../api/MicroBlogFeeds";
import AppStore from "../stores/App";
import Tokens from "../stores/Tokens";
import { getAuthTheme } from "../theme/authTheme";

function ReplyComposerScreen({ navigation, route, isDark = false }) {
  const theme = getAuthTheme(isDark, AppStore.accent_palette_id);
  const header_height = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const input_ref = React.useRef(null);
  const post_id = `${route?.params?.post_id || ""}`.trim();
  const initial_text = `${route?.params?.initial_text || ""}`;
  const source_route_key = `${route?.params?.source_route_key || ""}`.trim();
  const [reply_text, set_reply_text] = React.useState(initial_text);
  const [initial_selection, set_initial_selection] = React.useState(null);
  const [is_posting, set_is_posting] = React.useState(false);
  const can_post = Boolean(post_id && reply_text.trim() && !is_posting);
  const toast_top_offset = header_height + 10;

  const handle_close = React.useCallback(() => {
    if (is_posting) {
      return;
    }

    navigation.goBack();
  }, [is_posting, navigation]);

  const handle_post = React.useCallback(async () => {
    const content = `${reply_text || ""}`;

    if (!can_post || !content.trim()) {
      return;
    }

    let did_close_after_post = false;
    set_is_posting(true);

    try {
      await Tokens.hydrate();
      const user_token = Tokens.get_user_token();

      if (!user_token) {
        AppStore.show_toast(
          "Your Micro.blog session expired. Please sign in again.",
          {
            top_offset: toast_top_offset,
          },
        );
        return;
      }

      await create_micro_blog_reply({
        token: user_token,
        post_id,
        content,
      });

      if (source_route_key) {
        navigation.dispatch({
          ...CommonActions.setParams({
            reply_posted_at: Date.now(),
          }),
          source: source_route_key,
        });
      }

      AppStore.show_toast("Reply posted", {
        top_offset: toast_top_offset,
      });
      did_close_after_post = true;
      navigation.goBack();
    } catch (error) {
      console.warn("Failed to post reply", error);
      AppStore.show_toast(
        error?.status === 401 || error?.status === 403
          ? "Your Micro.blog session expired. Please sign in again."
          : "We could not post that reply.",
        {
          top_offset: toast_top_offset,
        },
      );
    } finally {
      if (!did_close_after_post) {
        set_is_posting(false);
      }
    }
  }, [
    can_post,
    navigation,
    post_id,
    reply_text,
    source_route_key,
    toast_top_offset,
  ]);

  React.useEffect(() => {
    const cursor_position = `${initial_text || ""}`.length;
    set_initial_selection({
      start: cursor_position,
      end: cursor_position,
    });

    const frame_id = requestAnimationFrame(() => {
      input_ref.current?.focus?.();
    });

    return () => {
      if (typeof cancelAnimationFrame === "function") {
        cancelAnimationFrame(frame_id);
      }
    };
  }, [initial_text]);

  React.useLayoutEffect(() => {
    const post_button_title = is_posting ? "Posting..." : "Post";

    navigation.setOptions({
      headerLeft:
        Platform.OS === "ios"
          ? undefined
          : () => (
              <Button
                color={theme.colors.accentStrong}
                disabled={is_posting}
                onPress={handle_close}
                title="Close"
              />
            ),
      headerRight:
        Platform.OS === "ios"
          ? undefined
          : () => (
              <Button
                color={theme.colors.accentStrong}
                disabled={!can_post}
                onPress={handle_post}
                title={post_button_title}
              />
            ),
      headerTintColor: theme.colors.ink,
      title: "Reply",
      unstable_headerLeftItems:
        Platform.OS === "ios"
          ? () => [
              {
                accessibilityLabel: "Close",
                disabled: is_posting,
                icon: {
                  type: "sfSymbol",
                  name: "xmark",
                },
                label: "Close",
                onPress: handle_close,
                tintColor: theme.colors.accentStrong,
                type: "button",
              },
            ]
          : undefined,
      unstable_headerRightItems:
        Platform.OS === "ios"
          ? () => [
              {
                disabled: !can_post,
                label: post_button_title,
                onPress: handle_post,
                tintColor: theme.colors.accentStrong,
                type: "button",
                variant: "done",
              },
            ]
          : undefined,
    });
  }, [
    can_post,
    handle_close,
    handle_post,
    is_posting,
    navigation,
    theme.colors.accentStrong,
    theme.colors.ink,
  ]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[
        styles.screen,
        {
          backgroundColor: theme.colors.canvas,
          paddingBottom: insets.bottom + 18,
        },
      ]}
    >
      <TextInput
        autoCapitalize="sentences"
        autoCorrect
        autoFocus
        keyboardAppearance={theme.isDark ? "dark" : "light"}
        multiline
        onChangeText={set_reply_text}
        onSelectionChange={() => {
          if (initial_selection) {
            set_initial_selection(null);
          }
        }}
        placeholderTextColor={theme.colors.inkSoft}
        ref={input_ref}
        scrollEnabled
        selection={initial_selection || undefined}
        selectionColor={theme.colors.accentStrong}
        style={[
          styles.input,
          {
            color: theme.colors.ink,
          },
        ]}
        textAlignVertical="top"
        value={reply_text}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 18,
  },
  input: {
    flex: 1,
    fontSize: 18,
    lineHeight: 26,
    padding: 0,
  },
});

export default observer(ReplyComposerScreen);
