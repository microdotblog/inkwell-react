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

export const DEFAULT_ACCENT_PALETTE_ID = 'purple';

const sharedLightColors = {
  ink: '#1f1930',
  inkSoft: '#69627f',
  line: 'rgba(38, 34, 54, 0.10)',
  white: '#ffffff',
  shadow: 'rgba(24, 20, 40, 0.14)',
};

const sharedDarkColors = {
  ink: '#f5f2ff',
  inkSoft: '#c5bedc',
  line: 'rgba(232, 228, 248, 0.16)',
  white: '#ffffff',
  shadow: 'rgba(4, 3, 10, 0.52)',
};

const accentPalettes = {
  blue: {
    label: 'Blue',
    light: {
      swatch: '#538fd8',
      colors: {
        canvas: '#f2f7ff',
        paper: 'rgba(255, 255, 255, 0.78)',
        paperMuted: '#e9f0fb',
        accent: '#4478bb',
        accentStrong: '#538fd8',
        accentSoft: '#dbe9ff',
        glow: 'rgba(83, 143, 216, 0.24)',
        badge: 'rgba(248, 251, 255, 0.76)',
        buttonGhost: 'rgba(250, 252, 255, 0.80)',
      },
      background: {
        imageOpacity: 0.92,
        waveScale: 1.1,
        base: ['#ffffff', '#f2f7ff', '#e3ecfb'],
        tint: [
          'rgba(255, 255, 255, 0.05)',
          'rgba(166, 203, 255, 0.18)',
          'rgba(78, 128, 198, 0.22)',
        ],
        glow: [
          'rgba(255, 255, 255, 0.58)',
          'rgba(198, 225, 255, 0.18)',
          'rgba(255, 255, 255, 0)',
        ],
        edge: [
          'rgba(255, 255, 255, 0.08)',
          'rgba(255, 255, 255, 0.02)',
          'rgba(68, 120, 187, 0.14)',
        ],
      },
    },
    dark: {
      swatch: '#9fc4ff',
      colors: {
        canvas: '#101827',
        paper: 'rgba(24, 33, 48, 0.84)',
        paperMuted: '#1f2b3e',
        accent: '#5c8bdb',
        accentStrong: '#9fc4ff',
        accentSoft: '#2d3b52',
        glow: 'rgba(124, 183, 255, 0.34)',
        badge: 'rgba(22, 30, 44, 0.78)',
        buttonGhost: 'rgba(31, 40, 58, 0.80)',
      },
      background: {
        imageOpacity: 0.32,
        waveScale: 1.18,
        base: ['#172236', '#121a29', '#101827'],
        tint: [
          'rgba(25, 34, 52, 0.08)',
          'rgba(74, 112, 184, 0.24)',
          'rgba(16, 24, 39, 0.70)',
        ],
        glow: [
          'rgba(180, 214, 255, 0.20)',
          'rgba(92, 139, 219, 0.12)',
          'rgba(16, 24, 39, 0)',
        ],
        edge: [
          'rgba(255, 255, 255, 0.02)',
          'rgba(10, 14, 22, 0.08)',
          'rgba(9, 12, 19, 0.40)',
        ],
      },
    },
  },
  purple: {
    label: 'Purple',
    light: {
      swatch: '#765eef',
      colors: {
        canvas: '#f5f2ff',
        paper: 'rgba(255, 255, 255, 0.76)',
        paperMuted: '#f1ecfb',
        accent: '#6856cd',
        accentStrong: '#765eef',
        accentSoft: '#e6ddff',
        glow: 'rgba(118, 94, 239, 0.24)',
        badge: 'rgba(250, 246, 255, 0.74)',
        buttonGhost: 'rgba(252, 248, 255, 0.78)',
      },
      background: {
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
    },
    dark: {
      swatch: '#b5a8ff',
      colors: {
        canvas: '#120f1d',
        paper: 'rgba(30, 25, 47, 0.84)',
        paperMuted: '#26213b',
        accent: '#7968e6',
        accentStrong: '#b5a8ff',
        accentSoft: '#342d52',
        glow: 'rgba(153, 138, 255, 0.34)',
        badge: 'rgba(28, 23, 43, 0.78)',
        buttonGhost: 'rgba(40, 34, 59, 0.80)',
      },
      background: {
        imageOpacity: 0.30,
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
      },
    },
  },
  teal: {
    label: 'Teal',
    light: {
      swatch: '#27a79a',
      colors: {
        canvas: '#eef8f7',
        paper: 'rgba(255, 255, 255, 0.78)',
        paperMuted: '#e4f3f1',
        accent: '#2f9388',
        accentStrong: '#27a79a',
        accentSoft: '#d4f4ee',
        glow: 'rgba(39, 167, 154, 0.24)',
        badge: 'rgba(245, 252, 251, 0.76)',
        buttonGhost: 'rgba(247, 253, 252, 0.80)',
      },
      background: {
        imageOpacity: 0.92,
        waveScale: 1.1,
        base: ['#fbfffe', '#eef8f7', '#deefec'],
        tint: [
          'rgba(255, 255, 255, 0.05)',
          'rgba(151, 231, 223, 0.18)',
          'rgba(53, 156, 148, 0.22)',
        ],
        glow: [
          'rgba(255, 255, 255, 0.58)',
          'rgba(191, 245, 239, 0.18)',
          'rgba(255, 255, 255, 0)',
        ],
        edge: [
          'rgba(255, 255, 255, 0.08)',
          'rgba(255, 255, 255, 0.02)',
          'rgba(47, 147, 136, 0.14)',
        ],
      },
    },
    dark: {
      swatch: '#7ed9cf',
      colors: {
        canvas: '#0e1d1c',
        paper: 'rgba(23, 40, 38, 0.84)',
        paperMuted: '#1a312f',
        accent: '#3aa79a',
        accentStrong: '#7ed9cf',
        accentSoft: '#214541',
        glow: 'rgba(126, 217, 207, 0.30)',
        badge: 'rgba(19, 35, 34, 0.78)',
        buttonGhost: 'rgba(27, 46, 44, 0.80)',
      },
      background: {
        imageOpacity: 0.30,
        waveScale: 1.18,
        base: ['#132827', '#10201f', '#0e1d1c'],
        tint: [
          'rgba(18, 38, 37, 0.08)',
          'rgba(41, 138, 130, 0.24)',
          'rgba(14, 29, 28, 0.70)',
        ],
        glow: [
          'rgba(175, 241, 235, 0.18)',
          'rgba(58, 167, 154, 0.10)',
          'rgba(14, 29, 28, 0)',
        ],
        edge: [
          'rgba(255, 255, 255, 0.02)',
          'rgba(9, 19, 18, 0.08)',
          'rgba(8, 17, 16, 0.40)',
        ],
      },
    },
  },
  rose: {
    label: 'Rose',
    light: {
      swatch: '#dd749b',
      colors: {
        canvas: '#fff4f8',
        paper: 'rgba(255, 255, 255, 0.78)',
        paperMuted: '#fce8ef',
        accent: '#c65b84',
        accentStrong: '#dd749b',
        accentSoft: '#ffdbe7',
        glow: 'rgba(221, 116, 155, 0.24)',
        badge: 'rgba(255, 247, 250, 0.78)',
        buttonGhost: 'rgba(255, 249, 252, 0.82)',
      },
      background: {
        imageOpacity: 0.92,
        waveScale: 1.1,
        base: ['#fffdfd', '#fff4f8', '#fae4ed'],
        tint: [
          'rgba(255, 255, 255, 0.05)',
          'rgba(255, 186, 210, 0.18)',
          'rgba(208, 95, 138, 0.22)',
        ],
        glow: [
          'rgba(255, 255, 255, 0.58)',
          'rgba(255, 218, 230, 0.18)',
          'rgba(255, 255, 255, 0)',
        ],
        edge: [
          'rgba(255, 255, 255, 0.08)',
          'rgba(255, 255, 255, 0.02)',
          'rgba(198, 91, 132, 0.14)',
        ],
      },
    },
    dark: {
      swatch: '#f1a5c1',
      colors: {
        canvas: '#20101a',
        paper: 'rgba(46, 24, 36, 0.84)',
        paperMuted: '#382230',
        accent: '#cc6f94',
        accentStrong: '#f1a5c1',
        accentSoft: '#5a3043',
        glow: 'rgba(241, 165, 193, 0.28)',
        badge: 'rgba(42, 22, 33, 0.78)',
        buttonGhost: 'rgba(55, 30, 42, 0.80)',
      },
      background: {
        imageOpacity: 0.30,
        waveScale: 1.18,
        base: ['#2b1621', '#24121c', '#20101a'],
        tint: [
          'rgba(53, 26, 38, 0.08)',
          'rgba(164, 72, 110, 0.22)',
          'rgba(32, 16, 26, 0.70)',
        ],
        glow: [
          'rgba(255, 202, 221, 0.18)',
          'rgba(204, 111, 148, 0.10)',
          'rgba(32, 16, 26, 0)',
        ],
        edge: [
          'rgba(255, 255, 255, 0.02)',
          'rgba(20, 10, 15, 0.08)',
          'rgba(18, 9, 14, 0.40)',
        ],
      },
    },
  },
};

export const ACCENT_PALETTE_OPTIONS = Object.freeze([
  {
    id: 'blue',
    label: accentPalettes.blue.label,
    light_swatch: accentPalettes.blue.light.swatch,
    dark_swatch: accentPalettes.blue.dark.swatch,
  },
  {
    id: 'purple',
    label: accentPalettes.purple.label,
    light_swatch: accentPalettes.purple.light.swatch,
    dark_swatch: accentPalettes.purple.dark.swatch,
  },
  {
    id: 'teal',
    label: accentPalettes.teal.label,
    light_swatch: accentPalettes.teal.light.swatch,
    dark_swatch: accentPalettes.teal.dark.swatch,
  },
  {
    id: 'rose',
    label: accentPalettes.rose.label,
    light_swatch: accentPalettes.rose.light.swatch,
    dark_swatch: accentPalettes.rose.dark.swatch,
  },
]);

export function normalizeAccentPaletteId(accent_palette_id = '') {
  const normalized_palette_id = `${accent_palette_id || ''}`.trim().toLowerCase();

  if (accentPalettes[normalized_palette_id]) {
    return normalized_palette_id;
  } else {
    return DEFAULT_ACCENT_PALETTE_ID;
  }
}

export function getAuthTheme(isDark, accent_palette_id = DEFAULT_ACCENT_PALETTE_ID) {
  const normalized_palette_id = normalizeAccentPaletteId(accent_palette_id);
  const palette = accentPalettes[normalized_palette_id];
  const shared_colors = isDark ? sharedDarkColors : sharedLightColors;
  const palette_mode = isDark ? palette.dark : palette.light;

  return {
    ...baseTheme,
    isDark,
    accent_palette_id: normalized_palette_id,
    colors: {
      ...shared_colors,
      ...palette_mode.colors,
    },
    background: palette_mode.background,
  };
}
