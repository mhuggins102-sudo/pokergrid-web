import { Card, StandardCard, fullDeck } from './cards';

export const shuffle = <T>(arr: readonly T[], rng: () => number = Math.random): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export const freshShuffledDeck = (
  rng?: () => number,
  jokerCount: number = 1
): Card[] => shuffle(fullDeck(jokerCount), rng);

// Double Duty: give each standard card a dual (bottom-half) identity.
// The duals are a derangement of the 52 identities — a random permutation
// with no fixed point — so every rank+suit appears exactly once as a top
// and once as a bottom (= twice across all 104 halves), always on two
// different physical cards, never twice on the same card. A side effect
// worth knowing: the face-up tops are exactly one standard deck, so an
// unflipped run plays like a normal game and flips are pure option value.
// Jokers pass through untouched. Each standard card is also stamped with
// a stable uid (its identity index) for layout/React-key uniqueness.
export const assignDualIdentities = (
  deck: readonly Card[],
  rng: () => number = Math.random
): Card[] => {
  const identities = fullDeck(0) as StandardCard[];
  const identityIndex = (c: StandardCard): number =>
    identities.findIndex(i => i.rank === c.rank && i.suit === c.suit);
  const perm = shuffle(identities, rng);
  // Fixed-point repair: one left-to-right pass swapping any fixed point
  // with its wrapping neighbor. Neither position ends up fixed, and the
  // pass never re-creates a fixed point behind it. Not uniform over all
  // derangements — irrelevant for gameplay, and deterministic from rng.
  for (let i = 0; i < perm.length; i++) {
    const j = (i + 1) % perm.length;
    if (identityIndex(perm[i]) === i) {
      [perm[i], perm[j]] = [perm[j], perm[i]];
    }
  }
  return deck.map(c => {
    if (c.kind !== 'standard') return c;
    const idx = identityIndex(c);
    const d = perm[idx];
    return { ...c, dual: { rank: d.rank, suit: d.suit }, uid: idx };
  });
};

// Simple Mulberry32 seeded RNG for deterministic tests / replays.
export const seededRng = (seed: number): (() => number) => {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
