import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AchievementId } from '../../game/achievements';
import type { ChallengeId } from '../../game/challenges';
import {
  EMPTY_STATS,
  RunRecord,
  Stats,
  hydrateStats,
  recordRun,
} from '../../lib/stats';

interface StatsStore {
  stats: Stats;
  record: (run: RunRecord) => void;
  recordTargetsUp: (level: number) => void;
  recordChallenge: (id: ChallengeId) => void;
  recordAchievement: (id: AchievementId) => void;
  reset: () => void;
}

/**
 * All-time play stats. Persisted under the same key/shape the original
 * app used, with the same legacy migrations applied on load.
 */
export const useStatsStore = create<StatsStore>()(
  persist(
    set => ({
      stats: EMPTY_STATS,
      record: run => set(s => ({ stats: recordRun(s.stats, run) })),
      recordTargetsUp: level =>
        set(s =>
          level <= s.stats.targetsUpBest
            ? s
            : { stats: { ...s.stats, targetsUpBest: level } }
        ),
      recordChallenge: id =>
        set(s =>
          s.stats.challengesDone.includes(id)
            ? s
            : {
                stats: {
                  ...s.stats,
                  challengesDone: [...s.stats.challengesDone, id],
                },
              }
        ),
      recordAchievement: id =>
        set(s =>
          s.stats.achievementsDone.includes(id)
            ? s
            : {
                stats: {
                  ...s.stats,
                  achievementsDone: [...s.stats.achievementsDone, id],
                },
              }
        ),
      reset: () => set({ stats: EMPTY_STATS }),
    }),
    {
      name: 'pokergrid:stats:v1',
      merge: (persisted, current) => ({
        ...current,
        stats: hydrateStats(
          (persisted as { stats?: Partial<Stats> } | undefined)?.stats
        ),
      }),
    }
  )
);
