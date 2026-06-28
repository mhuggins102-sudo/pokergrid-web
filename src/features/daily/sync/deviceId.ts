// Anonymous per-device identity — the leaderboard key. Same storage
// key as the original app; on this domain every player starts fresh
// (accepted in the redesign plan — handles are device-bound).

const KEY_DEVICE_ID = 'pokergrid:daily:deviceId';
// The chosen leaderboard name, kept device-local (the source of truth is
// the Supabase row). Exported so the handle editor and the reset path
// share one key.
export const KEY_HANDLE = 'pokergrid:daily:handle';

const randomHex128 = (): string => {
  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
};

/**
 * Forget this device's leaderboard identity (id + local handle). The
 * next getOrCreateDeviceId() mints a fresh id, so the player starts over
 * as a new entrant and can claim a different username. Old rows stay in
 * Supabase under the previous id.
 */
export const clearDailyIdentity = (): void => {
  try {
    localStorage.removeItem(KEY_DEVICE_ID);
    localStorage.removeItem(KEY_HANDLE);
  } catch {
    // Storage unavailable — nothing persisted to clear.
  }
};

/** Read-through bootstrap: first call mints + persists the id. */
export const getOrCreateDeviceId = (): string => {
  try {
    const existing = localStorage.getItem(KEY_DEVICE_ID);
    if (existing) return existing;
    const id = randomHex128();
    localStorage.setItem(KEY_DEVICE_ID, id);
    return id;
  } catch {
    // Storage unavailable (private mode edge cases) — session-scoped id.
    return randomHex128();
  }
};
