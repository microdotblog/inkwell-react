const baseTheme = {
  spacing: {
    xSmall: 8,
    small: 12,
    medium: 16,
    large: 24,
    xLarge: 32,
    xxLarge: 40,
  },
  radius: {
    pill: 999,
    medium: 18,
    large: 28,
  },
  typography: {
    display: 'Newsreader_600SemiBold',
    displayStrong: 'Newsreader_700Bold',
  },
};

const lightColors = {
  canvas: '#f6f1e6',
  paper: 'rgba(255, 255, 255, 0.72)',
  paperMuted: '#f4f6f9',
  ink: '#1d1a16',
  inkSoft: '#6b6258',
  accent: '#355c7d',
  accentStrong: '#4779b2',
  accentSoft: '#d7e3f2',
  line: 'rgba(29, 26, 22, 0.10)',
  white: '#ffffff',
  shadow: 'rgba(23, 18, 12, 0.12)',
  glow: 'rgba(71, 121, 178, 0.20)',
  badge: 'rgba(255, 255, 255, 0.62)',
  buttonGhost: 'rgba(255, 255, 255, 0.68)',
};

const darkColors = {
  canvas: '#111821',
  paper: 'rgba(28, 36, 48, 0.84)',
  paperMuted: '#212a38',
  ink: '#f4f6fb',
  inkSoft: '#b5bdcb',
  accent: '#4779b2',
  accentStrong: '#7cb7ff',
  accentSoft: '#2a3648',
  line: 'rgba(212, 223, 242, 0.16)',
  white: '#ffffff',
  shadow: 'rgba(2, 4, 8, 0.52)',
  glow: 'rgba(124, 183, 255, 0.24)',
  badge: 'rgba(28, 36, 48, 0.74)',
  buttonGhost: 'rgba(36, 46, 61, 0.76)',
};

export function getAuthTheme(isDark) {
  return {
    ...baseTheme,
    isDark,
    colors: isDark ? darkColors : lightColors,
    gradients: isDark
      ? {
          background: ['#121a24', '#17212d', '#111821'],
          heroGlow: ['rgba(71, 121, 178, 0.28)', 'rgba(71, 121, 178, 0.03)'],
          topOrb: ['rgba(124, 183, 255, 0.22)', 'rgba(124, 183, 255, 0)'],
          bottomOrb: ['rgba(83, 105, 132, 0.34)', 'rgba(83, 105, 132, 0.04)'],
        }
      : {
          background: ['#fbf7ef', '#f6f1e6', '#f8f4ec'],
          heroGlow: ['rgba(71, 121, 178, 0.18)', 'rgba(71, 121, 178, 0.02)'],
          topOrb: ['rgba(255, 255, 255, 0.92)', 'rgba(255, 255, 255, 0)'],
          bottomOrb: ['rgba(232, 221, 203, 0.8)', 'rgba(232, 221, 203, 0.08)'],
        },
  };
}
