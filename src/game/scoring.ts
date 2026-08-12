import { Card } from './cards';
import {
  applyGridEffects,
  applyLineEffects,
  BonusCard,
  LineContext,
} from './bonusCards';
import { Grid, lines } from './grid';
import { evaluateLine, HandRank } from './hands';
import {
  LOW_HAND_VALUE,
  LowHandRank,
  RAINBOW_BONUS,
  evaluateLowLine,
  isRainbowLine,
} from './lowHands';

export const HAND_BASE_VALUE: Record<HandRank, number> = {
  HIGH_CARD: 0,
  PAIR: 5,
  TWO_PAIR: 12,
  THREE_OF_A_KIND: 20,
  STRAIGHT: 30,
  FLUSH: 40,
  FULL_HOUSE: 50,
  FOUR_OF_A_KIND: 70,
  STRAIGHT_FLUSH: 90,
  ROYAL_FLUSH: 120,
  FIVE_OF_A_KIND: 150,
};

export const INCOMPLETE_LINE_PENALTY = -25;

export interface ScoredLine extends LineContext {
  base: number;
  multiplier: number;
  flat: number;
  total: number;
  incomplete: boolean; // line has fewer than 5 cards
  // Nut Low only: the line's 2-7 lowball category (null while the line
  // is incomplete). Undefined outside lowball scoring. `hand` above
  // still carries the HIGH evaluation in lowball mode, so every
  // "line.hand truthy = line complete" check keeps working — display
  // surfaces prefer lowHand when present (see lineHandLabel).
  lowHand?: LowHandRank | null;
}

export interface ScoreReport {
  lines: ScoredLine[];
  subtotal: number; // sum of all line totals (including penalties)
  incompletePenalty: number; // sum of all penalty contributions (negative or 0)
  gridMultiplier: number;
  gridFlat: number;
  // Time Trial's clock adjustment (0 everywhere else) — a flat term
  // OUTSIDE the grid multiplier, echoed here for the display surfaces.
  timeAdjust: number;
  total: number; // ceil(subtotal * gridMultiplier) + gridFlat + timeAdjust
}

export interface ScoreOptions {
  // Cards remaining in the playing-card deck — used by grid-level bonus cards
  // (e.g. "×1.05 per deck card").
  deckRemaining?: number;
  // For mid-game live previews: treat incomplete lines as 0 (not -25). The
  // penalty only matters at game end; showing it live can be misleading.
  ignoreIncompletePenalty?: boolean;
  // Cards in the discards pile (no-perk ditches + destroyed targets).
  // "Trash Joker" looks here.
  discards?: readonly Card[];
  // Drawn cards spent on suit perks. Burnout / Frugal look here.
  perkSpent?: readonly Card[];
  // Per-hand base-value boosts (the Bull Market challenge's ♣ invest
  // perk). Added to HAND_BASE_VALUE before any line multipliers apply.
  handBoost?: Partial<Record<HandRank, number>>;
  // Time Trial: the clock's flat adjustment (timeTrialAdjust). Only the
  // FINAL score surfaces pass it — the live score stays board-only.
  timeAdjust?: number;
  // Nut Low: score every line as a 2-7 lowball hand (LOW_HAND_VALUE
  // table) with a flat +RAINBOW_BONUS on complete four-suit lines.
  // Always paired with a no-bonus-card game (state.lowball mirrors
  // noBonusCards), so line/grid multipliers stay 1 in practice.
  lowball?: boolean;
}

// ---- Time Trial (challenge) -------------------------------------------
// Two nonlinear halves around a 3:00 par, each quadratic in the whole
// seconds from par (t) and saturating past a 60s window:
//   under par:  +(BONUS_BASE + t² / BONUS_DIV)     +25 @10s … +200 @60s+
//   over par:   −(PENALTY_BASE + t² / PENALTY_DIV) −23 @10s … −110 @60s+
// Exactly at par: 0. Deliberately asymmetric — every second saved is
// worth more than the matching second lost costs, so fast play is the
// bigger lever. Tune here.
export const TIME_TRIAL_PAR_S = 180; // 3:00
export const TIME_TRIAL_WINDOW_S = 60; // swing saturates past ±this
export const TIME_TRIAL_BONUS_BASE = 20;
export const TIME_TRIAL_BONUS_DIV = 20;
export const TIME_TRIAL_PENALTY_BASE = 20;
export const TIME_TRIAL_PENALTY_DIV = 40;
// The saturated extremes (sub-2:00 → +200, past 4:00 → −110), derived so
// they track the knobs above.
export const TIME_TRIAL_MAX_BONUS =
  TIME_TRIAL_BONUS_BASE + TIME_TRIAL_WINDOW_S ** 2 / TIME_TRIAL_BONUS_DIV;
export const TIME_TRIAL_MAX_PENALTY =
  TIME_TRIAL_PENALTY_BASE + TIME_TRIAL_WINDOW_S ** 2 / TIME_TRIAL_PENALTY_DIV;

/** The clock's current worth. Structural param (not GameState) so the
 *  scoring module stays engine-import-free; tolerant of hydrated old
 *  states missing the fields. */
export const timeTrialAdjust = (s: {
  timeTrial?: boolean;
  elapsedMs?: number;
}): number => {
  if (!s.timeTrial) return 0;
  const elapsedS = Math.floor((s.elapsedMs ?? 0) / 1000);
  const delta = TIME_TRIAL_PAR_S - elapsedS; // + under par, − over
  if (delta === 0) return 0;
  const t = Math.min(Math.abs(delta), TIME_TRIAL_WINDOW_S);
  return delta > 0
    ? Math.round(TIME_TRIAL_BONUS_BASE + (t * t) / TIME_TRIAL_BONUS_DIV)
    : -Math.round(TIME_TRIAL_PENALTY_BASE + (t * t) / TIME_TRIAL_PENALTY_DIV);
};

/** Base value of a hand including any Bull Market invest boosts. */
export const effectiveHandBase = (
  hand: HandRank,
  handBoost?: Partial<Record<HandRank, number>>
): number => HAND_BASE_VALUE[hand] + (handBoost?.[hand] ?? 0);

/**
 * Shapley-value attribution of the bonus-card contribution.
 *
 * For each held bonus card, returns the fair share of the score it contributes
 * given the other cards. The leave-one-out marginal (with-all minus
 * without-this) double-counts when multiple bonuses multiplicatively stack on
 * the same line — three ×2 cards on a Pair would each show ~5×(8-4)=20 even
 * though the cards together only added 5×(8-1)=35 total.
 *
 * Shapley averages the marginal contribution across every order the cards
 * could have been added. By construction:
 *
 *   sum(shapley) = scoreGrid(grid, allCards, options).total
 *                - scoreGrid(grid, [],       options).total
 *
 * Returned values are rounded to the nearest integer; the tiny rounding drift
 * is bounded by N (≤ 3 cards) so the displayed sum tracks the actual bonus
 * contribution within a few points.
 *
 * Cost: 2^N scoreGrid evaluations. With N capped at 3 (BONUS_HAND_LIMIT) the
 * worst case is 8 evaluations — fast.
 */
const popcount = (n: number): number => {
  let c = 0;
  while (n > 0) { c += n & 1; n >>= 1; }
  return c;
};

export const bonusShapleyValues = (
  grid: Grid,
  cards: readonly BonusCard[],
  options: ScoreOptions = {}
): number[] => {
  const N = cards.length;
  if (N === 0) return [];

  // Precompute total score for every subset of bonuses.
  const subsetTotal: number[] = new Array(1 << N);
  for (let mask = 0; mask < (1 << N); mask++) {
    const subset = cards.filter((_, i) => (mask & (1 << i)) !== 0);
    subsetTotal[mask] = scoreGrid(grid, subset, options).total;
  }

  const fact: number[] = [1];
  for (let i = 1; i <= N; i++) fact.push(fact[i - 1] * i);

  const values: number[] = [];
  for (let i = 0; i < N; i++) {
    let sh = 0;
    for (let mask = 0; mask < (1 << N); mask++) {
      if ((mask & (1 << i)) !== 0) continue; // S must NOT contain i
      const k = popcount(mask);
      const weight = (fact[k] * fact[N - k - 1]) / fact[N];
      sh += weight * (subsetTotal[mask | (1 << i)] - subsetTotal[mask]);
    }
    values.push(Math.round(sh));
  }
  return values;
};

export const scoreGrid = (
  grid: Grid,
  bonusCards: readonly BonusCard[],
  options: ScoreOptions = {}
): ScoreReport => {
  const deckRemaining = options.deckRemaining ?? 0;
  // The penalty is skipped during live-preview scoring (option) AND when the
  // player holds Patience. Either route reaches the same place.
  const ignorePenalty =
    (options.ignoreIncompletePenalty ?? false) ||
    bonusCards.some(c => c.negatesIncompletePenalty);
  const discards = options.discards ?? [];
  const perkSpent = options.perkSpent ?? [];
  // First pass — build every LineContext up front (kind / index /
  // cards / hand) WITHOUT yet applying bonus effects. Cross-line
  // bonus cards (Lowhand) need to compare the current line against
  // the rest of the board; supplying allCtxs to applyLineEffects
  // below gives them that visibility. Single-line cards ignore the
  // extra argument and behave exactly as before.
  const allCtxs: LineContext[] = lines(grid).map(l => ({
    kind: l.kind,
    index: l.index,
    cards: l.cards,
    hand: evaluateLine(l.cards),
  }));
  const lowball = options.lowball ?? false;
  const scored: ScoredLine[] = allCtxs.map(ctx => {
    const filled = ctx.cards.filter(c => c !== null).length;
    const incomplete = filled < 5;
    // Nut Low: lowHand is the line's 2-7 category (null while
    // incomplete); ctx.hand keeps the high evaluation — see ScoredLine.
    const lowHand = lowball ? evaluateLowLine(ctx.cards) : undefined;
    if (!ctx.hand) {
      const total = incomplete && !ignorePenalty ? INCOMPLETE_LINE_PENALTY : 0;
      return {
        ...ctx,
        lowHand,
        base: 0,
        multiplier: 1,
        flat: 0,
        total,
        incomplete,
      };
    }
    const base = lowball
      ? LOW_HAND_VALUE[lowHand!]
      : effectiveHandBase(ctx.hand, options.handBoost);
    const { multiplier, flat: bonusFlat } = applyLineEffects(
      ctx,
      bonusCards,
      allCtxs
    );
    const flat =
      bonusFlat + (lowball && isRainbowLine(ctx.cards) ? RAINBOW_BONUS : 0);
    const total = Math.ceil(base * multiplier) + flat;
    return { ...ctx, lowHand, base, multiplier, flat, total, incomplete: false };
  });
  const subtotal = scored.reduce((sum, s) => sum + s.total, 0);
  const incompletePenalty = scored
    .filter(s => s.incomplete)
    .reduce((sum, s) => sum + s.total, 0);
  const { multiplier: gridMultiplier, flat: gridFlat } = applyGridEffects(
    { grid, deckRemaining, discards, perkSpent, lines: scored },
    bonusCards
  );
  const timeAdjust = options.timeAdjust ?? 0;
  const total = Math.ceil(subtotal * gridMultiplier) + gridFlat + timeAdjust;
  return {
    lines: scored,
    subtotal,
    incompletePenalty,
    gridMultiplier,
    gridFlat,
    timeAdjust,
    total,
  };
};
