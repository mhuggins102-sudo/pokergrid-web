import {
  Card,
  RANKS,
  Suit,
  SUITS,
  StandardCard,
  isJoker,
  rankIndex,
} from './cards';

// ============================================================================
// Nut Low — deuce-to-seven (2-7) lowball hand evaluation.
//
// The sibling of hands.ts for the Nut Low challenge: every line scores as
// a LOW hand. A hand only counts as a "low" when it has no pair, no
// straight, and no flush; lows are ranked by their HIGHEST card, so
// 7-5-4-3-2 is the best hand in the game. Aces are always high
// (rankIndex maps A → 14), which also means A-2-3-4-5 is NOT a straight
// here — it reads as ace-high.
//
// Eleven categories, mirroring the high game's HAND_BASE_VALUE ladder
// value-for-value (150 / 120 / 90 / 70 / 50 / 40 / 30 / 20 / 12 / 5 / 0).
// A non-straight 6-high is impossible — the only five distinct ranks ≤ 6
// are 2-3-4-5-6, a straight — so the ladder lands on exactly eleven slots.
// ============================================================================

export type LowHandRank =
  | 'NUMBER_ONE'
  | 'SEVEN_LOW'
  | 'EIGHT_LOW'
  | 'NINE_LOW'
  | 'TEN_LOW'
  | 'JACK_LOW'
  | 'QUEEN_LOW'
  | 'KING_LOW'
  | 'ACE_HIGH'
  | 'ONE_PAIR'
  | 'BUSTED';

// Ordering primitive for joker resolution and tier-sorted displays —
// higher is better, exactly like HAND_TIER in hands.ts. Matches 2-7
// rankings with everything from two pair down flattened into BUSTED.
export const LOW_TIER: Record<LowHandRank, number> = {
  BUSTED: 0,
  ONE_PAIR: 1,
  ACE_HIGH: 2,
  KING_LOW: 3,
  QUEEN_LOW: 4,
  JACK_LOW: 5,
  TEN_LOW: 6,
  NINE_LOW: 7,
  EIGHT_LOW: 8,
  SEVEN_LOW: 9,
  NUMBER_ONE: 10,
};

// Same point ladder as HAND_BASE_VALUE, reassigned to the low categories.
export const LOW_HAND_VALUE: Record<LowHandRank, number> = {
  NUMBER_ONE: 150,
  SEVEN_LOW: 120,
  EIGHT_LOW: 90,
  NINE_LOW: 70,
  TEN_LOW: 50,
  JACK_LOW: 40,
  QUEEN_LOW: 30,
  KING_LOW: 20,
  ACE_HIGH: 12,
  ONE_PAIR: 5,
  BUSTED: 0,
};

export const LOW_HAND_LABEL: Record<LowHandRank, string> = {
  NUMBER_ONE: 'Number One',
  SEVEN_LOW: 'Seven Low',
  EIGHT_LOW: 'Eight Low',
  NINE_LOW: 'Nine Low',
  TEN_LOW: 'Ten Low',
  JACK_LOW: 'Jack Low',
  QUEEN_LOW: 'Queen Low',
  KING_LOW: 'King Low',
  ACE_HIGH: 'Ace High',
  ONE_PAIR: 'One Pair',
  BUSTED: 'Busted',
};

// Best-first, for the hand-values reference tables.
export const LOW_HAND_ORDER: LowHandRank[] = [
  'NUMBER_ONE',
  'SEVEN_LOW',
  'EIGHT_LOW',
  'NINE_LOW',
  'TEN_LOW',
  'JACK_LOW',
  'QUEEN_LOW',
  'KING_LOW',
  'ACE_HIGH',
  'ONE_PAIR',
  'BUSTED',
];

// Flat bonus for a complete line showing all four suits ("the Royal
// Sampler"). Stacks on any category, BUSTED included — flushes bust you,
// suit diversity pays.
export const RAINBOW_BONUS = 25;

// Evaluates 5 standard cards under 2-7 lowball rules. Supercharged cards
// ('wild' / 'double') only exist in Targets Up runs and can never appear
// in a Nut Low game, but this shares deck plumbing with the high
// evaluator so it handles them gracefully rather than crashing:
//   - 'double' counts once — pair-class boosts only hurt a low hand, and
//     a phantom second copy would be pure downside with no upside.
//   - 'wild' is suit-flexible, so it always DODGES a flush; it counts as
//     its printed rank otherwise.
const evalLowFive = (cards: StandardCard[]): LowHandRank => {
  if (cards.length !== 5) throw new Error('Expected 5 cards');

  const counts = new Map<number, number>();
  for (const c of cards) {
    const r = rankIndex(c.rank);
    counts.set(r, (counts.get(r) ?? 0) + 1);
  }
  const multiset = [...counts.values()].sort((a, b) => b - a);

  // Paired hands can't also be straights/flushes, so these short-circuit.
  if (multiset[0] > 2 || (multiset[0] === 2 && multiset[1] === 2)) {
    return 'BUSTED'; // two pair, trips, full house, quads
  }
  if (multiset[0] === 2) return 'ONE_PAIR';

  // Five distinct ranks from here. Flush: all five real suits equal —
  // any wild present breaks it (its suit is free to differ).
  const suits = new Set(
    cards.filter(c => c.supercharge !== 'wild').map(c => c.suit)
  );
  if (suits.size === 1 && cards.every(c => c.supercharge !== 'wild')) {
    return 'BUSTED';
  }

  // Straight: 5 consecutive rank indices. Deliberately NO wheel clause
  // (contrast hands.ts) — aces are only ever high in 2-7, so A-2-3-4-5
  // has indices [2,3,4,5,14] and falls through to ACE_HIGH.
  const uniq = cards.map(c => rankIndex(c.rank)).sort((a, b) => a - b);
  if (uniq[4] - uniq[0] === 4) return 'BUSTED';

  // A qualified low — categorize by the highest card.
  const high = uniq[4];
  if (high >= 14) return 'ACE_HIGH';
  if (high === 13) return 'KING_LOW';
  if (high === 12) return 'QUEEN_LOW';
  if (high === 11) return 'JACK_LOW';
  if (high === 10) return 'TEN_LOW';
  if (high === 9) return 'NINE_LOW';
  if (high === 8) return 'EIGHT_LOW';
  // high === 7 (6-high is impossible — see module comment). The nut is
  // exactly 7-5-4-3-2; the other three 7-lows share the SEVEN_LOW slot.
  return uniq.join(',') === '2,3,4,5,7' ? 'NUMBER_ONE' : 'SEVEN_LOW';
};

// Recursive joker substitution, mirroring hands.ts's evalWithJokers:
// try every rank+suit for each joker and keep the best LOW result. The
// seed is BUSTED (the floor) and the comparator runs on LOW_TIER, so a
// joker fills toward 2-3-4-5-7 instead of pairing up. Worst case is the
// same 52² = 2704 evaluations as the high path.
const evalLowWithJokers = (
  standards: StandardCard[],
  jokerCount: number
): LowHandRank => {
  if (jokerCount === 0) return evalLowFive(standards);
  let best: LowHandRank = 'BUSTED';
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      const sub: StandardCard = { kind: 'standard', rank, suit };
      const result = evalLowWithJokers([...standards, sub], jokerCount - 1);
      if (LOW_TIER[result] > LOW_TIER[best]) best = result;
    }
  }
  return best;
};

// Evaluate any 5-card line as a 2-7 low. Returns null if any slot is
// empty — the same completeness contract as evaluateLine.
export const evaluateLowLine = (line: (Card | null)[]): LowHandRank | null => {
  if (line.length !== 5) throw new Error('Line must have exactly 5 slots');
  if (line.some(c => c === null)) return null;
  const cards = line as Card[];
  const jokers = cards.filter(isJoker).length;
  if (jokers === 0) return evalLowFive(cards as StandardCard[]);
  const standards = cards.filter(c => !isJoker(c)) as StandardCard[];
  return evalLowWithJokers(standards, jokers);
};

// True when a COMPLETE line shows all four suits. Jokers (and wilds)
// count as a free suit of the player's choice. This is decided
// independently of the joker's low-hand resolution above, and the two
// never conflict: a flush needs the four real cards monosuited, in which
// case distinct suits + jokers ≤ 2 and rainbow is unreachable anyway —
// so whenever a rainbow IS reachable, the joker's flush-dodging suit
// choice is free to complete it.
export const isRainbowLine = (line: (Card | null)[]): boolean => {
  if (line.length !== 5) throw new Error('Line must have exactly 5 slots');
  if (line.some(c => c === null)) return false;
  const cards = line as Card[];
  const free = cards.filter(
    c => isJoker(c) || (!isJoker(c) && c.supercharge === 'wild')
  ).length;
  const suits = new Set<Suit>(
    cards
      .filter((c): c is StandardCard => !isJoker(c))
      .filter(c => c.supercharge !== 'wild')
      .map(c => c.suit)
  );
  return suits.size + free >= 4;
};
