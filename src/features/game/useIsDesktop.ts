import { useTier } from '../../app/useTier';

/**
 * True at the desktop breakpoint (≥1024px). Migration shim over
 * useTier (mobile/tablet unification plan, decision B) — call sites
 * flip to `useTier()` tier checks phase by phase, and this file is
 * deleted when the last one is gone. Same jsdom contract as before:
 * no real matchMedia → 'phone' tier → false, so unit tests exercise
 * the mobile tree.
 */
export function useIsDesktop(): boolean {
  return useTier() === 'desktop';
}
