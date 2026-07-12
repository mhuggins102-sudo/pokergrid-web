import { ACHIEVEMENTS, AchievementTier } from '../../game/achievements';
import { useTier } from '../../app/useTier';
import { useStatsStore } from '../progress/statsStore';
import styles from './AchievementsPage.module.css';

/*
 * The trophy case at every tier (phase 3 convergence), per
 * design-refs/desktop/Achievements.dc.html: header with the earned
 * tally + progress ring, then one section per tier — heading, note,
 * per-tier progress — over a card grid (three columns, one on phones).
 * Earned cards get the warn-toned ★ medal and border; locked ones dim
 * with an ○. Earned state comes from the real stats store.
 *
 * Phone (density pass): the eyebrow + title + tally/ring give way to a
 * Challenges-style horizontal progress bar; section heads put the
 * title (with its per-tier count) on one row and the subtitle below.
 */

const TIER_META: Array<{
  tier: AchievementTier;
  label: string;
  note: string;
}> = [
  { tier: 'easy', label: 'Easy', note: 'Earned on Free Play · Easy' },
  {
    tier: 'hard-extreme',
    label: 'Hard / Extreme',
    note: 'Earned on Free Play · Hard or Extreme',
  },
  { tier: 'daily', label: 'Daily Puzzles', note: 'Cumulative across daily plays' },
  { tier: 'milestone', label: 'Milestones', note: 'Long-term goals across all modes' },
];

// SVG ring: r=15.5 → circumference ≈ 97.4.
const RING = 97.4;

export function AchievementsPage() {
  const done = useStatsStore(s => s.stats.achievementsDone);
  const earned = new Set(done);
  const doneCount = ACHIEVEMENTS.filter(a => earned.has(a.id)).length;
  const total = ACHIEVEMENTS.length;
  const pct = total ? doneCount / total : 0;
  const isPhone = useTier() === 'phone';

  return (
    <div className={styles.wrap}>
      {isPhone ? (
        /* Phone: a Challenges-style horizontal progress bar stands in
           for the eyebrow + title + tally/ring. */
        <div className={styles.progress}>
          <div
            className={styles.progressTrack}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={doneCount}
            aria-label="Achievements earned"
          >
            <div
              className={styles.progressFill}
              style={{ width: `${Math.round(pct * 100)}%` }}
            />
          </div>
          <span className={styles.progressLabel}>
            {doneCount} of {total} earned
          </span>
        </div>
      ) : (
        <div className={styles.head}>
          <div>
            <div className={styles.eyebrow}>Achievements</div>
            <h1 className={styles.title}>The trophy case</h1>
          </div>
          <div className={styles.tally}>
            <div className={styles.tallyText}>
              <div className={styles.tallyCount}>
                {doneCount}
                <span className={styles.tallyTotal}> / {total}</span>
              </div>
              <div className={styles.tallyLabel}>earned</div>
            </div>
            <div className={styles.ring} role="img" aria-label={`${doneCount} of ${total} achievements earned`}>
              <svg viewBox="0 0 36 36" className={styles.ringSvg}>
                <circle
                  cx="18"
                  cy="18"
                  r="15.5"
                  fill="none"
                  stroke="var(--paper-sunken)"
                  strokeWidth="4"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="15.5"
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={`${(pct * RING).toFixed(1)} ${RING}`}
                />
              </svg>
            </div>
          </div>
        </div>
      )}

      <div className={styles.sections}>
        {TIER_META.map(({ tier, label, note }) => {
          const items = ACHIEVEMENTS.filter(a => a.tier === tier);
          const got = items.filter(a => earned.has(a.id)).length;
          return (
            <section key={tier}>
              <div className={styles.sectionHead}>
                <h2 className={styles.sectionTitle}>{label}</h2>
                <span className={styles.sectionNote}>{note}</span>
                <span className={styles.sectionProgress}>
                  {got} / {items.length}
                </span>
              </div>
              <div className={styles.grid}>
                {items.map(a => {
                  const on = earned.has(a.id);
                  return (
                    <div
                      key={a.id}
                      className={`${styles.card} ${on ? styles.cardOn : ''}`}
                    >
                      <div className={styles.cardInner}>
                        <span className={styles.medal} aria-hidden="true">
                          {on ? '★' : '○'}
                        </span>
                        <div className={styles.cardBody}>
                          <div className={styles.cardName}>{a.name}</div>
                          <div className={styles.cardDesc}>{a.description}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
