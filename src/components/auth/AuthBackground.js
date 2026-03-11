import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function AuthBackground({ theme }) {
  return (
    <View pointerEvents="none" style={styles.container}>
      <LinearGradient
        colors={theme.gradients.background}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.canvas}
      />
      <LinearGradient
        colors={theme.gradients.heroGlow}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroGlow}
      />
      <LinearGradient
        colors={theme.gradients.topOrb}
        start={{ x: 0.3, y: 0.1 }}
        end={{ x: 1, y: 1 }}
        style={styles.topOrb}
      />
      <LinearGradient
        colors={theme.gradients.bottomOrb}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.bottomOrb}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
  },
  canvas: {
    ...StyleSheet.absoluteFillObject,
  },
  heroGlow: {
    position: 'absolute',
    top: -90,
    right: -40,
    width: 260,
    height: 260,
    borderRadius: 130,
  },
  topOrb: {
    position: 'absolute',
    top: 90,
    right: -70,
    width: 240,
    height: 240,
    borderRadius: 120,
  },
  bottomOrb: {
    position: 'absolute',
    bottom: -110,
    left: -30,
    width: 280,
    height: 280,
    borderRadius: 140,
  },
});
