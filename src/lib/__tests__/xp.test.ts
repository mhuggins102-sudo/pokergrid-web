import { describe, expect, test } from 'vitest';
import { EMPTY_STATS, Stats } from '../stats';
import {
  ACHIEVEMENT_XP,
  BASE_WIN_XP,
  CHALLENGE_FIRST_CLEAR_XP,
  DAILY_BEAT_XP,
  DAILY_PLAY_XP,
  FIRST_WIN_PER_DIFFICULTY_XP,
  LEVEL_XP,
  MAX_LEVEL,
  TARGETS_UP_LEVEL_XP,
  TIER_WIN_BONUS,
  XP_BUCKET_ORDER,
  levelFromXp,
  levelInfoFor,
  xpBuckets,
  xpForStats,
} from '../xp';

const withDiff = (
  base: Stats,
  d: 'easy' | 'medium' | 'hard' | 'extreme',
  wins: number,
  tiers: Partial<Record<'SS' | 'S' | 'A', number>>
): Stats => ({
  ...base,
  byDifficulty: {
    ...base.byDifficulty,
    [d]: { ...base.byDifficulty[d], wins },
  },
  tierCounts: {
    ...base.tierCounts,
    [d]: { ...base.tierCounts[d], SS: 0, S: 0, A: 0, ...tiers },
  },
});

describe('xp — level curve', () => {
  test('levelFromXp maps thresholds to 1..MAX_LEVEL', () => {
    expect(levelFromXp(0)).toBe(1);
    expect(levelFromXp(59)).toBe(1);
    expect(levelFromXp(60)).toBe(2);
    expect(levelFromXp(LEVEL_XP[9])).toBe(10);
    expect(levelFromXp(LEVEL_XP[MAX_LEVEL - 1])).toBe(MAX_LEVEL);
    expect(levelFromXp(999999)).toBe(MAX_LEVEL);
  });

  test('levelInfoFor reports within-level progress and caps at max', () => {
    const mid = levelInfoFor(105); // level 3 (150) not reached; level 2 floor 60
    expect(mid.level).toBe(2);
    expect(mid.xpIntoLevel).toBe(45); // 105 - 60
    expect(mid.levelSpan).toBe(90); // 150 - 60
    expect(mid.progress).toBeCloseTo(0.5, 1);

    const max = levelInfoFor(999999);
    expect(max.level).toBe(MAX_LEVEL);
    expect(max.atMax).toBe(true);
    expect(max.levelSpan).toBeNull();
    expect(max.progress).toBe(1);
  });
});

describe('xp — earning', () => {
  test('empty record is 0 XP → level 1', () => {
    expect(xpForStats(EMPTY_STATS, [])).toBe(0);
    expect(levelFromXp(xpForStats(EMPTY_STATS, []))).toBe(1);
  });

  test('a single Medium A-tier free-play win', () => {
    // one Medium win, tier A
    const stats = withDiff(EMPTY_STATS, 'medium', 1, { A: 1 });
    const xp = xpForStats(stats, []);
    // base 20 + first-win 50 + tier A 5
    expect(xp).toBe(
      BASE_WIN_XP.medium + FIRST_WIN_PER_DIFFICULTY_XP + TIER_WIN_BONUS.A
    );
  });

  test('extreme SS win is worth the most per game', () => {
    const stats = withDiff(EMPTY_STATS, 'extreme', 1, { SS: 1 });
    const xp = xpForStats(stats, []);
    expect(xp).toBe(
      BASE_WIN_XP.extreme + FIRST_WIN_PER_DIFFICULTY_XP + TIER_WIN_BONUS.SS
    );
  });

  test('challenges, achievements, targets-up are one-time counters', () => {
    const stats: Stats = {
      ...EMPTY_STATS,
      challengesDone: ['no-discards', 'short-deck'] as Stats['challengesDone'],
      achievementsDone: ['easy-grand'] as Stats['achievementsDone'],
      targetsUpBest: 3,
    };
    expect(xpForStats(stats, [])).toBe(
      2 * CHALLENGE_FIRST_CLEAR_XP +
        1 * ACHIEVEMENT_XP +
        3 * TARGETS_UP_LEVEL_XP
    );
  });

  test('xpBuckets sums to xpForStats and a before/after diff attributes a run', () => {
    const before = EMPTY_STATS;
    const after = withDiff(EMPTY_STATS, 'medium', 1, { A: 1 });
    const sum = (b: Record<string, number>) =>
      XP_BUCKET_ORDER.reduce((s, k) => s + b[k], 0);

    // Sum invariant: buckets always reconstruct the scalar total.
    expect(sum(xpBuckets(after, []))).toBe(xpForStats(after, []));

    // Per-source delta = exactly what this one run earned.
    const bBefore = xpBuckets(before, []);
    const bAfter = xpBuckets(after, []);
    expect(bAfter.win - bBefore.win).toBe(BASE_WIN_XP.medium);
    expect(bAfter.firstWin - bBefore.firstWin).toBe(FIRST_WIN_PER_DIFFICULTY_XP);
    expect(bAfter.tier - bBefore.tier).toBe(TIER_WIN_BONUS.A);
  });

  test('daily plays: show-up + beat + tier bonus', () => {
    const plays = [
      { score: 500, won: true, difficulty: 'medium' as const }, // beat
      { score: 100, won: false, difficulty: 'easy' as const }, // just played
    ];
    const xp = xpForStats(EMPTY_STATS, plays);
    // play1: 15 + 25 + tier bonus (some tier); play2: 15
    expect(xp).toBeGreaterThanOrEqual(DAILY_PLAY_XP * 2 + DAILY_BEAT_XP);
  });
});
