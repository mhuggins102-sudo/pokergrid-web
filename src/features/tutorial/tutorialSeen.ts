// First-run flag — same key as the original app so returning players
// who already took the tutorial there aren't nagged again.
const KEY = 'pokergrid:tutorial-seen:v1';

export const tutorialSeen = (): boolean => {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return true; // storage unavailable → never nag
  }
};

export const markTutorialSeen = (): void => {
  try {
    localStorage.setItem(KEY, '1');
  } catch {
    // ignore
  }
};
