import { useEffect } from 'react';
import { earnedCumulativeAchievements } from '../../game/achievements';
import { dailyWinSummary } from '../daily/dailyStats';
import { usePlaysStore } from '../daily/sync/playsStore';
import { useStatsStore } from './statsStore';

/**
 * Keep the cumulative achievements (Daily-Puzzle tier + the combined-win
 * milestones) in sync with the local daily plays and free-play wins.
 *
 * Daily games don't run the per-run achievement engine, so this watches
 * the plays map and the free-play win count and records any newly
 * satisfied cumulative achievement. Mounted once app-wide so a daily win
 * is reflected immediately, and so achievements earned by dailies played
 * before this shipped are caught on the next load. recordAchievement is
 * idempotent, so the effect converges.
 */
export function useSyncDailyAchievements(): void {
  const plays = usePlaysStore(s => s.plays);
  const freeWins = useStatsStore(s => s.stats.wins);
  const done = useStatsStore(s => s.stats.achievementsDone);

  useEffect(() => {
    const daily = dailyWinSummary(plays);
    const earned = earnedCumulativeAchievements({
      dailyWins: daily.wins,
      dailyBestStreak: daily.bestStreak,
      totalWins: freeWins + daily.wins,
    });
    const missing = earned.filter(id => !done.includes(id));
    if (missing.length === 0) return;
    const record = useStatsStore.getState().recordAchievement;
    for (const id of missing) record(id);
  }, [plays, freeWins, done]);
}
