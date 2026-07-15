// Unlock catalog — maps Claude Design's 27 card-face skins (deckSkins.ts)
// onto the player-level progression + the store's group entries.
//
// PROVISIONAL: levels and groupings here are a first pass, grouped by the
// designs' families. The final level gates and which skins share a group
// are the user's call — only this file changes when they're set; the
// engine, CardFace, and store all read it as-is.

import { SKINS } from './deckSkins';

const nameOf = (id: string): string =>
  SKINS.find(s => s.id === id)?.name ?? id;

export interface SkinUnlock {
  /** Store-entry id (stable key). */
  id: string;
  /** Display name — the family name for a group, the skin name for a single. */
  name: string;
  /** Player level required to unlock (1 = available from the start). */
  level: number;
  /**
   * The skin ids this entry unlocks. One id = a single design; more than
   * one = a group (all unlocked together, freely chosen).
   */
  skinIds: string[];
}

// Ordered by level. Groups collect a design family; singles stand alone.
export const SKIN_CATALOG: SkinUnlock[] = [
  { id: 'twin', name: nameOf('D05a'), level: 1, skinIds: ['D05a'] },
  {
    id: 'wash',
    name: 'Gradient wash',
    level: 2,
    skinIds: ['D27b', 'D27c', 'W1', 'W2', 'W3'],
  },
  { id: 'quad', name: nameOf('D06c'), level: 3, skinIds: ['D06c'] },
  { id: 'keyline', name: nameOf('D21'), level: 4, skinIds: ['D21'] },
  { id: 'pastel', name: 'Pastel wash', level: 5, skinIds: ['P1', 'P3'] },
  { id: 'ticket', name: nameOf('D24'), level: 6, skinIds: ['D24'] },
  { id: 'emboss', name: nameOf('D42'), level: 7, skinIds: ['D42'] },
  { id: 'bigpip', name: nameOf('D16'), level: 8, skinIds: ['D16'] },
  { id: 'filigree', name: nameOf('D41c'), level: 9, skinIds: ['D41c'] },
  {
    id: 'terrain',
    name: 'Terrains',
    level: 10,
    skinIds: ['D64', 'D65b', 'D67b', 'D69b', 'D69c', 'D70c'],
  },
  { id: 'rope', name: nameOf('D55b'), level: 12, skinIds: ['D55b'] },
  { id: 'carved', name: 'Bamboo / carved', level: 14, skinIds: ['D62c', 'C2'] },
  {
    id: 'wanted',
    name: 'Wanted poster',
    level: 17,
    skinIds: ['D51a', 'N1', 'N2'],
  },
  { id: 'lava', name: nameOf('L1'), level: 20, skinIds: ['L1'] },
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
