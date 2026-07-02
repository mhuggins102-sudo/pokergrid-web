import { Link } from 'react-router';
import { CHALLENGES } from '../../game/challenges';
import { Button } from '../../design/primitives';
import { useStatsStore } from '../progress/statsStore';
import styles from './ChallengesPage.module.css';

/**
 * Challenge catalog. Every challenge is open from the start — beaten
 * ones stay marked so the list doubles as a progress sheet.
 */
export function ChallengesPage() {
  const done = useStatsStore(s => s.stats.challengesDone);

  return (
    <section className={styles.wrap}>
      <header>
        <h1 className="text-title">Challenges</h1>
        <p className="text-body" style={{ color: 'var(--ink-2)' }}>
          Twisted rule sets on the Hard ruleset — no undos. Play them in
          any order; beaten ones stay marked.
        </p>
      </header>
      <div className={styles.list}>
        {CHALLENGES.map(challenge => {
          const isDone = done.includes(challenge.id);
          return (
            <article key={challenge.id} className={styles.card}>
              <div className={styles.topRow}>
                <span className={styles.name}>{challenge.name}</span>
                {isDone && (
                  <span className={`${styles.state} ${styles.done}`}>
                    ✓ Beaten
                  </span>
                )}
              </div>
              <span className={styles.synopsis}>{challenge.synopsis}</span>
              <p className={styles.goal}>{challenge.goal}</p>
              <Link to={`/challenges/${challenge.id}`} className={styles.start}>
                <Button variant={isDone ? 'secondary' : 'primary'} size="sm">
                  {isDone ? 'Play again' : 'Start'}
                </Button>
              </Link>
            </article>
          );
        })}
      </div>
    </section>
  );
}
