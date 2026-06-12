// One-time "what's this twist?" explainer for daily puzzles. Keyed per
// twist id so each variant is explained the first time a player meets
// it in a daily — Challenges players will have seen them, but the
// daily audience is broader.
import type { ChallengeId } from '../../game/challenges';

const KEY = 'pokergrid:daily-twist-seen:v1';

const read = (): string[] => {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter(x => typeof x === 'string') : [];
  } catch {
    return [];
  }
};

export const twistSeen = (id: ChallengeId): boolean => read().includes(id);

export const markTwistSeen = (id: ChallengeId): void => {
  try {
    const seen = read();
    if (!seen.includes(id)) {
      localStorage.setItem(KEY, JSON.stringify([...seen, id]));
    }
  } catch {
    // storage unavailable — explainer just shows again next time
  }
};

/** Settings → Reset all progress re-arms every twist explainer. */
export const clearTwistsSeen = (): void => {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
};
