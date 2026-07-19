import { useEffect, useMemo, useState } from 'react';
import {
  DailyXpPlay,
  LevelInfo,
  XP_BUCKET_LABEL,
  XP_BUCKET_ORDER,
  XpBucket,
  dailyPlayXpBuckets,
  levelInfoFor,
  xpBuckets,
  xpForStats,
} from '../../lib/xp';
import { skinUnlocked } from '../../design/skinCatalog';
import { usePlaysStore } from '../daily/sync/playsStore';
import { useSettingsStore } from '../settings/settingsStore';
import { useGameSession } from '../game/GameSessionProvider';
import { DailyPlaysMap } from '../daily/sync/playsStore';
import { useProgressionStore } from './progressionStore';
import { useStatsStore } from './statsStore';

// Map the persisted plays store into the minimal shape the XP math wants.
const toDailyXpPlays = (plays: DailyPlaysMap): DailyXpPlay[] =>
  Object.values(plays).map(p => ({
    score: p.score,
    won: p.won,
    difficulty: p.recipe.difficulty,
    twist: p.recipe.twist,
  }));

/**
 * The player's derived XP + level, reactive to the stats and daily-plays
 * stores. XP is never stored — it's computed from the record (see
 * lib/xp.ts), so this is always in sync and needs no ledger.
 *
 * Note: pulls in the daily plays (and thus the engine chunk) — safe on the
 * in-game / settings surfaces, but keep it off the engine-free Home hero.
 */
export function usePlayerLevel(): LevelInfo {
  const stats = useStatsStore(s => s.stats);
  const plays = usePlaysStore(s => s.plays);

  return useMemo(
    () => levelInfoFor(xpForStats(stats, toDailyXpPlays(plays))),
    [stats, plays]
  );
}

export interface XpEarned {
  /** XP the run earned (sum of the positive per-source deltas). */
  total: number;
  /** Non-zero earning sources, in a stable display order. */
  items: { bucket: XpBucket; label: string; xp: number }[];
}

// Pre-run bucket snapshot keyed by the final GameState, so the mobile
// ResultView and the desktop dialog — the same run mounted across a
// viewport fork — share ONE baseline captured before the result is
// written to the stores. Mirrors useRecordResult's WeakSet guard.
const preBucketsByState = new WeakMap<object, Record<XpBucket, number>>();

/**
 * XP this run earned, split by source — feeds the end-of-game "+N XP"
 * line and its tap breakdown. Derived as the diff between a pre-result
 * bucket snapshot (captured on this result view's first render, before
 * useRecordResult's effect writes the run) and the live, post-write
 * buckets.
 *
 * `viewOnly` (archive replay): the live diff no longer exists, but a
 * recorded DAILY play's own XP is reconstructable from its record (the
 * show-up + beat value and the tier kicker — see dailyPlayXpBuckets), so
 * when the caller passes the run's `{ score, won }` a daily re-view still
 * reports what that play earned. Anything else view-only → null.
 */
export function useXpEarned(
  viewOnly: boolean = false,
  run?: { score: number; won: boolean }
): XpEarned | null {
  const { state, mode } = useGameSession();
  const stats = useStatsStore(s => s.stats);
  const plays = usePlaysStore(s => s.plays);

  // Baseline: the first render for this GameState runs BEFORE the record
  // effect, so getState() reads the pre-run record; the WeakMap makes it
  // one-shot per game (shared across the fork's two result views).
  const pre = useMemo(() => {
    if (!preBucketsByState.has(state)) {
      preBucketsByState.set(
        state,
        xpBuckets(
          useStatsStore.getState().stats,
          toDailyXpPlays(usePlaysStore.getState().plays)
        )
      );
    }
    return preBucketsByState.get(state)!;
  }, [state]);

  if (viewOnly) {
    if (!run || mode.kind !== 'daily') return null;
    const buckets = dailyPlayXpBuckets({
      score: run.score,
      won: run.won,
      difficulty: mode.recipe.difficulty,
      twist: mode.recipe.twist,
    });
    const items = XP_BUCKET_ORDER.filter(b => (buckets[b] ?? 0) > 0).map(
      bucket => ({ bucket, label: XP_BUCKET_LABEL[bucket], xp: buckets[bucket]! })
    );
    return { total: items.reduce((sum, i) => sum + i.xp, 0), items };
  }

  const after = xpBuckets(stats, toDailyXpPlays(plays));
  const items = XP_BUCKET_ORDER.map(bucket => ({
    bucket,
    label: XP_BUCKET_LABEL[bucket],
    xp: after[bucket] - pre[bucket],
  })).filter(i => i.xp > 0);
  const total = items.reduce((sum, i) => sum + i.xp, 0);
  return { total, items };
}

/**
 * One-time seed of the level-up acknowledgement watermark. On a fresh
 * install (levelAckd === null) it snaps to the player's CURRENT derived
 * level, so an existing record doesn't replay a flood of old "Level X
 * reached" banners — only genuinely new levels announce themselves.
 * Mount once, high in the tree.
 */
export function useSeedProgression(): void {
  const { level } = usePlayerLevel();
  const levelAckd = useProgressionStore(s => s.levelAckd);
  const ackLevel = useProgressionStore(s => s.ackLevel);
  useEffect(() => {
    if (levelAckd === null) ackLevel(level);
  }, [levelAckd, level, ackLevel]);
}

/**
 * For the end-of-game popup: returns the level to celebrate if this run
 * crossed a new threshold (current derived level > the acknowledgement
 * watermark), else null. Fires once — it waits for the run's XP to land in
 * the stores (level is reactive), then bumps the watermark so a re-mount
 * (mobile↔desktop fork) doesn't replay it.
 *
 * `viewOnly` (a re-hydrated stored play, e.g. the daily archive) never
 * celebrates or acks — the same guard every result-recording hook has,
 * so an unrelated level crossing (say, the boot-time achievement sync)
 * can't paint its banner over an old game.
 */
export function useLevelUp(viewOnly: boolean = false): number | null {
  const { level } = usePlayerLevel();
  const levelAckd = useProgressionStore(s => s.levelAckd);
  const ackLevel = useProgressionStore(s => s.ackLevel);
  const [shown, setShown] = useState<number | null>(null);
  useEffect(() => {
    if (viewOnly) return;
    if (shown === null && levelAckd !== null && level > levelAckd) {
      setShown(level);
      ackLevel(level);
    }
  }, [viewOnly, level, levelAckd, shown, ackLevel]);
  return viewOnly ? null : shown;
}

/**
 * Clears an equipped deck skin that has fallen back behind its unlock
 * level — possible after "Reset all progress" drops the derived level.
 * Without this the locked skin keeps rendering in-game while the store
 * shows its entry padlocked, with no visible tile to un-pick it from.
 * Mount once, high in the tree (beside useSeedProgression).
 */
export function useValidateEquippedSkin(): void {
  const { level } = usePlayerLevel();
  const deckSkin = useSettingsStore(s => s.deckSkin);
  const set = useSettingsStore(s => s.set);
  useEffect(() => {
    if (deckSkin !== null && !skinUnlocked(deckSkin, level)) {
      set({ deckSkin: null });
    }
  }, [deckSkin, level, set]);
}
