import { useEffect, useMemo, useState } from 'react';
import { DailyXpPlay, LevelInfo, levelInfoFor, xpForStats } from '../../lib/xp';
import { usePlaysStore } from '../daily/sync/playsStore';
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
 */
export function useLevelUp(): number | null {
  const { level } = usePlayerLevel();
  const levelAckd = useProgressionStore(s => s.levelAckd);
  const ackLevel = useProgressionStore(s => s.ackLevel);
  const [shown, setShown] = useState<number | null>(null);
  useEffect(() => {
    if (shown === null && levelAckd !== null && level > levelAckd) {
      setShown(level);
      ackLevel(level);
    }
  }, [level, levelAckd, shown, ackLevel]);
  return shown;
}
