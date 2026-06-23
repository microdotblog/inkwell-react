import React from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

import { with_color_opacity } from "./feedItemDetailUtils";

const REPLY_MODAL_NAV_BUTTON_HEIGHT = 40;
const REPLY_MODAL_NAV_BUTTON_RADIUS = REPLY_MODAL_NAV_BUTTON_HEIGHT / 2;

function ReplyComposerModal({
  input_ref,
  is_posting = false,
  onChangeText,
  onPost,
  onRequestClose,
  reply_key = "",
  safe_area_bottom = 0,
  safe_area_top = 0,
  theme,
  value = "",
  visible = false,
}) {
  const [initial_selection, set_initial_selection] = React.useState(null);
  const can_post = `${value || ""}`.trim().length > 0 && !is_posting;
  const nav_button_background_color = with_color_opacity(
    theme?.colors?.canvas || "#ffffff",
    theme?.isDark ? 0.18 : 0.82,
  );
  const nav_button_border_color = with_color_opacity(
    theme?.colors?.line || "#d2d2d7",
    theme?.isDark ? 0.34 : 0.76,
  );

  React.useEffect(() => {
    if (!visible) {
      set_initial_selection(null);
      return;
    }

    const cursor_position = `${value || ""}`.length;
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
  }, [input_ref, reply_key, visible]);

  return (
    <Modal
      animationType="slide"
      onRequestClose={onRequestClose}
      presentationStyle="fullScreen"
      visible={visible}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={[
          styles.replyModalScreen,
          {
            backgroundColor: theme.colors.canvas,
          },
        ]}
      >
        <View
          style={[
            styles.replyModalHeader,
            {
              paddingTop: safe_area_top + 8,
            },
          ]}
        >
          <Pressable
            accessibilityLabel="Close reply"
            accessibilityRole="button"
            disabled={is_posting}
            hitSlop={8}
            onPress={onRequestClose}
            style={({ pressed }) => {
              return [
                styles.replyModalHeaderButton,
                styles.replyModalCloseButton,
                {
                  backgroundColor: nav_button_background_color,
                  borderColor: nav_button_border_color,
                  opacity: is_posting ? 0.5 : pressed ? 0.72 : 1,
                },
              ];
            }}
          >
            <MaterialIcons
              color={theme.colors.ink}
              name="close"
              size={20}
            />
          </Pressable>

          <Text
            style={[
              styles.replyModalTitle,
              {
                color: theme.colors.ink,
              },
            ]}
          >
            Reply
          </Text>

          <Pressable
            accessibilityLabel="Post reply"
            accessibilityRole="button"
            disabled={!can_post}
            onPress={onPost}
            style={({ pressed }) => {
              return [
                styles.replyModalHeaderButton,
                styles.replyModalPostButton,
                {
                  backgroundColor: nav_button_background_color,
                  borderColor: nav_button_border_color,
                  opacity: !can_post ? 0.5 : pressed ? 0.72 : 1,
                },
              ];
            }}
          >
            {is_posting ? (
              <ActivityIndicator
                color={theme.colors.accentStrong}
                size="small"
              />
            ) : (
              <Text
                style={[
                  styles.replyModalPostLabel,
                  {
                    color: theme.colors.accentStrong,
                  },
                ]}
              >
                Post
              </Text>
            )}
          </Pressable>
        </View>

        <View
          style={[
            styles.replyModalBody,
            {
              paddingBottom: safe_area_bottom + 18,
            },
          ]}
        >
          <TextInput
            autoCapitalize="sentences"
            autoCorrect
            autoFocus
            keyboardAppearance={theme.isDark ? "dark" : "light"}
            multiline
            onChangeText={onChangeText}
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
              styles.replyModalInput,
              {
                color: theme.colors.ink,
              },
            ]}
            textAlignVertical="top"
            value={value}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  replyModalScreen: {
    flex: 1,
  },
  replyModalHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 56,
    paddingBottom: 8,
    paddingHorizontal: 18,
    position: "relative",
  },
  replyModalHeaderButton: {
    alignItems: "center",
    borderRadius: REPLY_MODAL_NAV_BUTTON_RADIUS,
    borderWidth: 1,
    height: REPLY_MODAL_NAV_BUTTON_HEIGHT,
    justifyContent: "center",
    zIndex: 1,
  },
  replyModalCloseButton: {
    width: REPLY_MODAL_NAV_BUTTON_HEIGHT,
  },
  replyModalPostButton: {
    minWidth: 64,
    paddingHorizontal: 16,
  },
  replyModalTitle: {
    left: 84,
    position: "absolute",
    right: 84,
    fontSize: 17,
    fontWeight: "700",
    lineHeight: 22,
    textAlign: "center",
  },
  replyModalPostLabel: {
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 22,
  },
  replyModalBody: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 18,
  },
  replyModalInput: {
    flex: 1,
    fontSize: 18,
    lineHeight: 26,
    padding: 0,
  },
});

export default ReplyComposerModal;
