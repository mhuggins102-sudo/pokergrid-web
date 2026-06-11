import { createContext, useContext } from 'react';

/**
 * Dock-button spotlight for guided play (the tutorial). GameScreen
 * pulses the action button whose id matches; null (the default
 * everywhere outside the tutorial) is a no-op.
 */
export type CoachHighlight = 'place' | 'perk' | 'discard' | null;

export const CoachHighlightContext = createContext<CoachHighlight>(null);

export const useCoachHighlight = (): CoachHighlight =>
  useContext(CoachHighlightContext);
