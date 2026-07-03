import { describe, expect, it } from 'vitest';
import type { Difficulty } from '../../../game/rules';
import { EMPTY_STATS, Stats } from '../../../lib/stats';
import type { DailyPlay, DailyPlaysMap } from '../../daily/sync/playsStore';
import { newlyEarnedFromDailyFinish } from '../cumulativeInputs';

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

const stats = (achievementsDone: Stats['achievementsDone'] = []): Stats => ({
  ...EMPTY_STATS,
  achievementsDone,
});

describe('newlyEarnedFromDailyFinish (end-of-game daily toast)', () => {
  it('detects a streak completed retroactively by an archive fill-in', () => {
    // The reported glitch: won days 1 and 2, lost day 5, then won day 3
    // — the 1-2-3 run completes out of order and must toast On a Roll.
    const before = map(
      play('2026-05-01', true),
      play('2026-05-02', true),
      play('2026-05-05', false)
    );
    const ids = newlyEarnedFromDailyFinish(
      before,
      play('2026-05-03', true),
      stats(['daily-first'])
    );
    expect(ids).toEqual(['daily-streak-3']);
  });

  it('awards Daily Debut on the first-ever daily win', () => {
    expect(newlyEarnedFromDailyFinish({}, play('2026-05-01', true), stats()))
      .toEqual(['daily-first']);
  });

  it('never re-fires achievements already recorded', () => {
    // Streak 3 already earned; extending it to 4 crosses nothing new.
    const before = map(
      play('2026-05-01', true),
      play('2026-05-02', true),
      play('2026-05-03', true)
    );
    const ids = newlyEarnedFromDailyFinish(
      before,
      play('2026-05-04', true),
      stats(['daily-first', 'daily-streak-3'])
    );
    expect(ids).toEqual([]);
  });

  it('returns nothing for a loss', () => {
    const before = map(play('2026-05-01', true), play('2026-05-02', true));
    const ids = newlyEarnedFromDailyFinish(
      before,
      play('2026-05-03', false),
      stats(['daily-first'])
    );
    expect(ids).toEqual([]);
  });

  it('keeps the stored play when the date was already recorded', () => {
    // A replayed date must not re-derive: the stored loss stays
    // authoritative, so the overlayed "win" changes nothing.
    const before = map(
      play('2026-05-01', true),
      play('2026-05-02', true),
      play('2026-05-03', false)
    );
    const ids = newlyEarnedFromDailyFinish(
      before,
      play('2026-05-03', true),
      stats(['daily-first'])
    );
    expect(ids).toEqual([]);
  });

  it('surfaces count milestones crossed by a daily win', () => {
    // 19 scattered wins on record (gaps keep the streak below 3); the
    // 20th crosses Daily Devotee. With 5 free-play wins banked it also
    // crosses the combined 25-win milestone.
    const days = Array.from({ length: 19 }, (_, i) =>
      play(`2026-04-${String(1 + i * 1).padStart(2, '0')}`, true)
    ).filter((_, i) => i % 3 !== 2); // drop every 3rd day → max streak 2
    const extra = Array.from({ length: 19 - days.length }, (_, i) =>
      play(`2026-03-${String(1 + i * 2).padStart(2, '0')}`, true)
    );
    const before = map(...days, ...extra);
    expect(Object.keys(before)).toHaveLength(19);
    const ids = newlyEarnedFromDailyFinish(
      before,
      play('2026-05-20', true),
      { ...stats(['daily-first', 'daily-streak-3']), wins: 5 }
    );
    expect(ids).toContain('daily-20');
    expect(ids).toContain('wins-25');
  });
});
