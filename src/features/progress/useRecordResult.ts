import { useEffect, useRef, useState } from 'react';
import {
  ACHIEVEMENTS,
  Achievement,
  AchievementCheckCtx,
  achievementEarned,
} from '../../game/achievements';
import { BONUS_DECK_POOL } from '../../game/bonusCards';
import { CHALLENGES, challengeWon } from '../../game/challenges';
import { Difficulty } from '../../game/rules';
import { ScoreReport } from '../../game/scoring';
import { RunRecord, Stats, Tier, recordRun, tierForRun } from '../../lib/stats';
import { usePlaysStore } from '../daily/sync/playsStore';
import { useGameSession } from '../game/GameSessionProvider';
import { newlyEarnedFromDailyFinish } from './cumulativeInputs';
import { useStatsStore } from './statsStore';

export interface RecordedResult {
  won: boolean;
  tier: Tier;
  /** Achievements newly earned by this run (already persisted). */
  newAchievements: Achievement[];
}

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard', 'extreme'];

/**
 * One-shot, mode-aware result recording — the web port of the original
 * ResultScreen's recording effect. Free play records a full RunRecord
 * (with Shapley attribution) and evaluates achievements; challenges
 * record completion on a win (and can fire the all-challenges
 * milestone); Targets-Up records only the best-level high-water mark
 * (its save lifecycle lives with the rewards flow).
 */
export function useRecordResult(
  report: ScoreReport,
  shapley: number[]
): RecordedResult {
  const { state, mode, setup } = useGameSession();
  const won = report.total >= state.target;
  const tier = tierForRun({ score: report.total, target: state.target, won });
  const [newAchievements, setNewAchievements] = useState<Achievement[]>([]);
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    // The tutorial's rigged deal must not touch stats or achievements.
    if (mode.kind === 'tutorial') return;

    const store = useStatsStore.getState();
    const before = store.stats;
    const achMode: AchievementCheckCtx['mode'] =
      mode.kind === 'free'
        ? 'free'
        : mode.kind === 'challenge'
          ? 'challenge'
          : 'targets-up';

    // Per-card attribution with any -pwrN suffix stripped.
    const attribution = state.bonusCards.map((c, i) => ({
      cardId: c.id.replace(/-pwr\d+$/, ''),
      shapley: shapley[i] ?? 0,
    }));

    let after: Stats = before;

    if (mode.kind === 'free') {
      const run: RunRecord = {
        ts: Date.now(),
        difficulty: state.difficulty,
        score: report.total,
        target: state.target,
        won,
        bonusCards: attribution,
      };
      after = recordRun(before, run);
      store.record(run);
    } else if (mode.kind === 'challenge') {
      if (setup.challenge && challengeWon(setup.challenge, state, report)) {
        store.recordChallenge(setup.challenge.id);
        after = {
          ...before,
          challengesDone: before.challengesDone.includes(setup.challenge.id)
            ? before.challengesDone
            : [...before.challengesDone, setup.challenge.id],
        };
      }
    } else if (mode.kind === 'targets' && won) {
      store.recordTargetsUp(mode.level);
    }

    // Daily finishes skip the per-run engine (its achievements are all
    // free/challenge-gated) but can cross a cumulative threshold — first
    // daily win, a streak, a combined-win milestone. Check against an
    // overlay that includes THIS run (the play is saved by ResultView's
    // later effect) so the newly crossed ones surface in the 🏆 callout;
    // useSyncDailyAchievements would otherwise record them silently.
    if (mode.kind === 'daily') {
      const ids = newlyEarnedFromDailyFinish(
        usePlaysStore.getState().plays,
        {
          dateISO: mode.dateISO,
          score: report.total,
          won,
          recipe: mode.recipe,
          completedAt: Date.now(),
          state,
        },
        before
      );
      for (const id of ids) store.recordAchievement(id);
      if (ids.length > 0) {
        setNewAchievements(
          ids.flatMap(id => ACHIEVEMENTS.filter(a => a.id === id))
        );
      }
      return;
    }

    if (achMode === 'targets-up') return;

    const milestone = {
      winsByDifficulty: Object.fromEntries(
        DIFFICULTIES.map(d => [d, after.byDifficulty[d].wins])
      ) as Record<Difficulty, number>,
      ssByDifficulty: Object.fromEntries(
        DIFFICULTIES.map(d => [d, after.tierCounts[d].SS])
      ) as Record<Difficulty, number>,
      totalWins: after.wins,
      challengesCompleted: after.challengesDone.length,
      totalChallenges: CHALLENGES.length,
      runBonusShapley: shapley,
      runWasFreePlay: mode.kind === 'free',
      uniqueBonusCardsScored: Object.values(after.bonusCardStats).filter(
        s => s.totalShapley > 0
      ).length,
      totalBonusCardsInPool: BONUS_DECK_POOL.length,
    };

    const ctx: AchievementCheckCtx = { state, report, milestone, mode: achMode };
    const earned = ACHIEVEMENTS.filter(
      a => !before.achievementsDone.includes(a.id) && achievementEarned(a, ctx)
    );
    for (const a of earned) store.recordAchievement(a.id);
    if (earned.length > 0) setNewAchievements(earned);
  }, [mode, setup, state, report, shapley, won]);

  return { won, tier, newAchievements };
}
