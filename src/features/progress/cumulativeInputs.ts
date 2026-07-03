import {
  AchievementId,
  CumulativeInputs,
  earnedCumulativeAchievements,
} from '../../game/achievements';
import type { Difficulty } from '../../game/rules';
import type { Stats } from '../../lib/stats';
import { dailyByDifficulty, dailyWinSummary } from '../daily/dailyStats';
import type { DailyPlay, DailyPlaysMap } from '../daily/sync/playsStore';

const perDifficulty = (
  fn: (d: Difficulty) => number
): Record<Difficulty, number> => ({
  easy: fn('easy'),
  medium: fn('medium'),
  hard: fn('hard'),
  extreme: fn('extreme'),
});

/**
 * Build the cumulative-achievement inputs from the daily plays map plus
 * the free-play stats. Shared by the silent app-wide catch-up effect
 * (useSyncDailyAchievements) and the end-of-game toast path
 * (useRecordResult's daily branch) so both always agree on what counts.
 */
export const cumulativeInputsFrom = (
  plays: DailyPlaysMap,
  stats: Stats
): CumulativeInputs => {
  const daily = dailyWinSummary(plays);
  const dailyDiff = dailyByDifficulty(plays);
  return {
    dailyWins: daily.wins,
    dailyBestStreak: daily.bestStreak,
    totalWins: stats.wins + daily.wins,
    // Free-play + daily, per difficulty, so dailies count toward the
    // Globetrotter / Perfectionist milestones.
    winsByDifficulty: perDifficulty(
      d => stats.byDifficulty[d].wins + dailyDiff[d].wins
    ),
    ssByDifficulty: perDifficulty(
      d => stats.tierCounts[d].SS + dailyDiff[d].ssWins
    ),
  };
};

/**
 * Cumulative achievements newly earned by finishing one daily run —
 * `plays` is the map BEFORE this finish is saved and `stats` the pre-run
 * snapshot whose achievementsDone gates the diff. The overlay keeps an
 * existing entry for the date (a replayed date can't re-derive), and the
 * streak math is calendar-based, so a run completed retroactively by
 * filling in an archive day counts the same as playing in order.
 */
export const newlyEarnedFromDailyFinish = (
  plays: DailyPlaysMap,
  todayPlay: DailyPlay,
  stats: Stats
): AchievementId[] => {
  const overlay: DailyPlaysMap = plays[todayPlay.dateISO]
    ? plays
    : { ...plays, [todayPlay.dateISO]: todayPlay };
  return earnedCumulativeAchievements(cumulativeInputsFrom(overlay, stats)).filter(
    id => !stats.achievementsDone.includes(id)
  );
};
