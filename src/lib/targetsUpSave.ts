import {
  baseId,
  BONUS_DECK_POOL,
  BonusCard,
  powerUpBonusCard,
} from '../game/bonusCards';
import { Card } from '../game/cards';

// Targets-Up resume save, ported from the original repo's
// targetsUpSave.ts (same shape and storage key, sans AsyncStorage —
// the zustand store persists it). Captures level / wins plus the
// powered-up carry-over cards so closing the tab between levels
// resumes the full state.

// Serialized form of a BonusCard. lineEffect / gridEffect are function
// references, so we persist just enough to look the card up in
// BONUS_DECK_POOL and re-apply N power-ups on load.
export interface SerializedBonusCard {
  baseId: string;
  powerLevel: number;
}

export interface TUSave {
  level: number;
  wins: number;
  ts: number;
  // Deprecated hand carry-over — kept for migration; always null in
  // new saves (hydrateSavedCards folds it into deckExtras).
  keptCard?: SerializedBonusCard | null;
  deckExtras?: SerializedBonusCard[];
  // Standard cards supercharged on past S/SS-tier wins. Plain data —
  // survives JSON round-tripping directly.
  superchargedDeckCards?: Card[];
  // Base id of the card powered in the previous round; the next
  // reward picker blocks consecutive same-card power-ups.
  lastKeptBaseId?: string | null;
}

export const serializeBonusCard = (c: BonusCard): SerializedBonusCard => ({
  baseId: baseId(c),
  powerLevel: c.powerLevel ?? 0,
});

export const deserializeBonusCard = (
  s: SerializedBonusCard
): BonusCard | null => {
  const base = BONUS_DECK_POOL.find(c => c.id === s.baseId);
  if (!base) return null;
  let card = base;
  for (let i = 0; i < s.powerLevel; i++) {
    card = powerUpBonusCard(card);
  }
  return card;
};

/** Validate + normalize a parsed save blob; null when unusable. */
export const hydrateTUSave = (parsed: Partial<TUSave> | null): TUSave | null => {
  if (!parsed) return null;
  if (typeof parsed.level !== 'number' || typeof parsed.wins !== 'number') {
    return null;
  }
  return {
    level: parsed.level,
    wins: parsed.wins,
    ts: parsed.ts ?? Date.now(),
    keptCard: parsed.keptCard ?? null,
    deckExtras: parsed.deckExtras ?? [],
    superchargedDeckCards: parsed.superchargedDeckCards ?? [],
    lastKeptBaseId: parsed.lastKeptBaseId ?? null,
  };
};

// Reconstruct deck extras + supercharged Cards from a save — the
// arguments newGame() needs for the next level.
export const hydrateSavedCards = (
  s: TUSave | null
): { deckExtras: BonusCard[]; superchargedDeckCards: Card[] } => {
  if (!s) return { deckExtras: [], superchargedDeckCards: [] };
  const extras = (s.deckExtras ?? [])
    .map(deserializeBonusCard)
    .filter((c): c is BonusCard => c !== null);
  // Backward compat with the old keep-one save format.
  const legacyKept = s.keptCard ? deserializeBonusCard(s.keptCard) : null;
  const deckExtras = legacyKept ? [...extras, legacyKept] : extras;
  return { deckExtras, superchargedDeckCards: s.superchargedDeckCards ?? [] };
};
