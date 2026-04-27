import React from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { observer } from "mobx-react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  block_micro_blog_user,
  fetch_micro_blog_user_profile,
  report_micro_blog_user,
} from "../api/MicroBlogFeeds";
import AuthBackground from "../components/auth/AuthBackground";
import {
  FeedDetailAvatar,
  HeaderEntryMenuButton,
  UnavailableScreen,
  useFeedItemDetailScaledTextStyles,
} from "../components/feed_item_detail/FeedItemDetailViews";
import {
  READER_AVATAR_SIZE,
  READER_BOTTOM_PADDING,
  READER_COLUMN_MAX_WIDTH,
  READER_HORIZONTAL_PADDING,
  normalize_http_url,
  open_external_url,
  resolve_host_label,
} from "../components/feed_item_detail/feedItemDetailUtils";
import AppStore from "../stores/App";
import Tokens from "../stores/Tokens";
import { getAuthTheme } from "../theme/authTheme";

function UserProfileScreen({ navigation, route, isDark = false }) {
  const accent_palette_id = AppStore.accent_palette_id;
  const theme = getAuthTheme(isDark, accent_palette_id);
  const scaled_text_styles = useFeedItemDetailScaledTextStyles();
  const header_height = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const route_username = normalize_profile_username(route?.params?.username);
  const fallback_profile = React.useMemo(() => {
    return normalize_user_profile_payload(null, {
      avatar_url: route?.params?.avatar_url,
      display_name: route?.params?.display_name,
      profile_url: route?.params?.profile_url,
      username: route_username,
    });
  }, [
    route?.params?.avatar_url,
    route?.params?.display_name,
    route?.params?.profile_url,
    route_username,
  ]);
  const [profile, set_profile] = React.useState(fallback_profile);
  const [is_loading, set_is_loading] = React.useState(Boolean(route_username));
  const [did_fail_to_load, set_did_fail_to_load] = React.useState(false);
  const toast_top_offset = header_height + 10;
  const profile_username = profile.username || route_username;
  const display_name =
    profile.display_name || fallback_profile.display_name || profile_username;
  const profile_url = profile.profile_url || fallback_profile.profile_url;
  const profile_host = resolve_host_label(profile_url);
  const micro_blog_profile_url = profile_username
    ? `https://micro.blog/${encodeURIComponent(profile_username)}`
    : "";
  const menu_actions = React.useMemo(() => {
    return get_profile_menu_actions({
      can_open_micro_blog: Boolean(micro_blog_profile_url),
      can_use_profile_actions: Boolean(profile_username),
      theme,
    });
  }, [micro_blog_profile_url, profile_username, theme]);

  React.useEffect(() => {
    set_profile(fallback_profile);
  }, [fallback_profile]);

  React.useEffect(() => {
    if (!route_username) {
      set_is_loading(false);
      set_did_fail_to_load(true);
      return;
    }

    let did_cancel = false;
    set_is_loading(true);
    set_did_fail_to_load(false);

    async function load_profile() {
      try {
        const payload = await fetch_micro_blog_user_profile({
          username: route_username,
        });

        if (did_cancel) {
          return;
        }

        set_profile(
          normalize_user_profile_payload(payload, {
            ...fallback_profile,
            username: route_username,
          }),
        );
      } catch (error) {
        if (did_cancel) {
          return;
        }

        console.warn("Failed to load Micro.blog profile", error);
        set_did_fail_to_load(true);
      } finally {
        if (did_cancel) {
          return;
        }

        set_is_loading(false);
      }
    }

    load_profile();

    return () => {
      did_cancel = true;
    };
  }, [fallback_profile, route_username]);

  const handle_report_profile = React.useCallback(() => {
    if (!profile_username) {
      return;
    }

    Alert.alert(
      undefined,
      "Report this user to Micro.blog for a community guidelines violation?",
      [
        {
          style: "cancel",
          text: "Cancel",
        },
        {
          style: "destructive",
          text: "Report",
          onPress: async () => {
            try {
              await Tokens.hydrate();
              const user_token = Tokens.get_user_token();

              if (!user_token) {
                AppStore.show_toast("We could not report this user.", {
                  top_offset: toast_top_offset,
                });
                return;
              }

              await report_micro_blog_user({
                token: user_token,
                username: profile_username,
              });
              AppStore.show_toast("This user has been reported for review.", {
                top_offset: toast_top_offset,
              });
            } catch (error) {
              console.warn("Failed to report user", error);
              AppStore.show_toast("We could not report this user.", {
                top_offset: toast_top_offset,
              });
            }
          },
        },
      ],
    );
  }, [profile_username, toast_top_offset]);

  const handle_block_profile = React.useCallback(() => {
    if (!profile_username) {
      return;
    }

    Alert.alert(
      undefined,
      `Block @${profile_username}? You won't see their replies.`,
      [
        {
          style: "cancel",
          text: "Cancel",
        },
        {
          style: "destructive",
          text: "Block",
          onPress: async () => {
            try {
              await Tokens.hydrate();
              const user_token = Tokens.get_user_token();

              if (!user_token) {
                AppStore.show_toast(`We could not block @${profile_username}.`, {
                  top_offset: toast_top_offset,
                });
                return;
              }

              await block_micro_blog_user({
                token: user_token,
                username: profile_username,
              });
              AppStore.show_toast(`@${profile_username} has been blocked.`, {
                top_offset: toast_top_offset,
              });
            } catch (error) {
              console.warn("Failed to block user", error);
              AppStore.show_toast(`We could not block @${profile_username}.`, {
                top_offset: toast_top_offset,
              });
            }
          },
        },
      ],
    );
  }, [profile_username, toast_top_offset]);

  const handle_profile_menu_action = React.useCallback(
    async (menu_action_id = "") => {
      if (menu_action_id === "open_micro_blog") {
        await open_external_url(micro_blog_profile_url);
        return;
      }

      if (menu_action_id === "report_profile") {
        handle_report_profile();
        return;
      }

      if (menu_action_id === "block_profile") {
        handle_block_profile();
      }
    },
    [
      handle_block_profile,
      handle_report_profile,
      micro_blog_profile_url,
    ],
  );

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: menu_actions.length
        ? () => (
            <HeaderEntryMenuButton
              accessibility_label="Open profile actions"
              is_dark={isDark}
              menu_actions={menu_actions}
              onMenuAction={handle_profile_menu_action}
              theme={theme}
            />
          )
        : undefined,
      title: display_name || "Profile",
    });
  }, [
    display_name,
    handle_profile_menu_action,
    isDark,
    menu_actions,
    navigation,
    theme,
  ]);

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.canvas }]}>
      <AuthBackground intensity={0.1} theme={theme} />
      <ScrollView
        alwaysBounceVertical
        bounces
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={[
          styles.content,
          {
            paddingBottom: insets.bottom + READER_BOTTOM_PADDING,
            paddingHorizontal: READER_HORIZONTAL_PADDING,
            paddingTop: 12,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {profile_username ? (
          <View style={styles.profileColumn}>
            <View
              style={[
                styles.profileMasthead,
                {
                  borderBottomColor: theme.colors.line,
                },
              ]}
            >
              <View style={styles.profileHeaderRow}>
                <FeedDetailAvatar
                  avatar_url={profile.avatar_url}
                  source={display_name}
                  size={READER_AVATAR_SIZE}
                  theme={theme}
                />
                <View style={styles.profileMeta}>
                  <Text
                    style={[
                      styles.profileName,
                      scaled_text_styles.sourceLabel,
                      { color: theme.colors.ink },
                    ]}
                  >
                    {display_name}
                  </Text>
                  <View style={styles.profileDetailsRow}>
                    {profile_host ? (
                      <Text
                        style={[
                          styles.profileDetailLabel,
                          scaled_text_styles.hostLabel,
                          { color: theme.colors.inkSoft },
                        ]}
                      >
                        {profile_host}
                      </Text>
                    ) : null}
                    {profile_host ? (
                      <Text
                        style={[
                          styles.profileDetailSeparator,
                          scaled_text_styles.feedDetailSeparator,
                          { color: theme.colors.inkSoft },
                        ]}
                      >
                        •
                      </Text>
                    ) : null}
                    <Text
                      style={[
                        styles.profileDetailLabel,
                        scaled_text_styles.hostLabel,
                        { color: theme.colors.inkSoft },
                      ]}
                    >
                      @{profile_username}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.profileBody}>
              {is_loading ? (
                <ActivityIndicator color={theme.colors.accentStrong} />
              ) : (
                <Text style={[styles.bioText, { color: theme.colors.ink }]}>
                  {profile.bio || "No bio yet."}
                </Text>
              )}
            </View>
          </View>
        ) : (
          <UnavailableScreen
            body={
              did_fail_to_load
                ? "The profile username is missing."
                : "We could not load this profile."
            }
            scaled_text_styles={scaled_text_styles}
            theme={theme}
            title="This profile isn't available right now."
          />
        )}
      </ScrollView>
    </View>
  );
}

function get_profile_menu_actions({
  can_open_micro_blog = false,
  can_use_profile_actions = false,
  theme,
} = {}) {
  const icon_color = theme?.colors?.ink;
  const actions = [];

  if (can_open_micro_blog) {
    actions.push({
      id: "open_micro_blog",
      image: Platform.select({
        ios: "safari",
      }),
      imageColor: icon_color,
      title: "Open in Micro.blog",
    });
  }

  if (can_use_profile_actions) {
    actions.push({
      id: "report_profile",
      image: Platform.select({
        ios: "exclamationmark.triangle",
      }),
      imageColor: icon_color,
      title: "Report",
    });

    actions.push({
      id: "block_profile",
      image: Platform.select({
        ios: "slash.circle",
      }),
      imageColor: icon_color,
      title: "Block",
    });
  }

  return actions;
}

function normalize_user_profile_payload(payload = null, fallback = {}) {
  const micro_blog = payload?._microblog || {};
  const author = payload?.author || {};
  const username = normalize_profile_username(
    micro_blog.username || fallback.username,
  );
  const display_name =
    `${author.name || ""}`.trim() ||
    normalize_profile_title(payload?.title) ||
    `${fallback.display_name || ""}`.trim() ||
    username;
  const profile_url =
    normalize_http_url(author.url) ||
    normalize_http_url(fallback.profile_url);

  return {
    avatar_url: `${author.avatar || fallback.avatar_url || ""}`.trim(),
    bio: `${micro_blog.bio || fallback.bio || ""}`.trim(),
    display_name,
    profile_url,
    username,
  };
}

function normalize_profile_title(title = "") {
  return `${title || ""}`.trim().replace(/^Micro\.blog\s+-\s+/i, "");
}

function normalize_profile_username(username = "") {
  return `${username || ""}`.trim().replace(/^@+/, "");
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    alignItems: "center",
    flexGrow: 1,
  },
  profileColumn: {
    maxWidth: READER_COLUMN_MAX_WIDTH,
    width: "100%",
  },
  profileMasthead: {
    borderBottomWidth: 1,
    paddingBottom: 20,
    paddingTop: Platform.OS === "ios" ? 0 : 10,
  },
  profileHeaderRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
  },
  profileMeta: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  profileName: {
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 24,
  },
  profileDetailsRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  profileDetailLabel: {
    fontSize: 14,
    lineHeight: 20,
  },
  profileDetailSeparator: {
    fontSize: 13,
    lineHeight: 18,
  },
  profileBody: {
    paddingTop: 19,
  },
  bioText: {
    fontSize: 18,
    lineHeight: 29,
  },
});

export default observer(UserProfileScreen);
