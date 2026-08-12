import { HandRank } from '../../game/hands';
import { LOW_HAND_LABEL, LowHandRank } from '../../game/lowHands';
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

/**
 * Mode-aware hand name for a scored line: the 2-7 low category when the
 * report was scored under Nut Low (lowHand present), the high hand
 * otherwise, '' when the line is empty/incomplete. `lowHand` presence
 * marks the mode, so callers need no extra threading.
 */
export const lineHandLabel = (line: {
  hand: HandRank | null;
  lowHand?: LowHandRank | null;
}): string =>
  line.lowHand
    ? LOW_HAND_LABEL[line.lowHand]
    : line.hand
      ? HAND_LABEL[line.hand]
      : '';
