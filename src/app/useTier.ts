import { useEffect, useState } from 'react';

/**
 * The app's three presentation tiers (mobile/tablet unification plan,
 * decision B):
 *
 *   phone   <768px
 *   tablet  768–1023px
 *   desktop ≥1024px
 *
 * These MUST match the CSS breakpoints documented in
 * src/design/tokens.css (`/* bp-tablet *\/` = 768, `/* bp-desktop *\/`
 * = 1024) — a JSX fork and its stylesheet flip together or one tier
 * renders with another tier's styles.
 */
export type Tier = 'phone' | 'tablet' | 'desktop';

export const BP_TABLET = 768;
export const BP_DESKTOP = 1024;

const TABLET_QUERY = `(min-width: ${BP_TABLET}px)`;
const DESKTOP_QUERY = `(min-width: ${BP_DESKTOP}px)`;

const canQuery = (): boolean =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function';

const tierNow = (): Tier => {
  // No real matchMedia (SSR, jsdom) → 'phone', preserving the
  // longstanding contract that unit tests exercise the phone tree.
  // (The jsdom setup shim answers false to both width queries, which
  // lands on 'phone' through the same arithmetic.)
  if (!canQuery()) return 'phone';
  if (window.matchMedia(DESKTOP_QUERY).matches) return 'desktop';
  if (window.matchMedia(TABLET_QUERY).matches) return 'tablet';
  return 'phone';
};

/**
 * The current presentation tier, live across viewport resizes. Two
 * matchMedia listeners (768 and 1024) — same jsdom/SSR-safe pattern as
 * the original useIsDesktop, which is now a shim over this hook.
 */
export function useTier(): Tier {
  const [tier, setTier] = useState<Tier>(tierNow);
  useEffect(() => {
    if (!canQuery()) return;
    const queries = [
      window.matchMedia(TABLET_QUERY),
      window.matchMedia(DESKTOP_QUERY),
    ];
    const onChange = () => setTier(tierNow());
    onChange(); // in case the viewport moved between render and effect
    for (const mq of queries) mq.addEventListener('change', onChange);
    return () => {
      for (const mq of queries) mq.removeEventListener('change', onChange);
    };
  }, []);
  return tier;
}
