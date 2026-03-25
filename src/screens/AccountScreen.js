import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { useHeaderHeight } from '@react-navigation/elements';
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
import {
  DEFAULT_TEXT_SCALE,
  createScaledTextStyles,
  formatTextScaleLabel,
  MAX_TEXT_SCALE,
  MIN_TEXT_SCALE,
  TEXT_SCALE_PRESET_COUNT,
  getTextScaleForSliderIndex,
  getTextScaleSliderIndex,
} from '../theme/textScale';

const SCREEN_HORIZONTAL_PADDING = 20;
const CONTENT_TOP_PADDING = 12;
const TEXT_STYLE_NAMES = [
  'avatarInitial',
  'signedInAs',
  'profileName',
  'profileHandle',
  'preferenceTitle',
  'preferenceBody',
  'paletteLabel',
  'textScaleValue',
  'sliderMarkerLabel',
];

function format_profile_handle(profile_url = '') {
  const trimmed_profile_url = `${profile_url || ''}`.trim();

  if (!trimmed_profile_url) {
    return '';
  }

  if (trimmed_profile_url.startsWith('@')) {
    return trimmed_profile_url;
  }

  const sanitized_profile_url = trimmed_profile_url
    .split(/[?#]/)[0]
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/+$/g, '');
  const profile_segments = sanitized_profile_url.split('/').filter(Boolean);
  let handle_candidate = '';

  if (profile_segments.length > 1) {
    handle_candidate = profile_segments[profile_segments.length - 1];
  } else {
    const hostname = profile_segments[0] || '';
    const hostname_segments = hostname.split('.').filter(Boolean);

    if (hostname === 'micro.blog') {
      handle_candidate = '';
    } else if (hostname_segments.length > 0) {
      handle_candidate = hostname_segments[0];
    }
  }

  if (!handle_candidate) {
    return '';
  }

  return `@${handle_candidate.replace(/^@+/g, '')}`;
}

function AccountScreen({ isDark = false }) {
  const accent_palette_id = AppStore.accent_palette_id;
  const text_scale = AppStore.text_scale;
  const text_scale_slider_index = React.useMemo(() => {
    return getTextScaleSliderIndex(text_scale);
  }, [text_scale]);
  const theme = getAuthTheme(isDark, accent_palette_id);
  const scaled_text_styles = React.useMemo(() => {
    return createScaledTextStyles(styles, TEXT_STYLE_NAMES, text_scale);
  }, [text_scale]);
  const profile = Auth.current_profile();
  const profile_name = profile.name || 'Micro.blog account';
  const profile_handle = format_profile_handle(profile.url);
  const profile_photo = profile.photo || '';
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
        profile_handle={profile_handle}
        profile_name={profile_name}
        profile_photo={profile_photo}
        scaled_text_styles={scaled_text_styles}
        theme={theme}
        text_scale={text_scale}
        text_scale_slider_index={text_scale_slider_index}
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
  profile_handle = '',
  profile_name = '',
  profile_photo = '',
  scaled_text_styles,
  theme,
  text_scale = DEFAULT_TEXT_SCALE,
  text_scale_slider_index = 0,
  transition_progress,
  transition_theme,
}) {
  const header_height = useHeaderHeight();
  const content_top_padding = header_height + CONTENT_TOP_PADDING;
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

  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <ScrollView
        alwaysBounceVertical
        bounces
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={[styles.content, { paddingTop: content_top_padding }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.cardStack}>
          <AuthCard style={styles.card} theme={theme}>
            <View style={styles.profileRow}>
              {profile_photo ? (
                <Image source={{ uri: profile_photo }} style={styles.avatar} />
              ) : (
                <Animated.View style={[styles.avatarFallback, avatar_fallback_style]}>
                  <Animated.Text
                    style={[
                      styles.avatarInitial,
                      scaled_text_styles.avatarInitial,
                      avatar_initial_style,
                    ]}
                  >
                    {avatar_initial}
                  </Animated.Text>
                </Animated.View>
              )}

              <View style={styles.profileMeta}>
                <Text
                  style={[
                    styles.signedInAs,
                    scaled_text_styles.signedInAs,
                    { color: theme.colors.inkSoft },
                  ]}
                >
                  Signed in as:
                </Text>
                <Text
                  style={[
                    styles.profileName,
                    scaled_text_styles.profileName,
                    { color: theme.colors.ink },
                  ]}
                >
                  {profile_name}
                </Text>
                {profile_handle ? (
                  <Text
                    style={[
                      styles.profileHandle,
                      scaled_text_styles.profileHandle,
                      { color: theme.colors.inkSoft },
                    ]}
                  >
                    {profile_handle}
                  </Text>
                ) : null}
              </View>
            </View>
          </AuthCard>

          <AuthCard style={styles.card} theme={theme}>
            <View style={styles.preferenceStack}>
              <View style={styles.preferenceCopy}>
                <Text
                  style={[
                    styles.preferenceTitle,
                    scaled_text_styles.preferenceTitle,
                    { color: theme.colors.ink },
                  ]}
                >
                  Appearance
                </Text>
                <Text
                  style={[
                    styles.preferenceBody,
                    scaled_text_styles.preferenceBody,
                    { color: theme.colors.inkSoft },
                  ]}
                >
                  Choose an accent colour for this device.
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
                      scaled_text_styles={scaled_text_styles}
                      swatch_color={is_dark ? option.dark_swatch : option.light_swatch}
                      theme={theme}
                      transition_progress={transition_progress}
                      transition_theme={transition_theme}
                    />
                  );
                })}
              </View>

              <View style={styles.preferenceCopy}>
                <View style={styles.preferenceHeaderRow}>
                  <Text
                    style={[
                      styles.preferenceTitle,
                      scaled_text_styles.preferenceTitle,
                      { color: theme.colors.ink },
                    ]}
                  >
                    Text size
                  </Text>
                  <Text
                    style={[
                      styles.textScaleValue,
                      scaled_text_styles.textScaleValue,
                      { color: theme.colors.accentStrong },
                    ]}
                  >
                    {formatTextScaleLabel(text_scale)}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.preferenceBody,
                    scaled_text_styles.preferenceBody,
                    { color: theme.colors.inkSoft },
                  ]}
                >
                  Adjust font size throughout the app.
                </Text>
              </View>

              <View style={styles.sliderWrap}>
                <Slider
                  maximumTrackTintColor={theme.colors.line}
                  maximumValue={TEXT_SCALE_PRESET_COUNT - 1}
                  minimumTrackTintColor={theme.colors.accent}
                  minimumValue={0}
                  onSlidingComplete={(next_slider_index) => {
                    AppStore.set_text_scale(
                      getTextScaleForSliderIndex(next_slider_index),
                    );
                  }}
                  onValueChange={(next_slider_index) => {
                    AppStore.apply_text_scale(
                      getTextScaleForSliderIndex(next_slider_index),
                    );
                  }}
                  step={1}
                  thumbTintColor={theme.colors.accentStrong}
                  value={text_scale_slider_index}
                />
                <View style={styles.sliderMarkersRow}>
                  <Text
                    style={[
                      styles.sliderMarkerLabel,
                      scaled_text_styles.sliderMarkerLabel,
                      { color: theme.colors.inkSoft },
                    ]}
                  >
                    {formatTextScaleLabel(MIN_TEXT_SCALE)}
                  </Text>
                  <Text
                    style={[
                      styles.sliderMarkerLabel,
                      scaled_text_styles.sliderMarkerLabel,
                      { color: theme.colors.accentStrong },
                    ]}
                  >
                    {formatTextScaleLabel(DEFAULT_TEXT_SCALE)}
                  </Text>
                  <Text
                    style={[
                      styles.sliderMarkerLabel,
                      scaled_text_styles.sliderMarkerLabel,
                      { color: theme.colors.inkSoft },
                    ]}
                  >
                    {formatTextScaleLabel(MAX_TEXT_SCALE)}
                  </Text>
                </View>
                <View style={styles.sliderStepDotsRow}>
                  {Array.from({ length: TEXT_SCALE_PRESET_COUNT }).map((_, index) => {
                    const is_active = index === text_scale_slider_index;

                    return (
                      <View
                        key={`text-scale-step-${index}`}
                        style={[
                          styles.sliderStepDot,
                          {
                            backgroundColor: is_active
                              ? theme.colors.accentStrong
                              : theme.colors.line,
                            opacity: is_active ? 1 : 0.72,
                          },
                        ]}
                      />
                    );
                  })}
                </View>
              </View>
            </View>
          </AuthCard>

          <View style={styles.signOutContainer}>
            <PrimaryButton
              label="Sign out"
              onPress={Auth.sign_out}
              variant="ghost"
              disabled={is_busy}
              theme={theme}
              textStyle={{ color: theme.colors.danger }}
            />
          </View>
        </View>
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
  scaled_text_styles,
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
        <Animated.Text
          style={[
            styles.paletteLabel,
            scaled_text_styles.paletteLabel,
            label_style,
          ]}
        >
          {label}
        </Animated.Text>
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
    paddingHorizontal: SCREEN_HORIZONTAL_PADDING,
    paddingBottom: 24,
  },
  card: {
    padding: 22,
  },
  cardStack: {
    gap: 14,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  avatarInitial: {
    fontFamily: 'Newsreader_700Bold',
    fontSize: 14,
    lineHeight: 16,
  },
  profileMeta: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  signedInAs: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.2,
    lineHeight: 16,
  },
  profileName: {
    flexShrink: 1,
    fontFamily: 'Newsreader_600SemiBold',
    fontSize: 22,
    lineHeight: 26,
  },
  profileHandle: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.2,
    lineHeight: 20,
  },
  preferenceStack: {
    gap: 16,
  },
  preferenceCopy: {
    gap: 4,
  },
  preferenceHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  preferenceTitle: {
    fontFamily: 'Newsreader_600SemiBold',
    fontSize: 22,
    lineHeight: 26,
  },
  preferenceBody: {
    fontSize: 14,
    lineHeight: 20,
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
  sliderWrap: {
    marginTop: -2,
  },
  sliderMarkersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  sliderMarkerLabel: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  sliderStepDotsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingHorizontal: 4,
  },
  sliderStepDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  signOutContainer: {
    marginTop: 8,
  },
  textScaleValue: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
});

export default observer(AccountScreen);
