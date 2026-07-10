import {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { NavLink, useLocation } from 'react-router';
import { useSettingsStore } from '../features/settings/settingsStore';
import { useResolvedTheme } from '../features/settings/useTheme';
import styles from './DesktopNav.module.css';

/**
 * ≥1024px header from the desktop redesign: wordmark + date on the
 * left, centered links with a hover-opening "Game Modes" dropdown,
 * theme toggle (and a page-fillable extras slot — the in-game score
 * pill) on the right. Mobile keeps the classic scrolling nav; the two
 * headers swap via media queries in AppLayout.module.css.
 */

// Pages push transient nav content (score pill, etc.) through this
// context; the slot empties itself when the page unmounts.
const NavExtrasContext = createContext<{
  extras: ReactNode;
  setExtras: (n: ReactNode) => void;
} | null>(null);

export function NavExtrasProvider({ children }: { children: ReactNode }) {
  const [extras, setExtras] = useState<ReactNode>(null);
  const value = useMemo(() => ({ extras, setExtras }), [extras]);
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

// "Thu · Jul 10" — the masthead dateline next to the wordmark.
const dateline = (): string => {
  const now = new Date();
  const wk = now.toLocaleDateString('en-US', { weekday: 'short' });
  const md = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${wk} · ${md}`;
};

export function DesktopNav() {
  const ctx = useContext(NavExtrasContext);
  const { pathname } = useLocation();
  const inGameMode = MODES.some(m => pathname.startsWith(m.to));

  // ◐ flips light↔dark within the chosen family. Explicit appearance
  // (not 'system') so the click always visibly does something.
  const settings = useSettingsStore();
  const resolved = useResolvedTheme();
  const toggleAppearance = () =>
    settings.set({
      appearance: resolved.endsWith('-dark') ? 'light' : 'dark',
    });

  return (
    <header className={styles.bar}>
      <div className={styles.left}>
        <NavLink to="/" className={styles.wordmark}>
          PokerGrid
        </NavLink>
        <span className={styles.dateline}>{dateline()}</span>
      </div>
      <nav className={styles.center} aria-label="Primary">
        <div className={styles.modesWrap} tabIndex={0}>
          <span
            className={`${styles.link} ${styles.modesTrigger} ${
              inGameMode ? styles.on : ''
            }`}
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
      <div className={styles.right}>
        {ctx?.extras}
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
