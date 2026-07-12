import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Outlet, ScrollRestoration } from 'react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../design/primitives';
import { bootDailySync, queryClient } from '../features/daily/sync/sync';
import { useSyncDailyAchievements } from '../features/progress/useSyncDailyAchievements';
import { useApplyTheme } from '../features/settings/useTheme';
import { UpdatePrompt } from './UpdatePrompt';
import { DesktopNav, NavExtrasProvider } from './DesktopNav';
import { ClassicChromeContext } from './useClassicChrome';
import styles from './AppLayout.module.css';

const NAV_ITEMS = [
  { to: '/daily', label: 'Daily' },
  { to: '/play', label: 'Free Play' },
  { to: '/challenges', label: 'Challenges' },
  { to: '/targets', label: 'Targets Up' },
  { to: '/stats', label: 'Stats' },
  { to: '/achievements', label: 'Achievements' },
  { to: '/rules', label: 'Rules' },
  { to: '/settings', label: 'Settings' },
];

export function AppLayout() {
  // Drain any queued daily submissions on start + when the browser
  // regains connectivity.
  useEffect(() => {
    bootDailySync();
  }, []);

  // Record Daily-Puzzle / combined-win achievements from local plays.
  useSyncDailyAchievements();

  // Stamp the selected theme onto <html> (and keep it live on OS
  // color-scheme changes).
  useApplyTheme();

  // Ref-counted "classic chrome" flag: game-family surfaces
  // (GameSessionProvider, DailyResultStatic) register while mounted so
  // the tablet-tier header swap skips them — they still render the
  // phone tree under the classic header until phase 5. Count in a ref
  // (register/deregister mustn't depend on render state); a small
  // state mirror drives the class. See useClassicChrome.ts.
  const classicCountRef = useRef(0);
  const [classicOn, setClassicOn] = useState(false);
  const register = useCallback(() => {
    classicCountRef.current += 1;
    setClassicOn(classicCountRef.current > 0);
    return () => {
      classicCountRef.current -= 1;
      setClassicOn(classicCountRef.current > 0);
    };
  }, []);
  const chromeValue = useMemo(() => ({ register }), [register]);

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
      <NavExtrasProvider>
      <ClassicChromeContext.Provider value={chromeValue}>
      <div
        className={`${styles.shell} ${classicOn ? styles.classicChrome : ''}`}
      >
        <UpdatePrompt />
        {/* Desktop-redesign header; AppLayout.module.css shows exactly
            one of the two headers per breakpoint. */}
        <div className={styles.desktopHeader}>
          <DesktopNav />
        </div>
        <header className={styles.header}>
          <div className={styles.headerInner}>
            <NavLink to="/" className={styles.wordmark}>
              PokerGrid
            </NavLink>
            <nav className={styles.nav} aria-label="Primary">
              {NAV_ITEMS.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    isActive
                      ? `${styles.navLink} ${styles.navLinkActive}`
                      : styles.navLink
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
        </header>
        <main className={styles.main}>
          <Outlet />
        </main>
      </div>
      {/* Reset scroll to the top on navigation (and restore it on
          back/forward) — without this, deep pages like the bonus card
          reference open mid-scroll. */}
      <ScrollRestoration />
      </ClassicChromeContext.Provider>
      </NavExtrasProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
