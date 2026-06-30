import { Card, Rank, isJoker } from './cards';
import { HandRank } from './hands';

// The "Bull Market" challenge's ♣ "invest" perk boosts the base value of
// one scoring hand type, chosen at random (the spin wheel). High Card is
// never eligible — it scores nothing by design.
export const INVEST_HANDS: HandRank[] = [
  'PAIR',
  'TWO_PAIR',
  'THREE_OF_A_KIND',
  'STRAIGHT',
  'FLUSH',
  'FULL_HOUSE',
  'FOUR_OF_A_KIND',
  'STRAIGHT_FLUSH',
  'FIVE_OF_A_KIND',
  'ROYAL_FLUSH',
];

// Each invest adds TWICE the club's blackjack pip value to the hand's
// base (e.g. an Ace boosts by 22, a 7 by 14).
const INVEST_MULTIPLIER = 2;

// Blackjack pip values: 2–9 face, 10/J/Q/K = 10, A = 11.
const RANK_INVEST_VALUE: Record<Rank, number> = {
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  J: 10,
  Q: 10,
  K: 10,
  A: 11,
};

/** How much a club spent on the invest perk adds to a hand's base
 *  (2× its blackjack pip value). */
export const clubInvestValue = (card: Card): number =>
  isJoker(card) ? 0 : RANK_INVEST_VALUE[card.rank] * INVEST_MULTIPLIER;

/** Uniformly pick a scoring hand to boost (stacking allowed). */
export const pickInvestHand = (rng: () => number): HandRank =>
  INVEST_HANDS[Math.floor(rng() * INVEST_HANDS.length)];
