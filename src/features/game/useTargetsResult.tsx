import { ReactNode, useEffect, useRef, useState } from 'react';
import { baseId } from '../../game/bonusCards';
import { rngStep } from '../../game/deck';
import { Tier } from '../../lib/stats';
import { useTargetsStore } from '../targets/targetsStore';
import { useGameSession } from './GameSessionProvider';
import { RewardsResult, RewardsSheet } from './components/RewardsSheet';

export interface TargetsResultFlow {
  isTargets: boolean;
  /** S/SS win with the reward pick(s) not yet committed. */
  rewardsPending: boolean;
  /** Reward picks this tier grants: SS → 2, S → 1, otherwise 0. */
  rewardCount: number;
  /** Bring up the RewardsSheet (desktop's "Choose Reward(s)" button). */
  openRewards: () => void;
  /** The RewardsSheet element — render it; null while closed. */
  rewardsSheet: ReactNode;
}

// Guards the ladder save commit across COMPONENTS, mirroring
// useRecordResult's recordedStates: mobile's ResultView and the desktop
// result dialog both drive this flow, and a viewport resize across the
// 1024px fork right after a run ends mounts the other one. The final
// GameState object identifies the run, so advance/clear happens once.
const committedRuns = new WeakSet<object>();

/**
 * The Targets-Up end-of-run ladder lifecycle, extracted so ResultView
 * (mobile) and DesktopResultDialog share ONE owner: on a win it
 * advances the save (after the S/SS reward picks, when earned); on a
 * loss it clears the save so the next run restarts at level 1.
 *
 * `autoReveal` (mobile) opens the RewardsSheet on its own after a
 * beat; the desktop dialog opens it on demand via `openRewards`.
 */
export function useTargetsResult(
  won: boolean,
  tier: Tier,
  { autoReveal = false }: { autoReveal?: boolean } = {}
): TargetsResultFlow {
  const { state, mode, viewOnly } = useGameSession();
  const targets = useTargetsStore();
  const isTargets = mode.kind === 'targets';
  const wantsRewards =
    isTargets && !viewOnly && won && (tier === 'SS' || tier === 'S');
  const [rewardsPending, setRewardsPending] = useState(
    () => wantsRewards && !committedRuns.has(state)
  );
  const [rewardsOpen, setRewardsOpen] = useState(false);
  useEffect(() => {
    if (!autoReveal || !wantsRewards) return;
    // Let the final result land first, then bring up the perks picker —
    // it used to pop on the same frame as the verdict, hiding the
    // result.
    const t = window.setTimeout(() => setRewardsOpen(true), 1500);
    return () => window.clearTimeout(t);
  }, [autoReveal, wantsRewards]);
  const tuDoneRef = useRef(false);

  const finishTargets = (result: RewardsResult) => {
    if (mode.kind !== 'targets' || viewOnly) return;
    if (tuDoneRef.current || committedRuns.has(state)) return;
    tuDoneRef.current = true;
    committedRuns.add(state);
    const extras = result.poweredBonus
      ? [...mode.deckExtras, result.poweredBonus]
      : mode.deckExtras;
    const charged = result.superchargedCard
      ? [...mode.superchargedDeckCards, result.superchargedCard]
      : mode.superchargedDeckCards;
    const lastKept = result.poweredBonus
      ? baseId(result.poweredBonus)
      : (targets.save?.lastKeptBaseId ?? null);
    targets.saveProgress(
      mode.level + 1,
      (targets.save?.wins ?? mode.level - 1) + 1,
      extras,
      charged,
      lastKept
    );
    setRewardsPending(false);
    setRewardsOpen(false);
  };
  const finishRef = useRef(finishTargets);
  finishRef.current = finishTargets;

  useEffect(() => {
    if (!isTargets || viewOnly) return;
    if (tuDoneRef.current || committedRuns.has(state)) return;
    // A-tier win: nothing to pick — advance immediately.
    if (won && !wantsRewards) finishRef.current({});
    // Loss: the run is over; wipe the save so the next run starts at
    // level 1.
    if (!won) {
      tuDoneRef.current = true;
      committedRuns.add(state);
      useTargetsStore.getState().clearProgress();
    }
  }, [isTargets, viewOnly, won, wantsRewards, state]);

  const rewardsSheet =
    rewardsPending && rewardsOpen && (tier === 'SS' || tier === 'S') ? (
      <RewardsSheet
        tier={tier}
        grid={state.grid}
        bonusCards={state.bonusCards}
        blockedBaseId={targets.save?.lastKeptBaseId ?? null}
        // Derived from the finished run's RNG word (not Math.random) so
        // a seeded run's reward roll is reproducible too.
        superchargeRoll={rngStep(state.rngState >>> 0).value}
        onDone={finishTargets}
      />
    ) : null;

  return {
    isTargets,
    rewardsPending,
    rewardCount: wantsRewards ? (tier === 'SS' ? 2 : 1) : 0,
    openRewards: () => setRewardsOpen(true),
    rewardsSheet,
  };
}
