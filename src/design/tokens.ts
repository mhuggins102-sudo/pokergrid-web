/*
 * Typed mirror of tokens.css. Use these when a value is needed in JS/TS
 * (canvas drawing, motion springs, computed styles); use the CSS custom
 * properties everywhere else. Keep the two files in sync.
 */

export const colors = {
  // Surfaces
  paper: '#faf7f1',
  paperRaised: '#ffffff',
  paperSunken: '#f2ecdf',
  felt: '#1f5d43',

  // Ink
  ink: '#1a1a1a',
  ink2: '#5f5a51',
  ink3: '#938c7d',
  hairline: 'rgba(26, 26, 26, 0.14)',
  scrim: 'rgba(26, 26, 26, 0.4)',
  rule: '#d9d1c0',

  // Card faces
  cardFace: '#fffdf8',
  cardRed: '#b3262e',
  cardBlack: '#1f1f1f',
  cardBack: '#28486e',

  // Suit chips
  suitH: '#b3262e',
  suitD: '#1d5fa0',
  suitC: '#2f7d4f',
  suitS: '#1f2937',
  joker: '#6d4fa3',

  // Signals
  accent: '#1f5d43',
  warn: '#b07d2e',
  danger: '#9a2433',
  success: '#2f7d4f',
} as const;

export const difficultyColors = {
  easy: '#2f7d4f',
  medium: '#b07d2e',
  hard: '#c2542e',
  extreme: '#9a2433',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  xs: 2,
  sm: 6,
  md: 10,
  lg: 16,
  pill: 999,
} as const;

export const shadows = {
  sm: '0 1px 2px rgba(26, 26, 26, 0.08)',
  md: '0 2px 8px rgba(26, 26, 26, 0.10)',
  lg: '0 8px 24px rgba(26, 26, 26, 0.14)',
} as const;

export const fonts = {
  display: "'Fraunces Variable', Georgia, 'Times New Roman', serif",
  body: "'Inter Variable', system-ui, -apple-system, 'Segoe UI', sans-serif",
} as const;

export type ColorToken = keyof typeof colors;
export type SpacingToken = keyof typeof spacing;
export type RadiusToken = keyof typeof radius;
export type Difficulty = keyof typeof difficultyColors;
