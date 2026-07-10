import { CSSProperties, useEffect } from 'react';
import { Link, useRouteError } from 'react-router';

// A redeploy replaces every hashed chunk; a tab holding the previous
// index.html then lazy-imports a chunk that no longer exists, and the
// SPA fallback answers that .js request with HTML. The failure message
// differs per engine:
//   Chrome:  "Failed to fetch dynamically imported module" /
//            "'text/html' is not a valid JavaScript MIME type"
//   Safari:  "Importing a module script failed."
//   Firefox: "error loading dynamically imported module"
const isStaleChunkError = (error: unknown): boolean => {
  const msg =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : '';
  return /dynamically imported module|module script failed|MIME type/i.test(
    msg
  );
};

const RELOAD_KEY = 'pokergrid:chunk-reload-at';

/**
 * Router-level error surface. Its main job is the stale-deploy
 * self-heal: chunk-load failures trigger ONE automatic hard reload
 * (rate-limited via sessionStorage so a persistently broken cache
 * can't reload-loop) — the fresh index.html references live chunks
 * and the app recovers without the player doing anything. Anything
 * else (or a failed heal) gets a friendly reload/home card instead
 * of React Router's developer error page.
 *
 * Styled inline with token fallbacks: when this renders, the
 * stylesheet may be exactly what failed to load.
 */
export function RouteError() {
  const error = useRouteError();

  const stale = isStaleChunkError(error);
  useEffect(() => {
    if (!stale) return;
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
    if (Date.now() - last < 15_000) return; // healed recently → show UI
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
    window.location.reload();
  }, [stale]);

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

  return (
    <div style={wrap}>
      <div style={card}>
        <h1 style={{ fontSize: 18, margin: '0 0 8px' }}>
          {stale ? 'PokerGrid just updated' : 'Something went wrong'}
        </h1>
        <p style={{ fontSize: 14, lineHeight: 1.5, margin: 0, opacity: 0.8 }}>
          {stale
            ? 'A new version was deployed while this page was open. Reloading picks it up — your saved games and stats are safe.'
            : 'An unexpected error interrupted the page. Reloading usually clears it — your saved games and stats are safe.'}
        </p>
        <button
          type="button"
          style={button}
          onClick={() => window.location.reload()}
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
      </div>
    </div>
  );
}
