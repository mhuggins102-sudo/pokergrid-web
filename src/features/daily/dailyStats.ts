import type { Difficulty } from '../../game/rules';
import { dayMs, toISO, toUTC } from './dailyDates';
import type { DailyPlaysMap } from './sync/playsStore';

// Per-difficulty roll-up of completed daily puzzles — the same shape
// the free-play stats use, derived live from the local plays map.
export interface DailyDifficultyAgg {
  best: number | null;
  totalScore: number;
  totalRuns: number;
  wins: number;
}

const emptyAgg = (): DailyDifficultyAgg => ({
  best: null,
  totalScore: 0,
  totalRuns: 0,
  wins: 0,
});

export const dailyByDifficulty = (
  plays: DailyPlaysMap
): Record<Difficulty, DailyDifficultyAgg> => {
  const out: Record<Difficulty, DailyDifficultyAgg> = {
    easy: emptyAgg(),
    medium: emptyAgg(),
    hard: emptyAgg(),
    extreme: emptyAgg(),
  };
  for (const p of Object.values(plays)) {
    const a = out[p.recipe.difficulty];
    if (!a) continue;
    a.totalScore += p.score;
    a.totalRuns += 1;
    if (p.won) a.wins += 1;
    if (a.best === null || p.score > a.best) a.best = p.score;
  }
  return out;
};

export interface DailyWinSummary {
  // Total dailies won.
  wins: number;
  // Total dailies played (won or not).
  total: number;
  // Longest run of consecutive CALENDAR dates that were each won.
  bestStreak: number;
}

/**
 * Daily-win tallies for the Daily-Puzzle achievements. The streak is by
 * calendar date: a missed or lost day breaks the run, so only adjacent
 * won dates extend it.
 */
export const dailyWinSummary = (plays: DailyPlaysMap): DailyWinSummary => {
  const all = Object.values(plays);
  const wonDates = all
    .filter(p => p.won)
    .map(p => p.dateISO)
    .sort();
  const wonSet = new Set(wonDates);
  let bestStreak = 0;
  for (const iso of wonDates) {
    // Only count forward from the START of a run (no won day before it).
    if (wonSet.has(toISO(toUTC(iso) - dayMs))) continue;
    let len = 0;
    for (let cur = iso; wonSet.has(cur); cur = toISO(toUTC(cur) + dayMs)) {
      len += 1;
    }
    if (len > bestStreak) bestStreak = len;
  }
  return { wins: wonDates.length, total: all.length, bestStreak };
};
