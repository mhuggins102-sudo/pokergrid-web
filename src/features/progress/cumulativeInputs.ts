import {
  AchievementId,
  CumulativeInputs,
  earnedCumulativeAchievements,
} from '../../game/achievements';
import { difficultyForLevel } from '../../game/challenges';
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
 * the stats store — the win milestones count every mode. Shared by the
 * silent app-wide catch-up effect (useSyncDailyAchievements), the
 * end-of-game paths (useRecordResult), and the Achievements page's
 * progress popovers, so all of them always agree on what counts.
 *
 * Mode coverage is bounded by what the save actually stores:
 *   - Free Play / Daily: every win, per difficulty (full fidelity).
 *   - Challenges: one win per challenge beaten (repeat wins aren't
 *     stored). All challenges run the Hard ruleset, so they count as
 *     Hard wins — and an SS trophy as a Hard SS win.
 *   - Targets Up: only the best run's high-water mark persists —
 *     reaching level N means levels 1..N were each won, mapped onto
 *     the difficulty each level runs at.
 */
export const cumulativeInputsFrom = (
  plays: DailyPlaysMap,
  stats: Stats
): CumulativeInputs => {
  const daily = dailyWinSummary(plays);
  const dailyDiff = dailyByDifficulty(plays);
  const challengeWins = stats.challengesDone.length;
  const challengeSS = Object.values(stats.challengeTiers).filter(
    t => t === 'SS'
  ).length;
  const targetsUpWins = perDifficulty(() => 0);
  for (let level = 1; level <= stats.targetsUpBest; level++) {
    targetsUpWins[difficultyForLevel(level)] += 1;
  }
  return {
    dailyWins: daily.wins,
    dailyBestStreak: daily.bestStreak,
    totalWins: stats.wins + daily.wins + challengeWins + stats.targetsUpBest,
    winsByDifficulty: perDifficulty(
      d =>
        stats.byDifficulty[d].wins +
        dailyDiff[d].wins +
        (d === 'hard' ? challengeWins : 0) +
        targetsUpWins[d]
    ),
    ssByDifficulty: perDifficulty(
      d =>
        stats.tierCounts[d].SS +
        dailyDiff[d].ssWins +
        (d === 'hard' ? challengeSS : 0)
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
