// Unlock catalog — maps Claude Design's card-face skins (deckSkins.ts)
// onto the player-level progression + the store's group entries.
//
// Groupings and levels here are the product config for the deck-skin store;
// only this file changes when they're tuned — the engine, CardFace, and
// store all read it as-is. Claude Design's deckSkins.ts stays the visual
// source of truth (its SKINS names are their gallery labels); we relabel to
// short, in-app names via NAME_OVERRIDES below.

import { SKINS } from './deckSkins';

/*
 * Short in-app display names. Claude Design's SKINS carry descriptive
 * gallery labels ("Gradient wash · corner fade"); the store wants one- or
 * two-word names, so we override per id here without touching deckSkins.ts.
 * Provisional — a first pass on the names the user hasn't fixed yet.
 */
const NAME_OVERRIDES: Record<string, string> = {
  // Singles
  D05a: 'Twin',
  D06c: 'Quad',
  D16: 'Big pip',
  D24: 'Ticket',
  EX13: 'Court',
  // Bordered group
  D21: 'Keyline',
  D41c: 'Filigree',
  D55b: 'Rope',
  // Emboss group
  D42: 'Emboss',
  D42a: 'Double ring',
  // Neon group (fixed-palette fluorescents)
  EX6: 'Lime',
  EX16: 'Sunset',
  EX17: 'Aqua',
  // Wash group
  D27b: 'Wash',
  D27c: 'Framed wash',
  W1: 'Corner fade',
  W2: 'Deep sweep',
  W3: 'Radial glow',
  // Wanted group
  D51a: 'Wanted',
  N1: 'Roped',
  N2: 'Sepia',
  // Pastel group
  P1: 'Mint',
  P3: 'Rose',
  // Bamboo group
  D62c: 'Bamboo',
  C2: 'Ivory',
  // Terrain — Set 1
  D64: 'Dunes',
  D65b: 'Clay',
  D67b: 'Forest',
  // Terrain — Set 2
  L1: 'Lava',
  D69b: 'Ice',
  D70c: 'Meadow',
  // Space group
  SP1: 'Cosmos',
  D69c: 'Aurora',
  // Prism group
  PZ1: 'Facet',
  PZ2: 'Shard',
  // Music sets
  MU1: 'Melt',
  MU2: 'Synthwave',
  MU3: 'Equalizer',
  MU4: 'Disco',
  // Art sets
  AR1: 'Deco',
  AR2: 'De Stijl',
  AR3: 'Bauhaus',
  AR4: 'Impression',
  AR5: 'Pop art',
};

const nameOf = (id: string): string =>
  NAME_OVERRIDES[id] ?? SKINS.find(s => s.id === id)?.name ?? id;

export interface SkinUnlock {
  /** Store-entry id (stable key). */
  id: string;
  /** Display name — the group name for a group, the skin name for a single. */
  name: string;
  /** Player level required to unlock (1 = available from the start). */
  level: number;
  /**
   * The skin ids this entry unlocks. One id = a single design; more than
   * one = a group (all unlocked together, freely chosen).
   */
  skinIds: string[];
}

// Ordered by level — EVERY level 1…20 grants exactly one entry, so a
// level-up always has a reward to show. Groups collect a design family
// (the big families unlock as Sets at different levels, like Terrain);
// singles stand alone.
export const SKIN_CATALOG: SkinUnlock[] = [
  { id: 'twin', name: nameOf('D05a'), level: 1, skinIds: ['D05a'] },
  {
    id: 'wash',
    name: 'Wash',
    level: 2,
    skinIds: ['D27b', 'D27c', 'W1', 'W2', 'W3'],
  },
  { id: 'quad', name: nameOf('D06c'), level: 3, skinIds: ['D06c'] },
  { id: 'pastel', name: 'Pastel', level: 4, skinIds: ['P1', 'P3'] },
  { id: 'ticket', name: nameOf('D24'), level: 5, skinIds: ['D24'] },
  { id: 'emboss', name: 'Emboss', level: 6, skinIds: ['D42', 'D42a'] },
  { id: 'bigpip', name: nameOf('D16'), level: 7, skinIds: ['D16'] },
  // Keyline / Filigree / Rope — the frame-led designs, together.
  { id: 'bordered', name: 'Bordered', level: 8, skinIds: ['D21', 'D41c', 'D55b'] },
  {
    id: 'terrain-1',
    name: 'Terrain · Set 1',
    level: 9,
    skinIds: ['D64', 'D65b', 'D67b'],
  },
  { id: 'bamboo', name: 'Bamboo', level: 10, skinIds: ['D62c', 'C2'] },
  // Cosmos joins the existing Aurora ice — the night-sky pair.
  { id: 'space', name: 'Space', level: 11, skinIds: ['SP1', 'D69c'] },
  { id: 'music-1', name: 'Music · Set 1', level: 12, skinIds: ['MU1', 'MU4'] },
  {
    id: 'terrain-2',
    name: 'Terrain · Set 2',
    level: 13,
    skinIds: ['L1', 'D69b', 'D70c'],
  },
  { id: 'prism', name: 'Prism', level: 14, skinIds: ['PZ1', 'PZ2'] },
  // Single Old-timey court design (figures on J/Q/K, numerals otherwise).
  { id: 'court', name: nameOf('EX13'), level: 15, skinIds: ['EX13'] },
  { id: 'art-1', name: 'Art · Set 1', level: 16, skinIds: ['AR1', 'AR4'] },
  { id: 'music-2', name: 'Music · Set 2', level: 17, skinIds: ['MU2', 'MU3'] },
  {
    id: 'art-2',
    name: 'Art · Set 2',
    level: 18,
    skinIds: ['AR2', 'AR3', 'AR5'],
  },
  // Fixed-palette fluorescents — loud, off-theme, so a high unlock.
  { id: 'neon', name: 'Neon', level: 19, skinIds: ['EX6', 'EX16', 'EX17'] },
  { id: 'wanted', name: 'Wanted', level: 20, skinIds: ['D51a', 'N1', 'N2'] },
];

// id → level lookup (every skin across all entries).
const LEVEL_BY_SKIN: Record<string, number> = Object.fromEntries(
  SKIN_CATALOG.flatMap(u => u.skinIds.map(id => [id, u.level]))
);

export const skinUnlockLevel = (skinId: string): number =>
  LEVEL_BY_SKIN[skinId] ?? 1;

/** Is a skin unlocked at the player's current level? */
export const skinUnlocked = (skinId: string, playerLevel: number): boolean =>
  playerLevel >= skinUnlockLevel(skinId);

/** The skin name for a store label. */
export const skinName = nameOf;
