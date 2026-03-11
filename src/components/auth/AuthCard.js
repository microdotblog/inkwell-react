import React from 'react';
import { StyleSheet, View } from 'react-native';

export default function AuthCard({ children, style, theme }) {
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.paper,
          borderColor: theme.colors.line,
          shadowColor: theme.colors.shadow,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 28,
    borderWidth: 1,
    padding: 24,
    shadowOffset: {
      width: 0,
      height: 18,
    },
    shadowOpacity: 1,
    shadowRadius: 36,
    elevation: 10,
  },
});
