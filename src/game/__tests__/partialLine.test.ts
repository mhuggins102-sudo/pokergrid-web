import { Card, Rank, StandardCard, Suit } from '../cards';
import { HandRank, evaluatePartialLine } from '../hands';

const C = (rank: Rank, suit: Suit): StandardCard => ({
  kind: 'standard',
  rank,
  suit,
});
const JK: Card = { kind: 'joker' };

// Pad a partial line out to the 5 slots a grid line always has.
const line = (...cards: Card[]): (Card | null)[] => [
  ...cards,
  ...Array<null>(5 - cards.length).fill(null),
];

const expectPartial = (cards: (Card | null)[], rank: HandRank | null) => {
  expect(evaluatePartialLine(cards)).toBe(rank);
};

describe('evaluatePartialLine — the desktop hand-so-far evaluator', () => {
  test('empty line evaluates to null', () => {
    expectPartial(line(), null);
  });

  test('a single card is High Card', () => {
    expectPartial(line(C('A', 'H')), 'HIGH_CARD');
  });

  test('two matching ranks make a Pair', () => {
    expectPartial(line(C('9', 'H'), C('9', 'C')), 'PAIR');
    // Unrelated third card doesn't change the read.
    expectPartial(line(C('9', 'H'), C('9', 'C'), C('2', 'D')), 'PAIR');
  });

  test('two distinct pairs at four cards make Two Pair', () => {
    expectPartial(
      line(C('K', 'H'), C('K', 'C'), C('3', 'D'), C('3', 'S')),
      'TWO_PAIR'
    );
  });

  test('jokers extend the largest rank group', () => {
    // Joker + lone card → the joker pairs it up.
    expectPartial(line(C('Q', 'S'), JK), 'PAIR');
    // Joker on a pair → trips, not two pair.
    expectPartial(line(C('9', 'H'), C('9', 'C'), JK), 'THREE_OF_A_KIND');
    // Two jokers on a pair (4 cards) → quads.
    expectPartial(line(C('9', 'H'), C('9', 'C'), JK, JK), 'FOUR_OF_A_KIND');
    // A lone joker makes nothing on its own.
    expectPartial(line(JK), 'HIGH_CARD');
  });

  test('count-based full house rule (top 3 + second 2)', () => {
    // Four placed cards can't reach the 3+2 shape yet — two pairs stay
    // Two Pair until the fifth card lands...
    expectPartial(
      line(C('K', 'H'), C('K', 'C'), C('3', 'D'), C('3', 'S')),
      'TWO_PAIR'
    );
    // ...and the joker that completes the line yields the Full House
    // (via the 5-card delegation, where the joker resolves to a King).
    expectPartial(
      [C('K', 'H'), C('K', 'C'), C('3', 'D'), C('3', 'S'), JK],
      'FULL_HOUSE'
    );
  });

  test('no straights or flushes until the line is complete', () => {
    // Four to a straight flush still reads High Card while partial.
    expectPartial(
      line(C('2', 'H'), C('3', 'H'), C('4', 'H'), C('5', 'H')),
      'HIGH_CARD'
    );
  });

  test('a doubled (supercharged) card counts twice for sets', () => {
    const dbl = (rank: Rank, suit: Suit): StandardCard => ({
      ...C(rank, suit),
      supercharge: 'double',
    });
    // A lone doubled card already reads as a forming Pair — matching
    // how evalStandardFive counts it once the line completes.
    expectPartial(line(dbl('9', 'H')), 'PAIR');
    // Doubled card + a natural same-rank card → trips.
    expectPartial(line(dbl('9', 'H'), C('9', 'C')), 'THREE_OF_A_KIND');
    // A joker extends the doubled group: 2 (double) + 1 (joker) → trips.
    expectPartial(line(dbl('Q', 'S'), JK), 'THREE_OF_A_KIND');
    // Doubled card + same rank + joker → quads.
    expectPartial(line(dbl('9', 'H'), C('9', 'C'), JK), 'FOUR_OF_A_KIND');
    // Doubled pair beside a natural pair → full-house shape (3 + 2).
    expectPartial(
      line(dbl('K', 'H'), C('K', 'C'), C('3', 'D'), C('3', 'S')),
      'FULL_HOUSE'
    );
    // A 'wild' supercharge does NOT double rank counts.
    expectPartial(
      line({ ...C('9', 'H'), supercharge: 'wild' }),
      'HIGH_CARD'
    );
  });

  test('a full 5-card line delegates to the real evaluator', () => {
    // Flush — only visible through evaluateLine, never the count pass.
    expectPartial(
      [C('2', 'H'), C('5', 'H'), C('7', 'H'), C('9', 'H'), C('J', 'H')],
      'FLUSH'
    );
    expectPartial(
      [C('10', 'S'), C('J', 'S'), C('Q', 'S'), C('K', 'S'), C('A', 'S')],
      'ROYAL_FLUSH'
    );
  });
});
