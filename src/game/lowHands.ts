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
// straight, and no flush; lows are ranked by their HIGHEST cards, so
// 7-5-4-3-2 ("The Nuts") is the best hand in the game. Aces are always
// high (rankIndex maps A → 14), which also means A-2-3-4-5 is NOT a
// straight here — it reads as an ace-high low.
//
// Twelve categories. The top of the ladder follows real 2-7 granularity —
// lows are named by their first two cards (a "smooth" 8-6 beats a "rough"
// 8-7, and any 8-high beats any 9-high) — while the court-card highs
// merge (J/Q, K/A). One Pair scores nothing, and BUSTED (two pair or
// worse, any straight or flush) COSTS 25, the same as an unfinished
// line. A non-straight 6-high is impossible (the only five distinct
// ranks ≤ 6 are 2-3-4-5-6, a straight), so nothing sits between The
// Nuts/Seven High and the eights.
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
  | 'ONE_PAIR'
  | 'BUSTED';

// Ordering primitive for joker resolution and tier-sorted displays —
// higher is better, exactly like HAND_TIER in hands.ts. Matches 2-7
// rankings (any no-pair beats One Pair; any 8-high beats any 9-high)
// with everything from two pair down flattened into BUSTED.
export const LOW_TIER: Record<LowHandRank, number> = {
  BUSTED: 0,
  ONE_PAIR: 1,
  KING_ACE_HIGH: 2,
  JACK_QUEEN_HIGH: 3,
  TEN_HIGH: 4,
  NINE_HIGH: 5,
  NUT_NINE: 6,
  ROUGH_EIGHT: 7,
  SMOOTH_EIGHT: 8,
  NUT_EIGHT: 9,
  SEVEN_HIGH: 10,
  THE_NUTS: 11,
};

// The high game's point ladder reassigned to the low categories — plus
// BUSTED at the incomplete-line penalty (a busted line costs 25, same
// as never finishing it).
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
  ONE_PAIR: 0,
  BUSTED: -25,
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
  ONE_PAIR: 'One Pair',
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
  'ONE_PAIR',
  'BUSTED',
];

// Flat bonus for a complete line showing all four suits ("the Royal
// Sampler"). Pays on any MADE hand — One Pair and better; a busted line
// takes its full -25 with no rainbow offset (scoring.ts gates it).
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
