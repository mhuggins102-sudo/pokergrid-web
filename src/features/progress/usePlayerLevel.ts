import { useEffect, useMemo, useState } from 'react';
import { DailyXpPlay, LevelInfo, levelInfoFor, xpForStats } from '../../lib/xp';
import { skinUnlocked } from '../../design/skinCatalog';
import { usePlaysStore } from '../daily/sync/playsStore';
import { useSettingsStore } from '../settings/settingsStore';
import { useProgressionStore } from './progressionStore';
import { useStatsStore } from './statsStore';

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

  return useMemo(() => {
    const dailyPlays: DailyXpPlay[] = Object.values(plays).map(p => ({
      score: p.score,
      won: p.won,
      difficulty: p.recipe.difficulty,
      twist: p.recipe.twist,
    }));
    return levelInfoFor(xpForStats(stats, dailyPlays));
  }, [stats, plays]);
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
