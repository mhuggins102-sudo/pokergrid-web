// @vitest-environment jsdom
import { bestDailyStreak, dailyStreak } from '../streak';
import type { DailyPlay, DailyPlaysMap } from '../sync/playsStore';

// Only the key matters for streak math — the value just has to exist.
const play = {} as DailyPlay;
const playsOf = (...dates: string[]): DailyPlaysMap =>
  Object.fromEntries(dates.map(d => [d, play]));

const TODAY = '2026-07-10'; // a Friday

describe('dailyStreak', () => {
  test('empty history → no streak, hollow week', () => {
    const s = dailyStreak({}, TODAY);
    expect(s.current).toBe(0);
    expect(s.best).toBe(0);
    expect(s.playedToday).toBe(false);
    expect(s.atRisk).toBe(false);
    expect(s.week).toHaveLength(7);
    expect(s.week.every(d => !d.played)).toBe(true);
  });

  test('today unplayed keeps yesterday-anchored streak alive (at risk)', () => {
    const s = dailyStreak(
      playsOf('2026-07-04', '2026-07-05', '2026-07-06', '2026-07-07', '2026-07-08', '2026-07-09'),
      TODAY
    );
    expect(s.current).toBe(6);
    expect(s.playedToday).toBe(false);
    expect(s.atRisk).toBe(true);
  });

  test('playing today extends the run and clears the risk', () => {
    const s = dailyStreak(playsOf('2026-07-09', '2026-07-10'), TODAY);
    expect(s.current).toBe(2);
    expect(s.playedToday).toBe(true);
    expect(s.atRisk).toBe(false);
  });

  test('a missed calendar day breaks the streak', () => {
    // Played the 7th and 9th — the 8th gap limits the run to 1.
    const s = dailyStreak(playsOf('2026-07-07', '2026-07-09'), TODAY);
    expect(s.current).toBe(1);
    // Two days ago with yesterday missed → nothing current.
    const s2 = dailyStreak(playsOf('2026-07-08'), TODAY);
    expect(s2.current).toBe(0);
    expect(s2.atRisk).toBe(false);
  });

  test('best finds the longest historical run even when broken', () => {
    const s = dailyStreak(
      playsOf('2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04', '2026-07-09'),
      TODAY
    );
    expect(s.current).toBe(1);
    expect(s.best).toBe(4);
  });

  test('month boundaries count as consecutive days', () => {
    const s = dailyStreak(playsOf('2026-06-30', '2026-07-01'), '2026-07-01');
    expect(s.current).toBe(2);
  });

  test('week covers the 7 days ending today with mockup labels', () => {
    const s = dailyStreak(playsOf('2026-07-09'), TODAY);
    expect(s.week.map(d => d.dateISO)).toEqual([
      '2026-07-04', '2026-07-05', '2026-07-06', '2026-07-07',
      '2026-07-08', '2026-07-09', '2026-07-10',
    ]);
    // Jul 4 2026 is a Saturday; today (Jul 10) a Friday.
    expect(s.week.map(d => d.label)).toEqual(['Sa', 'Su', 'M', 'Tu', 'W', 'Th', 'F']);
    expect(s.week[5].played).toBe(true);
    expect(s.week[6].isToday).toBe(true);
    expect(s.week[6].played).toBe(false);
  });
});

describe('bestDailyStreak (persisted high-water mark)', () => {
  beforeEach(() => localStorage.clear());

  test('persists and never regresses', () => {
    expect(bestDailyStreak(3)).toBe(3);
    expect(bestDailyStreak(1)).toBe(3); // plays map shrank — best survives
    expect(bestDailyStreak(5)).toBe(5);
  });

  test('garbage in storage reads as zero', () => {
    localStorage.setItem('pokergrid:daily:best-streak:v1', 'lol');
    expect(bestDailyStreak(0)).toBe(0);
  });
});
