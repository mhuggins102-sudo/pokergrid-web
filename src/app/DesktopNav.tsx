import {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { NavLink, useLocation } from 'react-router';
import { currentDateISO } from '../game/daily/seed';
import { Drawer, useTapPopover } from '../design/primitives';
import { SKIN_CATALOG, skinName, skinUnlocked } from '../design/skinCatalog';
import { usePlayerLevel } from '../features/progress/usePlayerLevel';
import {
  Appearance,
  ThemeFamily,
  useSettingsStore,
} from '../features/settings/settingsStore';
import { useResolvedTheme } from '../features/settings/useTheme';
import styles from './DesktopNav.module.css';

/**
 * THE app header (phase 4 unification; phase 6 folded the phone row into
 * the desk center-nav; phase 7 moved the phone row into a drawer).
 * Desktop/tablet (≥768): wordmark + date on the left, centered links
 * with a "Game Modes" dropdown (hover/focus on a mouse, tap-toggle on
 * touch via TapPopover), theme toggle (and a page-fillable extras slot —
 * the in-game score pill) on the right.
 * Phone (<768): a single header row — a hamburger button left of the
 * wordmark opens the nav DRAWER (flat mode + page links, plus quick
 * Display controls: appearance / theme / deck skin, so a player can
 * restyle mid-game without leaving the run). The `.center` nav is
 * display:none on phones; the dateline stays desk-only.
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

// Drawer "Display" group options (quick in-place switches — the full
// controls stay on the Settings page).
const APPEARANCES: { v: Appearance; label: string }[] = [
  { v: 'light', label: 'Light' },
  { v: 'dark', label: 'Dark' },
  { v: 'system', label: 'System' },
];

const FAMILIES: { v: ThemeFamily; label: string }[] = [
  { v: 'paper', label: 'Morning Paper' },
  { v: 'card-room', label: 'Card Room' },
];

const fmtDateline = (d: Date): string => {
  const wk = d.toLocaleDateString('en-US', { weekday: 'short' });
  const md = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${wk} · ${md}`;
};

// The masthead dateline next to the wordmark ("Thu · Jul 10"): inside
// an archived daily it names THAT puzzle's date; the non-daily modes
// are labeled by mode (Free Play / Challenges / Targets Up — the same
// mechanism for all three); everywhere else it's today. DESKTOP-scoped
// (the `.dateline` span is shown only ≥1024) — kept exactly as-is so
// the desktop header stays byte-identical; phones use `phoneLabel`.
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
  // "Today" must name the UTC date the daily is keyed on (seed.ts's
  // currentDateISO), not the device-local date — near UTC midnight a
  // local `new Date()` disagrees with the home "Today's Daily" date.
  // Build from parts like the daily-date branch above (a bare
  // new Date(iso) would re-introduce the UTC-parse day shift).
  const [y, m, d] = currentDateISO().split('-').map(Number);
  return fmtDateline(new Date(y, m - 1, d));
};

// The PHONE label beside the wordmark (the `.datelinePhone` span, shown
// only <768): every named page names itself so the header states where
// you are without the big page title (the density pass dropped those).
// Extends the desktop mapping with the four utility pages + the archive;
// home and an archived daily keep the date. Kept separate from
// `dateline` so desktop's ≥1024 header is untouched.
const phoneLabel = (pathname: string): string => {
  // Archive lives under /daily/ but names itself; order it before the
  // daily-date regex (which it wouldn't match anyway).
  if (pathname.startsWith('/daily/archive')) return 'Archive';
  if (pathname.startsWith('/stats')) return 'Stats';
  if (pathname.startsWith('/achievements')) return 'Achievements';
  if (pathname.startsWith('/rules')) return 'Rules';
  if (pathname.startsWith('/settings')) return 'Settings';
  return dateline(pathname);
};

// ---- Morning Paper broadsheet strip (desk-only, CSS-gated to the paper
// themes) — the decorative dateline above the nameplate. Always today's
// date (the edition's own dateline), built from currentDateISO parts to
// dodge the new Date('YYYY-MM-DD') UTC day-shift.
const editionDate = (): string => {
  const [y, m, d] = currentDateISO().split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
};

// A whimsical, date-derived issue number for the nameplate ("No. 563"),
// so it ticks over daily instead of sitting on a magic literal.
const editionNo = (): number => {
  const [y, m, d] = currentDateISO().split('-').map(Number);
  return (
    Math.floor((Date.UTC(y, m - 1, d) - Date.UTC(2025, 0, 1)) / 86400000) + 1
  );
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

  // Phone nav drawer (the hamburger left of the wordmark). A Dialog, so
  // it is NOT in the TapPopover registry — close it on route change
  // ourselves (link taps also close, covering same-route taps).
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => setMenuOpen(false), [pathname]);

  // Drawer Display group: the quick deck-skin chips — Default + every
  // unlocked design (group entries unlock all their skins together).
  const { level } = usePlayerLevel();
  const skinChips = useMemo(() => {
    const chips: { id: string | null; label: string }[] = [
      { id: null, label: 'Default' },
    ];
    for (const u of SKIN_CATALOG) {
      if (!skinUnlocked(u.skinIds[0], level)) continue;
      for (const id of u.skinIds) chips.push({ id, label: skinName(id) });
    }
    return chips;
  }, [level]);

  // ◐ flips light↔dark within the chosen family. Explicit appearance
  // (not 'system') so the click always visibly does something.
  const settings = useSettingsStore();
  const resolved = useResolvedTheme();
  const toggleAppearance = () =>
    settings.set({
      appearance: resolved.endsWith('-dark') ? 'light' : 'dark',
    });

  // Morning Paper's edition label follows the appearance; the strip that
  // shows it is CSS-gated to the paper themes × desktop, so this string
  // is inert in Card Room.
  const editionLabel = resolved.endsWith('-dark')
    ? 'Late Night'
    : 'Morning Edition';

  return (
    <header
      className={`${styles.bar} ${gameRow ? styles.gameRowActive : ''}`}
    >
      {/* Broadsheet dateline — desk-only, shown only in the Morning Paper
          themes (DesktopNav.module.css). Decorative, so hidden from a11y. */}
      <div className={styles.editionStrip} aria-hidden="true">
        <span>No. {editionNo()}</span>
        <span>{editionLabel}</span>
        <span>{editionDate()}</span>
      </div>
      <div className={styles.left}>
        {/* Phone-only hamburger (CSS-gated <768; stays visible in-game
            so the drawer's Display switches are reachable mid-run). */}
        <button
          type="button"
          className={styles.menuBtn}
          aria-label="Menu"
          aria-haspopup="dialog"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(true)}
        >
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="18" x2="20" y2="18" />
          </svg>
        </button>
        <NavLink to="/" className={styles.wordmark}>
          PokerGrid
        </NavLink>
        {/* Two labels, one shown per tier: the desktop dateline (≥1024)
            and the phone page-name (<768); tablet hides both. */}
        <span className={styles.dateline}>{dateline(pathname)}</span>
        <span className={styles.datelinePhone}>{phoneLabel(pathname)}</span>
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

      {/* Phone nav drawer. Links close it; the Display switches keep it
          open so their effect shows live behind the scrim. */}
      <Drawer open={menuOpen} onClose={() => setMenuOpen(false)} title="Menu">
        <nav className={styles.drawerNav} aria-label="Menu">
          <span className={styles.drawerGroupLabel}>Game modes</span>
          {MODES.map(m => (
            <NavLink
              key={m.to}
              to={m.to}
              className={({ isActive }) =>
                `${styles.drawerLink} ${isActive ? styles.drawerLinkOn : ''}`
              }
              onClick={() => setMenuOpen(false)}
            >
              {m.label}
            </NavLink>
          ))}
          <hr className={styles.drawerRule} />
          {LINKS.map(l => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `${styles.drawerLink} ${isActive ? styles.drawerLinkOn : ''}`
              }
              onClick={() => setMenuOpen(false)}
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
        <hr className={styles.drawerRule} />
        <div className={styles.drawerDisplay}>
          <span className={styles.drawerGroupLabel}>Display</span>
          <div
            className={styles.drawerSeg}
            role="group"
            aria-label="Light or dark appearance"
          >
            {APPEARANCES.map(a => (
              <button
                key={a.v}
                type="button"
                className={`${styles.drawerSegBtn} ${
                  settings.appearance === a.v ? styles.drawerSegBtnOn : ''
                }`}
                aria-pressed={settings.appearance === a.v}
                onClick={() => settings.set({ appearance: a.v })}
              >
                {a.label}
              </button>
            ))}
          </div>
          <div className={styles.drawerSeg} role="group" aria-label="Theme">
            {FAMILIES.map(f => (
              <button
                key={f.v}
                type="button"
                className={`${styles.drawerSegBtn} ${
                  settings.themeFamily === f.v ? styles.drawerSegBtnOn : ''
                }`}
                aria-pressed={settings.themeFamily === f.v}
                onClick={() => settings.set({ themeFamily: f.v })}
              >
                {f.label}
              </button>
            ))}
          </div>
          <span className={styles.drawerCtlLabel}>Deck skin</span>
          <div
            className={styles.drawerChips}
            role="group"
            aria-label="Deck skin"
          >
            {skinChips.map(c => (
              <button
                key={c.id ?? 'default'}
                type="button"
                className={`${styles.drawerChip} ${
                  settings.deckSkin === c.id ? styles.drawerChipOn : ''
                }`}
                aria-pressed={settings.deckSkin === c.id}
                onClick={() => settings.set({ deckSkin: c.id })}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </Drawer>
    </header>
  );
}
