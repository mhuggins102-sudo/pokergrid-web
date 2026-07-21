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
 * Heal the stale service-worker state, then reload.
 *
 * FIRST CHOICE — pull a fresh worker: registration.update() fetches
 * sw.js over the network, BYPASSING the HTTP/edge caches that can keep
 * handing back the previous build's worker (the loop's root: a stale
 * worker re-poisons the client no matter how many times the page
 * itself reloads fresh). If a new build's worker installs, it
 * skip-waits into control and the reload below boots straight into it
 * — caches intact, convergence in one cycle.
 *
 * FALLBACK — purge: no newer worker exists (or update failed), so the
 * breakage is local. Unregister the worker and clear Cache Storage;
 * the reload then navigates with NO controller and pulls the fresh
 * index.html + live chunks straight from the network; vite-plugin-pwa
 * re-registers a worker that precaches the current build. Best-effort:
 * any step can reject (private mode, denied storage) — we reload
 * regardless, which is still better than the stale-worker loop.
 */
const dropStaleWorkerAndReload = async (): Promise<void> => {
  try {
    // Capped: a hung storage API (observed as the spinner sitting
    // forever on iOS) must not stall the recovery — after 4s the
    // reload goes ahead with whatever healing completed.
    await Promise.race([
      (async () => {
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          const updated = await Promise.all(
            regs.map(r =>
              r
                .update()
                .then(() => !!(r.installing || r.waiting))
                .catch(() => false)
            )
          );
          if (updated.some(Boolean)) {
            // A fresh worker is installing — give it a beat toward
            // activation (it skip-waits), then reload into it. Leave
            // the caches alone: its precache is mid-build.
            await new Promise(resolve => setTimeout(resolve, 1500));
            return;
          }
          await Promise.all(regs.map(r => r.unregister()));
        }
        if ('caches' in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map(k => caches.delete(k)));
        }
      })(),
      new Promise<void>(resolve => setTimeout(resolve, 4000)),
    ]);
  } catch {
    // best effort — fall through to the reload
  }
  bustReload();
};

/**
 * Router-level error surface. Its main job is the stale-deploy
 * self-heal: a chunk-load failure shows ONLY the quiet "Updating…"
 * spinner and keeps retrying the recovery on its own — drop the stale
 * worker + caches, cache-busted reload, and if the page is somehow
 * still here (offline, hung network, another stale layer) try again,
 * paced at least 15s apart so a persistently broken device calmly
 * retries instead of flash-looping. There is deliberately NO manual
 * Reload button on this path — the player never has anything to do.
 * Non-update errors (a genuine crash) keep the friendly reload/home
 * card instead of React Router's developer error page.
 *
 * Styled inline with token fallbacks: when this renders, the
 * stylesheet may be exactly what failed to load.
 */
export function RouteError() {
  const error = useRouteError();

  const stale = isChunkLoadError(error);
  // Perpetual paced self-heal. Each attempt normally tears this page
  // down (the recovery navigates); reaching the timer again means the
  // navigation didn't happen or the reborn page failed straight back
  // into this boundary — wait out the remainder of the 15s pace and go
  // again. sessionStorage carries the pace across the reloads.
  useEffect(() => {
    if (!stale) return;
    let cancelled = false;
    let timer: number;
    const arm = () => {
      if (cancelled) return;
      const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
      const wait = Math.max(0, 15_000 - (Date.now() - last));
      timer = window.setTimeout(() => {
        if (cancelled) return;
        sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
        void dropStaleWorkerAndReload();
        arm();
      }, wait);
    };
    arm();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [stale]);
  // After ~20s of not converging, add a reassurance line (still no
  // controls — the retries keep running underneath).
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!stale) return;
    const t = window.setTimeout(() => setSlow(true), 20_000);
    return () => window.clearTimeout(t);
  }, [stale]);
  const quiet = stale;

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
          {quiet ? 'Updating PokerGrid…' : 'Something went wrong'}
        </h1>
        <p style={{ fontSize: 14, lineHeight: 1.5, margin: 0, opacity: 0.8 }}>
          {quiet
            ? 'Grabbing the newest version — one moment. Your saved games and stats are safe.'
            : 'An unexpected error interrupted the page. Reloading usually clears it — your saved games and stats are safe.'}
        </p>
        {quiet && slow && (
          <p
            style={{
              fontSize: 13,
              lineHeight: 1.5,
              margin: '12px 0 0',
              opacity: 0.65,
            }}
          >
            Still working — if this persists, check your connection. It will
            keep retrying on its own.
          </p>
        )}
        {!quiet && (
          <>
            <button
              type="button"
              style={button}
              onClick={() => {
                sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
                bustReload();
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
