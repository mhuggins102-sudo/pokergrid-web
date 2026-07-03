import { useEffect } from 'react';
import { earnedCumulativeAchievements } from '../../game/achievements';
import { usePlaysStore } from '../daily/sync/playsStore';
import { cumulativeInputsFrom } from './cumulativeInputs';
import { useStatsStore } from './statsStore';

/**
 * Keep the cumulative achievements (Daily-Puzzle tier + the combined-win
 * milestones) in sync with the local daily plays and free-play wins.
 *
 * This is the silent catch-up path: it records achievements earned by
 * dailies played before the feature shipped (or merged in from another
 * device) without a toast. The end-of-game 🏆 notification for a daily
 * finish comes from useRecordResult's daily branch, which runs the same
 * cumulative check via cumulativeInputsFrom. recordAchievement is
 * idempotent, so the two writers converge.
 */
export function useSyncDailyAchievements(): void {
  const plays = usePlaysStore(s => s.plays);
  const stats = useStatsStore(s => s.stats);

  useEffect(() => {
    const earned = earnedCumulativeAchievements(
      cumulativeInputsFrom(plays, stats)
    );
    const missing = earned.filter(id => !stats.achievementsDone.includes(id));
    if (missing.length === 0) return;
    const record = useStatsStore.getState().recordAchievement;
    for (const id of missing) record(id);
  }, [plays, stats]);
}
