import { Link } from 'react-router';
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
  return (
    <section className={styles.wrap}>
      <header className={styles.hero}>
        <h1 className={`text-hero ${styles.heroTitle}`}>PokerGrid</h1>
        <p className={`text-body ${styles.tagline}`}>
          Place 25 cards. Build ten poker hands at once. Beat the target.
        </p>
      </header>
      <div className={styles.tiles}>
        {TILES.map(t => (
          <Link key={t.to} to={t.to} className={styles.tile}>
            <span className={styles.tileTitle}>{t.title}</span>
            <span className={`text-label ${styles.tileBlurb}`}>{t.blurb}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
