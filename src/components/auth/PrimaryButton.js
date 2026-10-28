import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { observer } from 'mobx-react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { getAuthTheme } from '../../theme/authTheme';

function darkenHexColor(hex_color, amount = 0) {
  const normalized_hex = `${hex_color || ''}`.trim().replace('#', '');

  if (!/^[0-9a-fA-F]{6}$/.test(normalized_hex)) {
    return hex_color;
  }

  const clamp_channel = channel => {
    return Math.max(0, Math.min(255, Math.round(channel * (1 - amount))));
  };
  const red = clamp_channel(parseInt(normalized_hex.slice(0, 2), 16));
  const green = clamp_channel(parseInt(normalized_hex.slice(2, 4), 16));
  const blue = clamp_channel(parseInt(normalized_hex.slice(4, 6), 16));

  return `#${[red, green, blue].map(channel => channel.toString(16).padStart(2, '0')).join('')}`;
}

function contrastingLabelColor(background_color = '') {
  const hex = background_color.replace('#', '');
  const channels = [0, 2, 4].map((offset) => {
    const channel = parseInt(hex.slice(offset, offset + 2), 16) / 255;

    if (channel <= 0.04045) {
      return channel / 12.92;
    } else {
      return ((channel + 0.055) / 1.055) ** 2.4;
    }
  });
  const luminance =
    channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  const white_contrast = 1.05 / (luminance + 0.05);
  const black_contrast = (luminance + 0.05) / 0.05;

  return white_contrast >= black_contrast ? '#ffffff' : '#000000';
}

function PrimaryButton({
  label,
  onPress,
  onLongPress = null,
  variant = 'solid',
  style,
  textStyle,
  theme,
  disabled = false,
  leadingIconSource = null,
}) {
  const scale = useSharedValue(1);
  const did_long_press_ref = React.useRef(false);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  }, []);

  function handlePressIn() {
    if (disabled) {
      return;
    }

    scale.value = withSpring(0.985, {
      damping: 18,
      stiffness: 240,
    });
  }

  function handlePressOut() {
    if (disabled) {
      return;
    }

    scale.value = withSpring(1, {
      damping: 16,
      stiffness: 220,
    });

    if (did_long_press_ref.current) {
      setTimeout(() => {
        did_long_press_ref.current = false;
      }, 0);
    }
  }

  function handlePress(event) {
    if (disabled) {
      return;
    }

    if (did_long_press_ref.current) {
      did_long_press_ref.current = false;
      return;
    }

    onPress?.(event);
  }

  function handleLongPress(event) {
    if (disabled || !onLongPress) {
      return;
    }

    did_long_press_ref.current = true;
    onLongPress(event);
  }

  const solid_background_color = theme.isDark
    ? getAuthTheme(false, theme.accent_palette_id).colors.accent
    : theme.colors.accent;
  const solid_label_color = theme.isDark
    ? theme.colors.white
    : contrastingLabelColor(solid_background_color);

  return (
    <Animated.View style={[animatedStyle, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onLongPress={onLongPress ? handleLongPress : undefined}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={({ pressed }) => [
          styles.button,
          variant === 'ghost'
            ? [
                styles.ghostButton,
                {
                  backgroundColor: theme.colors.buttonGhost,
                  borderColor: theme.colors.line,
                },
              ]
            : [
                styles.solidButton,
                theme.isDark ? styles.darkSolidButton : styles.lightSolidButton,
                {
                  backgroundColor: solid_background_color,
                  shadowColor: theme.colors.glow,
                  borderColor: theme.isDark
                    ? darkenHexColor(solid_background_color, 0.08)
                    : theme.colors.accentStrong,
                },
              ],
          pressed && !disabled ? styles.pressed : null,
          disabled ? styles.disabled : null,
        ]}
      >
        <View style={styles.content}>
          {leadingIconSource ? (
            <Image
              accessibilityIgnoresInvertColors
              contentFit="contain"
              source={leadingIconSource}
              style={styles.leadingIcon}
            />
          ) : null}
          <Text
            style={[
              styles.label,
              variant === 'ghost'
                ? [styles.ghostLabel, { color: theme.colors.ink }]
                : { color: solid_label_color },
              textStyle,
            ]}
          >
            {label}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 56,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    overflow: 'hidden',
    position: 'relative',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    zIndex: 1,
  },
  solidButton: {
    borderWidth: 1,
    shadowOffset: {
      width: 0,
      height: 14,
    },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 4,
  },
  lightSolidButton: {
    shadowOpacity: 0.38,
    shadowRadius: 28,
    elevation: 10,
  },
  darkSolidButton: {
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 4,
  },
  ghostButton: {
    borderWidth: 1,
  },
  pressed: {
    opacity: 0.96,
  },
  disabled: {
    opacity: 0.58,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  leadingIcon: {
    width: 20,
    height: 20,
  },
  ghostLabel: {},
});

export default observer(PrimaryButton);
