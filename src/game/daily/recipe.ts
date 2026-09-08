// Daily Grid recipe — pure function from dateISO → {difficulty, twist?}.
//
// Every player worldwide gets the same recipe on the same UTC day
// because the function is deterministic from the date string.
//
// Since g3 the recipes come from a BALANCED 40-DAY CYCLE, not
// independent per-day rolls. Each cycle (aligned to the daily launch,
// 2026-03-01) holds exactly:
//   -  4 Extreme days (never twisted)
//   - 10 twist-free days — 3 Easy, 3 Medium, 4 Hard
//   - 26 twisted days — every live twist exactly TWICE, at two
//     DIFFERENT difficulties; twisted totals 7 Easy / 9 Medium /
//     10 Hard (per cycle, 3 twists pair Easy+Medium, 4 Easy+Hard,
//     6 Medium+Hard — the grouping reshuffles every cycle)
// and the cycle's order is a seeded shuffle constrained so no two
// consecutive days share an identity — the same twist never repeats
// back-to-back, and twist-free days (Extreme included) never cluster —
// including across cycle boundaries. The mix stays close to the old
// weights (Extreme 10%, twist-free 25%, each twist 1/13 of twisted
// days) but with exact counts and guaranteed variety instead of
// long-run averages.

import type { Difficulty } from '../rules';
import { TARGET_BY_DIFFICULTY } from '../rules';
import type { ChallengeId } from '../challenges';
import { seededRng, shuffle } from '../deck';
import { DAILY_GENERATION, fnv1a, parseDateISO } from './seed';

export interface DailyRecipe {
  difficulty: Difficulty;
  twist?: ChallengeId;
}

// The live twist rotation — every entry appears exactly twice per
// cycle. Spiraling (benched) and Nut Low (challenge-only while its
// target calibrates) sit out; adding a twist here changes the cycle
// composition, so revisit the 26-day math when the list grows.
export const ALL_TWISTS: ChallengeId[] = [
  'short-circuit',
  'no-discards',
  'gridlock',
  'short-deck',
  'poker-purist',
  'mixed-bag',
  'three-tricks',
  'scatter',
  'bull-market',
  'double-duty',
  'time-trial',
  'draw-poker',
  'trading-post',
];

export const CYCLE_LENGTH = 40;

// Cycle day 0 — the first daily ever published. Keep in sync with
// DAILY_LAUNCH_ISO (src/features/daily/dailyDates.ts); duplicated here
// because the game layer doesn't import from features.
export const CYCLE_EPOCH_ISO = '2026-03-01';
const CYCLE_EPOCH_MS = Date.UTC(2026, 2, 1);
const DAY_MS = 86_400_000;

// Mulberry32-style integer scramble — fixes FNV-1a's weak avalanche
// for near-identical inputs (consecutive cycle indices differ by one
// character) before the value seeds a cycle's rng.
const scramble32 = (h: number): number => {
  let t = h >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return (t ^ (t >>> 14)) >>> 0;
};

// Days since the epoch (negative before it — the archive never goes
// there, but the function stays total). Invalid strings hash to a
// stable pseudo-day instead of NaN-poisoning the math.
const dayNumberFor = (dateISO: string): number => {
  const d = parseDateISO(dateISO);
  if (!d) return scramble32(fnv1a(dateISO)) % 100_000;
  return Math.floor((d.getTime() - CYCLE_EPOCH_MS) / DAY_MS);
};

// Two adjacent days conflict when they share an identity: the same
// twist back-to-back, or two twist-free days in a row (Extreme counts
// as twist-free — a "no twist" cluster reads samey regardless of the
// difficulty underneath).
const conflicts = (a: DailyRecipe, b: DailyRecipe): boolean =>
  (a.twist ?? 'none') === (b.twist ?? 'none');

// One seeded attempt at a cycle layout. Null = the shuffle violated a
// constraint; the caller retries with the next nonce.
const tryBuildCycle = (rng: () => number): DailyRecipe[] | null => {
  // 1. Pair each twist with two DIFFERENT difficulties. The grouping
  //    (3× Easy+Medium, 4× Easy+Hard, 6× Medium+Hard) is the unique
  //    integer solution to the 7/9/10 twisted-difficulty totals; WHICH
  //    twist lands in which group reshuffles per cycle.
  const order = shuffle(ALL_TWISTS, rng);
  const twisted: DailyRecipe[] = [];
  order.forEach((twist, i) => {
    const pair: [Difficulty, Difficulty] =
      i < 3 ? ['easy', 'medium'] : i < 7 ? ['easy', 'hard'] : ['medium', 'hard'];
    twisted.push({ difficulty: pair[0], twist }, { difficulty: pair[1], twist });
  });

  // 2. Sequence the 26 twisted days. Twins must never end up adjacent —
  //    conservative (a twist-free day might separate them later), which
  //    only costs retries.
  const seq = shuffle(twisted, rng);
  for (let i = 1; i < seq.length; i++) {
    if (seq[i].twist === seq[i - 1].twist) return null;
  }

  // 3. The 14 twist-free days (Extreme included), shuffled…
  const frees = shuffle<DailyRecipe>(
    [
      { difficulty: 'easy' },
      { difficulty: 'easy' },
      { difficulty: 'easy' },
      { difficulty: 'medium' },
      { difficulty: 'medium' },
      { difficulty: 'medium' },
      { difficulty: 'hard' },
      { difficulty: 'hard' },
      { difficulty: 'hard' },
      { difficulty: 'hard' },
      { difficulty: 'extreme' },
      { difficulty: 'extreme' },
      { difficulty: 'extreme' },
      { difficulty: 'extreme' },
    ],
    rng
  );

  // 4. …dealt into 14 DISTINCT gaps of the 27 around the twisted
  //    sequence (before / between / after) — at most one per gap, so
  //    twist-free days can never cluster.
  const gapSet = new Set(
    shuffle(
      Array.from({ length: seq.length + 1 }, (_, i) => i),
      rng
    ).slice(0, frees.length)
  );

  // 5. Weave.
  const days: DailyRecipe[] = [];
  let f = 0;
  for (let g = 0; g <= seq.length; g++) {
    if (gapSet.has(g)) days.push(frees[f++]);
    if (g < seq.length) days.push(seq[g]);
  }
  return days;
};

// Build (and memoize) cycle k's 40 recipes. Continuity chains back to
// the epoch cycle: each cycle's first day must not conflict with the
// previous cycle's last, so building cycle k builds any missing
// ancestors first — cheap (a handful of 40-item shuffles per cycle,
// ~9 cycles a year).
const cycleMemo = new Map<number, DailyRecipe[]>();

const scheduleFor = (k: number): DailyRecipe[] => {
  const hit = cycleMemo.get(k);
  if (hit) return hit;
  const prevLast = k > 0 ? scheduleFor(k - 1)[CYCLE_LENGTH - 1] : null;
  let fallback: DailyRecipe[] | null = null;
  let built: DailyRecipe[] | null = null;
  for (let nonce = 0; nonce < 300 && !built; nonce++) {
    const rng = seededRng(
      scramble32(
        fnv1a(`pokergrid-cycle-g${DAILY_GENERATION}::${k}::${nonce}`)
      )
    );
    const attempt = tryBuildCycle(rng);
    if (!attempt) continue;
    fallback = fallback ?? attempt;
    if (prevLast && conflicts(prevLast, attempt[0])) continue;
    built = attempt;
  }
  // 300 seeded attempts virtually never all fail (each clears its
  // constraints ~1 time in 3); if they somehow do, a valid-but-
  // boundary-imperfect cycle beats crashing the daily.
  const result = built ?? fallback;
  if (!result) throw new Error(`daily cycle ${k} failed to build`);
  cycleMemo.set(k, result);
  return result;
};

export const recipeFor = (dateISO: string): DailyRecipe => {
  const day = dayNumberFor(dateISO);
  const k = Math.floor(day / CYCLE_LENGTH);
  return scheduleFor(k)[day - k * CYCLE_LENGTH];
};

// Twists that ignore the per-difficulty target and use a fixed value.
// Poker Purist strips the bonus deck entirely, so scoring is
// multiplier-free and a flat ceiling makes more sense than scaling.
// The difficulty's toolkit (jokers / undos / discards) still modifies
// how hard it FEELS within the mode. Nut Low is multiplier-free for the
// same reason, and its lowball values live on their own scale anyway.
const FIXED_TWIST_TARGET: Partial<
  Record<ChallengeId, number | Partial<Record<Difficulty, number>>>
> = {
  'poker-purist': 350,
  'nut-low': 400,
  // Flat 500 on every difficulty: Easy/Medium's assists (deck peek,
  // the extra joker) are far stronger in Five Draw than elsewhere, so
  // the easier tiers don't also get a discounted target.
  'draw-poker': 500,
  // No-multiplier scoring runs a tighter band than the base 400/450/500
  // (the challenge itself plays at 450 = the hard entry). Extreme never
  // draws a twist; the value is defensive.
  'bull-market': { easy: 400, medium: 425, hard: 450, extreme: 425 },
};

// Delta applied to the difficulty's base target when a twist is active.
// Every twist now keeps the full base target (400/450/500); the override
// map stays as the tuning knob if playtesting singles one out again.
const DEFAULT_TWIST_DELTA = 0;
const TWIST_DELTA_OVERRIDE: Partial<Record<ChallengeId, number>> = {};

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
  if (typeof fixed === 'number') return fixed;
  if (fixed !== undefined) {
    return fixed[difficulty] ?? TARGET_BY_DIFFICULTY[difficulty];
  }
  const delta = TWIST_DELTA_OVERRIDE[twist] ?? DEFAULT_TWIST_DELTA;
  return TARGET_BY_DIFFICULTY[difficulty] + delta;
};
