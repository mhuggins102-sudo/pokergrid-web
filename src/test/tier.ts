import type { Tier } from '../app/useTier';
import { BP_DESKTOP, BP_TABLET } from '../app/useTier';

type Listener = (ev: { matches: boolean; media: string }) => void;

/** Viewport width representative of each tier. */
const TIER_WIDTH: Record<Tier, number> = {
  phone: 390,
  tablet: 820,
  desktop: 1280,
};

/** Parse the `(min-width: Npx)` form used by the app's tier queries. */
const minWidthOf = (query: string): number | null => {
  const m = /\(min-width:\s*(\d+(?:\.\d+)?)px\)/.exec(query);
  return m ? Number(m[1]) : null;
};

/**
 * Point jsdom's matchMedia at a specific tier for the duration of a
 * test. The global setup shim (src/test/setup.ts) answers false to
 * every width query — the phone tree — so tests only call this to see
 * the tablet/desktop trees (or to exercise live tier *changes* via the
 * returned `set`).
 *
 * Compatible with the setup.ts conventions: same MediaQueryList
 * surface (modern add/removeEventListener plus the legacy
 * addListener/removeListener), and `prefers-reduced-motion` keeps
 * matching so presentation staging stays collapsed.
 *
 * Returns { set, restore }: `set(tier)` re-evaluates every live query
 * and fires change events (the useTier listeners react like a real
 * resize); `restore()` puts the previous matchMedia back — call it in
 * afterEach/finally.
 */
export function mockTier(initial: Tier = 'phone'): {
  set: (tier: Tier) => void;
  restore: () => void;
} {
  const previous = window.matchMedia;
  let width = TIER_WIDTH[initial];

  const live = new Set<{ query: string; listeners: Set<Listener> }>();

  const matches = (query: string): boolean => {
    if (query.includes('prefers-reduced-motion')) return true;
    const min = minWidthOf(query);
    return min !== null && width >= min;
  };

  window.matchMedia = ((query: string) => {
    const entry = { query, listeners: new Set<Listener>() };
    live.add(entry);
    const mql = {
      get matches() {
        return matches(query);
      },
      media: query,
      onchange: null,
      addEventListener: (type: string, cb: Listener) => {
        if (type === 'change') entry.listeners.add(cb);
      },
      removeEventListener: (type: string, cb: Listener) => {
        if (type === 'change') entry.listeners.delete(cb);
      },
      addListener: (cb: Listener) => entry.listeners.add(cb),
      removeListener: (cb: Listener) => entry.listeners.delete(cb),
      dispatchEvent: () => false,
    };
    return mql as unknown as MediaQueryList;
  }) as typeof window.matchMedia;

  return {
    set(tier: Tier) {
      width = TIER_WIDTH[tier];
      for (const { query, listeners } of live) {
        const ev = { matches: matches(query), media: query };
        for (const cb of listeners) cb(ev);
      }
    },
    restore() {
      window.matchMedia = previous;
    },
  };
}

// Sanity: the representative widths straddle the real breakpoints.
if (
  TIER_WIDTH.phone >= BP_TABLET ||
  TIER_WIDTH.tablet < BP_TABLET ||
  TIER_WIDTH.tablet >= BP_DESKTOP ||
  TIER_WIDTH.desktop < BP_DESKTOP
) {
  throw new Error('mockTier widths out of sync with tier breakpoints');
}
