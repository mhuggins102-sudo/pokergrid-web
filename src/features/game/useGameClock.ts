import { useEffect } from 'react';
import { useGameSession } from './GameSessionProvider';

/**
 * Time Trial's clock. Owns the ONLY real-time reads (Date.now) so the
 * reducer stays pure: active play time accumulates here and reaches
 * the engine as CLOCK_TICK payloads (whole seconds), where
 * state.elapsedMs is the single display + scoring source.
 *
 * "Active" time: the clock pauses while the document is hidden (app
 * backgrounded, tab switched, phone call) and resumes on return — an
 * interruption never costs points. It stops for good at game over
 * (the reducer also ignores late ticks there).
 *
 * StrictMode-safe: elapsed time lives in module-free closure state
 * re-derived from state.elapsedMs on every (re)start, so a double
 * mount can't double-count and a remount resumes seamlessly.
 *
 * `paused` holds the clock while a blocking overlay owns the screen
 * (the intro tour over a first game) — reading the how-to must not
 * cost Time Trial points. Unpausing re-baselines from state, exactly
 * like a remount.
 */
export function useGameClock(paused = false): void {
  const { state, dispatch, viewOnly } = useGameSession();
  const running =
    state.timeTrial && !viewOnly && !paused &&
    state.phase.kind !== 'game-over';
  // Deliberately NOT keyed on state.elapsedMs — our own ticks would
  // restart the effect. The baseline is read once per (re)start.
  const baseMs = state.elapsedMs;

  useEffect(() => {
    if (!running) return;
    // Accumulated active ms at the last pause, and the wall-clock
    // moment the current active stretch began (null while hidden).
    let accumulated = baseMs;
    let resumedAt: number | null = document.hidden ? null : Date.now();

    const activeMs = () =>
      accumulated + (resumedAt !== null ? Date.now() - resumedAt : 0);
    const tick = () =>
      dispatch({
        type: 'CLOCK_TICK',
        elapsedMs: Math.floor(activeMs() / 1000) * 1000,
      });

    const onVisibility = () => {
      if (document.hidden) {
        // Fold the stretch in and freeze.
        accumulated = activeMs();
        resumedAt = null;
        tick();
      } else if (resumedAt === null) {
        resumedAt = Date.now();
      }
    };

    const interval = window.setInterval(tick, 1000);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      // Fold the tail of the current stretch into state so a remount
      // (StrictMode, dock/layout flips) resumes without losing time.
      dispatch({
        type: 'CLOCK_TICK',
        elapsedMs: Math.floor(activeMs() / 1000) * 1000,
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, dispatch]);
}

/** m:ss for the clock pill and result lines. */
export const formatClock = (ms: number): string => {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
};
