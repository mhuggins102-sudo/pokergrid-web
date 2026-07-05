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

// One Mulberry32 step as a pure function of the 32-bit state word.
// The reducer stores the word in GameState (state.rngState) so that
// step(state, action) is pure: the same state + action always produce
// the same next state, UNDO rewinds the stream along with everything
// else, and React re-invoking a reducer can't silently advance it.
export const rngStep = (word: number): { value: number; next: number } => {
  const next = (word + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, next };
};

// A seeded rng closure that also exposes its current state word, so
// newGame can seed GameState.rngState to CONTINUE the same stream —
// bit-exact with the historical single-closure behavior that daily
// deals (shared with the original site) depend on.
export interface SeededRng {
  (): number;
  /** Current Mulberry32 state word (read without consuming a value). */
  state: () => number;
}

// Simple Mulberry32 seeded RNG for deterministic tests / replays.
export const seededRng = (seed: number): SeededRng => {
  let s = seed >>> 0;
  const fn = () => {
    const r = rngStep(s);
    s = r.next;
    return r.value;
  };
  fn.state = () => s;
  return fn;
};

// The Mulberry32 word to seed GameState.rngState from. Seeded rngs
// expose their word directly (no value consumed, so existing deck
// streams are unchanged); plain closures (Math.random) draw one value
// to derive a word — non-deterministic runs stay non-deterministic at
// setup, but become internally replayable from then on.
export const rngWordOf = (rng: () => number): number => {
  const withState = rng as Partial<SeededRng>;
  if (typeof withState.state === 'function') return withState.state();
  return Math.floor(rng() * 0x100000000) >>> 0;
};
