import { useEffect, useState } from 'react';
import { useTier } from '../../app/useTier';

/** The in-game presentation families (plan decision C). */
export type GameFamily = 'column' | 'desk-lite' | 'desk';

/*
 * Which in-game tree renders, keyed on tier + orientation:
 *
 *   column    phone, tablet-portrait — the measured phone column
 *   desk-lite tablet-landscape — the desk tree minus the left rail
 *   desk      ≥1024 — the full three-column desk tree
 *
 * The tutorial pin (coach → column below the desktop tier) is NOT
 * applied here: the coach prop isn't visible at this layer. GameScreen
 * folds a tablet-landscape coach run back to 'column' after calling
 * this. jsdom/SSR answer 'phone' from useTier and false from the
 * orientation query, so this resolves to 'column' there — the unit-test
 * contract that tests exercise the column tree is preserved.
 */

const LANDSCAPE_QUERY = '(orientation: landscape)';

const canQuery = (): boolean =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function';

const landscapeNow = (): boolean =>
  canQuery() && window.matchMedia(LANDSCAPE_QUERY).matches;

export function useGameFamily(): GameFamily {
  const tier = useTier();
  const [landscape, setLandscape] = useState(landscapeNow);
  useEffect(() => {
    if (!canQuery()) return;
    const mq = window.matchMedia(LANDSCAPE_QUERY);
    const onChange = () => setLandscape(mq.matches);
    onChange(); // in case orientation moved between render and effect
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  if (tier === 'desktop') return 'desk';
  if (tier === 'tablet' && landscape) return 'desk-lite';
  return 'column';
}
