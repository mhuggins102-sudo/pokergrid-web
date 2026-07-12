import { Link } from 'react-router';
import { CHALLENGES } from '../../game/challenges';
import { useStatsStore } from '../progress/statsStore';
import styles from './ChallengesPage.module.css';

/*
 * The challenge catalog at every tier (phase 3 convergence), per
 * design-refs/desktop/Challenges.dc.html: header + progress bar, then
 * a grid of cards (two columns, one on phones) — number square, name,
 * warn-toned twist synopsis, ✓ Beaten / Open badge, full goal copy,
 * and a Target / Play footer whose Play button surfaces on hover
 * (always visible on touch / keyboard focus).
 */

export function ChallengesPage() {
  const done = useStatsStore(s => s.stats.challengesDone);
  const doneCount = CHALLENGES.filter(c => done.includes(c.id)).length;
  const pct = Math.round((doneCount / CHALLENGES.length) * 100);

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <div>
          <div className={styles.eyebrow}>Challenges</div>
          <h1 className={styles.title}>Twisted rule sets</h1>
        </div>
        <p className={styles.lede}>
          Every challenge plays on the Hard ruleset with one rule bent. All ten
          are open from the start — clear them all for the{' '}
          <Link to="/achievements" className={styles.ledeLink}>
            Challenge Sweep
          </Link>{' '}
          milestone.
        </p>
      </div>

      <div className={styles.progress}>
        <div
          className={styles.progressTrack}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={CHALLENGES.length}
          aria-valuenow={doneCount}
          aria-label="Challenges beaten"
        >
          <div className={styles.progressFill} style={{ width: `${pct}%` }} />
        </div>
        <span className={styles.progressLabel}>
          {doneCount} of {CHALLENGES.length} beaten
        </span>
      </div>

      <div className={styles.grid}>
        {CHALLENGES.map((challenge, i) => {
          const isDone = done.includes(challenge.id);
          return (
            <article key={challenge.id} className={styles.card}>
              <div className={styles.cardTop}>
                <div className={styles.cardId}>
                  <span className={styles.num}>{i + 1}</span>
                  <div>
                    <div className={styles.name}>{challenge.name}</div>
                    <div className={styles.synopsis}>
                      <span className={styles.synopsisDot} aria-hidden="true" />
                      {challenge.synopsis.replace(/^Twist:\s*/i, '')}
                    </div>
                  </div>
                </div>
                <span
                  className={`${styles.badge} ${isDone ? styles.badgeDone : ''}`}
                >
                  {isDone ? '✓ Beaten' : 'Open'}
                </span>
              </div>
              <p className={styles.goal}>{challenge.goal}</p>
              <div className={styles.cardFoot}>
                <span className={styles.target}>
                  Target <b>{challenge.scoreTarget}</b>
                </span>
                <Link
                  to={`/challenges/${challenge.id}`}
                  className={styles.play}
                >
                  Play <span aria-hidden="true">→</span>
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
