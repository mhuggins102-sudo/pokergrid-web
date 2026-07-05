import { BonusCard } from '../../game/bonusCards';
import { Grid } from '../../game/grid';
import { ScoreOptions, ScoreReport, scoreGrid } from '../../game/scoring';

// The result hero's corner decomposition: how much of the final score
// is pure poker (base), how much the gold (per-line) bonus cards added,
// and what the purple (grid-level) cards multiplied it by. Exact by
// construction against scoring.ts's pipeline:
//
//   ceil((base + goldAdd) × gridMultiplier) + gridFlat === report.total
export interface ScoreBreakdownData {
  // Pure-poker score: the grid scored with NO bonus cards. Bull
  // Market's handBoost stays in — it changes hand values rather than
  // being a bonus card.
  base: number;
  // Points the gold (lineEffect) cards added: report.subtotal − base.
  goldAdd: number;
  gridMultiplier: number;
  gridFlat: number;
  hasGold: boolean;
  hasPurple: boolean;
  // The no-bonus-cards report — its per-line totals drive the rail
  // tally's "base" beat and the boosted-line detection.
  baseReport: ScoreReport;
}

export const computeScoreBreakdown = (
  grid: Grid,
  bonusCards: readonly BonusCard[],
  report: ScoreReport,
  options: ScoreOptions
): ScoreBreakdownData => {
  // Patience (purple) cancels the incomplete-line penalty inside the
  // subtotal. Score the base under the same penalty rules, so the
  // cancellation doesn't masquerade as gold points.
  const negatesPenalty = bonusCards.some(c => c.negatesIncompletePenalty);
  const baseReport = scoreGrid(grid, [], {
    ...options,
    ignoreIncompletePenalty:
      (options.ignoreIncompletePenalty ?? false) || negatesPenalty,
  });
  const base = baseReport.total;
  const goldAdd = report.subtotal - base;
  return {
    base,
    goldAdd,
    gridMultiplier: report.gridMultiplier,
    gridFlat: report.gridFlat,
    hasGold: goldAdd !== 0,
    hasPurple: report.gridMultiplier !== 1 || report.gridFlat !== 0,
    baseReport,
  };
};
