import {
  Card,
  RANKS,
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
// straight, and no flush; lows are ranked by their HIGHEST cards, so
// 7-5-4-3-2 ("The Nuts") is the best hand in the game. Aces are always
// high (rankIndex maps A → 14), which also means A-2-3-4-5 is NOT a
// straight here — it reads as an ace-high low.
//
// Eleven categories. The top of the ladder follows real 2-7 granularity —
// lows are named by their first two cards (a "smooth" 8-6 beats a "rough"
// 8-7, and any 8-high beats any 9-high) — while the court-card highs
// merge (J/Q, K/A). ANY pair busts: no hand scores zero, and BUSTED
// (a pair or worse, any straight or flush) COSTS 50, the same as an
// unfinished line. A non-straight 6-high is impossible (the only five
// distinct ranks ≤ 6 are 2-3-4-5-6, a straight), so nothing sits
// between The Nuts/Seven High and the eights.
// ============================================================================

export type LowHandRank =
  | 'THE_NUTS'
  | 'SEVEN_HIGH'
  | 'NUT_EIGHT'
  | 'SMOOTH_EIGHT'
  | 'ROUGH_EIGHT'
  | 'NUT_NINE'
  | 'NINE_HIGH'
  | 'TEN_HIGH'
  | 'JACK_QUEEN_HIGH'
  | 'KING_ACE_HIGH'
  | 'BUSTED';

// Ordering primitive for joker resolution and tier-sorted displays —
// higher is better, exactly like HAND_TIER in hands.ts. Matches 2-7
// rankings (any 8-high beats any 9-high) with every paired hand,
// straight, and flush flattened into BUSTED.
export const LOW_TIER: Record<LowHandRank, number> = {
  BUSTED: 0,
  KING_ACE_HIGH: 1,
  JACK_QUEEN_HIGH: 2,
  TEN_HIGH: 3,
  NINE_HIGH: 4,
  NUT_NINE: 5,
  ROUGH_EIGHT: 6,
  SMOOTH_EIGHT: 7,
  NUT_EIGHT: 8,
  SEVEN_HIGH: 9,
  THE_NUTS: 10,
};

// The high game's point ladder reassigned to the low categories — plus
// BUSTED at Nut Low's own penalty (a busted line costs 50, same as
// never finishing it; scoring.ts uses this value for the mode's
// incomplete-line penalty too).
export const LOW_HAND_VALUE: Record<LowHandRank, number> = {
  THE_NUTS: 150,
  SEVEN_HIGH: 120,
  NUT_EIGHT: 90,
  SMOOTH_EIGHT: 70,
  ROUGH_EIGHT: 50,
  NUT_NINE: 40,
  NINE_HIGH: 30,
  TEN_HIGH: 20,
  JACK_QUEEN_HIGH: 12,
  KING_ACE_HIGH: 5,
  BUSTED: -50,
};

export const LOW_HAND_LABEL: Record<LowHandRank, string> = {
  THE_NUTS: 'The Nuts (7-5)',
  SEVEN_HIGH: 'Seven High (7-6)',
  NUT_EIGHT: 'Nut 8 (8-5)',
  SMOOTH_EIGHT: 'Smooth 8 (8-6)',
  ROUGH_EIGHT: 'Rough 8 (8-7)',
  NUT_NINE: 'Nut 9 (9-5)',
  NINE_HIGH: 'Nine High',
  TEN_HIGH: 'Ten High',
  JACK_QUEEN_HIGH: 'J/Q High',
  KING_ACE_HIGH: 'K/A High',
  BUSTED: 'Busted',
};

// Best-first, for the hand-values reference tables.
export const LOW_HAND_ORDER: LowHandRank[] = [
  'THE_NUTS',
  'SEVEN_HIGH',
  'NUT_EIGHT',
  'SMOOTH_EIGHT',
  'ROUGH_EIGHT',
  'NUT_NINE',
  'NINE_HIGH',
  'TEN_HIGH',
  'JACK_QUEEN_HIGH',
  'KING_ACE_HIGH',
  'BUSTED',
];

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

  // ANY pair busts — pairs upward (two pair, trips, boat, quads) too.
  if (multiset[0] >= 2) return 'BUSTED';

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
  // has indices [2,3,4,5,14] and falls through to KING_ACE_HIGH.
  const uniq = cards.map(c => rankIndex(c.rank)).sort((a, b) => a - b);
  if (uniq[4] - uniq[0] === 4) return 'BUSTED';

  // A qualified low — categorize by the top cards, 2-7 style. The
  // "nut" reads (x-5) pin the whole hand: below a 5 only 4-3-2 fit,
  // so 8-5 is exactly 8-5-4-3-2 and 9-5 exactly 9-5-4-3-2.
  const high = uniq[4];
  const second = uniq[3];
  if (high >= 13) return 'KING_ACE_HIGH';
  if (high >= 11) return 'JACK_QUEEN_HIGH';
  if (high === 10) return 'TEN_HIGH';
  if (high === 9) return second === 5 ? 'NUT_NINE' : 'NINE_HIGH';
  if (high === 8) {
    // 8-7-6-5-4 is a straight (caught above), so every second card
    // 5/6/7 maps cleanly.
    if (second === 5) return 'NUT_EIGHT';
    if (second === 6) return 'SMOOTH_EIGHT';
    return 'ROUGH_EIGHT';
  }
  // high === 7 (6-high is impossible — see module comment). The Nuts is
  // exactly 7-5-4-3-2; the other three 7-highs all read 7-6.
  return second === 5 ? 'THE_NUTS' : 'SEVEN_HIGH';
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

