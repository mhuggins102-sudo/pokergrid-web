// App-level wiring of the queue: real deps, drain triggers, and the
// save → enqueue → drain submission path.

import { QueryClient } from '@tanstack/react-query';
import type { GameState } from '../../../game/state';
import type { DailyRecipe } from '../../../game/daily/recipe';
import { isBackendConfigured, submitDailyPlay } from '../../../lib/supabaseRpc';
import { clearDailyIdentity, getOrCreateDeviceId } from './deviceId';
import { DailyPlay, usePlaysStore } from './playsStore';
import { DrainDeps, drainGuarded, useQueueStore } from './queue';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnReconnect: true,
      staleTime: 30_000,
    },
  },
});

const realDeps: DrainDeps = {
  getPendingSubmits: () => useQueueStore.getState().pending,
  removePendingSubmit: (deviceId, dateISO) =>
    useQueueStore.getState().remove(deviceId, dateISO),
  submit: p =>
    submitDailyPlay({
      deviceId: p.deviceId,
      dateISO: p.dateISO,
      score: p.score,
      won: p.won,
      recipe: p.recipe,
      usedUndo: p.usedUndo,
    }),
};

/** Drain the queue; on any confirmed submit, refresh rank queries. */
export const drainQueue = () =>
  drainGuarded(realDeps, r => {
    if (r.anySubmitted) {
      void queryClient.invalidateQueries({ queryKey: ['daily-rank'] });
    }
  });

/**
 * Record a finished daily: local play first (source of truth for "did
 * this device play this date"), then the durable queue entry, then a
 * fire-and-forget drain. The result screen renders immediately — the
 * network never gates it.
 */
export const recordDailyCompletion = (
  dateISO: string,
  recipe: DailyRecipe,
  state: GameState,
  score: number,
  won: boolean
): void => {
  const play: DailyPlay = {
    dateISO,
    score,
    won,
    recipe,
    completedAt: Date.now(),
    state,
  };
  usePlaysStore.getState().savePlay(play);
  if (!isBackendConfigured()) return;
  useQueueStore.getState().enqueue({
    deviceId: getOrCreateDeviceId(),
    dateISO,
    score,
    won,
    recipe,
    usedUndo: state.undoCount > 0,
    enqueuedAt: Date.now(),
  });
  void drainQueue();
};

/**
 * Wipe this device's local daily history: stored results, the pending
 * submit queue, and the leaderboard identity (device id + handle). Used
 * by "Reset all progress" so a player can truly start over — including
 * under a different username. Already-submitted scores remain in Supabase
 * under the old (now-forgotten) device id. Cached rank/stats queries are
 * invalidated so the UI reflects the fresh identity.
 */
export const resetDailyProgress = (): void => {
  usePlaysStore.getState().reset();
  useQueueStore.getState().clear();
  clearDailyIdentity();
  void queryClient.invalidateQueries({ queryKey: ['daily-rank'] });
  void queryClient.invalidateQueries({ queryKey: ['daily-stats'] });
  void queryClient.invalidateQueries({ queryKey: ['daily-histogram'] });
};

let bootDone = false;

/** Drain triggers: app start + browser regaining connectivity. */
export const bootDailySync = (): void => {
  if (bootDone) return;
  bootDone = true;
  if (!isBackendConfigured()) return;
  void drainQueue();
  window.addEventListener('online', () => void drainQueue());
};
