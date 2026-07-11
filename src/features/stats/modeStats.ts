import type { ChallengeId } from '../../game/challenges';
import type { Difficulty } from '../../game/rules';
import { Tier, TIER_ORDER, tierForRun } from '../../lib/stats';
import type { Stats } from '../../lib/stats';
import { dailyByDifficulty } from '../daily/dailyStats';
import type { DailyPlaysMap } from '../daily/sync/playsStore';

// The Stats page filters by ONE axis at a time: a play mode (Daily /
// Free Play) or a difficulty. Both tables are built from the same 2-D
// (mode × difficulty) roll-up so the unselected axis re-scopes to the
// selected one.
export type StatsMode = 'daily' | 'free';
export const STATS_MODES: StatsMode[] = ['daily', 'free'];
export const MODE_LABEL: Record<StatsMode, string> = {
  daily: 'Daily',
  free: 'Free Play',
};
export const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard', 'extreme'];

export interface Cell {
  best: number | null;
  totalScore: number;
  totalRuns: number;
  wins: number;
}

export interface RunLite {
  mode: StatsMode;
  difficulty: Difficulty;
  score: number;
  target: number;
  won: boolean;
  ts: number;
  // Daily runs only: the twist (challenge modifier) the recipe rolled,
  // if any. Display-only — the desktop Recent-runs table shows it as a
  // ✦ pill.
  twist?: ChallengeId;
}

// A dot on the score-over-plays chart. Slimmer than RunLite (the
// score-history buffer doesn't keep targets).
export interface HistoryPoint {
  mode: StatsMode;
  difficulty: Difficulty;
  score: number;
  won: boolean;
  ts: number;
}

export interface ModeStatsData {
  // [mode][difficulty] roll-up.
  cells: Record<StatsMode, Record<Difficulty, Cell>>;
  // [mode][difficulty] tier histogram.
  tiers: Record<StatsMode, Record<Difficulty, Record<Tier, number>>>;
  // Combined recent runs, newest first.
  runs: RunLite[];
  // Every stored play, OLDEST first — free runs from the score-history
  // buffer, dailies from the plays map (its full archive).
  history: HistoryPoint[];
}

export const emptyCell = (): Cell => ({
  best: null,
  totalScore: 0,
  totalRuns: 0,
  wins: 0,
});

export const addCell = (a: Cell, b: Cell): Cell => ({
  best:
    a.best === null ? b.best : b.best === null ? a.best : Math.max(a.best, b.best),
  totalScore: a.totalScore + b.totalScore,
  totalRuns: a.totalRuns + b.totalRuns,
  wins: a.wins + b.wins,
});

export const emptyTiers = (): Record<Tier, number> => ({
  SS: 0,
  S: 0,
  A: 0,
  B: 0,
  C: 0,
  D: 0,
});

export const addTiers = (
  a: Record<Tier, number>,
  b: Record<Tier, number>
): Record<Tier, number> => {
  const out = emptyTiers();
  for (const t of TIER_ORDER) out[t] = a[t] + b[t];
  return out;
};

export const avgOf = (cell: Cell): number | null =>
  cell.totalRuns > 0 ? Math.round(cell.totalScore / cell.totalRuns) : null;

const byDiff = <T>(make: () => T): Record<Difficulty, T> => ({
  easy: make(),
  medium: make(),
  hard: make(),
  extreme: make(),
});

/**
 * Fold the free-play stats store and the local daily plays into one
 * mode × difficulty model. Free-play cells/tiers come from the store's
 * all-time roll-up; daily cells/tiers are derived from the plays map.
 */
export const buildModeStats = (
  stats: Stats,
  plays: DailyPlaysMap
): ModeStatsData => {
  const daily = dailyByDifficulty(plays);

  const cells: ModeStatsData['cells'] = {
    free: byDiff(emptyCell),
    daily: byDiff(emptyCell),
  };
  const tiers: ModeStatsData['tiers'] = {
    free: byDiff(emptyTiers),
    daily: byDiff(emptyTiers),
  };

  for (const d of DIFFICULTIES) {
    const f = stats.byDifficulty[d];
    cells.free[d] = {
      best: f.best,
      totalScore: f.totalScore,
      totalRuns: f.totalRuns,
      wins: f.wins,
    };
    cells.daily[d] = { ...daily[d] };
    tiers.free[d] = { ...emptyTiers(), ...stats.tierCounts[d] };
  }

  const runs: RunLite[] = [];
  const history: HistoryPoint[] = stats.scoreHistory.map(p => ({
    mode: 'free' as const,
    difficulty: p.difficulty,
    score: p.score,
    won: p.won,
    ts: p.ts,
  }));

  for (const r of stats.recent) {
    runs.push({
      mode: 'free',
      difficulty: r.difficulty,
      score: r.score,
      target: r.target,
      won: r.won,
      ts: r.ts,
    });
  }

  for (const p of Object.values(plays)) {
    const d = p.recipe.difficulty;
    const target = p.state.target;
    const run = { score: p.score, target, won: p.won };
    tiers.daily[d][tierForRun(run)] += 1;
    runs.push({
      mode: 'daily',
      difficulty: d,
      score: p.score,
      target,
      won: p.won,
      ts: p.completedAt,
      twist: p.recipe.twist,
    });
    history.push({
      mode: 'daily',
      difficulty: d,
      score: p.score,
      won: p.won,
      ts: p.completedAt,
    });
  }

  runs.sort((a, b) => b.ts - a.ts);
  history.sort((a, b) => a.ts - b.ts);

  return { cells, tiers, runs, history };
};
