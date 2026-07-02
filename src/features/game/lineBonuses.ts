import {
  BonusCard,
  LineContext,
  isPlaceholder,
  isSpecialCard,
} from '../../game/bonusCards';
import { HAND_BASE_VALUE, ScoredLine } from '../../game/scoring';

export interface AppliedLineBonus {
  card: BonusCard;
  mult: number;
  flat: number;
}

/**
 * Which held bonus cards actually fired on a line — each card's own
 * lineEffect re-derived against that line, so the display is the real
 * scoring math.
 */
export const appliedLineBonuses = (
  line: ScoredLine,
  bonusCards: BonusCard[],
  allLines: ScoredLine[]
): AppliedLineBonus[] => {
  if (!line.hand) return [];
  return bonusCards
    .filter(c => !isPlaceholder(c) && !isSpecialCard(c) && c.lineEffect)
    .map(card => {
      const eff = card.lineEffect!(line as LineContext, card, allLines);
      return { card, mult: eff.multiplier ?? 1, flat: eff.flatAdd ?? 0 };
    })
    .filter(e => e.mult !== 1 || e.flat !== 0);
};

export const fmtMult = (m: number): string =>
  `×${m.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}`;

/**
 * Split a line's (possibly boosted) base into the hand's regular value
 * and the Bull Market ♣ invest on top. `invested` is 0 everywhere
 * outside Bull Market — line.base IS the table value then.
 */
export const investedBase = (
  line: ScoredLine
): { raw: number; invested: number } => {
  const raw = line.hand ? HAND_BASE_VALUE[line.hand] : 0;
  return { raw, invested: line.base - raw };
};
