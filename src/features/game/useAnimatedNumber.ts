import { useEffect, useRef, useState } from 'react';

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Tick a displayed number from its previous value to `value` over a
 * short ease-out ramp. Jumps straight to the target under reduced
 * motion (system preference or the app setting, via `animate`).
 *
 * `initial` seeds the pre-animation value for mount-time tallies (the
 * result screen counts up from 0); omitted, the first render shows
 * `value` directly and only subsequent changes animate (the live
 * score bar).
 */
export function useAnimatedNumber(
  value: number,
  animate: boolean,
  { durationMs = 280, initial }: { durationMs?: number; initial?: number } = {}
): number {
  const seed = initial ?? value;
  const [display, setDisplay] = useState(seed);
  const fromRef = useRef(seed);
  useEffect(() => {
    const from = fromRef.current;
    fromRef.current = value;
    if (!animate || from === value || prefersReducedMotion()) {
      setDisplay(value);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - (1 - t) * (1 - t); // ease-out
      setDisplay(Math.round(from + (value - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, animate, durationMs]);
  return display;
}
