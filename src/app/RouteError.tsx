import { CSSProperties, useEffect, useState } from 'react';
import { Link, useRouteError } from 'react-router';

// A redeploy replaces every hashed chunk; a tab holding the previous
// index.html then lazy-imports a chunk that no longer exists (or that
// the just-activated service worker has evicted mid-swap). The failure
// message differs per engine AND per cause:
//   Chrome:  "Failed to fetch dynamically imported module" /
//            "'text/html' is not a valid JavaScript MIME type"
//   Safari:  "Importing a module script failed." — or, when the fetch
//            itself fails during the SW activation race, the generic
//            "Load failed" (which is why the update card used to slip
//            through to the non-self-healing branch).
//   Firefox: "error loading dynamically imported module" /
//            "NetworkError when attempting to fetch resource"
// Covered broadly so EVERY chunk-load failure self-heals instead of
// surfacing the scary generic card. `ChunkLoadError` is matched by name
// too (some bundlers throw it with a non-matching message).
export const isChunkLoadError = (error: unknown): boolean => {
  const msg =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : '';
  const name = error instanceof Error ? error.name : '';
  return (
    name === 'ChunkLoadError' ||
    /dynamically imported module|module script failed|importing a module script|MIME type|load failed|failed to fetch|error loading dynamically imported|unable to preload|networkerror when attempting to fetch/i.test(
      msg
    )
  );
};

const RELOAD_KEY = 'pokergrid:chunk-reload-at';

/**
 * Recovery navigation with a unique cache-buster query. A plain
 * location.reload() can be answered by an HTTP cache layer (browser,
 * carrier proxy, CDN edge) with the SAME stale index.html that just
 * failed — observed on iOS, where tapping Reload brought the update card
 * straight back with nothing changed. A never-seen query string forces
 * every layer to fetch the live document. main.tsx strips the parameter
 * on boot so it doesn't linger in the address bar.
 */
export const CACHE_BUST_PARAM = 'pgu';

const bustReload = (): void => {
  const url = new URL(window.location.href);
  url.searchParams.set(CACHE_BUST_PARAM, String(Date.now()));
  window.location.replace(url.toString());
};

/**
 * Drop the stale service worker (and its precache) before reloading.
 *
 * The chunk that failed to load is the OLD deploy's — but the page is
 * still controlled by the OLD service worker, whose precache serves the
 * stale index.html + evicted chunk map. A plain location.reload() fetches
 * right back through that worker and hits the same missing chunk, so the
 * heal never converges and the update card resurfaces once the reload
 * rate-limit lapses. Unregistering the worker (and clearing the Cache
 * Storage entries it was serving) means the reload navigates with NO
 * controller and pulls the fresh index.html + live chunks straight from
 * the network; vite-plugin-pwa then re-registers a worker that precaches
 * the NEW build. Best-effort: any step can reject (private mode, denied
 * storage) — we reload regardless, which is still better than the
 * old-worker loop.
 */
const dropStaleWorkerAndReload = async (): Promise<void> => {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
  } catch {
    // best effort — fall through to the reload
  }
  bustReload();
};

/**
 * Router-level error surface. Its main job is the stale-deploy
 * self-heal: chunk-load failures trigger ONE automatic hard reload
 * (rate-limited via sessionStorage so a persistently broken cache
 * can't reload-loop) — the stale worker is dropped first so the fresh
 * index.html references live chunks and the app recovers without the
 * player doing anything. Anything else (or a failed heal) gets a
 * friendly reload/home card instead of React Router's developer error
 * page.
 *
 * Styled inline with token fallbacks: when this renders, the
 * stylesheet may be exactly what failed to load.
 */
export function RouteError() {
  const error = useRouteError();

  const stale = isChunkLoadError(error);
  // Heal or show the manual card? Decided synchronously so the FIRST
  // paint already matches: a fresh stale-chunk failure auto-heals behind
  // a quiet "Updating…" card; a failure landing within 15s of a heal
  // (loop guard) gets the full card with the manual Reload.
  const [healing] = useState(() => {
    if (!stale) return false;
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
    return Date.now() - last >= 15_000;
  });
  useEffect(() => {
    if (!healing) return;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
    void dropStaleWorkerAndReload();
  }, [healing]);
  // If the heal hangs (offline, storage denied), reveal the manual
  // controls instead of spinning forever.
  const [healTimedOut, setHealTimedOut] = useState(false);
  useEffect(() => {
    if (!healing) return;
    const t = window.setTimeout(() => setHealTimedOut(true), 6000);
    return () => window.clearTimeout(t);
  }, [healing]);
  const quiet = healing && !healTimedOut;

  const wrap: CSSProperties = {
    minHeight: '100dvh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    background: 'var(--paper, #17150f)',
    color: 'var(--ink, #efe9d8)',
    fontFamily:
      "var(--font-body, system-ui, -apple-system, 'Segoe UI', sans-serif)",
    textAlign: 'center',
  };
  const card: CSSProperties = {
    maxWidth: 360,
    padding: '32px 24px',
    borderRadius: 14,
    background: 'var(--paper-raised, #211e17)',
    border: '1px solid var(--rule, #3a352a)',
  };
  const button: CSSProperties = {
    display: 'inline-block',
    marginTop: 20,
    padding: '12px 24px',
    borderRadius: 10,
    border: 'none',
    background: 'var(--accent, #3a8f68)',
    color: 'var(--on-accent, #ffffff)',
    font: 'inherit',
    fontWeight: 650,
    cursor: 'pointer',
  };

  const spinner: CSSProperties = {
    display: 'inline-block',
    width: 22,
    height: 22,
    marginBottom: 14,
    border: '3px solid var(--rule, #3a352a)',
    borderTopColor: 'var(--accent, #3a8f68)',
    borderRadius: '50%',
    animation: 'pg-heal-spin 800ms linear infinite',
  };

  return (
    <div style={wrap}>
      {/* Inline keyframes: when this renders, the stylesheet may be
          exactly what failed to load. */}
      <style>{'@keyframes pg-heal-spin{to{transform:rotate(360deg)}}'}</style>
      <div style={card}>
        {quiet && <span style={spinner} aria-hidden="true" />}
        <h1 style={{ fontSize: 18, margin: '0 0 8px' }}>
          {quiet
            ? 'Updating PokerGrid…'
            : stale
              ? 'PokerGrid just updated'
              : 'Something went wrong'}
        </h1>
        <p style={{ fontSize: 14, lineHeight: 1.5, margin: 0, opacity: 0.8 }}>
          {quiet
            ? 'Grabbing the newest version — one moment. Your saved games and stats are safe.'
            : stale
              ? 'A new version was deployed while this page was open. Reloading picks it up — your saved games and stats are safe.'
              : 'An unexpected error interrupted the page. Reloading usually clears it — your saved games and stats are safe.'}
        </p>
        {!quiet && (
          <>
            <button
              type="button"
              style={button}
              onClick={() => {
                // Stamp the guard so a still-broken reboot shows this
                // card immediately instead of auto-heal flash-looping.
                sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
                if (stale) void dropStaleWorkerAndReload();
                else bustReload();
              }}
            >
              Reload
            </button>
            <p style={{ marginTop: 16, marginBottom: 0 }}>
              <Link
                to="/"
                style={{ color: 'var(--accent, #3a8f68)', fontSize: 13 }}
              >
                Back to home
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
