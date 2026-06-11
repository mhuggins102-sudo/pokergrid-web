import { useState } from 'react';
import { Link } from 'react-router';
import { markTutorialSeen, tutorialSeen } from '../tutorial/tutorialSeen';
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
    to: '/targets',
    title: 'Targets Up',
    blurb: 'Climb the ladder — the target rises every level.',
  },
  {
    to: '/challenges',
    title: 'Challenges',
    blurb: 'Twisted rule sets: Gridlock, Mixed Bag, Three Tricks…',
  },
];

export function HomePage() {
  // First-visit callout; "No thanks" suppresses it for good (the
  // tutorial stays reachable from Rules and Settings).
  const [showIntro, setShowIntro] = useState(() => !tutorialSeen());

  return (
    <section className={styles.wrap}>
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
      </div>
      {!showIntro && (
        <p className={`text-label ${styles.tutorialLink}`}>
          New here? <Link to="/tutorial">Take the interactive tutorial</Link>.
        </p>
      )}
    </section>
  );
}
