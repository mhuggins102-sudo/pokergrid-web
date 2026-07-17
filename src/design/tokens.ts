/*
 * Typed mirror of tokens.css. Use these when a value is needed in JS/TS
 * (canvas drawing, motion springs, computed styles); use the CSS custom
 * properties everywhere else. Keep the two files in sync.
 */

export const colors = {
  // Surfaces (Morning Paper light — Broadsheet)
  paper: '#f4f1e8',
  paperRaised: '#faf9f5', // = color-mix(#fff 58%, #f4f1e8)
  paperSunken: '#e8e4d8',
  felt: '#1f5d43',

  // Ink
  ink: '#1a1a16',
  ink2: '#66645a',
  ink3: '#726e60',
  hairline: 'rgba(26, 26, 22, 0.18)',
  scrim: 'rgba(26, 26, 22, 0.5)',
  rule: 'rgba(26, 26, 22, 0.55)',

  // Card faces
  cardFace: '#fffef9',
  cardRed: '#7a1f2b',
  cardBlack: '#1a1a16',
  cardBack: '#5a3038',

  // Suit chips
  suitH: '#7a1f2b',
  suitD: '#1d5fa0',
  suitC: '#2f7d4f',
  suitS: '#1a1a16',
  joker: '#6d4fa3',

  // Signals
  accent: '#7a1f2b',
  // Text/glyphs on an accent/warn fill — white here (Morning Paper
  // light); the dark themes flip --on-accent to near-black in CSS.
  onAccent: '#ffffff',
  // Text on a --danger fill — white in every theme (see --on-danger).
  onDanger: '#ffffff',
  warn: '#9a7b1f',
  danger: '#8c2f2f',
  success: '#3f7a4a',
} as const;

// var() references so difficulty tones follow the active theme (dark
// lifts them for contrast). Every consumer feeds these into CSS custom
// properties / inline styles, where var() resolves — never canvas.
export const difficultyColors = {
  easy: 'var(--difficulty-easy)',
  medium: 'var(--difficulty-medium)',
  hard: 'var(--difficulty-hard)',
  extreme: 'var(--difficulty-extreme)',
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

// Board geometry — the 5×5 grid gap, shared by GridBoard and LineRails
// (--board-gap in tokens.css). Off the spacing scale on purpose.
export const boardGap = 6;

export const shadows = {
  sm: '0 1px 2px rgba(26, 26, 26, 0.08)',
  md: '0 2px 8px rgba(26, 26, 26, 0.10)',
  lg: '0 8px 24px rgba(26, 26, 26, 0.14)',
} as const;

export const fonts = {
  display: "'Fraunces Variable', 'Fraunces', Georgia, serif",
  // Morning Paper body (Card Room uses Space Grotesk — see tokens.css).
  body: "'Inter Variable', 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif",
} as const;

export type ColorToken = keyof typeof colors;
export type SpacingToken = keyof typeof spacing;
export type RadiusToken = keyof typeof radius;
export type Difficulty = keyof typeof difficultyColors;
