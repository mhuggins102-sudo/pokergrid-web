import { useState } from 'react';
import { Link } from 'react-router';
import { useStatsStore } from '../progress/statsStore';
import { countDailyWins } from '../daily/dailyWinsLite';
import { markTutorialSeen, tutorialSeen } from '../tutorial/tutorialSeen';
import { useTier } from '../../app/useTier';
import { DesktopHome } from './DesktopHome';
import styles from './HomePage.module.css';

const TILES = [
  {
    to: '/daily',
    title: 'Daily Puzzle',
    blurb: 'One seeded deal a day, shared leaderboard.',
  },
  {
    to: '/play',
    title: 'Free Play',
    blurb: 'Unlimited games across four difficulties.',
  },
  {
    to: '/challenges',
    title: 'Challenges',
    blurb: 'Twisted rule sets: Gridlock, Mixed Bag, Three Tricks…',
  },
  {
    to: '/targets',
    title: 'Targets Up',
    blurb: 'Climb the ladder — the target rises every level.',
  },
];

export function HomePage() {
  // Non-phone tiers (≥768px) render the desktop-redesign landing page
  // INSTEAD of the phone tile list (same JSX-fork pattern as
  // GameScreen) — on phones nothing changes.
  const tier = useTier();
  // First-visit callout; "No thanks" suppresses it for good (the
  // tutorial stays reachable from Rules and Settings).
  const [showIntro, setShowIntro] = useState(() => !tutorialSeen());
  // The stats/achievements tiles mirror the original home cards: a
  // running count once there is one. (statsStore is light — type-only
  // game imports — so home stays out of the engine chunk.)
  // Free-play wins (reactive) + daily wins (read once from storage, so
  // Home stays off the engine chunk). Snapshot refreshes whenever Home
  // remounts, e.g. after returning from a daily.
  const freeWins = useStatsStore(s => s.stats.wins);
  const [dailyWins] = useState(() => countDailyWins());
  const wins = freeWins + dailyWins;
  const earned = useStatsStore(s => s.stats.achievementsDone.length);

  if (tier !== 'phone') return <DesktopHome />;

  return (
    <section className={styles.wrap}>
      {/* Redundant with the top nav on purpose — quick reach for the
          two "help me" pages from the landing screen. */}
      <nav className={styles.quickLinks} aria-label="Rules and settings">
        <Link
          to="/rules"
          className={styles.quickLink}
          aria-label="Rules"
          title="Rules"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </Link>
        <Link
          to="/settings"
          className={styles.quickLink}
          aria-label="Settings"
          title="Settings"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </Link>
      </nav>
      <header className={styles.hero}>
        <h1 className={`text-hero ${styles.heroTitle}`}>PokerGrid</h1>
        <p className={`text-body ${styles.tagline}`}>
          Place 25 cards. Build ten poker hands at once. Beat the target.
        </p>
      </header>
      {showIntro && (
        <div className={styles.intro}>
          <div className={styles.introText}>
            <span className={styles.introTitle}>First time here?</span>
            <span className={`text-label ${styles.introBlurb}`}>
              Learn by playing — a guided practice deal walks you through
              every move in about three minutes.
            </span>
          </div>
          <div className={styles.introActions}>
            <Link to="/tutorial" className={styles.introStart}>
              Start the tutorial
            </Link>
            <button
              type="button"
              className={styles.introDismiss}
              onClick={() => {
                markTutorialSeen();
                setShowIntro(false);
              }}
            >
              No thanks
            </button>
          </div>
        </div>
      )}
      <div className={styles.tiles}>
        {TILES.map(t => (
          <Link key={t.to} to={t.to} className={styles.tile}>
            <span className={styles.tileTitle}>{t.title}</span>
            <span className={`text-label ${styles.tileBlurb}`}>{t.blurb}</span>
          </Link>
        ))}
        <Link to="/stats" className={styles.tile}>
          <span className={styles.tileTitle}>Stats</span>
          <span className={`text-label ${styles.tileBlurb}`}>
            {wins > 0
              ? `${wins} win${wins === 1 ? '' : 's'} — records and tiers per difficulty.`
              : 'Your records and tiers, per difficulty.'}
          </span>
        </Link>
        <Link to="/achievements" className={styles.tile}>
          <span className={styles.tileTitle}>Achievements</span>
          <span className={`text-label ${styles.tileBlurb}`}>
            {earned > 0
              ? `${earned} earned — quiet goals that unlock as you play.`
              : 'Quiet goals that unlock as you play.'}
          </span>
        </Link>
      </div>
      {!showIntro && (
        <p className={`text-label ${styles.tutorialLink}`}>
          New here? <Link to="/tutorial">Take the interactive tutorial</Link>.
        </p>
      )}
    </section>
  );
}
