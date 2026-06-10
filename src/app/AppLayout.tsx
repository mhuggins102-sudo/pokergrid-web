import { NavLink, Outlet } from 'react-router';
import { ToastProvider } from '../design/primitives';
import styles from './AppLayout.module.css';

const NAV_ITEMS = [
  { to: '/daily', label: 'Daily' },
  { to: '/play', label: 'Free Play' },
  { to: '/targets', label: 'Targets Up' },
  { to: '/challenges', label: 'Challenges' },
  { to: '/stats', label: 'Stats' },
  { to: '/rules', label: 'Rules' },
  { to: '/settings', label: 'Settings' },
];

export function AppLayout() {
  return (
    <ToastProvider>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div className={styles.headerInner}>
            <NavLink to="/" className={styles.wordmark}>
              PokerGrid
            </NavLink>
            <nav className={styles.nav} aria-label="Primary">
              {NAV_ITEMS.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    isActive
                      ? `${styles.navLink} ${styles.navLinkActive}`
                      : styles.navLink
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
        </header>
        <main className={styles.main}>
          <Outlet />
        </main>
      </div>
    </ToastProvider>
  );
}
