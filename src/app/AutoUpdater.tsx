import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useGameActive } from './gameActiveStore';

/** How often a long-lived session re-checks the server for a deploy. */
const UPDATE_CHECK_MS = 60 * 60 * 1000;

/**
 * Applies a newly-deployed version automatically — no tap required —
 * but never mid-game. registerType 'autoUpdate' lets a fresh worker
 * install AND activate on its own (no waiting-worker purgatory), and
 * the library hands the follow-up reload to us via onNeedReload; this
 * headless component holds it while an interactive game is mounted
 * (gameActiveStore) and applies it the moment the player is idle or
 * navigates, so an in-memory board is never dropped by a refresh.
 *
 * Long-lived sessions (iOS standalone especially, which never
 * re-registers on resume) also poll for updates on foreground and
 * hourly — a deploy then lands while the player sits on a menu screen
 * instead of surfacing later as a stale-chunk error mid-session.
 * RouteError's self-heal remains the backstop for any residual race.
 */
export function AutoUpdater() {
  const [needReload, setNeedReload] = useState(false);
  useRegisterSW({
    onNeedReload() {
      setNeedReload(true);
    },
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      const check = () => void registration.update().catch(() => {});
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
      window.setInterval(check, UPDATE_CHECK_MS);
    },
  });
  const gameActive = useGameActive();
  // Re-evaluate the safe-to-apply check whenever the route changes, so a
  // held reload also applies on navigation, not only when a game
  // unmounts.
  const { pathname } = useLocation();
  const applied = useRef(false);

  useEffect(() => {
    if (!needReload || applied.current || gameActive) return;
    applied.current = true;
    window.location.reload();
  }, [needReload, gameActive, pathname]);

  // ---- Multi-tab backstop: reload any tab the new worker claims ----
  // An update's skipWaiting re-controls EVERY open tab and the old
  // build's precache is deleted — a tab that missed the library's
  // 'activated' event would keep running old code with its chunk cache
  // gone, so its next lazy navigation failed into the "just updated"
  // card (the classic several-tabs-open iOS report). Listening for
  // controllerchange lets every tab reload itself the moment it's taken
  // over — deferred while a game is mid-play, exactly like the apply
  // above.
  const [takenOver, setTakenOver] = useState(false);
  const reloaded = useRef(false);
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    // A first-ever install can also fire controllerchange when a fresh
    // worker claims a previously uncontrolled page — that's not a
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
