import { describe, expect, it } from 'vitest';
import { earnedCumulativeAchievements } from '../achievements';

describe('earnedCumulativeAchievements', () => {
  it('awards the first daily win', () => {
    expect(
      earnedCumulativeAchievements({
        dailyWins: 1,
        dailyBestStreak: 1,
        totalWins: 1,
      })
    ).toEqual(['daily-first']);
  });

  it('awards the 20-daily and streak tiers as thresholds are crossed', () => {
    const ids = earnedCumulativeAchievements({
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
      earnedCumulativeAchievements({
        dailyWins: 5,
        dailyBestStreak: 3,
        totalWins: 25,
      })
    ).toContain('wins-25');
    expect(
      earnedCumulativeAchievements({
        dailyWins: 5,
        dailyBestStreak: 3,
        totalWins: 100,
      })
    ).toContain('wins-100');
  });

  it('awards nothing at zero', () => {
    expect(
      earnedCumulativeAchievements({
        dailyWins: 0,
        dailyBestStreak: 0,
        totalWins: 0,
      })
    ).toEqual([]);
  });
});
