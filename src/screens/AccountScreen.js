import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { observer } from 'mobx-react';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import AuthCard from '../components/auth/AuthCard';
import AuthBackground from '../components/auth/AuthBackground';
import PrimaryButton from '../components/auth/PrimaryButton';
import Auth from '../stores/Auth';
import AppStore from '../stores/App';
import { ACCENT_PALETTE_OPTIONS, getAuthTheme } from '../theme/authTheme';

function AccountScreen({ isDark = false }) {
  const accent_palette_id = AppStore.accent_palette_id;
  const theme = getAuthTheme(isDark, accent_palette_id);
  const profile = Auth.current_profile();
  const profile_name = profile.name || 'Micro.blog account';
  const profile_url = profile.url || 'Your token is ready for timeline sync.';
  const avatar_initial = profile_name.charAt(0).toUpperCase() || 'M';
  const is_busy = Auth.is_loading();
  const [transition_theme, set_transition_theme] = React.useState(null);
  const transition_progress = useSharedValue(1);
  const theme_transition_key = `${isDark ? 'dark' : 'light'}:${theme.accent_palette_id}`;
  const previous_theme_key_ref = React.useRef(theme_transition_key);
  const previous_theme_ref = React.useRef(theme);
  const transition_token_ref = React.useRef(0);

  const complete_transition = React.useCallback((transition_token) => {
    if (transition_token_ref.current === transition_token) {
      set_transition_theme(null);
    }
  }, []);

  React.useLayoutEffect(() => {
    if (previous_theme_key_ref.current === theme_transition_key) {
      previous_theme_ref.current = theme;
      return;
    }

    const transition_token = transition_token_ref.current + 1;
    transition_token_ref.current = transition_token;
    set_transition_theme(previous_theme_ref.current);
    transition_progress.value = 0;
    transition_progress.value = withTiming(
      1,
      {
        duration: 360,
        easing: Easing.out(Easing.cubic),
      },
      (finished) => {
        if (finished) {
          runOnJS(complete_transition)(transition_token);
        }
      },
    );
    previous_theme_key_ref.current = theme_transition_key;
    previous_theme_ref.current = theme;
  }, [complete_transition, theme, theme_transition_key, transition_progress]);

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.canvas }]}>
      <AuthBackground theme={theme} />

      <AccountScreenContent
        accent_palette_id={accent_palette_id}
        avatar_initial={avatar_initial}
        is_busy={is_busy}
        is_dark={isDark}
        profile={profile}
        profile_name={profile_name}
        profile_url={profile_url}
        theme={theme}
        transition_progress={transition_progress}
        transition_theme={transition_theme}
      />
    </View>
  );
}

function AccountScreenContent({
  accent_palette_id,
  avatar_initial = '',
  is_busy = false,
  is_dark = false,
  profile,
  profile_name = '',
  profile_url = '',
  theme,
  transition_progress,
  transition_theme,
}) {
  const should_show_status_badge = profile.has_inkwell === false;
  const should_show_ai_helper = profile.is_using_ai != null;
  const should_show_meta_stack = should_show_status_badge || should_show_ai_helper;

  const avatar_fallback_style = useAnimatedStyle(() => {
    if (!transition_theme) {
      return {
        backgroundColor: theme.colors.accentSoft,
        borderColor: theme.colors.line,
      };
    }

    return {
      backgroundColor: interpolateColor(
        transition_progress.value,
        [0, 1],
        [transition_theme.colors.accentSoft, theme.colors.accentSoft],
      ),
      borderColor: interpolateColor(
        transition_progress.value,
        [0, 1],
        [transition_theme.colors.line, theme.colors.line],
      ),
    };
  }, [theme, transition_progress, transition_theme]);

  const avatar_initial_style = useAnimatedStyle(() => {
    if (!transition_theme) {
      return {
        color: theme.colors.accentStrong,
      };
    }

    return {
      color: interpolateColor(
        transition_progress.value,
        [0, 1],
        [transition_theme.colors.accentStrong, theme.colors.accentStrong],
      ),
    };
  }, [theme, transition_progress, transition_theme]);

  const status_badge_style = useAnimatedStyle(() => {
    if (!transition_theme) {
      return {
        backgroundColor: theme.colors.badge,
        borderColor: theme.colors.line,
      };
    }

    return {
      backgroundColor: interpolateColor(
        transition_progress.value,
        [0, 1],
        [transition_theme.colors.badge, theme.colors.badge],
      ),
      borderColor: interpolateColor(
        transition_progress.value,
        [0, 1],
        [transition_theme.colors.line, theme.colors.line],
      ),
    };
  }, [theme, transition_progress, transition_theme]);

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <ScrollView
        bounces={false}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <Text style={[styles.title, { color: theme.colors.ink }]}>Settings</Text>
        </View>

        <AuthCard style={styles.card} theme={theme}>
          <View style={styles.profileRow}>
            {profile.photo ? (
              <Image source={{ uri: profile.photo }} style={styles.avatar} />
            ) : (
              <Animated.View style={[styles.avatarFallback, avatar_fallback_style]}>
                <Animated.Text style={[styles.avatarInitial, avatar_initial_style]}>
                  {avatar_initial}
                </Animated.Text>
              </Animated.View>
            )}

            <View style={styles.profileMeta}>
              <Text style={[styles.profileName, { color: theme.colors.ink }]}>{profile_name}</Text>
              <Text style={[styles.profileUrl, { color: theme.colors.inkSoft }]}>{profile_url}</Text>
            </View>
          </View>

          {should_show_meta_stack ? (
            <View style={styles.metaStack}>
              {should_show_status_badge ? (
                <Animated.View style={[styles.statusBadge, status_badge_style]}>
                  <Text style={[styles.statusText, { color: theme.colors.inkSoft }]}>
                    Micro.blog says Inkwell is not enabled for this account yet.
                  </Text>
                </Animated.View>
              ) : null}

              {should_show_ai_helper ? (
                <Text style={[styles.helperText, { color: theme.colors.inkSoft }]}>
                  Fading summaries are currently {profile.is_using_ai ? 'enabled' : 'disabled'} for
                  this account.
                </Text>
              ) : null}
            </View>
          ) : null}

          <View style={styles.preferenceStack}>
            <View style={styles.preferenceCopy}>
              <Text style={[styles.preferenceTitle, { color: theme.colors.ink }]}>Accent colour</Text>
              <Text style={[styles.preferenceBody, { color: theme.colors.inkSoft }]}>
                Choose an accent colour for this device. It stays set even after you sign out.
              </Text>
            </View>

            <View style={styles.paletteWrap}>
              {ACCENT_PALETTE_OPTIONS.map((option) => {
                return (
                  <AccentPaletteChip
                    isDark={is_dark}
                    is_selected={option.id === accent_palette_id}
                    key={option.id}
                    label={option.label}
                    onPress={() => AppStore.set_accent_palette(option.id)}
                    previous_is_selected={option.id === transition_theme?.accent_palette_id}
                    swatch_color={is_dark ? option.dark_swatch : option.light_swatch}
                    theme={theme}
                    transition_progress={transition_progress}
                    transition_theme={transition_theme}
                  />
                );
              })}
            </View>
          </View>

          <PrimaryButton
            label="Sign out"
            onPress={Auth.sign_out}
            variant="ghost"
            disabled={is_busy}
            theme={theme}
          />
        </AuthCard>
      </ScrollView>
    </SafeAreaView>
  );
}

function AccentPaletteChip({
  isDark = false,
  is_selected = false,
  label = '',
  onPress,
  previous_is_selected = false,
  swatch_color = '',
  theme,
  transition_progress,
  transition_theme,
}) {
  const chip_style = useAnimatedStyle(() => {
    if (!transition_theme) {
      return {
        backgroundColor: is_selected ? theme.colors.accentSoft : theme.colors.paper,
        borderColor: is_selected ? theme.colors.accent : theme.colors.line,
      };
    }

    return {
      backgroundColor: interpolateColor(
        transition_progress.value,
        [0, 1],
        [
          previous_is_selected ? transition_theme.colors.accentSoft : transition_theme.colors.paper,
          is_selected ? theme.colors.accentSoft : theme.colors.paper,
        ],
      ),
      borderColor: interpolateColor(
        transition_progress.value,
        [0, 1],
        [
          previous_is_selected ? transition_theme.colors.accent : transition_theme.colors.line,
          is_selected ? theme.colors.accent : theme.colors.line,
        ],
      ),
    };
  }, [is_selected, previous_is_selected, theme, transition_progress, transition_theme]);

  const label_style = useAnimatedStyle(() => {
    if (!transition_theme) {
      return {
        color: is_selected ? theme.colors.ink : theme.colors.inkSoft,
      };
    }

    return {
      color: interpolateColor(
        transition_progress.value,
        [0, 1],
        [
          previous_is_selected ? transition_theme.colors.ink : transition_theme.colors.inkSoft,
          is_selected ? theme.colors.ink : theme.colors.inkSoft,
        ],
      ),
    };
  }, [is_selected, previous_is_selected, theme, transition_progress, transition_theme]);

  const check_style = useAnimatedStyle(() => {
    const start_opacity = previous_is_selected ? 1 : 0;
    const end_opacity = is_selected ? 1 : 0;
    const progress = transition_theme ? transition_progress.value : 1;
    const opacity = start_opacity + (end_opacity - start_opacity) * progress;

    return {
      opacity,
      transform: [
        {
          scale: 0.88 + opacity * 0.12,
        },
      ],
    };
  }, [is_selected, previous_is_selected, transition_progress, transition_theme]);

  return (
    <Pressable
      accessibilityLabel={`Use ${label} accent colour`}
      accessibilityRole="button"
      accessibilityState={{ selected: is_selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.palettePressable, pressed ? styles.pressedPaletteChip : null]}
    >
      <Animated.View style={[styles.paletteChip, chip_style]}>
        <View
          style={[
            styles.paletteSwatch,
            {
              backgroundColor: swatch_color,
              borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.06)',
            },
          ]}
        />
        <Animated.Text style={[styles.paletteLabel, label_style]}>{label}</Animated.Text>
        <Animated.View style={check_style}>
          <MaterialIcons color={theme.colors.accentStrong} name="check" size={18} />
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 24,
    gap: 32,
  },
  hero: {
    gap: 10,
    paddingTop: 28,
  },
  title: {
    fontFamily: 'Newsreader_700Bold',
    fontSize: 46,
    lineHeight: 52,
    maxWidth: 320,
  },
  card: {
    gap: 24,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
  },
  avatarFallback: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  avatarInitial: {
    fontFamily: 'Newsreader_700Bold',
    fontSize: 28,
    lineHeight: 30,
  },
  profileMeta: {
    flex: 1,
    gap: 6,
  },
  profileName: {
    fontFamily: 'Newsreader_600SemiBold',
    fontSize: 30,
    lineHeight: 36,
  },
  profileUrl: {
    fontSize: 15,
    lineHeight: 22,
  },
  metaStack: {
    gap: 12,
  },
  preferenceStack: {
    gap: 14,
  },
  preferenceCopy: {
    gap: 6,
  },
  preferenceTitle: {
    fontFamily: 'Newsreader_600SemiBold',
    fontSize: 24,
    lineHeight: 28,
  },
  preferenceBody: {
    fontSize: 14,
    lineHeight: 21,
  },
  paletteWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  palettePressable: {
    minHeight: 50,
    minWidth: 136,
    flexBasis: '48%',
    flexGrow: 1,
  },
  paletteChip: {
    width: '100%',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  pressedPaletteChip: {
    opacity: 0.84,
  },
  paletteSwatch: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    flexShrink: 0,
  },
  paletteLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
  },
  statusBadge: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  statusText: {
    fontSize: 14,
    lineHeight: 20,
  },
  helperText: {
    fontSize: 14,
    lineHeight: 21,
  },
});

export default observer(AccountScreen);
