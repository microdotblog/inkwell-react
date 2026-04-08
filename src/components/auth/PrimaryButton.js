import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { observer } from 'mobx-react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import AppStore from '../../stores/App';
import { getScaledTextStyle } from '../../theme/textScale';

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
  const text_scale = AppStore.text_scale;
  const scaled_label_style = React.useMemo(() => {
    return getScaledTextStyle(styles.label, text_scale);
  }, [text_scale]);
  const scaled_custom_text_style = React.useMemo(() => {
    return getScaledTextStyle(textStyle, text_scale);
  }, [textStyle, text_scale]);

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
                {
                  backgroundColor: theme.colors.accent,
                  shadowColor: theme.colors.glow,
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
              scaled_label_style,
              variant === 'ghost'
                ? [styles.ghostLabel, { color: theme.colors.ink }]
                : styles.solidLabel,
              textStyle,
              scaled_custom_text_style,
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
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  solidButton: {
    shadowOffset: {
      width: 0,
      height: 14,
    },
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
  solidLabel: {
    color: '#ffffff',
  },
  ghostLabel: {},
});

export default observer(PrimaryButton);
