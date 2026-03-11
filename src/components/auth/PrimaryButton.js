import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

export default function PrimaryButton({
  label,
  onPress,
  variant = 'solid',
  style,
  textStyle,
  theme,
}) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  }, []);

  function handlePressIn() {
    scale.value = withSpring(0.985, {
      damping: 18,
      stiffness: 240,
    });
  }

  function handlePressOut() {
    scale.value = withSpring(1, {
      damping: 16,
      stiffness: 220,
    });
  }

  return (
    <Animated.View style={[animatedStyle, style]}>
      <Pressable
        accessibilityRole="button"
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
          pressed ? styles.pressed : null,
        ]}
      >
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
  label: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  solidLabel: {
    color: '#ffffff',
  },
  ghostLabel: {},
});
