import { Card, Rank, StandardCard, Suit } from '../cards';
import {
  LOW_HAND_VALUE,
  LowHandRank,
  evaluateLowLine,
  isRainbowLine,
} from '../lowHands';

const C = (rank: Rank, suit: Suit): StandardCard => ({
  kind: 'standard',
  rank,
  suit,
});
const JK: Card = { kind: 'joker' };

const expectLow = (cards: (Card | null)[], rank: LowHandRank | null) =>
  expect(evaluateLowLine(cards)).toBe(rank);

describe('2-7 lowball evaluation — no joker', () => {
  it('returns null for an incomplete line', () => {
    expectLow([C('2', 'H'), C('3', 'C'), C('4', 'D'), C('5', 'S'), null], null);
  });

  it('crowns 7-5-4-3-2 offsuit as the Number One', () => {
    expectLow(
      [C('7', 'S'), C('5', 'H'), C('4', 'D'), C('3', 'C'), C('2', 'S')],
      'NUMBER_ONE'
    );
  });

  it('busts the same ranks when suited (flush)', () => {
    expectLow(
      [C('7', 'H'), C('5', 'H'), C('4', 'H'), C('3', 'H'), C('2', 'H')],
      'BUSTED'
    );
  });

  it('reads A-2-3-4-5 as ace-high — the wheel is NOT a straight in 2-7', () => {
    expectLow(
      [C('A', 'S'), C('2', 'H'), C('3', 'D'), C('4', 'C'), C('5', 'S')],
      'ACE_HIGH'
    );
  });

  it('busts real straights, low and high', () => {
    expectLow(
      [C('2', 'S'), C('3', 'H'), C('4', 'D'), C('5', 'C'), C('6', 'S')],
      'BUSTED'
    );
    expectLow(
      [C('3', 'S'), C('4', 'H'), C('5', 'D'), C('6', 'C'), C('7', 'S')],
      'BUSTED'
    );
    expectLow(
      [C('10', 'S'), C('J', 'H'), C('Q', 'D'), C('K', 'C'), C('A', 'S')],
      'BUSTED'
    );
  });

  it('groups the other three 7-highs as Seven Low (7-6-5-4-3 is a straight)', () => {
    expectLow(
      [C('7', 'S'), C('6', 'H'), C('4', 'D'), C('3', 'C'), C('2', 'S')],
      'SEVEN_LOW'
    );
    expectLow(
      [C('7', 'S'), C('6', 'H'), C('5', 'D'), C('3', 'C'), C('2', 'S')],
      'SEVEN_LOW'
    );
    expectLow(
      [C('7', 'S'), C('6', 'H'), C('5', 'D'), C('4', 'C'), C('2', 'S')],
      'SEVEN_LOW'
    );
    expectLow(
      [C('7', 'S'), C('6', 'H'), C('5', 'D'), C('4', 'C'), C('3', 'S')],
      'BUSTED'
    );
  });

  it('categorizes each low by its highest card', () => {
    expectLow(
      [C('8', 'S'), C('5', 'H'), C('4', 'D'), C('3', 'C'), C('2', 'S')],
      'EIGHT_LOW'
    );
    expectLow(
      [C('9', 'S'), C('6', 'H'), C('4', 'D'), C('3', 'C'), C('2', 'S')],
      'NINE_LOW'
    );
    expectLow(
      [C('10', 'S'), C('7', 'H'), C('5', 'D'), C('3', 'C'), C('2', 'S')],
      'TEN_LOW'
    );
    expectLow(
      [C('J', 'S'), C('8', 'H'), C('6', 'D'), C('4', 'C'), C('2', 'S')],
      'JACK_LOW'
    );
    expectLow(
      [C('Q', 'S'), C('9', 'H'), C('7', 'D'), C('4', 'C'), C('2', 'S')],
      'QUEEN_LOW'
    );
    expectLow(
      [C('K', 'S'), C('9', 'H'), C('6', 'D'), C('4', 'C'), C('2', 'S')],
      'KING_LOW'
    );
    expectLow(
      [C('A', 'S'), C('8', 'H'), C('6', 'D'), C('4', 'C'), C('2', 'S')],
      'ACE_HIGH'
    );
  });

  it('scores exactly one pair as One Pair — even a pair of aces', () => {
    expectLow(
      [C('2', 'S'), C('2', 'H'), C('5', 'D'), C('8', 'C'), C('K', 'S')],
      'ONE_PAIR'
    );
    expectLow(
      [C('A', 'S'), C('A', 'H'), C('4', 'D'), C('7', 'C'), C('9', 'S')],
      'ONE_PAIR'
    );
  });

  it('busts two pair and every heavier count hand', () => {
    expectLow(
      [C('2', 'S'), C('2', 'H'), C('5', 'D'), C('5', 'C'), C('K', 'S')],
      'BUSTED'
    );
    expectLow(
      [C('3', 'S'), C('3', 'H'), C('3', 'D'), C('8', 'C'), C('K', 'S')],
      'BUSTED'
    );
    expectLow(
      [C('4', 'S'), C('4', 'H'), C('4', 'D'), C('9', 'C'), C('9', 'S')],
      'BUSTED'
    );
    expectLow(
      [C('6', 'S'), C('6', 'H'), C('6', 'D'), C('6', 'C'), C('K', 'S')],
      'BUSTED'
    );
  });
});

describe('2-7 lowball evaluation — joker resolves LOW', () => {
  it('fills the missing card of the Number One', () => {
    expectLow(
      [C('7', 'S'), C('5', 'H'), C('4', 'D'), C('2', 'C'), JK],
      'NUMBER_ONE'
    );
  });

  it('picks a 7 over completing the 2-3-4-5-6 straight or pairing', () => {
    expectLow(
      [C('2', 'S'), C('3', 'H'), C('4', 'D'), C('5', 'C'), JK],
      'NUMBER_ONE'
    );
  });

  it('dodges the flush with its suit choice', () => {
    // Four monosuited low cards: a high-hand joker would flush; a low
    // joker takes the missing 4 in another suit for the Number One.
    expectLow(
      [C('2', 'H'), C('3', 'H'), C('5', 'H'), C('7', 'H'), JK],
      'NUMBER_ONE'
    );
  });

  it('two jokers rebuild the Number One from 4-5-7', () => {
    expectLow([C('4', 'S'), C('5', 'H'), C('7', 'D'), JK, JK], 'NUMBER_ONE');
  });

  it('cannot unmake an existing pair', () => {
    expectLow(
      [C('K', 'S'), C('K', 'H'), C('Q', 'D'), C('J', 'C'), JK],
      'ONE_PAIR'
    );
  });
});

describe('isRainbowLine', () => {
  it('needs all four suits among the five cards', () => {
    expect(
      isRainbowLine([C('2', 'H'), C('3', 'C'), C('4', 'D'), C('5', 'S'), C('9', 'H')])
    ).toBe(true);
    expect(
      isRainbowLine([C('2', 'H'), C('3', 'C'), C('4', 'D'), C('5', 'H'), C('9', 'H')])
    ).toBe(false);
  });

  it('a joker fills the missing suit', () => {
    expect(
      isRainbowLine([C('2', 'H'), C('3', 'C'), C('4', 'D'), C('5', 'H'), JK])
    ).toBe(true);
    // ...but can't cover a two-suit gap.
    expect(
      isRainbowLine([C('2', 'H'), C('3', 'H'), C('5', 'H'), C('7', 'H'), JK])
    ).toBe(false);
  });

  it('is false for incomplete lines', () => {
    expect(
      isRainbowLine([C('2', 'H'), C('3', 'C'), C('4', 'D'), C('5', 'S'), null])
    ).toBe(false);
  });
});

describe('the lowball value ladder', () => {
  it('mirrors the high game values, 150 down to 0', () => {
    expect(Object.values(LOW_HAND_VALUE).sort((a, b) => b - a)).toEqual([
      150, 120, 90, 70, 50, 40, 30, 20, 12, 5, 0,
    ]);
  });
});
