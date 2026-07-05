// Lightweight daily-win count read straight from persisted storage, so
// the Home screen can fold daily wins into its total WITHOUT importing
// the daily plays store — that store pulls in the game engine (via
// bonusCards), which Home deliberately stays out of. The storage key +
// schema version are shared with playsStore via the engine-free
// playsStoreKey module, so the two can't drift apart.
import { PLAYS_STORE_NAME, PLAYS_STORE_VERSION } from './sync/playsStoreKey';

export const countDailyWins = (): number => {
  try {
    const raw = localStorage.getItem(PLAYS_STORE_NAME);
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as {
      state?: { plays?: Record<string, { won?: boolean }> };
      version?: number;
    };
    // A future schema bump means this lightweight reader no longer
    // understands the shape — return 0 (and let the real store's
    // migration handle it) rather than mis-counting.
    if ((parsed.version ?? 0) !== PLAYS_STORE_VERSION) return 0;
    const plays = parsed.state?.plays ?? {};
    let wins = 0;
    for (const p of Object.values(plays)) if (p?.won) wins += 1;
    return wins;
  } catch {
    return 0;
  }
};
