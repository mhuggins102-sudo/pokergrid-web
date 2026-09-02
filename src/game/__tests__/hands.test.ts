import { Card, RANKS, Rank, StandardCard, SUITS, Suit } from '../cards';
import {
  evalWithJokersBruteForce,
  evalWithJokersFast,
  evaluateLine,
  HandRank,
} from '../hands';

const C = (rank: Rank, suit: Suit): StandardCard => ({ kind: 'standard', rank, suit });
const JK: Card = { kind: 'joker' };

const expectHand = (cards: (Card | null)[], rank: HandRank | null) => {
  expect(evaluateLine(cards)).toBe(rank);
};

describe('hand evaluation — no joker', () => {
  test('null on any empty slot', () => {
    expectHand([C('A', 'H'), null, C('3', 'H'), C('4', 'H'), C('5', 'H')], null);
  });

  test('high card', () => {
    expectHand(
      [C('2', 'H'), C('4', 'C'), C('6', 'D'), C('8', 'S'), C('K', 'H')],
      'HIGH_CARD'
    );
  });

  test('pair', () => {
    expectHand(
      [C('2', 'H'), C('2', 'C'), C('5', 'D'), C('8', 'S'), C('K', 'H')],
      'PAIR'
    );
  });

  test('two pair', () => {
    expectHand(
      [C('2', 'H'), C('2', 'C'), C('5', 'D'), C('5', 'S'), C('K', 'H')],
      'TWO_PAIR'
    );
  });

  test('three of a kind', () => {
    expectHand(
      [C('2', 'H'), C('2', 'C'), C('2', 'D'), C('5', 'S'), C('K', 'H')],
      'THREE_OF_A_KIND'
    );
  });

  test('straight high (10-A)', () => {
    expectHand(
      [C('10', 'H'), C('J', 'C'), C('Q', 'D'), C('K', 'S'), C('A', 'H')],
      'STRAIGHT'
    );
  });

  test('straight wheel (A-2-3-4-5)', () => {
    expectHand(
      [C('A', 'H'), C('2', 'C'), C('3', 'D'), C('4', 'S'), C('5', 'H')],
      'STRAIGHT'
    );
  });

  test('flush', () => {
    expectHand(
      [C('2', 'H'), C('5', 'H'), C('8', 'H'), C('J', 'H'), C('K', 'H')],
      'FLUSH'
    );
  });

  test('full house', () => {
    expectHand(
      [C('2', 'H'), C('2', 'C'), C('2', 'D'), C('5', 'S'), C('5', 'H')],
      'FULL_HOUSE'
    );
  });

  test('four of a kind', () => {
    expectHand(
      [C('2', 'H'), C('2', 'C'), C('2', 'D'), C('2', 'S'), C('5', 'H')],
      'FOUR_OF_A_KIND'
    );
  });

  test('straight flush', () => {
    expectHand(
      [C('2', 'H'), C('3', 'H'), C('4', 'H'), C('5', 'H'), C('6', 'H')],
      'STRAIGHT_FLUSH'
    );
  });

  test('straight flush wheel is straight flush, not royal', () => {
    expectHand(
      [C('A', 'H'), C('2', 'H'), C('3', 'H'), C('4', 'H'), C('5', 'H')],
      'STRAIGHT_FLUSH'
    );
  });

  test('royal flush', () => {
    expectHand(
      [C('10', 'H'), C('J', 'H'), C('Q', 'H'), C('K', 'H'), C('A', 'H')],
      'ROYAL_FLUSH'
    );
  });
});

describe('hand evaluation — joker wild', () => {
  test('joker + 4-of-a-kind => 5K', () => {
    expectHand(
      [C('2', 'H'), C('2', 'C'), C('2', 'D'), C('2', 'S'), JK],
      'FIVE_OF_A_KIND'
    );
  });

  test('joker completes royal flush (10-J-Q-K-?)', () => {
    expectHand(
      [C('10', 'H'), C('J', 'H'), C('Q', 'H'), C('K', 'H'), JK],
      'ROYAL_FLUSH'
    );
  });

  test('joker completes straight flush (2-3-4-?-6 of hearts)', () => {
    expectHand(
      [C('2', 'H'), C('3', 'H'), C('4', 'H'), JK, C('6', 'H')],
      'STRAIGHT_FLUSH'
    );
  });

  test('joker fills broken flush (mixed ranks, 4 same suit)', () => {
    // 4 hearts but no straight possible; joker gives flush via 5th heart
    expectHand(
      [C('2', 'H'), C('5', 'H'), JK, C('9', 'H'), C('K', 'H')],
      'FLUSH'
    );
  });

  test('joker completes straight (mixed suits)', () => {
    // 2-3-?-5-6, mixed suits => straight
    expectHand(
      [C('2', 'H'), C('3', 'C'), JK, C('5', 'S'), C('6', 'H')],
      'STRAIGHT'
    );
  });

  test('joker + pair => three of a kind (best available)', () => {
    expectHand(
      [C('2', 'H'), C('2', 'C'), C('5', 'D'), C('8', 'S'), JK],
      'THREE_OF_A_KIND'
    );
  });

  test('joker + 3-of-a-kind => four of a kind', () => {
    expectHand(
      [C('2', 'H'), C('2', 'C'), C('2', 'D'), C('5', 'S'), JK],
      'FOUR_OF_A_KIND'
    );
  });

  test('joker + two pair => full house', () => {
    expectHand(
      [C('2', 'H'), C('2', 'C'), C('5', 'D'), C('5', 'S'), JK],
      'FULL_HOUSE'
    );
  });

  test('joker alone with high cards => one pair (best the joker can make)', () => {
    expectHand(
      [C('2', 'H'), C('5', 'C'), C('8', 'D'), C('J', 'S'), JK],
      'PAIR'
    );
  });
});

describe('closed-form joker evaluation matches the brute-force search', () => {
  const allStandards: StandardCard[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) allStandards.push({ kind: 'standard', rank, suit });
  }

  it('a random sample of 3-card lines with two jokers', () => {
    let x = 777;
    const next = () => (x = (x * 1103515245 + 12345) >>> 0) % 52;
    for (let i = 0; i < 1200; i++) {
      const picked = new Set<number>();
      while (picked.size < 3) picked.add(next());
      const line = [...picked].map(k => allStandards[k]);
      expect(evalWithJokersFast(line, 2)).toBe(
        evalWithJokersBruteForce(line, 2)
      );
    }
  }, 60_000);

  it('a large random sample of 4-card lines with one joker', () => {
    // Deterministic LCG so the sample is stable.
    let x = 12345;
    const next = () => (x = (x * 1103515245 + 12345) >>> 0) % 52;
    for (let i = 0; i < 20000; i++) {
      const picked = new Set<number>();
      while (picked.size < 4) picked.add(next());
      const line = [...picked].map(k => allStandards[k]);
      expect(evalWithJokersFast(line, 1)).toBe(
        evalWithJokersBruteForce(line, 1)
      );
    }
  }, 30_000);

  it('declines supercharged lines so the search handles them', () => {
    const line: StandardCard[] = [
      { kind: 'standard', rank: 'K', suit: 'H', supercharge: 'double' },
      { kind: 'standard', rank: '2', suit: 'S' },
      { kind: 'standard', rank: '7', suit: 'D' },
      { kind: 'standard', rank: '9', suit: 'C' },
    ];
    expect(evalWithJokersFast(line, 1)).toBeNull();
  });
});
