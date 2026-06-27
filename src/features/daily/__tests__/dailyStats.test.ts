import { describe, expect, it } from 'vitest';
import { dailyByDifficulty, dailyWinSummary } from '../dailyStats';
import type { DailyPlay, DailyPlaysMap } from '../sync/playsStore';
import type { Difficulty } from '../../../game/rules';

const play = (
  dateISO: string,
  won: boolean,
  score = 100,
  difficulty: Difficulty = 'medium'
): DailyPlay =>
  ({
    dateISO,
    won,
    score,
    completedAt: 0,
    recipe: { difficulty },
    state: { target: 80 },
  }) as unknown as DailyPlay;

const map = (...plays: DailyPlay[]): DailyPlaysMap =>
  Object.fromEntries(plays.map(p => [p.dateISO, p]));

describe('dailyWinSummary', () => {
  it('counts wins and the longest consecutive-date streak', () => {
    const s = dailyWinSummary(
      map(
        play('2026-05-01', true),
        play('2026-05-02', true),
        play('2026-05-03', true)
      )
    );
    expect(s).toEqual({ wins: 3, total: 3, bestStreak: 3 });
  });

  it('breaks the streak on a lost day', () => {
    const s = dailyWinSummary(
      map(
        play('2026-05-01', true),
        play('2026-05-02', true),
        play('2026-05-03', false),
        play('2026-05-04', true)
      )
    );
    expect(s.wins).toBe(3);
    expect(s.total).toBe(4);
    expect(s.bestStreak).toBe(2);
  });

  it('breaks the streak on a skipped (unplayed) day', () => {
    const s = dailyWinSummary(
      map(
        play('2026-05-01', true),
        play('2026-05-02', true),
        play('2026-05-05', true)
      )
    );
    expect(s.bestStreak).toBe(2);
  });

  it('handles an empty map', () => {
    expect(dailyWinSummary({})).toEqual({ wins: 0, total: 0, bestStreak: 0 });
  });
});

describe('dailyByDifficulty', () => {
  it('rolls up best / total / wins per difficulty', () => {
    const agg = dailyByDifficulty(
      map(
        play('2026-05-01', true, 120, 'hard'),
        play('2026-05-02', false, 90, 'hard'),
        play('2026-05-03', true, 200, 'easy')
      )
    );
    // 120/80 = 1.5 → S tier (not SS); 200/80 = 2.5 → SS.
    expect(agg.hard).toEqual({
      best: 120,
      totalScore: 210,
      totalRuns: 2,
      wins: 1,
      ssWins: 0,
    });
    expect(agg.easy).toEqual({
      best: 200,
      totalScore: 200,
      totalRuns: 1,
      wins: 1,
      ssWins: 1,
    });
    expect(agg.extreme).toEqual({
      best: null,
      totalScore: 0,
      totalRuns: 0,
      wins: 0,
      ssWins: 0,
    });
  });
});
