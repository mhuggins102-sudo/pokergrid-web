import { useEffect, useRef, useState } from 'react';
import {
  ACHIEVEMENTS,
  Achievement,
  AchievementCheckCtx,
  achievementEarned,
} from '../../game/achievements';
import { BONUS_DECK_POOL, baseId } from '../../game/bonusCards';
import { LIVE_CHALLENGES, challengeWon } from '../../game/challenges';
import { ScoreReport } from '../../game/scoring';
import {
  RunRecord,
  Stats,
  Tier,
  TrophyKind,
  isBetterTier,
  recordRun,
  tierForRun,
  trophyForTier,
} from '../../lib/stats';
import { usePlaysStore } from '../daily/sync/playsStore';
import { peekBotRun } from '../game/botRun';
import { useGameSession } from '../game/GameSessionProvider';
import {
  cumulativeInputsFrom,
  newlyEarnedFromDailyFinish,
} from './cumulativeInputs';
import { useStatsStore } from './statsStore';

export interface RecordedResult {
  won: boolean;
  tier: Tier;
  /** Achievements newly earned by this run (already persisted). */
  newAchievements: Achievement[];
  /** Set when THIS challenge run earned a first trophy or upgraded the
   *  stored one — the result popup's trophy callout. Null otherwise. */
  challengeTrophy: ChallengeTrophy | null;
}

export interface ChallengeTrophy {
  kind: TrophyKind;
  tier: Tier;
  /** True on the challenge's first-ever win; false on an upgrade. */
  first: boolean;
}

// Guards recording across COMPONENTS, not just re-renders: mobile's
// ResultView and desktop's result dialog both call this hook, and a
// viewport resize across the 1024px fork right after a game ends
// mounts the other one — the final GameState object is referentially
// stable by then, so it identifies the run.
const recordedStates = new WeakSet<object>();

/**
 * One-shot, mode-aware result recording — the web port of the original
 * ResultScreen's recording effect. Free play records a full RunRecord
 * (with Shapley attribution) and evaluates achievements; challenges
 * record completion on a win (and can fire the all-challenges
 * milestone plus Variant feats); dailies check the cumulative
 * thresholds and run the per-run engine (difficulty tiers when
 * twist-free, Variant feats when twisted); Targets-Up records only the
 * best-level high-water mark (its save lifecycle lives with the
 * rewards flow).
 */
export function useRecordResult(
  report: ScoreReport,
  shapley: number[]
): RecordedResult {
  const { state, mode, setup, seed, viewOnly } = useGameSession();
  const won = report.total >= state.target;
  // A twist's flat S/SS ladder (challenge or twisted daily — setup
  // carries the challenge entry for both) replaces the ratio bands.
  const tier = tierForRun({
    score: report.total,
    target: state.target,
    won,
    tierDeltas: setup.challenge?.tierDeltas,
  });
  const [newAchievements, setNewAchievements] = useState<Achievement[]>([]);
  const [challengeTrophy, setChallengeTrophy] =
    useState<ChallengeTrophy | null>(null);
  const ranRef = useRef(false);

  useEffect(() => {
    // A re-hydrated stored run (archive view) was recorded when it was
    // actually played — never again.
    if (viewOnly) return;
    if (ranRef.current || recordedStates.has(state)) return;
    ranRef.current = true;
    recordedStates.add(state);
    // Set once this component is gone: a late bot result must not set
    // state on an unmounted surface (the achievement still persists —
    // whichever result surface is mounted then won't re-announce it,
    // but the Achievements page has it).
    let cancelled = false;
    const cleanup = () => {
      cancelled = true;
    };
    // The tutorial's rigged deal must not touch stats or achievements.
    if (mode.kind === 'tutorial') return;

    const store = useStatsStore.getState();
    const before = store.stats;
    const achMode: AchievementCheckCtx['mode'] =
      mode.kind === 'free'
        ? 'free'
        : mode.kind === 'challenge'
          ? 'challenge'
          : mode.kind === 'daily'
            ? 'daily'
            : 'targets-up';
    // The twist shaping this run: the Challenge's own id, or a twisted
    // Daily's recipe twist. Gates the twist-free (easy/medium +
    // hard/extreme) tiers and matches the Variant tier's variantId.
    const activeVariant =
      mode.kind === 'challenge'
        ? mode.id
        : mode.kind === 'daily'
          ? (mode.recipe.twist ?? null)
          : null;

    // Per-card attribution with any -pwrN suffix stripped.
    const attribution = state.bonusCards.map((c, i) => ({
      cardId: baseId(c),
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
        const id = setup.challenge.id;
        const prevBest = before.challengeTiers[id] ?? null;
        const upgraded = !prevBest || isBetterTier(tier, prevBest);
        store.recordChallenge(id, tier);
        after = {
          ...before,
          challengesDone: before.challengesDone.includes(id)
            ? before.challengesDone
            : [...before.challengesDone, id],
          challengeTiers: upgraded
            ? { ...before.challengeTiers, [id]: tier }
            : before.challengeTiers,
        };
        // Trophy callout: only on a first win or a strict upgrade — a
        // repeat win at the same (or lower) tier stays quiet.
        const kind = trophyForTier(tier);
        if (upgraded && kind) {
          setChallengeTrophy({ kind, tier, first: !prevBest });
        }
      }
    } else if (mode.kind === 'targets' && won) {
      store.recordTargetsUp(mode.level);
    }

    if (achMode === 'targets-up') return;

    // Daily finishes can cross a cumulative threshold — first daily win,
    // a streak, a combined-win milestone. Check against an overlay that
    // includes THIS run (the play is saved by ResultView's later effect)
    // so the newly crossed ones surface in the 🏆 callout;
    // useSyncDailyAchievements would otherwise record them silently.
    // The per-run engine below then runs on top: a twist-free daily can
    // earn the difficulty tiers, a twisted one its Variant feats.
    const cumulativeIds =
      mode.kind === 'daily'
        ? newlyEarnedFromDailyFinish(
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
          )
        : [];
    for (const id of cumulativeIds) store.recordAchievement(id);

    // Win tallies span every mode (free play, daily, challenges,
    // Targets Up) via the same helper the cumulative path and the
    // progress popovers use. For a daily run the plays map doesn't hold
    // THIS run yet, but that's fine — milestones aren't evaluated on
    // the daily per-run path (the overlay-aware cumulative check above
    // owns them).
    const combined = cumulativeInputsFrom(
      usePlaysStore.getState().plays,
      after
    );
    const milestone = {
      winsByDifficulty: combined.winsByDifficulty,
      ssByDifficulty: combined.ssByDifficulty,
      totalWins: combined.totalWins,
      // Count only LIVE catalog entries — a wins list carrying a
      // since-hidden challenge mustn't fire Challenge Sweep early.
      challengesCompleted: after.challengesDone.filter(id =>
        LIVE_CHALLENGES.some(c => c.id === id)
      ).length,
      totalChallenges: LIVE_CHALLENGES.length,
      challengeSilverPlus: LIVE_CHALLENGES.filter(c => {
        const t = after.challengeTiers[c.id];
        return t === 'SS' || t === 'S';
      }).length,
      challengeGold: LIVE_CHALLENGES.filter(
        c => after.challengeTiers[c.id] === 'SS'
      ).length,
      runBonusShapley: shapley,
      runWasFreePlay: mode.kind === 'free',
      uniqueBonusCardsScored: Object.values(after.bonusCardStats).filter(
        s => s.totalShapley > 0
      ).length,
      totalBonusCardsInPool: BONUS_DECK_POOL.length,
    };

    const ctx: AchievementCheckCtx = {
      state,
      report,
      milestone,
      mode: achMode,
      activeVariant,
    };
    const earned = ACHIEVEMENTS.filter(
      a =>
        !before.achievementsDone.includes(a.id) &&
        !cumulativeIds.includes(a.id) &&
        achievementEarned(a, ctx)
    );
    for (const a of earned) store.recordAchievement(a.id);
    const announced = [
      ...cumulativeIds.flatMap(id => ACHIEVEMENTS.filter(a => a.id === id)),
      ...earned,
    ];
    if (announced.length > 0) setNewAchievements(announced);

    // Free play: the bot has been replaying this deal since the run
    // started (GameSessionProvider). Its score usually waits already;
    // either way, judge the bot-comparison achievements (Bot Buster)
    // once it lands and add them to the same callout. Without a
    // started run (no Worker) there is nothing to judge here — the Bot
    // Score sheet judges on demand in that case.
    const botRun =
      mode.kind === 'free' && seed !== undefined
        ? peekBotRun(state.difficulty, seed)
        : undefined;
    if (!botRun) return;
    void botRun.then(
      bot => {
        if (cancelled) return;
        const done = useStatsStore.getState().stats.achievementsDone;
        const fromBot = ACHIEVEMENTS.filter(
          a =>
            !done.includes(a.id) &&
            !announced.some(x => x.id === a.id) &&
            achievementEarned(a, { ...ctx, botScore: bot.score })
        );
        if (fromBot.length === 0) return;
        for (const a of fromBot) useStatsStore.getState().recordAchievement(a.id);
        setNewAchievements(prev => [...prev, ...fromBot]);
      },
      () => {
        /* the bot couldn't finish — nothing to judge */
      }
    );
    return cleanup;
  }, [mode, setup, state, report, shapley, won, viewOnly, seed]);

  return { won, tier, newAchievements, challengeTrophy };
}
