import { useEffect } from 'react';
import { Outlet, ScrollRestoration } from 'react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { TapPopoverProvider, ToastProvider } from '../design/primitives';
import { bootDailySync, queryClient } from '../features/daily/sync/sync';
import { useSyncDailyAchievements } from '../features/progress/useSyncDailyAchievements';
import { useApplyTheme } from '../features/settings/useTheme';
import { AutoUpdater } from './AutoUpdater';
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
      {/* Touch tap-equivalence for the hover-only popovers (decision E).
          Inside the router so it can watch route changes, and covering
          BOTH the header (pills teleport in via useNavExtras) and the
          routed pages. */}
      <TapPopoverProvider>
      <div className={styles.shell}>
        {/* Applies a new deploy automatically once no game is in progress
            (headless — no banner). */}
        <AutoUpdater />
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
      </TapPopoverProvider>
      </NavExtrasProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
