import { HandRank } from '../../game/hands';
import { LineKind } from '../../game/grid';

export const HAND_LABEL: Record<HandRank, string> = {
  HIGH_CARD: 'High Card',
  PAIR: 'Pair',
  TWO_PAIR: 'Two Pair',
  THREE_OF_A_KIND: 'Three of a Kind',
  STRAIGHT: 'Straight',
  FLUSH: 'Flush',
  FULL_HOUSE: 'Full House',
  FOUR_OF_A_KIND: 'Four of a Kind',
  STRAIGHT_FLUSH: 'Straight Flush',
  ROYAL_FLUSH: 'Royal Flush',
  FIVE_OF_A_KIND: 'Five of a Kind',
};

export const lineLabel = (kind: LineKind, index: number): string =>
  `${kind === 'row' ? 'R' : 'C'}${index + 1}`;
