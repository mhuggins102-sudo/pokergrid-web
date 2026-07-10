import { useMemo } from 'react';
import { currentDateISO } from '../../game/daily/seed';
import { usePlaysStore } from './sync/playsStore';
import { DailyStreak, bestDailyStreak, dailyStreak } from './streak';

/**
 * Live streak for the current player — reactive to the plays store;
 * `best` folds in the persisted high-water mark. Lives apart from the
 * pure helper so engine-free surfaces (Home) can compute the same
 * streak from the lite storage snapshot instead.
 */
export function useDailyStreak(): DailyStreak {
  const plays = usePlaysStore(s => s.plays);
  return useMemo(() => {
    const s = dailyStreak(plays, currentDateISO());
    return { ...s, best: bestDailyStreak(s.best) };
  }, [plays]);
}
