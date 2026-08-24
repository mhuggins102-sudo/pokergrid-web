import {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import { NavLink, useLocation } from 'react-router';
import { currentDateISO } from '../game/daily/seed';
import { Chevron, Drawer, useTapPopover } from '../design/primitives';
import { SKIN_CATALOG, skinName, skinUnlocked } from '../design/skinCatalog';
import { usePlayerLevel } from '../features/progress/usePlayerLevel';
import { useHandle } from '../features/daily/sync/handleStore';
import { DOCK_LAYOUT_LABEL } from '../features/settings/DockLayoutPreview';
import {
  DockLayout,
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
 * Phone (<768): a single header row — wordmark + page label on the
 * left, a hamburger in the top-right corner (the old ◐ slot; ◐ and the
 * in-game HOME icon are gone on phones). The hamburger opens the nav
 * DRAWER from the right: the flat mode + page links, with a quick-
 * settings grid pinned at the bottom (theme / light-dark / dock / deck
 * skin cyclers plus Line-totals + Sound toggles — restyle mid-game
 * without leaving the run). The `.center` nav is display:none on
 * phones; the dateline stays desk-only.
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
 *  component's lifetime. Layout effect, not effect: the teleported
 *  node must land in the SAME pre-paint pass as the page's own mount,
 *  or the first painted frame lacks it and the header visibly grows a
 *  frame later (the archive-revisit "board slides down" jank). */
export function useNavExtras(node: ReactNode): void {
  const ctx = useContext(NavExtrasContext);
  const setExtras = ctx?.setExtras;
  useLayoutEffect(() => {
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
  useLayoutEffect(() => {
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

// Drawer quick-action cycle order for the theme family.
const FAMILY_CYCLE: ThemeFamily[] = ['paper', 'card-room', 'draft'];

// Drawer quick-action cycle order for the dock layout.
const DOCK_CYCLE: DockLayout[] = [
  'classic',
  'hand-stack',
  'center-stage',
  'desktop',
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
  // game has pushed one. When present the phone header (<768) gains it
  // as a second grid row; ≥768 it's display:none and the center nav
  // shows normally.
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

  // Phone nav drawer (the top-right hamburger). A Dialog, so it is NOT
  // in the TapPopover registry — close it on route change ourselves
  // (link taps also close, covering same-route taps).
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => setMenuOpen(false), [pathname]);

  // ◐ flips light↔dark within the chosen family. Explicit appearance
  // (not 'system') so the click always visibly does something. Shared
  // by the ≥768 header toggle and the drawer's quick-action icon.
  const settings = useSettingsStore();
  const resolved = useResolvedTheme();
  const toggleAppearance = () =>
    settings.set({
      appearance: resolved.endsWith('-dark') ? 'light' : 'dark',
    });

  // Drawer quick actions: the deck-skin cycle order — Default + every
  // unlocked design (group entries unlock all their skins together).
  // The level info + handle feed the drawer ident and its
  // progress-to-next-level popover (hover on fine pointers, tap on
  // touch — the union pattern).
  const { level, xp, atMax, xpIntoLevel, levelSpan, progress } =
    usePlayerLevel();
  const handle = useHandle();
  const identTap = useTapPopover('drawer-ident');
  const [identHover, setIdentHover] = useState(false);
  const identOpen = identHover || identTap.open;
  // The tap-opened progress popover is a glance, not a mode: it
  // dismisses itself after a beat (the drawer stays open), and tapping
  // the ident again toggles it closed. Hover-open (fine pointers)
  // closes on mouse-out as usual, so no timer there.
  useEffect(() => {
    if (!identTap.open) return;
    const t = window.setTimeout(identTap.close, 2500);
    return () => window.clearTimeout(t);
  }, [identTap.open, identTap.close]);
  const skinCycle = useMemo(() => {
    const order: (string | null)[] = [null];
    for (const u of SKIN_CATALOG) {
      if (!skinUnlocked(u.skinIds[0], level)) continue;
      order.push(...u.skinIds);
    }
    return order;
  }, [level]);
  const cycleSkin = () => {
    const i = skinCycle.indexOf(settings.deckSkin);
    settings.set({ deckSkin: skinCycle[(i + 1) % skinCycle.length] });
  };
  const skinLabel = settings.deckSkin ? skinName(settings.deckSkin) : 'Default';
  const appearanceLabel =
    settings.appearance === 'system'
      ? 'System'
      : settings.appearance === 'dark'
        ? 'Dark'
        : 'Light';
  const familyLabel =
    settings.themeFamily === 'paper'
      ? 'Paper'
      : settings.themeFamily === 'draft'
        ? 'Drafting'
        : 'Card Room';
  const cycleFamily = () => {
    const i = FAMILY_CYCLE.indexOf(settings.themeFamily);
    settings.set({
      themeFamily: FAMILY_CYCLE[(i + 1) % FAMILY_CYCLE.length],
    });
  };
  const cycleDock = () => {
    const i = DOCK_CYCLE.indexOf(settings.dockLayout);
    settings.set({ dockLayout: DOCK_CYCLE[(i + 1) % DOCK_CYCLE.length] });
  };
  const dockLabel = DOCK_LAYOUT_LABEL[settings.dockLayout];

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
            Game Modes{' '}
            <span className={styles.caret}>
              <Chevron size={12} />
            </span>
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
        {/* Phone-only hamburger in the corner slot (the old ◐ position;
            ◐ itself is phone-hidden — its flip lives in the drawer's
            quick actions). Visible in-game so those quick actions stay
            reachable mid-run; exiting home is the wordmark's job. */}
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

      {/* Phone nav drawer (headerless — Esc / scrim tap close it; the
          title still labels the dialog for a11y). Links close it; the
          quick-action icons cycle their setting and keep it open so the
          effect shows live behind the scrim. */}
      <Drawer
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        title="Menu"
        hideHeader
      >
        {/* Player ident above the nav, IN flow so the link rows below
            can't run beneath it. Screen name only when one is saved;
            the level and XP lines always (XP echoing the result
            popup's warm +XP styling). Pressing anywhere on it reveals
            progress to the next level. */}
        {/* Hover/focus open only on FINE pointers: touch browsers
            emulate mouseenter on tap, which would pin the popover open
            past the toggle (a second tap could never close it). */}
        <div
          ref={identTap.wrapRef}
          className={`${styles.drawerIdent} ${
            identOpen ? styles.drawerIdentOpen : ''
          }`}
          onMouseEnter={() => {
            if (!identTap.coarse) setIdentHover(true);
          }}
          onMouseLeave={() => setIdentHover(false)}
          onFocus={() => {
            if (!identTap.coarse) setIdentHover(true);
          }}
          onBlur={e => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
              setIdentHover(false);
            }
          }}
        >
          <button
            type="button"
            className={styles.drawerIdentBtn}
            aria-describedby="drawer-ident-pop"
            {...identTap.toggleProps}
          >
            {handle && <span className={styles.drawerIdentName}>{handle}</span>}
            <span className={styles.drawerIdentLevel}>Level {level}</span>
            <span className={styles.drawerIdentXp}>
              {xp.toLocaleString()} XP
            </span>
          </button>
          {/* Progress to the next level — the SkinStore header's
              level bar in miniature. */}
          <div
            className={styles.drawerIdentPop}
            role="tooltip"
            id="drawer-ident-pop"
          >
            <div className={styles.drawerIdentPopRow}>
              <span className={styles.drawerIdentPopLevel}>
                Level {level}
              </span>
              <span className={styles.drawerIdentPopXp}>
                {atMax || levelSpan == null
                  ? 'Max level'
                  : `${xpIntoLevel.toLocaleString()} / ${levelSpan.toLocaleString()} XP`}
              </span>
            </div>
            <div className={styles.drawerIdentTrack}>
              <div
                className={styles.drawerIdentFill}
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
            {!atMax && levelSpan != null && (
              <div className={styles.drawerIdentPopNext}>
                {(levelSpan - xpIntoLevel).toLocaleString()} XP to Level{' '}
                {level + 1}
              </div>
            )}
          </div>
        </div>
        {/* No current-page highlight on the links (NavLink still marks
            the active page via aria-current). */}
        <nav className={styles.drawerNav} aria-label="Menu">
          <span className={styles.drawerGroupLabel}>Game modes</span>
          {MODES.map(m => (
            <NavLink
              key={m.to}
              to={m.to}
              className={styles.drawerLink}
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
              className={styles.drawerLink}
              onClick={() => setMenuOpen(false)}
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
        {/* Quick settings, pinned to the drawer's bottom: a 2×2 icon
            grid — theme / light-dark over dock / deck skin. Taps cycle
            the value in place; the drawer stays open. */}
        <div className={styles.drawerFoot}>
          <div className={styles.drawerQuick}>
            <button
              type="button"
              className={styles.drawerQuickBtn}
              aria-label={`Theme: ${familyLabel} — tap to cycle`}
              onClick={cycleFamily}
            >
              <svg
                className={styles.drawerQuickIcon}
                viewBox="0 0 24 24"
                width="19"
                height="19"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="4" y="4" width="7" height="7" rx="1.5" />
                <rect x="13.5" y="4" width="7" height="7" rx="1.5" />
                <rect x="4" y="13.5" width="7" height="7" rx="1.5" />
                <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
              </svg>
              <span className={styles.drawerQuickCaption}>{familyLabel}</span>
            </button>
            <button
              type="button"
              className={styles.drawerQuickBtn}
              aria-label={`Light or dark: ${appearanceLabel} — tap to switch`}
              onClick={toggleAppearance}
            >
              <span className={styles.drawerQuickGlyph} aria-hidden="true">
                ◐
              </span>
              <span className={styles.drawerQuickCaption}>
                {appearanceLabel}
              </span>
            </button>
            <button
              type="button"
              className={styles.drawerQuickBtn}
              aria-label={`Dock layout: ${dockLabel} — tap to cycle`}
              onClick={cycleDock}
            >
              <svg
                className={styles.drawerQuickIcon}
                viewBox="0 0 24 24"
                width="19"
                height="19"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {/* Screen with a docked bottom band. */}
                <rect x="4" y="4" width="16" height="16" rx="2" />
                <line x1="4" y1="14.5" x2="20" y2="14.5" />
              </svg>
              <span className={styles.drawerQuickCaption}>{dockLabel}</span>
            </button>
            <button
              type="button"
              className={styles.drawerQuickBtn}
              aria-label={`Deck skin: ${skinLabel} — tap to cycle`}
              onClick={cycleSkin}
            >
              <svg
                className={styles.drawerQuickIcon}
                viewBox="0 0 24 24"
                width="19"
                height="19"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {/* Card back — the deck's artwork: a single SQUARE card
                    (PokerGrid's cards are square) showing its decorated
                    back (inset inner frame). Deliberately NOT a fan,
                    which now belongs to the Hands icon. */}
                <rect x="5" y="5" width="14" height="14" rx="2" />
                <rect x="8.5" y="8.5" width="7" height="7" rx="1" />
              </svg>
              <span className={styles.drawerQuickCaption}>{skinLabel}</span>
            </button>
            <button
              type="button"
              className={styles.drawerQuickBtn}
              aria-label={`Line totals: ${
                settings.lineRails ? 'On' : 'Off'
              } — tap to switch`}
              onClick={() => settings.set({ lineRails: !settings.lineRails })}
            >
              <svg
                className={styles.drawerQuickIcon}
                viewBox="0 0 24 24"
                width="19"
                height="19"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {/* Board square with the line-total rails riding its
                    right + bottom edges. */}
                <rect x="4" y="4" width="12" height="12" rx="2" />
                <line x1="19.5" y1="6" x2="19.5" y2="14" />
                <line x1="6" y1="19.5" x2="14" y2="19.5" />
              </svg>
              <span className={styles.drawerQuickCaption}>
                Rails {settings.lineRails ? 'on' : 'off'}
              </span>
            </button>
            <button
              type="button"
              className={styles.drawerQuickBtn}
              aria-label={`Sound: ${
                settings.sounds ? 'On' : 'Off'
              } — tap to switch`}
              onClick={() => settings.set({ sounds: !settings.sounds })}
            >
              <svg
                className={styles.drawerQuickIcon}
                viewBox="0 0 24 24"
                width="19"
                height="19"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {/* Speaker; waves when on, an × when muted. */}
                <path d="M5 9.5v5h3l4 3.5v-12L8 9.5z" />
                {settings.sounds ? (
                  <>
                    <path d="M15.5 9.5a3.6 3.6 0 0 1 0 5" />
                    <path d="M17.8 7.5a6.6 6.6 0 0 1 0 9" />
                  </>
                ) : (
                  <>
                    <line x1="15.5" y1="10" x2="19.5" y2="14" />
                    <line x1="19.5" y1="10" x2="15.5" y2="14" />
                  </>
                )}
              </svg>
              <span className={styles.drawerQuickCaption}>
                Sound {settings.sounds ? 'on' : 'off'}
              </span>
            </button>
          </div>
        </div>
      </Drawer>
    </header>
  );
}
