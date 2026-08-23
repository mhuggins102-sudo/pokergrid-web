import type { Stats } from '../../lib/stats';
import { readPlayedDatesLite } from '../daily/streak';

// The intro tour's dismissal flag (the tutorialSeen.ts idiom: plain
// localStorage, try/catch everywhere, read fails CLOSED — storage
// unavailable must never nag). Tri-state:
//   'seen'  — the player finished the tour or ticked "don't show
//             again": never auto-show.
//   'show'  — Settings' "Show again": show over the next game even
//             for a seasoned profile, once.
//   null    — untouched: show only over a fresh profile's games.
const KEY = 'pokergrid:intro-tour:v1';

export type IntroTourChoice = 'seen' | 'show' | null;

export const introTourChoice = (): IntroTourChoice => {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'seen' || v === 'show' ? v : null;
  } catch {
    return 'seen';
  }
};

export const markIntroTourSeen = (): void => {
  try {
    localStorage.setItem(KEY, 'seen');
  } catch {
    // Best-effort only.
  }
};

/** Settings' "Show again" — arms the tour for the next game. */
export const requestIntroTour = (): void => {
  try {
    localStorage.setItem(KEY, 'show');
  } catch {
    // Best-effort only.
  }
};

/** Reset-all-progress: back to the untouched state. */
export const clearIntroTour = (): void => {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Best-effort only.
  }
};

/**
 * "Has this profile ever really played?" — guards existing players
 * from suddenly meeting the tour when the flag ships. Finished free
 * runs, beaten challenges, a Targets-Up ladder, or any recorded daily
 * all count as played; an abandoned mid-game does not (that player is
 * still the tour's audience).
 */
export const freshProfile = (stats: Stats): boolean =>
  stats.wins + stats.losses === 0 &&
  stats.challengesDone.length === 0 &&
  stats.targetsUpBest === 0 &&
  Object.keys(readPlayedDatesLite()).length === 0;
