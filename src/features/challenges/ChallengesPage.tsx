import { useState } from 'react';
import { Link } from 'react-router';
import { CHALLENGES, ChallengeId } from '../../game/challenges';
import { Button, Chevron } from '../../design/primitives';
import { useStatsStore } from '../progress/statsStore';
import { useIsDesktop } from '../game/useIsDesktop';
import { ChallengesDesk } from './ChallengesDesk';
import styles from './ChallengesPage.module.css';

/**
 * Challenge catalog. Every challenge is open from the start — beaten
 * ones stay marked so the list doubles as a progress sheet. The long
 * goal copy is collapsed behind an accordion: tapping anywhere on a
 * card (except Start) expands it, one card at a time.
 */
export function ChallengesPage() {
  const done = useStatsStore(s => s.stats.challengesDone);
  const [expanded, setExpanded] = useState<ChallengeId | null>(null);
  // ≥1024px renders the desktop-redesign catalog INSTEAD of the phone
  // accordion (same JSX-fork pattern as HomePage) — below the
  // breakpoint nothing changes.
  const isDesktop = useIsDesktop();
  if (isDesktop) return <ChallengesDesk />;

  return (
    <section className={styles.wrap}>
      <header>
        <h1 className="text-title">Challenges</h1>
        <p className="text-body" style={{ color: 'var(--ink-2)' }}>
          Twisted puzzles on the Hard ruleset, ordered from simplest to
          most complex. Tap any card for the full rules.
        </p>
      </header>
      <div className={styles.list}>
        {CHALLENGES.map(challenge => {
          const isDone = done.includes(challenge.id);
          const isOpen = expanded === challenge.id;
          const toggle = () =>
            setExpanded(cur => (cur === challenge.id ? null : challenge.id));
          return (
            <article
              key={challenge.id}
              className={`${styles.card} ${isDone ? styles.cardDone : ''}`}
              onClick={toggle}
            >
              <button
                type="button"
                className={styles.topRow}
                aria-expanded={isOpen}
                aria-controls={`goal-${challenge.id}`}
                // The article's onClick already toggles; swallow the
                // bubble so keyboard/AT activation doesn't double-fire.
                onClick={e => {
                  e.stopPropagation();
                  toggle();
                }}
              >
                <span className={styles.name}>{challenge.name}</span>
                <span className={styles.topRight}>
                  {isDone && (
                    <span className={`${styles.state} ${styles.done}`}>
                      ✓ Beaten
                    </span>
                  )}
                  <Chevron
                    className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`}
                  />
                </span>
              </button>
              <span className={styles.synopsis}>{challenge.synopsis}</span>
              <div
                id={`goal-${challenge.id}`}
                className={`${styles.goalWell} ${isOpen ? styles.goalWellOpen : ''}`}
              >
                <p className={styles.goal}>{challenge.goal}</p>
              </div>
              <Link
                to={`/challenges/${challenge.id}`}
                className={styles.start}
                onClick={e => e.stopPropagation()}
              >
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
