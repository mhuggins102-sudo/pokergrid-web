import { Card, Rank, StandardCard, Suit } from '../cards';
import { LOW_HAND_VALUE, LowHandRank, evaluateLowLine } from '../lowHands';

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

  it('crowns 7-5-4-3-2 offsuit as The Nuts', () => {
    expectLow(
      [C('7', 'S'), C('5', 'H'), C('4', 'D'), C('3', 'C'), C('2', 'S')],
      'THE_NUTS'
    );
  });

  it('busts the same ranks when suited (flush)', () => {
    expectLow(
      [C('7', 'H'), C('5', 'H'), C('4', 'H'), C('3', 'H'), C('2', 'H')],
      'BUSTED'
    );
  });

  it('reads A-2-3-4-5 as an ace-high low — the wheel is NOT a straight in 2-7', () => {
    expectLow(
      [C('A', 'S'), C('2', 'H'), C('3', 'D'), C('4', 'C'), C('5', 'S')],
      'KING_ACE_HIGH'
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
      [C('4', 'S'), C('5', 'H'), C('6', 'D'), C('7', 'C'), C('8', 'S')],
      'BUSTED'
    );
    expectLow(
      [C('10', 'S'), C('J', 'H'), C('Q', 'D'), C('K', 'C'), C('A', 'S')],
      'BUSTED'
    );
  });

  it('groups the other three 7-highs as Seven High (all read 7-6)', () => {
    expectLow(
      [C('7', 'S'), C('6', 'H'), C('4', 'D'), C('3', 'C'), C('2', 'S')],
      'SEVEN_HIGH'
    );
    expectLow(
      [C('7', 'S'), C('6', 'H'), C('5', 'D'), C('3', 'C'), C('2', 'S')],
      'SEVEN_HIGH'
    );
    expectLow(
      [C('7', 'S'), C('6', 'H'), C('5', 'D'), C('4', 'C'), C('2', 'S')],
      'SEVEN_HIGH'
    );
  });

  it('splits the eights by their second card: nut 8-5, smooth 8-6, rough 8-7', () => {
    expectLow(
      [C('8', 'S'), C('5', 'H'), C('4', 'D'), C('3', 'C'), C('2', 'S')],
      'NUT_EIGHT'
    );
    expectLow(
      [C('8', 'S'), C('6', 'H'), C('4', 'D'), C('3', 'C'), C('2', 'S')],
      'SMOOTH_EIGHT'
    );
    expectLow(
      [C('8', 'S'), C('6', 'H'), C('5', 'D'), C('3', 'C'), C('2', 'S')],
      'SMOOTH_EIGHT'
    );
    // 8-6-5-4-3 is NOT a straight (no 7) — still a smooth 8.
    expectLow(
      [C('8', 'S'), C('6', 'H'), C('5', 'D'), C('4', 'C'), C('3', 'S')],
      'SMOOTH_EIGHT'
    );
    expectLow(
      [C('8', 'S'), C('7', 'H'), C('6', 'D'), C('5', 'C'), C('2', 'S')],
      'ROUGH_EIGHT'
    );
    expectLow(
      [C('8', 'S'), C('7', 'H'), C('4', 'D'), C('3', 'C'), C('2', 'S')],
      'ROUGH_EIGHT'
    );
  });

  it('splits the nines: Nut 9 is exactly 9-5-4-3-2', () => {
    expectLow(
      [C('9', 'S'), C('5', 'H'), C('4', 'D'), C('3', 'C'), C('2', 'S')],
      'NUT_NINE'
    );
    expectLow(
      [C('9', 'S'), C('6', 'H'), C('4', 'D'), C('3', 'C'), C('2', 'S')],
      'NINE_HIGH'
    );
    expectLow(
      [C('9', 'S'), C('8', 'H'), C('4', 'D'), C('3', 'C'), C('2', 'S')],
      'NINE_HIGH'
    );
    // ...but 9-8-7-6-5 is a straight.
    expectLow(
      [C('9', 'S'), C('8', 'H'), C('7', 'D'), C('6', 'C'), C('5', 'S')],
      'BUSTED'
    );
  });

  it('merges the top of the ladder: ten, J/Q, K/A highs', () => {
    expectLow(
      [C('10', 'S'), C('7', 'H'), C('5', 'D'), C('3', 'C'), C('2', 'S')],
      'TEN_HIGH'
    );
    expectLow(
      [C('J', 'S'), C('8', 'H'), C('6', 'D'), C('4', 'C'), C('2', 'S')],
      'JACK_QUEEN_HIGH'
    );
    expectLow(
      [C('Q', 'S'), C('9', 'H'), C('7', 'D'), C('4', 'C'), C('2', 'S')],
      'JACK_QUEEN_HIGH'
    );
    expectLow(
      [C('K', 'S'), C('9', 'H'), C('6', 'D'), C('4', 'C'), C('2', 'S')],
      'KING_ACE_HIGH'
    );
    expectLow(
      [C('A', 'S'), C('8', 'H'), C('6', 'D'), C('4', 'C'), C('2', 'S')],
      'KING_ACE_HIGH'
    );
  });

  it('busts ANY pair and every heavier count hand', () => {
    expectLow(
      [C('2', 'S'), C('2', 'H'), C('5', 'D'), C('8', 'C'), C('K', 'S')],
      'BUSTED'
    );
    expectLow(
      [C('A', 'S'), C('A', 'H'), C('4', 'D'), C('7', 'C'), C('9', 'S')],
      'BUSTED'
    );
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
  it('fills the missing card of The Nuts', () => {
    expectLow(
      [C('7', 'S'), C('5', 'H'), C('4', 'D'), C('2', 'C'), JK],
      'THE_NUTS'
    );
  });

  it('picks a 7 over completing the 2-3-4-5-6 straight or pairing', () => {
    expectLow(
      [C('2', 'S'), C('3', 'H'), C('4', 'D'), C('5', 'C'), JK],
      'THE_NUTS'
    );
  });

  it('dodges the flush with its suit choice', () => {
    // Four monosuited low cards: a high-hand joker would flush; a low
    // joker takes the missing 4 in another suit for The Nuts.
    expectLow(
      [C('2', 'H'), C('3', 'H'), C('5', 'H'), C('7', 'H'), JK],
      'THE_NUTS'
    );
  });

  it('two jokers rebuild The Nuts from 4-5-7', () => {
    expectLow([C('4', 'S'), C('5', 'H'), C('7', 'D'), JK, JK], 'THE_NUTS');
  });

  it('cannot unmake an existing pair — the line stays busted', () => {
    expectLow(
      [C('K', 'S'), C('K', 'H'), C('Q', 'D'), C('J', 'C'), JK],
      'BUSTED'
    );
  });
});

describe('the lowball value ladder', () => {
  it('runs 150 down to 5 with Busted at -50 — no zero-point hand', () => {
    expect(Object.values(LOW_HAND_VALUE).sort((a, b) => b - a)).toEqual([
      150, 120, 90, 70, 50, 40, 30, 20, 12, 5, -50,
    ]);
  });
});
