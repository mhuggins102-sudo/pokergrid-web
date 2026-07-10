import { useEffect, useState } from 'react';

// Must match the CSS breakpoint in GameScreen.module.css /
// AppLayout.module.css exactly — the JSX fork and the stylesheet flip
// together or the desktop tree renders with mobile styles (and vice
// versa).
const QUERY = '(min-width: 1024px)';

const matchesNow = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia(QUERY).matches;

/**
 * True at the desktop breakpoint (≥1024px). Drives GameScreen's layout
 * fork: below it the phone flex column renders byte-for-byte as
 * before; at and above it the three-column desktop spread renders
 * instead. jsdom (unit tests) has no real matchMedia — the setup shim
 * reports false, so tests exercise the mobile tree.
 */
export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(matchesNow);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(QUERY);
    const onChange = () => setIsDesktop(mq.matches);
    onChange(); // in case the viewport moved between render and effect
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return isDesktop;
}
