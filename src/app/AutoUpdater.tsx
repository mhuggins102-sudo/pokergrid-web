import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useGameActive } from './gameActiveStore';

/**
 * Applies a newly-deployed version automatically — no tap required —
 * but never mid-game. A fresh deploy parks the new service worker in
 * "waiting" (registerType: 'prompt'); this headless component applies
 * it the moment it's safe: as soon as there's no interactive game
 * mounted (see gameActiveStore). A swap that lands mid-game is held
 * until the game ends or the player navigates, so an in-memory board is
 * never dropped by a reload.
 *
 * `updateServiceWorker(true)` skip-waits the new worker and reloads
 * once, so the fresh index.html + chunks load cleanly. RouteError's
 * self-heal is the backstop for any residual chunk-load race.
 *
 * (Replaces the old manual "A new version is ready — Reload" banner.)
 */
export function AutoUpdater() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  const gameActive = useGameActive();
  // Re-evaluate the safe-to-apply check whenever the route changes, so a
  // held update also applies on navigation, not only when a game
  // unmounts.
  const { pathname } = useLocation();
  const applied = useRef(false);

  useEffect(() => {
    if (!needRefresh || applied.current || gameActive) return;
    applied.current = true;
    updateServiceWorker(true);
  }, [needRefresh, gameActive, pathname, updateServiceWorker]);

  return null;
}
