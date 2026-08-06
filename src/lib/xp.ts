// Player XP + level progression. XP is DERIVED, not stored: it is a pure
// function of the persisted free-play stats + daily plays, so it needs no
// separate ledger, can never double-count, and is automatically
// retroactive (a veteran's existing record already implies their XP). See
// src/features/progress/usePlayerLevel.ts for the reactive binding.

import { dailyTargetFor } from '../game/daily/recipe';
import { Difficulty } from '../game/rules';
import { Stats, Tier, tierForRun } from './stats';
import type { ChallengeId } from '../game/challenges';

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard', 'extreme'];

// ---- XP earning chart (tunable; one edit rescales the economy) --------

// A won Free Play game, by difficulty.
export const BASE_WIN_XP: Record<Difficulty, number> = {
  easy: 10,
  medium: 20,
  hard: 35,
  extreme: 55,
};

// Skill kicker layered on an S/SS win (Free Play or Daily). A-tier wins
// take only the base value; losses (B / C / D) earn no tier bonus.
export const TIER_WIN_BONUS: Record<Tier, number> = {
  SS: 50,
  S: 20,
  A: 0,
  B: 0,
  C: 0,
  D: 0,
};

export const FIRST_WIN_PER_DIFFICULTY_XP = 50; // one-time, ×4
export const CHALLENGE_FIRST_CLEAR_XP = 150; // one-time, per challenge
// Best-trophy kicker per challenge: Silver (S win) adds one step (200
// total), Gold (SS) adds another on top (250 total). Derived from the
// stored best tier, so upgrading a beaten challenge yields exactly the
// difference.
export const CHALLENGE_TROPHY_STEP_XP = 50;
export const ACHIEVEMENT_XP = 100; // one-time, per achievement
export const TARGETS_UP_LEVEL_XP = 50; // per new highest level reached
export const DAILY_PLAY_XP = 15; // playing a daily (win or lose)
export const DAILY_BEAT_XP = 25; // additionally, beating its target

// ---- Level curve ------------------------------------------------------

// Cumulative XP required to REACH each level. Index i → level i+1
// (LEVEL_XP[0] = 0 = level 1 = the start). Shaped so the FIRST win
// (≥60 XP with its milestone) still pops Level 2 instantly — the
// onboarding hook — but no single game can leapfrog two levels: even a
// monster opener (Extreme SS + first win ≈ 155) stays at Level 2.
// Steepens toward the top.
export const LEVEL_XP = [
  0, 60, 200, 400, 680, 1020, 1420, 1880, 2400, 2980, 3620, 4320, 5000, 5700,
  6700, 7900, 9300, 11000, 12900, 15000,
];

export const MAX_LEVEL = LEVEL_XP.length; // 20

// The minimal daily-play shape the XP math needs (built from the plays
// store by the caller, so this module stays free of feature imports).
export interface DailyXpPlay {
  score: number;
  won: boolean;
  difficulty: Difficulty;
  twist?: ChallengeId;
}

// XP earning categories — the buckets a total splits into. Diffing two
// bucket snapshots (before vs after a run) yields exactly what THIS game
// earned per source, which drives the end-of-game "+N XP" breakdown.
// Wins split per difficulty and the tier kicker per tier so the
// breakdown rows can NAME them ("Medium Win", "Skill Tier SS").
export type XpBucket =
  | 'win-easy'
  | 'win-medium'
  | 'win-hard'
  | 'win-extreme'
  | 'tier-SS'
  | 'tier-S'
  | 'firstWin'
  | 'challenge'
  | 'challenge-silver'
  | 'challenge-gold'
  | 'achievement'
  | 'targets'
  | 'daily';

export const XP_BUCKET_LABEL: Record<XpBucket, string> = {
  'win-easy': 'Easy Win',
  'win-medium': 'Medium Win',
  'win-hard': 'Hard Win',
  'win-extreme': 'Extreme Win',
  'tier-SS': 'Skill Tier SS',
  'tier-S': 'Skill Tier S',
  firstWin: 'First win',
  challenge: 'Challenge cleared',
  'challenge-silver': 'Challenge Trophy — Silver',
  'challenge-gold': 'Challenge Trophy — Gold',
  achievement: 'Achievement',
  targets: 'Targets-Up level',
  daily: 'Daily',
};

// Stable render order for the breakdown list.
export const XP_BUCKET_ORDER: XpBucket[] = [
  'win-easy',
  'win-medium',
  'win-hard',
  'win-extreme',
  'tier-SS',
  'tier-S',
  'firstWin',
  'daily',
  'challenge',
  'challenge-silver',
  'challenge-gold',
  'achievement',
  'targets',
];

/**
 * The row label for a bucket's earnings. Static except `targets`, whose
 * row counts the levels climbed this run: "Targets Up (+2 Levels)".
 */
export const xpRowLabel = (bucket: XpBucket, xp: number): string => {
  if (bucket === 'targets') {
    const n = Math.round(xp / TARGETS_UP_LEVEL_XP);
    return `Targets Up (+${n} ${n === 1 ? 'Level' : 'Levels'})`;
  }
  return XP_BUCKET_LABEL[bucket];
};

const emptyBuckets = (): Record<XpBucket, number> => ({
  'win-easy': 0,
  'win-medium': 0,
  'win-hard': 0,
  'win-extreme': 0,
  'tier-SS': 0,
  'tier-S': 0,
  firstWin: 0,
  challenge: 0,
  'challenge-silver': 0,
  'challenge-gold': 0,
  achievement: 0,
  targets: 0,
  daily: 0,
});

/**
 * Lifetime XP split into its earning buckets. Same one-source-one-counter
 * discipline as xpForStats (which is just the sum of these), so a before/
 * after diff of the buckets attributes a single run's earnings exactly.
 */
export const xpBuckets = (
  stats: Stats,
  dailyPlays: readonly DailyXpPlay[]
): Record<XpBucket, number> => {
  const b = emptyBuckets();

  // Free Play: base win value + first-win-per-difficulty milestone + the
  // per-win tier kicker (S/SS only). tierCounts is free-play-only and,
  // since every win is A/S/SS, its S/SS buckets ARE the win-by-tier
  // counts.
  for (const d of DIFFICULTIES) {
    const wins = stats.byDifficulty[d].wins;
    b[`win-${d}`] += wins * BASE_WIN_XP[d];
    if (wins > 0) b.firstWin += FIRST_WIN_PER_DIFFICULTY_XP;
    const tc = stats.tierCounts[d];
    b['tier-SS'] += tc.SS * TIER_WIN_BONUS.SS;
    b['tier-S'] += tc.S * TIER_WIN_BONUS.S;
  }

  // One-time collections. The trophy kickers read the BEST recorded win
  // tier per beaten challenge (Silver = S or better, Gold = SS —
  // cumulative, so gold implies silver and an upgrade diffs cleanly).
  // Iterate challengesDone, not challengeTiers: stale ids of removed
  // challenges can linger in the tiers map, and pre-trophy wins have no
  // tier entry at all (flat clear value only).
  for (const id of stats.challengesDone) {
    b.challenge += CHALLENGE_FIRST_CLEAR_XP;
    const tier = stats.challengeTiers[id];
    if (tier === 'SS' || tier === 'S') {
      b['challenge-silver'] += CHALLENGE_TROPHY_STEP_XP;
    }
    if (tier === 'SS') {
      b['challenge-gold'] += CHALLENGE_TROPHY_STEP_XP;
    }
  }
  b.achievement += stats.achievementsDone.length * ACHIEVEMENT_XP;
  // Every Targets-Up level reached is worth its kicker once.
  b.targets += stats.targetsUpBest * TARGETS_UP_LEVEL_XP;

  // Dailies: show-up value, a beat bonus, and the same tier kicker.
  for (const p of dailyPlays) {
    b.daily += DAILY_PLAY_XP;
    if (p.won) {
      b.daily += DAILY_BEAT_XP;
      const target = dailyTargetFor(p.difficulty, p.twist);
      const tier = tierForRun({ score: p.score, target, won: true });
      if (tier === 'SS' || tier === 'S') {
        b[`tier-${tier}`] += TIER_WIN_BONUS[tier];
      }
    }
  }

  return b;
};

/**
 * The XP a single recorded daily play contributed: its show-up + beat
 * value in the daily bucket, plus the tier kicker on a win — exactly the
 * per-play terms of xpBuckets' dailies loop. One-time buckets
 * (achievements, first clears, level milestones) can't be attributed to a
 * historical run and are omitted. Used to label archive re-views, where
 * the live before/after bucket diff no longer exists.
 */
export const dailyPlayXpBuckets = (
  play: DailyXpPlay
): Partial<Record<XpBucket, number>> => {
  const out: Partial<Record<XpBucket, number>> = {
    daily: DAILY_PLAY_XP + (play.won ? DAILY_BEAT_XP : 0),
  };
  if (play.won) {
    const target = dailyTargetFor(play.difficulty, play.twist);
    const tier = tierForRun({ score: play.score, target, won: true });
    if (tier === 'SS' || tier === 'S') {
      out[`tier-${tier}`] = TIER_WIN_BONUS[tier];
    }
  }
  return out;
};

/**
 * Total lifetime XP implied by the player's record. Pure — same inputs
 * always give the same number, and it counts each earning source exactly
 * once because each maps to a distinct persisted counter.
 */
export const xpForStats = (
  stats: Stats,
  dailyPlays: readonly DailyXpPlay[]
): number => {
  const b = xpBuckets(stats, dailyPlays);
  return XP_BUCKET_ORDER.reduce((sum, k) => sum + b[k], 0);
};

export interface LevelInfo {
  /** 1 … MAX_LEVEL. */
  level: number;
  xp: number;
  atMax: boolean;
  /** XP accumulated since entering the current level. */
  xpIntoLevel: number;
  /** XP span of the current level (null at max). */
  levelSpan: number | null;
  /** 0…1 progress through the current level (1 at max). */
  progress: number;
}

/** Resolve a raw XP total into level + within-level progress. */
export const levelFromXp = (xp: number): number => {
  let level = 1;
  for (let i = 0; i < LEVEL_XP.length; i++) {
    if (xp >= LEVEL_XP[i]) level = i + 1;
    else break;
  }
  return level;
};

export const levelInfoFor = (xp: number): LevelInfo => {
  const level = levelFromXp(xp);
  const atMax = level >= MAX_LEVEL;
  const floor = LEVEL_XP[level - 1];
  const ceil = atMax ? null : LEVEL_XP[level];
  const levelSpan = ceil === null ? null : ceil - floor;
  const xpIntoLevel = xp - floor;
  const progress =
    levelSpan === null ? 1 : Math.min(1, Math.max(0, xpIntoLevel / levelSpan));
  return { level, xp, atMax, xpIntoLevel, levelSpan, progress };
};
