import { Link } from 'react-router';
import { CHALLENGES } from '../../game/challenges';
import { Button } from '../../design/primitives';
import { useStatsStore } from '../progress/statsStore';
import styles from './ChallengesPage.module.css';

/**
 * Challenge catalog. Gate ported from the original ChallengesScreen:
 * the first two unbeaten challenges are open; beating one unlocks the
 * next in sequence.
 */
export function ChallengesPage() {
  const done = useStatsStore(s => s.stats.challengesDone);

  let openBudget = 2;
  const rows = CHALLENGES.map(c => {
    const isDone = done.includes(c.id);
    let unlocked = true;
    if (!isDone) {
      unlocked = openBudget > 0;
      if (unlocked) openBudget--;
    }
    return { challenge: c, isDone, unlocked };
  });

  return (
    <section className={styles.wrap}>
      <header>
        <h1 className="text-title">Challenges</h1>
        <p className="text-body" style={{ color: 'var(--ink-2)' }}>
          Twisted rule sets on the Hard ruleset — no undos. Beat one to
          unlock the next.
        </p>
      </header>
      <div className={styles.list}>
        {rows.map(({ challenge, isDone, unlocked }) => (
          <article
            key={challenge.id}
            className={`${styles.card} ${unlocked ? '' : styles.cardLocked}`}
          >
            <div className={styles.topRow}>
              <span className={styles.name}>{challenge.name}</span>
              {isDone ? (
                <span className={`${styles.state} ${styles.done}`}>✓ Beaten</span>
              ) : !unlocked ? (
                <span className={`${styles.state} ${styles.locked}`}>Locked</span>
              ) : null}
            </div>
            <span className={styles.synopsis}>{challenge.synopsis}</span>
            <p className={styles.goal}>{challenge.goal}</p>
            {unlocked && (
              <Link to={`/challenges/${challenge.id}`} className={styles.start}>
                <Button variant={isDone ? 'secondary' : 'primary'} size="sm">
                  {isDone ? 'Play again' : 'Start'}
                </Button>
              </Link>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
