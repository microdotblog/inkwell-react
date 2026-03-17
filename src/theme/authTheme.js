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
  canvas: '#f5f2ff',
  paper: 'rgba(255, 255, 255, 0.76)',
  paperMuted: '#f1ecfb',
  ink: '#1f1930',
  inkSoft: '#69627f',
  accent: '#6856cd',
  accentStrong: '#765eef',
  accentSoft: '#e6ddff',
  line: 'rgba(40, 28, 76, 0.10)',
  white: '#ffffff',
  shadow: 'rgba(32, 22, 64, 0.14)',
  glow: 'rgba(118, 94, 239, 0.24)',
  badge: 'rgba(250, 246, 255, 0.74)',
  buttonGhost: 'rgba(252, 248, 255, 0.78)',
};

const darkColors = {
  canvas: '#120f1d',
  paper: 'rgba(30, 25, 47, 0.84)',
  paperMuted: '#26213b',
  ink: '#f5f2ff',
  inkSoft: '#c5bedc',
  accent: '#7968e6',
  accentStrong: '#b5a8ff',
  accentSoft: '#342d52',
  line: 'rgba(224, 216, 255, 0.16)',
  white: '#ffffff',
  shadow: 'rgba(4, 3, 10, 0.52)',
  glow: 'rgba(153, 138, 255, 0.34)',
  badge: 'rgba(28, 23, 43, 0.78)',
  buttonGhost: 'rgba(40, 34, 59, 0.80)',
};

export function getAuthTheme(isDark) {
  return {
    ...baseTheme,
    isDark,
    colors: isDark ? darkColors : lightColors,
    background: isDark
      ? {
          imageOpacity: 0.3,
          waveScale: 1.18,
          base: ['#1a152b', '#171224', '#120f1d'],
          tint: [
            'rgba(30, 24, 52, 0.06)',
            'rgba(94, 74, 184, 0.24)',
            'rgba(18, 15, 29, 0.70)',
          ],
          glow: [
            'rgba(180, 169, 255, 0.20)',
            'rgba(105, 82, 205, 0.10)',
            'rgba(18, 15, 29, 0)',
          ],
          edge: [
            'rgba(255, 255, 255, 0.02)',
            'rgba(10, 8, 18, 0.08)',
            'rgba(9, 7, 18, 0.40)',
          ],
        }
      : {
          imageOpacity: 0.92,
          waveScale: 1.1,
          base: ['#fffeff', '#f7f3ff', '#ede7ff'],
          tint: [
            'rgba(255, 255, 255, 0.05)',
            'rgba(170, 152, 255, 0.18)',
            'rgba(112, 86, 207, 0.24)',
          ],
          glow: [
            'rgba(255, 255, 255, 0.58)',
            'rgba(196, 183, 255, 0.18)',
            'rgba(255, 255, 255, 0)',
          ],
          edge: [
            'rgba(255, 255, 255, 0.08)',
            'rgba(255, 255, 255, 0.02)',
            'rgba(94, 65, 184, 0.14)',
          ],
        },
  };
}
