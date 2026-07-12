import { createContext, useContext, useLayoutEffect } from 'react';

/*
 * Phase-2 interim chrome scoping (mobile/tablet unification): pages
 * adopt the desktop header at the tablet tier (≥768px), but the GAME
 * surfaces must stay byte-identical there until phase 5 gives tablets
 * a real game layout — they still render the phone tree, designed to
 * sit under the classic scrolling header. Game-family screens register
 * here; while any registration is live, AppLayout keeps the classic
 * chrome at 768–1023 (the ≥1024 desktop rules are unconditional, and
 * <768 never shows the desktop header, so the flag only matters in
 * the tablet band). Dissolves in phases 4–5 (unified header + tablet
 * game layout).
 */

export const ClassicChromeContext = createContext<{
  /** Register a classic-chrome surface; returns the deregister. */
  register: () => () => void;
} | null>(null);

/** Keep the classic (phone) app chrome while this component is
 *  mounted. Ref-counted — nested/overlapping registrations are fine. */
export function useClassicChrome(): void {
  const ctx = useContext(ClassicChromeContext);
  const register = ctx?.register;
  // Layout effect: the flag must land in the same paint as the surface
  // mounting, or the header would flash swapped for a frame.
  useLayoutEffect(() => {
    if (!register) return;
    return register();
  }, [register]);
}
