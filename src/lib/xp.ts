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

// Skill kicker layered on ANY win (Free Play or Daily). Wins are always
// A / S / SS (tierForRun); losses (B / C / D) earn no tier bonus.
export const TIER_WIN_BONUS: Record<Tier, number> = {
  SS: 50,
  S: 20,
  A: 5,
  B: 0,
  C: 0,
  D: 0,
};

export const FIRST_WIN_PER_DIFFICULTY_XP = 50; // one-time, ×4
export const CHALLENGE_FIRST_CLEAR_XP = 100; // one-time, per challenge
export const ACHIEVEMENT_XP = 75; // one-time, per achievement
export const TARGETS_UP_LEVEL_XP = 25; // per new highest level reached
export const DAILY_PLAY_XP = 15; // playing a daily (win or lose)
export const DAILY_BEAT_XP = 25; // additionally, beating its target

// ---- Level curve ------------------------------------------------------

// Cumulative XP required to REACH each level. Index i → level i+1
// (LEVEL_XP[0] = 0 = level 1 = the start). Easy early, steep top.
export const LEVEL_XP = [
  0, 60, 150, 280, 450, 680, 970, 1320, 1750, 2250, 2850, 3550, 4350, 5300,
  6400, 7700, 9200, 10900, 12900, 15000,
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

/**
 * Total lifetime XP implied by the player's record. Pure — same inputs
 * always give the same number, and it counts each earning source exactly
 * once because each maps to a distinct persisted counter.
 */
export const xpForStats = (
  stats: Stats,
  dailyPlays: readonly DailyXpPlay[]
): number => {
  let xp = 0;

  // Free Play: base win value + first-win-per-difficulty milestone + the
  // per-win tier kicker. tierCounts is free-play-only and, since every win
  // is A/S/SS, its A/S/SS buckets ARE the win-by-tier counts.
  for (const d of DIFFICULTIES) {
    const wins = stats.byDifficulty[d].wins;
    xp += wins * BASE_WIN_XP[d];
    if (wins > 0) xp += FIRST_WIN_PER_DIFFICULTY_XP;
    const tc = stats.tierCounts[d];
    xp +=
      tc.SS * TIER_WIN_BONUS.SS + tc.S * TIER_WIN_BONUS.S + tc.A * TIER_WIN_BONUS.A;
  }

  // One-time collections.
  xp += stats.challengesDone.length * CHALLENGE_FIRST_CLEAR_XP;
  xp += stats.achievementsDone.length * ACHIEVEMENT_XP;
  // Every Targets-Up level reached is worth its kicker once.
  xp += stats.targetsUpBest * TARGETS_UP_LEVEL_XP;

  // Dailies: show-up value, a beat bonus, and the same tier kicker.
  for (const p of dailyPlays) {
    xp += DAILY_PLAY_XP;
    if (p.won) {
      xp += DAILY_BEAT_XP;
      const target = dailyTargetFor(p.difficulty, p.twist);
      xp += TIER_WIN_BONUS[tierForRun({ score: p.score, target, won: true })];
    }
  }

  return xp;
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
