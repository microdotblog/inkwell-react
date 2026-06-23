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
              borderBottomColor: theme.colors.line,
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
                  opacity: is_posting ? 0.5 : pressed ? 0.72 : 1,
                },
              ];
            }}
          >
            <MaterialIcons
              color={theme.colors.ink}
              name="close"
              size={24}
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
    borderBottomWidth: 1,
    flexDirection: "row",
    minHeight: 58,
    paddingBottom: 8,
    paddingHorizontal: 12,
  },
  replyModalHeaderButton: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    minWidth: 60,
  },
  replyModalCloseButton: {
    alignItems: "flex-start",
  },
  replyModalPostButton: {
    alignItems: "flex-end",
  },
  replyModalTitle: {
    flex: 1,
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
