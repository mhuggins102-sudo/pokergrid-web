import { BonusCard } from '../../game/bonusCards';
import { Grid } from '../../game/grid';
import {
  ScoreOptions,
  ScoreReport,
  bonusShapleyValues,
  scoreGrid,
} from '../../game/scoring';
import { categoryOf } from '../../lib/bonusCardCategory';

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

// ---- Per-card build-up (the corner-tap popup) ----

export interface GoldContribution {
  card: BonusCard;
  /** Points this card added to the lines (integer; rows sum to goldAdd). */
  add: number;
}

export interface PurpleContribution {
  card: BonusCard;
  /** The multiplier this card actually applied (1 = didn't fire). */
  multiplier: number;
  /** Flat points this card actually added at game end. */
  flat: number;
}

export interface ScoreBuildData extends ScoreBreakdownData {
  /** Per-gold-card adds, integer-rounded to sum exactly to goldAdd. */
  golds: GoldContribution[];
  subtotal: number;
  /** Only the purple cards that FIRED (multiplier ≠ 1 or flat ≠ 0). */
  purples: PurpleContribution[];
  total: number;
}

const GOLD_CATEGORIES = new Set(['hand', 'line', 'suit', 'conditional']);

// Round a fractional attribution to integers that sum to `target`:
// floor everything, then hand the remainder out by largest fraction.
const roundPreservingSum = (values: number[], target: number): number[] => {
  const floors = values.map(Math.floor);
  let remainder = target - floors.reduce((a, b) => a + b, 0);
  const order = values
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);
  const out = [...floors];
  for (const { i } of order) {
    if (remainder === 0) break;
    const step = remainder > 0 ? 1 : -1;
    out[i] += step;
    remainder -= step;
  }
  return out;
};

/**
 * The corner breakdown expanded per card: base, each gold card's
 * added points (Shapley attribution over the gold cards alone, so the
 * rows sum exactly to goldAdd), the green+gold subtotal, then each
 * fired purple card's multiplier / flat. Purple factors are
 * independent per card, so scoring the grid with each card alone
 * recovers its contribution (their product/sum reproduces the
 * report's gridMultiplier/gridFlat).
 */
export const computeScoreBuild = (
  grid: Grid,
  bonusCards: readonly BonusCard[],
  report: ScoreReport,
  options: ScoreOptions
): ScoreBuildData => {
  const breakdown = computeScoreBreakdown(grid, bonusCards, report, options);
  const negatesPenalty = bonusCards.some(c => c.negatesIncompletePenalty);
  const opts: ScoreOptions = {
    ...options,
    ignoreIncompletePenalty:
      (options.ignoreIncompletePenalty ?? false) || negatesPenalty,
  };

  const goldCards = bonusCards.filter(c => GOLD_CATEGORIES.has(categoryOf(c)));
  const shapley = bonusShapleyValues(grid, goldCards, opts);
  const adds = roundPreservingSum(shapley, breakdown.goldAdd);
  const golds: GoldContribution[] = goldCards.map((card, i) => ({
    card,
    add: adds[i],
  }));

  const purples: PurpleContribution[] = bonusCards
    .filter(c => {
      const cat = categoryOf(c);
      return cat === 'grid' || cat === 'deck-management';
    })
    .map(card => {
      const solo = scoreGrid(grid, [card], opts);
      return { card, multiplier: solo.gridMultiplier, flat: solo.gridFlat };
    })
    .filter(p => p.multiplier !== 1 || p.flat !== 0);

  return {
    ...breakdown,
    golds,
    subtotal: report.subtotal,
    purples,
    total: report.total,
  };
};
