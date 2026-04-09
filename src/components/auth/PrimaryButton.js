import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { observer } from 'mobx-react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

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

function PrimaryButton({
  label,
  onPress,
  variant = 'solid',
  style,
  textStyle,
  theme,
  disabled = false,
  leadingIconSource = null,
}) {
  const scale = useSharedValue(1);

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
  }

  const solid_gradient_colors = theme.isDark
    ? [
        darkenHexColor(theme.colors.accent, 0.18),
        theme.colors.accent,
        darkenHexColor(theme.colors.accent, 0.08),
      ]
    : [theme.colors.accentStrong, theme.colors.accent, theme.colors.accentStrong];

  return (
    <Animated.View style={[animatedStyle, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
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
                  shadowColor: theme.colors.glow,
                  borderColor: theme.isDark
                    ? 'rgba(255, 255, 255, 0.10)'
                    : 'rgba(255, 255, 255, 0.28)',
                },
              ],
          pressed && !disabled ? styles.pressed : null,
          disabled ? styles.disabled : null,
        ]}
      >
        {variant === 'solid' ? (
          <LinearGradient
            colors={solid_gradient_colors}
            end={{ x: 1, y: 1 }}
            start={{ x: 0, y: 0 }}
            style={styles.solidFill}
          />
        ) : null}
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
                : styles.solidLabel,
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
  solidFill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
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
  solidLabel: {
    color: '#ffffff',
  },
  ghostLabel: {},
});

export default observer(PrimaryButton);
