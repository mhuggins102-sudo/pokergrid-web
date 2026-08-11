import { describe, expect, it } from 'vitest';
import type { Difficulty } from '../../../game/rules';
import { EMPTY_STATS, Stats } from '../../../lib/stats';
import type { DailyPlay, DailyPlaysMap } from '../../daily/sync/playsStore';
import { cumulativeInputsFrom } from '../cumulativeInputs';

const statsWith = (patch: Partial<Stats>): Stats => ({
  ...EMPTY_STATS,
  ...patch,
});

const play = (
  dateISO: string,
  won: boolean,
  difficulty: Difficulty = 'medium'
): DailyPlay =>
  ({
    dateISO,
    won,
    score: 500,
    completedAt: 0,
    recipe: { difficulty },
    state: { target: 450 },
  }) as unknown as DailyPlay;

const playsOf = (...items: DailyPlay[]): DailyPlaysMap =>
  Object.fromEntries(items.map(p => [p.dateISO, p]));

describe('cumulativeInputsFrom counts wins from every mode', () => {
  it('counts challenge wins (distinct beaten) as Hard wins', () => {
    const c = cumulativeInputsFrom(
      {},
      statsWith({
        challengesDone: ['short-deck', 'scatter'],
        challengeTiers: { 'short-deck': 'SS', scatter: 'A' },
      })
    );
    expect(c.totalWins).toBe(2);
    expect(c.winsByDifficulty.hard).toBe(2);
    expect(c.winsByDifficulty.easy).toBe(0);
    // An SS trophy is a Hard-ruleset SS win.
    expect(c.ssByDifficulty.hard).toBe(1);
    expect(c.ssByDifficulty.easy).toBe(0);
  });

  it('maps the best Targets Up run onto per-level difficulties', () => {
    // Best level won = 5 → levels 1-2 ran Easy, 3-4 Medium, 5 Hard.
    const c = cumulativeInputsFrom({}, statsWith({ targetsUpBest: 5 }));
    expect(c.totalWins).toBe(5);
    expect(c.winsByDifficulty).toEqual({
      easy: 2,
      medium: 2,
      hard: 1,
      extreme: 0,
    });
  });

  it('sums free play, daily, challenge, and Targets Up wins', () => {
    const plays = playsOf(
      play('2026-01-01', true),
      play('2026-01-02', true, 'hard'),
      play('2026-01-03', false)
    );
    const c = cumulativeInputsFrom(
      plays,
      statsWith({
        wins: 3,
        challengesDone: ['poker-purist'],
        targetsUpBest: 2,
      })
    );
    // 3 free + 2 daily + 1 challenge + 2 Targets Up levels.
    expect(c.totalWins).toBe(8);
    expect(c.dailyWins).toBe(2);
  });
});
