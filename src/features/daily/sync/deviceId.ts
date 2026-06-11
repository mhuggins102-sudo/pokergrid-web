// Anonymous per-device identity — the leaderboard key. Same storage
// key as the original app; on this domain every player starts fresh
// (accepted in the redesign plan — handles are device-bound).

const KEY_DEVICE_ID = 'pokergrid:daily:deviceId';

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
