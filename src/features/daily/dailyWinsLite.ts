// Lightweight daily-win count read straight from persisted storage, so
// the Home screen can fold daily wins into its total WITHOUT importing
// the daily plays store — that store pulls in the game engine (via
// bonusCards), which Home deliberately stays out of.
//
// Key is duplicated from playsStore's persist name on purpose (importing
// the store is exactly what we're avoiding); keep them in sync.
const PLAYS_KEY = 'pokergrid:daily:plays:v1';

export const countDailyWins = (): number => {
  try {
    const raw = localStorage.getItem(PLAYS_KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as {
      state?: { plays?: Record<string, { won?: boolean }> };
    };
    const plays = parsed.state?.plays ?? {};
    let wins = 0;
    for (const p of Object.values(plays)) if (p?.won) wins += 1;
    return wins;
  } catch {
    return 0;
  }
};
