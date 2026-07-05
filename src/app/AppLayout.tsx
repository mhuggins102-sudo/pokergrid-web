import { useEffect } from 'react';
import { NavLink, Outlet, ScrollRestoration } from 'react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../design/primitives';
import { bootDailySync, queryClient } from '../features/daily/sync/sync';
import { useSyncDailyAchievements } from '../features/progress/useSyncDailyAchievements';
import { useApplyTheme } from '../features/settings/useTheme';
import { UpdatePrompt } from './UpdatePrompt';
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

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
      <div className={styles.shell}>
        <UpdatePrompt />
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
      </ToastProvider>
    </QueryClientProvider>
  );
}
