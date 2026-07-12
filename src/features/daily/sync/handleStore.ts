// Reactive view of the locally saved leaderboard handle (KEY_HANDLE).
// localStorage stays the source of truth — this module just makes
// same-tab writes observable, so a first-time save in the result
// dialog immediately renames every synthesized "own row" (leaderboard
// panel, day-stats sheet, archive detail) instead of waiting for a
// remount to re-read storage.

import { useSyncExternalStore } from 'react';
import { KEY_HANDLE } from './deviceId';

const listeners = new Set<() => void>();

const emit = (): void => {
  for (const l of listeners) l();
};

const subscribe = (fn: () => void): (() => void) => {
  listeners.add(fn);
  // Cross-tab renames arrive via the storage event; same-tab writes
  // don't fire it — that's what emit() is for.
  window.addEventListener('storage', fn);
  return () => {
    listeners.delete(fn);
    window.removeEventListener('storage', fn);
  };
};

/** The saved handle (null = anonymous), read fresh from storage. */
export const getLocalHandle = (): string | null => {
  try {
    return localStorage.getItem(KEY_HANDLE);
  } catch {
    return null;
  }
};

/** The saved handle as reactive state — re-renders on save/clear. */
export const useHandle = (): string | null =>
  useSyncExternalStore(subscribe, getLocalHandle, () => null);

/** Persist the handle locally and notify all useHandle subscribers. */
export const setLocalHandle = (handle: string | null): void => {
  try {
    if (handle) localStorage.setItem(KEY_HANDLE, handle);
    else localStorage.removeItem(KEY_HANDLE);
  } catch {
    // Storage unavailable — the remote save still holds server-side.
  }
  emit();
};

/** For paths that clear KEY_HANDLE outside this module (reset). */
export const notifyHandleChanged = (): void => emit();
