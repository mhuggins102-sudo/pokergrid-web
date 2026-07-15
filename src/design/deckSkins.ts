// Deck skins — unlockable card-face designs. A skin overrides only the
// card FACE; the rest of the theme (surfaces, UI) is unchanged. The two
// theme-default looks (Morning Paper / Card Room) are NOT listed here —
// the store shows only the extra unlockables, gated by player level.
//
// PLACEHOLDER DATA: the `face` values are stand-in CSS backgrounds and the
// `level` gates are provisional. When Claude Design's images arrive, swap
// each `face` for the real full-face art and set the final levels. The
// SkinStore + CardFace read this shape as-is, so only the data changes.

export interface DeckSkin {
  id: string;
  name: string;
  /**
   * Stand-in card-face treatment: any CSS `background` value, painted
   * behind the rank + pips. Real skins replace this with a full-face
   * image (at which point the rank/pip overlay is dropped).
   */
  face: string;
  /** Optional rank/pip ink override so placeholders stay legible. */
  ink?: string;
}

export interface SkinUnlock {
  id: string;
  name: string;
  /** Player level required to unlock (1 = available from the start). */
  level: number;
  /**
   * One skin = a single design. More than one = a GROUP: reaching the
   * level unlocks them all, and the player freely picks among them.
   */
  skins: DeckSkin[];
}

// A tiny helper for legible placeholder gradients.
const grad = (a: string, b: string): string =>
  `linear-gradient(150deg, ${a}, ${b})`;

export const SKIN_CATALOG: SkinUnlock[] = [
  {
    id: 'sunrise',
    name: 'Sunrise',
    level: 1,
    skins: [{ id: 'sunrise', name: 'Sunrise', face: grad('#fff4e0', '#ffd9a8') }],
  },
  {
    id: 'slate',
    name: 'Slate',
    level: 2,
    skins: [
      { id: 'slate', name: 'Slate', face: grad('#e9edf2', '#c7cfd8'), ink: '#1f2933' },
    ],
  },
  {
    id: 'terrains',
    name: 'Terrains',
    level: 4,
    skins: [
      { id: 'terrain-grass', name: 'Meadow', face: grad('#e6f2d9', '#b7d99a') },
      { id: 'terrain-desert', name: 'Dunes', face: grad('#f6ead0', '#e6c98f') },
      { id: 'terrain-tundra', name: 'Tundra', face: grad('#eef4f7', '#c6d9e2') },
      { id: 'terrain-ocean', name: 'Tide', face: grad('#dff0f4', '#a7d3e0') },
    ],
  },
  {
    id: 'parchment',
    name: 'Parchment',
    level: 6,
    skins: [
      { id: 'parchment', name: 'Parchment', face: grad('#f7efd8', '#e6d5a8'), ink: '#5a4630' },
    ],
  },
  {
    id: 'neon',
    name: 'Neon',
    level: 8,
    skins: [
      { id: 'neon', name: 'Neon', face: grad('#1b1030', '#3a1a5c'), ink: '#f6e9ff' },
    ],
  },
  {
    id: 'woodgrain',
    name: 'Woodgrain',
    level: 10,
    skins: [
      { id: 'wood-oak', name: 'Oak', face: grad('#e7cfa6', '#c79a5f'), ink: '#4a2f16' },
      { id: 'wood-walnut', name: 'Walnut', face: grad('#c79a6b', '#7c4a26'), ink: '#2c1a0e' },
      { id: 'wood-ash', name: 'Ash', face: grad('#e9e2d4', '#c3b79f'), ink: '#3d352a' },
    ],
  },
  {
    id: 'midnight',
    name: 'Midnight',
    level: 12,
    skins: [
      { id: 'midnight', name: 'Midnight', face: grad('#0f1830', '#1e2c52'), ink: '#dbe6ff' },
    ],
  },
  {
    id: 'rose',
    name: 'Rose Gold',
    level: 14,
    skins: [
      { id: 'rose', name: 'Rose Gold', face: grad('#f7e0e6', '#e6a9bd'), ink: '#6b2438' },
    ],
  },
  {
    id: 'emerald',
    name: 'Emerald',
    level: 16,
    skins: [
      { id: 'emerald', name: 'Emerald', face: grad('#dff2e6', '#8fd0a8'), ink: '#123d29' },
    ],
  },
  {
    id: 'royal',
    name: 'Royal',
    level: 18,
    skins: [
      { id: 'royal-amethyst', name: 'Amethyst', face: grad('#ece0f5', '#b48fd6'), ink: '#3a1f56' },
      { id: 'royal-sapphire', name: 'Sapphire', face: grad('#dfe6f7', '#8fa9d6'), ink: '#1f2f56' },
    ],
  },
  {
    id: 'prismatic',
    name: 'Prismatic',
    level: 20,
    skins: [
      {
        id: 'prismatic',
        name: 'Prismatic',
        face: 'linear-gradient(135deg,#ffd1dc,#c9e8ff,#d6ffd8,#fff3c4)',
        ink: '#2a2a2a',
      },
    ],
  },
];

// Flat id → skin lookup (every variant across all unlock entries).
const SKIN_BY_ID: Record<string, DeckSkin> = Object.fromEntries(
  SKIN_CATALOG.flatMap(u => u.skins).map(s => [s.id, s])
);

// id → the level at which that skin becomes available.
const LEVEL_BY_SKIN: Record<string, number> = Object.fromEntries(
  SKIN_CATALOG.flatMap(u => u.skins.map(s => [s.id, u.level]))
);

export const findSkin = (id: string | null): DeckSkin | null =>
  id ? (SKIN_BY_ID[id] ?? null) : null;

export const skinUnlockLevel = (id: string): number => LEVEL_BY_SKIN[id] ?? 1;

/** Is a given skin unlocked at the player's current level? */
export const skinUnlocked = (id: string, playerLevel: number): boolean =>
  playerLevel >= skinUnlockLevel(id);
