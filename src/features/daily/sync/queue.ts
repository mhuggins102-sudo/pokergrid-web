// Queue-first daily submission — the durable retry queue is written
// BEFORE the first network attempt, so a tab closed mid-submit always
// leaves the play on disk for the next drain. This is the design the
// redesign plan extracted from the original repo's score-save-hang
// fix (Part 3): entries leave the queue only when the server confirms
// (success or AlreadySubmittedError).

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { safeJSONStorage } from '../../../lib/safeStorage';
import type { DailyRecipe } from '../../../game/daily/recipe';
import {
  AlreadySubmittedError,
  BackendUnavailableError,
} from '../../../lib/supabaseRpc';

export interface PendingSubmit {
  deviceId: string;
  dateISO: string;
  score: number;
  won: boolean;
  recipe: DailyRecipe;
  usedUndo: boolean;
  enqueuedAt: number;
}

interface QueueStore {
  pending: PendingSubmit[];
  enqueue: (p: PendingSubmit) => void;
  remove: (deviceId: string, dateISO: string) => void;
}

export const useQueueStore = create<QueueStore>()(
  persist(
    set => ({
      pending: [],
      enqueue: p =>
        set(s =>
          // Idempotency: one queue entry per (device, date).
          s.pending.some(
            e => e.deviceId === p.deviceId && e.dateISO === p.dateISO
          )
            ? s
            : { pending: [...s.pending, p] }
        ),
      remove: (deviceId, dateISO) =>
        set(s => ({
          pending: s.pending.filter(
            e => !(e.deviceId === deviceId && e.dateISO === dateISO)
          ),
        })),
    }),
    { name: 'pokergrid:daily:pendingSubmits:v1', storage: safeJSONStorage() }
  )
);

// ---------------- pure drain (unit-testable) ----------------

export interface DrainDeps {
  getPendingSubmits: () => PendingSubmit[];
  removePendingSubmit: (deviceId: string, dateISO: string) => void;
  submit: (p: PendingSubmit) => Promise<void>;
}

export interface DrainResult {
  // True when at least one entry reached the server (fresh submit or
  // confirmed already-there) — callers refetch the rank on this.
  anySubmitted: boolean;
  // Most recent transient failure, for the rank panel's error state.
  lastError: { dateISO: string; error: unknown } | null;
}

// One pass over the queue. Transient failures leave the entry in place
// for the next drain; AlreadySubmittedError means the server has the
// play (an earlier submit landed but the response was lost), so the
// entry is dropped and counted as submitted.
export const drainPendingSubmitsOnce = async (
  deps: DrainDeps
): Promise<DrainResult> => {
  const pending = deps.getPendingSubmits();
  let anySubmitted = false;
  let lastError: DrainResult['lastError'] = null;
  for (const p of pending) {
    try {
      await deps.submit(p);
      deps.removePendingSubmit(p.deviceId, p.dateISO);
      anySubmitted = true;
    } catch (e) {
      if (e instanceof AlreadySubmittedError) {
        deps.removePendingSubmit(p.deviceId, p.dateISO);
        anySubmitted = true;
        continue;
      }
      if (e instanceof BackendUnavailableError) {
        // Misconfiguration; nothing further to drain.
        break;
      }
      lastError = { dateISO: p.dateISO, error: e };
    }
  }
  return { anySubmitted, lastError };
};

// ---------------- re-entrance guard with rerun coalescing ----------------

interface GuardState {
  running: Promise<DrainResult> | null;
  rerun: boolean;
}

const guard: GuardState = { running: null, rerun: false };

/**
 * Serialized drain: concurrent callers share the in-flight promise,
 * and an enqueue landing mid-drain sets the rerun flag so it isn't
 * missed — `do { drainOnce } while (rerun)`.
 */
export const drainGuarded = (
  deps: DrainDeps,
  onResult?: (r: DrainResult) => void
): Promise<DrainResult> => {
  if (guard.running) {
    guard.rerun = true;
    return guard.running;
  }
  guard.running = (async () => {
    // anySubmitted aggregates across passes (a rerun over an emptied
    // queue must not erase the first pass's success); lastError
    // reflects the final pass — the current state of the queue.
    const result: DrainResult = { anySubmitted: false, lastError: null };
    do {
      guard.rerun = false;
      const pass = await drainPendingSubmitsOnce(deps);
      result.anySubmitted = result.anySubmitted || pass.anySubmitted;
      result.lastError = pass.lastError;
    } while (guard.rerun);
    guard.running = null;
    onResult?.(result);
    return result;
  })();
  return guard.running;
};

/** Test-only: reset the module-level guard between cases. */
export const resetDrainGuardForTests = (): void => {
  guard.running = null;
  guard.rerun = false;
};
