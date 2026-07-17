import { useEffect, useRef, useState } from 'react';
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

  // ---- Multi-tab takeover: reload EVERY tab the new worker claims ----
  // Applying an update skip-waits the new worker, which takes control of
  // ALL open tabs and deletes the old build's precache — but only the
  // applying tab reloaded. Any other tab kept running old code with its
  // chunk cache gone, so its next lazy navigation failed into the
  // "just updated" card (the classic several-tabs-open iOS report).
  // Listening for controllerchange lets every tab reload itself the
  // moment it's taken over — deferred while a game is mid-play, exactly
  // like the apply above.
  const [takenOver, setTakenOver] = useState(false);
  const reloaded = useRef(false);
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    // A first-ever install also fires controllerchange when the fresh
    // worker claims the (previously uncontrolled) page — that's not a
    // takeover, so only arm the reload when a controller existed.
    let hadController = !!navigator.serviceWorker.controller;
    const onChange = () => {
      if (!hadController) {
        hadController = true;
        return;
      }
      setTakenOver(true);
    };
    navigator.serviceWorker.addEventListener('controllerchange', onChange);
    return () =>
      navigator.serviceWorker.removeEventListener('controllerchange', onChange);
  }, []);

  useEffect(() => {
    if (!takenOver || reloaded.current || gameActive) return;
    reloaded.current = true;
    window.location.reload();
  }, [takenOver, gameActive, pathname]);

  return null;
}
