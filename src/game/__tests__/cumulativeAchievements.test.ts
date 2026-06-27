import { describe, expect, it } from 'vitest';
import { earnedCumulativeAchievements } from '../achievements';
import type { Difficulty } from '../rules';

const allDiff = (n: number): Record<Difficulty, number> => ({
  easy: n,
  medium: n,
  hard: n,
  extreme: n,
});

const base = {
  dailyWins: 0,
  dailyBestStreak: 0,
  totalWins: 0,
  winsByDifficulty: allDiff(0),
  ssByDifficulty: allDiff(0),
};

describe('earnedCumulativeAchievements', () => {
  it('awards the first daily win', () => {
    expect(
      earnedCumulativeAchievements({
        ...base,
        dailyWins: 1,
        dailyBestStreak: 1,
        totalWins: 1,
      })
    ).toEqual(['daily-first']);
  });

  it('awards the 20-daily and streak tiers as thresholds are crossed', () => {
    const ids = earnedCumulativeAchievements({
      ...base,
      dailyWins: 20,
      dailyBestStreak: 10,
      totalWins: 20,
    });
    expect(ids).toContain('daily-first');
    expect(ids).toContain('daily-20');
    expect(ids).toContain('daily-streak-3');
    expect(ids).toContain('daily-streak-10');
    expect(ids).not.toContain('wins-25');
  });

  it('counts daily wins toward the combined win milestones', () => {
    expect(
      earnedCumulativeAchievements({ ...base, totalWins: 25 })
    ).toContain('wins-25');
    expect(
      earnedCumulativeAchievements({ ...base, totalWins: 100 })
    ).toContain('wins-100');
  });

  it('awards Globetrotter / Perfectionist when every difficulty qualifies', () => {
    const won = earnedCumulativeAchievements({
      ...base,
      winsByDifficulty: allDiff(1),
    });
    expect(won).toContain('win-every-difficulty');
    expect(won).not.toContain('perfect-every-difficulty');

    const perfect = earnedCumulativeAchievements({
      ...base,
      winsByDifficulty: allDiff(1),
      ssByDifficulty: allDiff(1),
    });
    expect(perfect).toContain('perfect-every-difficulty');
  });

  it('does not award the all-difficulty milestones with a gap', () => {
    const ids = earnedCumulativeAchievements({
      ...base,
      winsByDifficulty: { easy: 1, medium: 1, hard: 0, extreme: 2 },
    });
    expect(ids).not.toContain('win-every-difficulty');
  });

  it('awards nothing at zero', () => {
    expect(earnedCumulativeAchievements(base)).toEqual([]);
  });
});
