import { useState } from 'react';
import { Link } from 'react-router';
import { CHALLENGES, ChallengeId } from '../../game/challenges';
import { useTier } from '../../app/useTier';
import { useStatsStore } from '../progress/statsStore';
import styles from './ChallengesPage.module.css';

/*
 * The challenge catalog at every tier (phase 3 convergence), per
 * design-refs/desktop/Challenges.dc.html: header + progress bar, then
 * a grid of cards (two columns, one on phones) — number square, name,
 * warn-toned twist synopsis, ✓ Beaten / Open badge, full goal copy,
 * and a Target / Play footer whose Play button surfaces on hover
 * (always visible on touch / keyboard focus).
 *
 * Phone (density pass): cards collapse to the number + name + synopsis
 * + badge; tapping a card expands it in place to reveal the goal copy
 * and the Target / Play footer. ≥768 keeps the always-expanded cards.
 */

export function ChallengesPage() {
  const done = useStatsStore(s => s.stats.challengesDone);
  const doneCount = CHALLENGES.filter(c => done.includes(c.id)).length;
  const pct = Math.round((doneCount / CHALLENGES.length) * 100);
  const isPhone = useTier() === 'phone';
  // Phone-only per-card expansion — single-open (opening one closes any
  // other), so the list never grows into a long scroll of open cards.
  const [openId, setOpenId] = useState<ChallengeId | null>(null);
  const toggle = (id: ChallengeId) =>
    setOpenId(cur => (cur === id ? null : id));

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
          const isOpen = openId === challenge.id;

          const head = (
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
              {/* Beaten cards keep their ✓ badge at every tier. The old
                  "Open" badge (a relic of the retired unlock system) is
                  dropped at phone so the synopsis can run full width;
                  ≥768 still shows it. */}
              {(isDone || !isPhone) && (
                <span
                  className={`${styles.badge} ${isDone ? styles.badgeDone : ''}`}
                >
                  {isDone ? '✓ Beaten' : 'Open'}
                </span>
              )}
            </div>
          );

          const body = (
            <>
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
            </>
          );

          if (isPhone) {
            return (
              <article
                key={challenge.id}
                className={`${styles.card} ${isOpen ? styles.cardOpen : ''}`}
              >
                <button
                  type="button"
                  className={styles.cardToggle}
                  aria-expanded={isOpen}
                  onClick={e => {
                    const willOpen = !isOpen;
                    const article = e.currentTarget.closest('article');
                    toggle(challenge.id);
                    // A card expanded near the bottom can run off-screen;
                    // once the body has rendered, pull the whole card into
                    // view. block:'nearest' is a no-op when it already fits.
                    if (willOpen && article) {
                      requestAnimationFrame(() => {
                        try {
                          article.scrollIntoView({
                            behavior: 'smooth',
                            block: 'nearest',
                          });
                        } catch {
                          /* jsdom / unsupported env — non-essential */
                        }
                      });
                    }
                  }}
                >
                  {head}
                </button>
                {isOpen && body}
              </article>
            );
          }

          return (
            <article key={challenge.id} className={styles.card}>
              {head}
              {body}
            </article>
          );
        })}
      </div>
    </div>
  );
}
