import { useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import styles from './UpdatePrompt.module.css';

/**
 * "New version available" banner — the web port of the original
 * StaleVersionBanner. Long-lived tabs and installed PWAs otherwise run
 * a stale bundle until their next cold navigation; this surfaces the
 * waiting service worker as soon as it's ready.
 *
 * Never auto-reloads: applying the update is a tap, so a player
 * mid-game can't lose state to an unwanted refresh. Dismiss hides it
 * for the rest of the session.
 */
export function UpdatePrompt() {
  const [dismissed, setDismissed] = useState(false);
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh || dismissed) return null;

  return (
    <div className={styles.banner} role="status">
      <span className={styles.text}>A new version of PokerGrid is ready.</span>
      <button
        type="button"
        className={styles.reload}
        onClick={() => updateServiceWorker(true)}
      >
        Reload
      </button>
      <button
        type="button"
        className={styles.dismiss}
        aria-label="Dismiss update notice"
        onClick={() => setDismissed(true)}
      >
        ✕
      </button>
    </div>
  );
}
