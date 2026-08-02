import { ReactNode, useEffect, useRef, useState } from 'react';
import { ACHIEVEMENTS, AchievementTier } from '../../game/achievements';
import { useTier } from '../../app/useTier';
import { useStatsStore } from '../progress/statsStore';
import { Trophy } from '../challenges/Trophy';
import styles from './AchievementsPage.module.css';
import { Chevron, useTapPopover } from '../../design/primitives';

// The two trophy-counter achievements explain the medal system on
// hover (fine pointers) / tap (touch) — what earns gold, silver,
// bronze. Thresholds mirror tierForRun (lib/stats): SS ≥ 1.6× target,
// S ≥ 1.3×, A = any other win.
const MEDAL_INFO_IDS = new Set(['challenge-trophies-5', 'challenge-golds-3']);

function MedalRequirements({ id, children }: { id: string; children: ReactNode }) {
  const tap = useTapPopover(`ach-medals-${id}`);
  const [hover, setHover] = useState(false);
  const open = hover || tap.open;
  return (
    <div
      ref={tap.wrapRef}
      className={`${styles.medalInfoWrap} ${open ? styles.medalInfoOpen : ''}`}
      tabIndex={0}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={e => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setHover(false);
      }}
      {...tap.toggleProps}
    >
      {children}
      <div className={styles.medalInfoPop} role="tooltip">
        <div className={styles.medalInfoTitle}>Trophy tiers</div>
        <div className={styles.medalInfoRow}>
          <Trophy kind="gold" size={14} />
          <span>
            <b>Gold</b> — SS win: 1.6× the target or better
          </span>
        </div>
        <div className={styles.medalInfoRow}>
          <Trophy kind="silver" size={14} />
          <span>
            <b>Silver</b> — S win: 1.3× the target
          </span>
        </div>
        <div className={styles.medalInfoRow}>
          <Trophy kind="bronze" size={14} />
          <span>
            <b>Bronze</b> — any other win
          </span>
        </div>
      </div>
    </div>
  );
}

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
  {
    tier: 'easy-medium',
    label: 'Easy / Medium',
    note: 'Earned on Free Play · Easy or Medium',
  },
  {
    tier: 'hard-extreme',
    label: 'Hard / Extreme',
    note: 'Earned on Free Play · Hard or Extreme',
  },
  { tier: 'daily', label: 'Daily Puzzles', note: 'Cumulative across daily plays' },
  {
    tier: 'challenge',
    label: 'Challenges',
    note: 'Trophy goals across the Challenge catalog',
  },
  { tier: 'milestone', label: 'Milestones', note: 'Long-term goals across all modes' },
];

// SVG ring: r=15.5 → circumference ≈ 97.4.
const RING = 97.4;

// Phone: each tier is its own accordion container — the head (title +
// subtitle + earned count) is the tappable summary; the card grid is
// revealed on open. Single-open is driven by the parent; opening scrolls
// the container's head under the sticky nav.
function AchievementSection({
  open,
  onToggle,
  head,
  grid,
}: {
  open: boolean;
  onToggle: () => void;
  head: ReactNode;
  grid: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    const el = ref.current;
    if (!el) return;
    requestAnimationFrame(() => {
      try {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch {
        /* jsdom / unsupported env */
      }
    });
  }, [open]);
  return (
    <section
      ref={ref}
      className={`${styles.sectionCard} ${open ? styles.sectionCardOpen : ''}`}
    >
      <button
        type="button"
        className={styles.sectionToggle}
        aria-expanded={open}
        onClick={onToggle}
      >
        {head}
        <span className={styles.sectionCaret} aria-hidden="true">
          <Chevron size={14} />
        </span>
      </button>
      {open && grid}
    </section>
  );
}

export function AchievementsPage() {
  const done = useStatsStore(s => s.stats.achievementsDone);
  const earned = new Set(done);
  const doneCount = ACHIEVEMENTS.filter(a => earned.has(a.id)).length;
  const total = ACHIEVEMENTS.length;
  const pct = total ? doneCount / total : 0;
  const isPhone = useTier() === 'phone';
  // Phone accordion: all tiers closed on load, single-open.
  const [openTier, setOpenTier] = useState<AchievementTier | null>(null);

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
          const head = (
            <>
              <h2 className={styles.sectionTitle}>{label}</h2>
              <span className={styles.sectionNote}>{note}</span>
              <span className={styles.sectionProgress}>
                {got} / {items.length}
              </span>
            </>
          );
          const grid = (
            <div className={styles.grid}>
              {items.map(a => {
                const on = earned.has(a.id);
                const card = (
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
                return MEDAL_INFO_IDS.has(a.id) ? (
                  <MedalRequirements key={a.id} id={a.id}>
                    {card}
                  </MedalRequirements>
                ) : (
                  card
                );
              })}
            </div>
          );
          if (isPhone) {
            return (
              <AchievementSection
                key={tier}
                open={openTier === tier}
                onToggle={() =>
                  setOpenTier(cur => (cur === tier ? null : tier))
                }
                head={head}
                grid={grid}
              />
            );
          }
          return (
            <section key={tier}>
              <div className={styles.sectionHead}>{head}</div>
              {grid}
            </section>
          );
        })}
      </div>
    </div>
  );
}
