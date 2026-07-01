// Daily Grid recipe — pure function from dateISO → {difficulty, twist?}.
//
// Every player worldwide gets the same recipe on the same UTC day
// because the function is deterministic from the date string. Twist
// support is wired in but disabled in Phase 1 (TWIST_PROBABILITY = 0)
// per the implementation plan — Phase 3 turns it on.

import type { Difficulty } from '../rules';
import { TARGET_BY_DIFFICULTY } from '../rules';
import type { ChallengeId } from '../challenges';
import { fnv1a } from './seed';

export interface DailyRecipe {
  difficulty: Difficulty;
  twist?: ChallengeId;
}

// Weighted difficulty distribution (locked per spec):
//   Easy 20% / Medium 35% / Hard 35% / Extreme 10%.
// Anything that adds up cleanly works; the weighted-bag picker
// normalizes against the sum.
export interface RecipeConfig {
  difficultyWeights: Record<Difficulty, number>;
  twistProbability: number;        // 0..1
  // Per-difficulty twist eligibility. Extreme always empty so twists
  // never compound with the hardest baseline (locked decision). Other
  // tiers can host any twist; Phase 3 may narrow these once playtesting
  // reveals which combos feel unfair.
  twistEligibility: Record<Difficulty, ChallengeId[]>;
}

// The full twist rotation. Order is stable so the weighted pick below is
// deterministic. Extreme never gets a twist (empty eligibility).
const ALL_TWISTS: ChallengeId[] = [
  'short-circuit',
  'no-discards',
  'gridlock',
  'short-deck',
  'poker-purist',
  'mixed-bag',
  'three-tricks',
  'scatter',
  'bull-market',
];

// Relative odds of each twist when a day is twisted (common / normal /
// rare tiers, 3 : 2 : 1). Uniform selection is replaced by a weighted
// bag keyed on the twist-index channel.
const TWIST_WEIGHT: Record<ChallengeId, number> = {
  // Common (3)
  'short-deck': 3,
  'poker-purist': 3,
  'mixed-bag': 3,
  'three-tricks': 3,
  // Normal (2)
  'no-discards': 2,
  'short-circuit': 2,
  scatter: 2,
  gridlock: 2,
  // Rare (1)
  'bull-market': 1,
};

export const RECIPE_CONFIG: RecipeConfig = {
  difficultyWeights: { easy: 25, medium: 30, hard: 35, extreme: 10 },
  // Twists land on half of non-Extreme days. Suppressed on Extreme so
  // the hardest baseline doesn't compound with a structural handicap.
  twistProbability: 0.5,
  twistEligibility: {
    easy: ALL_TWISTS,
    medium: ALL_TWISTS,
    hard: ALL_TWISTS,
    extreme: [],
  },
};

// Mulberry32-style integer scramble. FNV-1a is fast but its avalanche
// behavior for inputs that differ by only their final byte (which is
// exactly the case here — only the day-of-month character changes
// across a month) is poor enough that sequential dates clustered on
// the same difficulty outcome (29 straight Easy days in May 2026,
// observed during playtest). Running each FNV output through this
// scrambler before bucketing fixes the within-month uniformity
// without breaking the long-run distribution the tests verify.
const scramble32 = (h: number): number => {
  let t = h >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return (t ^ (t >>> 14)) >>> 0;
};

// Three independent channels — separate FNV-1a hashes per channel
// (different salt prefixes) so difficulty / twist-probability /
// twist-index don't share entropy. Each gets a scramble32 pass on
// top to fix FNV-1a's weak avalanche for similar consecutive inputs.
const channelsFor = (dateISO: string): { difficultyRoll: number; twistRoll: number; twistIndexRoll: number } => {
  const hDiff      = scramble32(fnv1a(`pokergrid-recipe-difficulty::${dateISO}`));
  const hTwist     = scramble32(fnv1a(`pokergrid-recipe-twist::${dateISO}`));
  const hTwistIdx  = scramble32(fnv1a(`pokergrid-recipe-twist-index::${dateISO}`));
  return {
    difficultyRoll: hDiff / 0x100000000,    // [0, 1) using all 32 bits
    twistRoll: hTwist / 0x100000000,        // [0, 1)
    twistIndexRoll: hTwistIdx / 0x100000000, // [0, 1) — drives the weighted bag
  };
};

// Weighted pick from `eligible` (fixed order) using a [0, 1) roll.
const pickTwist = (
  eligible: ChallengeId[],
  roll: number
): ChallengeId => {
  const total = eligible.reduce((sum, t) => sum + TWIST_WEIGHT[t], 0);
  const target = roll * total;
  let acc = 0;
  for (const t of eligible) {
    acc += TWIST_WEIGHT[t];
    if (target < acc) return t;
  }
  return eligible[eligible.length - 1];
};

const pickDifficulty = (
  roll: number,
  weights: Record<Difficulty, number>
): Difficulty => {
  const order: Difficulty[] = ['easy', 'medium', 'hard', 'extreme'];
  const total = order.reduce((acc, d) => acc + weights[d], 0);
  let cumulative = 0;
  const r = roll * total;
  for (const d of order) {
    cumulative += weights[d];
    if (r < cumulative) return d;
  }
  return 'hard'; // fallback (shouldn't reach in practice)
};

export const recipeFor = (
  dateISO: string,
  config: RecipeConfig = RECIPE_CONFIG
): DailyRecipe => {
  const { difficultyRoll, twistRoll, twistIndexRoll } = channelsFor(dateISO);
  const difficulty = pickDifficulty(difficultyRoll, config.difficultyWeights);
  const eligibleTwists = config.twistEligibility[difficulty];
  if (
    eligibleTwists.length === 0 ||
    twistRoll >= config.twistProbability
  ) {
    return { difficulty };
  }
  const twist = pickTwist(eligibleTwists, twistIndexRoll);
  return { difficulty, twist };
};

// Twists that ignore the per-difficulty target and use a fixed value.
// Both Poker Purist and Three Tricks strip the bonus deck entirely, so
// scoring is multiplier-free and a flat ceiling makes more sense than
// scaling. The difficulty's toolkit (jokers / undos / discards) still
// modifies how hard it FEELS within the mode.
const FIXED_TWIST_TARGET: Partial<Record<ChallengeId, number>> = {
  'poker-purist': 350,
};

// Delta applied to the difficulty's base target for scoring-active
// twists. The default drops the bar by 50 so a twisted day feels
// comparable to the plain day; per-twist overrides tune specific ones —
// Bull Market and Three Tricks keep the full base target (400/450/500).
const DEFAULT_TWIST_DELTA = -50;
const TWIST_DELTA_OVERRIDE: Partial<Record<ChallengeId, number>> = {
  'bull-market': 0,
  'three-tricks': 0,
};

// Daily target = base difficulty target, optionally adjusted by the
// active twist. Twists with a fixed entry override the delta path.
// Defensive against Extreme + twist (recipe never produces that
// combination, but if a caller hands one in, the formula still
// returns a sane number).
export const dailyTargetFor = (
  difficulty: Difficulty,
  twist?: ChallengeId
): number => {
  if (!twist) return TARGET_BY_DIFFICULTY[difficulty];
  const fixed = FIXED_TWIST_TARGET[twist];
  if (fixed !== undefined) return fixed;
  const delta = TWIST_DELTA_OVERRIDE[twist] ?? DEFAULT_TWIST_DELTA;
  return TARGET_BY_DIFFICULTY[difficulty] + delta;
};
