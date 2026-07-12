import { useEffect } from 'react';
import { Outlet, ScrollRestoration } from 'react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../design/primitives';
import { bootDailySync, queryClient } from '../features/daily/sync/sync';
import { useSyncDailyAchievements } from '../features/progress/useSyncDailyAchievements';
import { useApplyTheme } from '../features/settings/useTheme';
import { UpdatePrompt } from './UpdatePrompt';
import { DesktopNav, NavExtrasProvider } from './DesktopNav';
import styles from './AppLayout.module.css';

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
      <NavExtrasProvider>
      <div className={styles.shell}>
        <UpdatePrompt />
        {/* THE header at every tier: DesktopNav carries its own phone
            (<768), condensed-tablet, and desktop variants, and now
            serves the tablet game surfaces too (phase 5 retired the
            classic scrolling header). */}
        <div className={styles.desktopHeader}>
          <DesktopNav />
        </div>
        <main className={styles.main}>
          <Outlet />
        </main>
      </div>
      {/* Reset scroll to the top on navigation (and restore it on
          back/forward) — without this, deep pages like the bonus card
          reference open mid-scroll. */}
      <ScrollRestoration />
      </NavExtrasProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
