import {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { NavLink, useLocation } from 'react-router';
import { useTapPopover } from '../design/primitives';
import { useSettingsStore } from '../features/settings/settingsStore';
import { useResolvedTheme } from '../features/settings/useTheme';
import styles from './DesktopNav.module.css';

/**
 * THE app header (phase 4 unification; phase 6 folded the phone row into
 * the desk center-nav). Desktop/tablet (≥768): wordmark + date on the
 * left, centered links with a "Game Modes" dropdown (hover/focus on a
 * mouse, tap-toggle on touch via TapPopover), theme toggle (and a
 * page-fillable extras slot — the in-game score pill) on the right.
 * Phone (<768): the same `.center` nav becomes the second header row
 * beneath the wordmark + ◐, and the Game Modes dropdown is now touch-
 * driven; the dateline stays desk-only.
 */

// Pages push transient nav content through this context; each slot
// empties itself when the page unmounts. Two slots:
//   • extras  — the right-hand pill cluster (desk / tablet score pill).
//   • gameRow — the streamlined game's in-game details row, which
//     REPLACES the center nav as the phone header's second row (set only
//     by the streamlined column GameScreen — see useNavGameRow).
// Exported so tests can supply a stable-value provider that captures the
// mounted node without the real provider's per-set value churn (which,
// with a fresh-identity node, act() amplifies into a render loop).
export const NavExtrasContext = createContext<{
  extras: ReactNode;
  setExtras: (n: ReactNode) => void;
  gameRow: ReactNode;
  setGameRow: (n: ReactNode) => void;
} | null>(null);

export function NavExtrasProvider({ children }: { children: ReactNode }) {
  const [extras, setExtras] = useState<ReactNode>(null);
  const [gameRow, setGameRow] = useState<ReactNode>(null);
  const value = useMemo(
    () => ({ extras, setExtras, gameRow, setGameRow }),
    [extras, gameRow]
  );
  return (
    <NavExtrasContext.Provider value={value}>
      {children}
    </NavExtrasContext.Provider>
  );
}

/** Mount `node` into the desktop nav's right-hand slot for this
 *  component's lifetime. */
export function useNavExtras(node: ReactNode): void {
  const ctx = useContext(NavExtrasContext);
  const setExtras = ctx?.setExtras;
  useEffect(() => {
    if (!setExtras) return;
    setExtras(node);
    return () => setExtras(null);
  }, [node, setExtras]);
}

/** Mount `node` as the phone header's in-game details row (row 2, in
 *  place of the center nav) for this component's lifetime. Mirrors
 *  useNavExtras exactly. The row + its HOME icon are CSS-gated to the
 *  phone tier (<768); at ≥768 the node is display:none and the center
 *  nav shows normally.
 *
 *  ONLY the streamlined column GameScreen sets this — so every
 *  non-game phone page keeps its Game Modes nav row exactly as-is (the
 *  nav-row replacement is strictly in-game). */
export function useNavGameRow(node: ReactNode): void {
  const ctx = useContext(NavExtrasContext);
  const setGameRow = ctx?.setGameRow;
  useEffect(() => {
    if (!setGameRow) return;
    setGameRow(node);
    return () => setGameRow(null);
  }, [node, setGameRow]);
}

const MODES = [
  { to: '/daily', label: 'Daily' },
  { to: '/play', label: 'Free Play' },
  { to: '/challenges', label: 'Challenges' },
  { to: '/targets', label: 'Targets Up' },
];

const LINKS = [
  { to: '/stats', label: 'Stats' },
  { to: '/achievements', label: 'Achievements' },
  { to: '/rules', label: 'Rules' },
  { to: '/settings', label: 'Settings' },
];

const fmtDateline = (d: Date): string => {
  const wk = d.toLocaleDateString('en-US', { weekday: 'short' });
  const md = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${wk} · ${md}`;
};

// The masthead dateline next to the wordmark ("Thu · Jul 10"): inside
// an archived daily it names THAT puzzle's date; the non-daily modes
// are labeled by mode (Free Play / Challenges / Targets Up — the same
// mechanism for all three); everywhere else it's today.
const dateline = (pathname: string): string => {
  const daily = /^\/daily\/(\d{4})-(\d{2})-(\d{2})$/.exec(pathname);
  if (daily) {
    // Construct from parts — new Date('YYYY-MM-DD') parses as UTC
    // midnight and shifts a day west of Greenwich.
    const [, y, m, d] = daily;
    return fmtDateline(new Date(+y, +m - 1, +d));
  }
  if (pathname.startsWith('/play')) return 'Free Play';
  if (pathname.startsWith('/challenges')) return 'Challenges';
  if (pathname.startsWith('/targets')) return 'Targets Up';
  return fmtDateline(new Date());
};

export function DesktopNav() {
  const ctx = useContext(NavExtrasContext);
  const { pathname } = useLocation();
  const inGameMode = MODES.some(m => pathname.startsWith(m.to));
  // The streamlined game's details row, if a running streamlined column
  // game has pushed one. When present the phone header (<768) swaps its
  // second row from the center nav to this row and shows a HOME icon;
  // ≥768 both are display:none and the center nav shows normally.
  const gameRow = ctx?.gameRow ?? null;
  // Selecting a menu item must CLOSE the dropdown even though the
  // pointer is still parked over it (and :focus-within would otherwise
  // pin it open) — suppressed until the pointer leaves the wrap.
  const [modesClosed, setModesClosed] = useState(false);

  // Touch (coarse pointer): hover/:focus-within can't open the Game Modes
  // menu, so tapping the trigger toggles it — the TapPopover primitive
  // (decision E) owns that behavior, plus outside-tap / Escape / route /
  // game-commit dismissal and single-open. Fine-pointer devices keep the
  // pure hover/focus CSS untouched (`open` stays false, no class, no
  // handlers there). Reuses the existing `.modesWrapOpen` open class.
  const modes = useTapPopover('nav-modes');

  // ◐ flips light↔dark within the chosen family. Explicit appearance
  // (not 'system') so the click always visibly does something.
  const settings = useSettingsStore();
  const resolved = useResolvedTheme();
  const toggleAppearance = () =>
    settings.set({
      appearance: resolved.endsWith('-dark') ? 'light' : 'dark',
    });

  return (
    <header
      className={`${styles.bar} ${gameRow ? styles.gameRowActive : ''}`}
    >
      <div className={styles.left}>
        <NavLink to="/" className={styles.wordmark}>
          PokerGrid
        </NavLink>
        <span className={styles.dateline}>{dateline(pathname)}</span>
      </div>
      <nav className={styles.center} aria-label="Primary">
        <div
          ref={modes.wrapRef}
          className={`${styles.modesWrap} ${
            modesClosed ? styles.modesWrapClosed : ''
          } ${modes.open ? styles.modesWrapOpen : ''}`}
          tabIndex={0}
          // Hover-only trigger on fine pointers: a mouse press must not
          // FOCUS the wrap (that pinned the menu open via :focus-within
          // until a click landed elsewhere) — keyboard Tab focus still
          // opens it. On coarse pointers the tap must fire a click, so
          // the preventDefault is skipped there.
          onMouseDown={e => {
            if (!modes.coarse) e.preventDefault();
          }}
          onMouseLeave={() => setModesClosed(false)}
          onFocus={() => setModesClosed(false)}
        >
          <span
            className={`${styles.link} ${styles.modesTrigger} ${
              inGameMode ? styles.on : ''
            }`}
            // Touch: tap toggles the menu (hover can't). Empty on fine
            // pointers, where hover/focus drive it.
            {...modes.toggleProps}
          >
            Game Modes <span className={styles.caret}>▾</span>
          </span>
          <div className={styles.modesMenu}>
            {MODES.map(m => (
              <NavLink
                key={m.to}
                to={m.to}
                className={({ isActive }) =>
                  `${styles.menuItem} ${isActive ? styles.menuItemOn : ''}`
                }
                onClick={() => {
                  // Close on selection: drop any focus inside the wrap
                  // (keyboard Enter) and suppress the hover-open until
                  // the pointer leaves — so the menu doesn't linger
                  // under the parked cursor, and the trigger drops any
                  // focus tint. (On coarse the navigation also fires the
                  // TapPopover route-change dismissal.) Route-based .on
                  // styling is untouched.
                  setModesClosed(true);
                  (document.activeElement as HTMLElement | null)?.blur?.();
                }}
              >
                {m.label}
              </NavLink>
            ))}
          </div>
        </div>
        {LINKS.map(l => (
          <NavLink
            key={l.to}
            to={l.to}
            className={({ isActive }) =>
              `${styles.link} ${isActive ? styles.on : ''}`
            }
          >
            {l.label}
          </NavLink>
        ))}
      </nav>
      {/* Streamlined game details row — phone header row 2, in place of
          the center nav (CSS-gated to <768; display:none ≥768). */}
      {gameRow && <div className={styles.gameRow}>{gameRow}</div>}
      <div className={styles.right}>
        {ctx?.extras}
        {gameRow && (
          <NavLink to="/" className={styles.homeBtn} aria-label="Home">
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3 11l9-7 9 7" />
              <path d="M5 10v10h14V10" />
            </svg>
          </NavLink>
        )}
        <button
          type="button"
          className={styles.themeToggle}
          title="Toggle light / dark"
          aria-label="Toggle light or dark appearance"
          onClick={toggleAppearance}
        >
          ◐
        </button>
      </div>
    </header>
  );
}
