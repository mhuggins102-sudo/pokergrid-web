import { CSSProperties } from 'react';
import { Link } from 'react-router';
import {
  TARGETS_UP_STEP,
  difficultyForLevel,
  targetForLevel,
} from '../../game/challenges';
import { difficultyColors } from '../../design/tokens';
import { targetsUpReached } from '../../lib/stats';
import { useStatsStore } from '../progress/statsStore';
import { useTargetsStore } from './targetsStore';
import styles from './TargetsPage.module.css';

/*
 * The Targets-Up entry at every tier (phase 3 convergence). No
 * Claude-Design mockup exists for this screen — it is composed from
 * the established desktop language instead:
 *
 *  - head: eyebrow / Fraunces headline / right-aligned lede
 *    (DifficultyPicker, ChallengesPage);
 *  - the ladder: a raised panel (DesktopRails .panel chrome) holding a
 *    horizontal run of level rungs — sunken tiles like the mockups'
 *    stat cells, difficulty-toned level labels like DifficultyPicker's
 *    difficulty cards, ✓-cleared / now / best states echoing
 *    ChallengesPage's beaten badges and selection borders;
 *  - the Starting/Continuing bar with the primary CTA on the right
 *    (DifficultyPicker's start bar, verbatim geometry);
 *  - two explainer cards reusing the original phone page's copy.
 */

const NAME: Record<string, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  extreme: 'Extreme',
};

/** Rung window: always at least 8, keeps the current level and the
 *  high-water mark in frame with a little headroom, and slides (with a
 *  leading ellipsis) once the ladder outgrows 12 rungs. */
const rungWindow = (level: number, best: number): number[] => {
  const end = Math.max(8, level + 3, best + 1);
  const start = end > 12 ? end - 11 : 1;
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
};

export function TargetsPage() {
  const save = useTargetsStore(s => s.save);
  const clearProgress = useTargetsStore(s => s.clearProgress);
  // Stored value = highest level BEATEN; every display shows the level
  // REACHED (beaten + 1) — beating L3 put you on L4.
  const best = targetsUpReached(useStatsStore(s => s.stats.targetsUpBest));

  const level = save?.level ?? 1;
  const target = targetForLevel(level);
  const difficulty = difficultyForLevel(level);
  const tone = difficultyColors[difficulty];
  const carries =
    (save?.deckExtras?.length ?? 0) + (save?.superchargedDeckCards?.length ?? 0);

  const rungs = rungWindow(level, best);

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <div>
          <div className={styles.eyebrow}>Targets Up</div>
          <h1 className={styles.title}>Climb the ladder</h1>
        </div>
        <p className={styles.lede}>
          One long run of full games. Beat the target and the next level asks
          for {TARGETS_UP_STEP} more — the ruleset stiffens as you climb. One
          loss ends the run.
        </p>
      </div>

      <section className={styles.ladder} aria-label="The ladder">
        <div className={styles.ladderHead}>
          <span className={styles.ladderTitle}>The ladder</span>
          <span className={styles.ladderNote}>
            {best > 0 ? `Best level reached · L${best}` : 'Every climb starts at L1'}
          </span>
        </div>
        <div className={styles.rungs}>
          {rungs[0] > 1 && (
            <div className={styles.rungGap} aria-hidden="true">
              …
            </div>
          )}
          {rungs.map(n => {
            const cleared = save !== null && n < level;
            const current = n === level;
            const rungTone = difficultyColors[difficultyForLevel(n)];
            return (
              <div
                key={n}
                className={[
                  styles.rung,
                  cleared ? styles.rungCleared : null,
                  current ? styles.rungCurrent : null,
                ]
                  .filter(Boolean)
                  .join(' ')}
                style={{ '--tone': rungTone } as CSSProperties}
                aria-label={`Level ${n}, target ${targetForLevel(n)}${
                  cleared ? ', cleared' : current ? ', current level' : ''
                }`}
              >
                <span className={styles.rungLevel}>L{n}</span>
                <span className={styles.rungTarget}>{targetForLevel(n)}</span>
                <span className={styles.rungTag}>
                  {cleared ? (
                    <span className={styles.tagCleared}>✓ won</span>
                  ) : current ? (
                    <span className={styles.tagNow}>
                      {save ? 'now' : 'start'}
                    </span>
                  ) : n === best && best > 0 ? (
                    <span className={styles.tagBest}>best</span>
                  ) : (
                    <span className={styles.tagAhead}>
                      {NAME[difficultyForLevel(n)]}
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
        <p className={styles.ladderFoot}>
          Levels 1–2 play the Easy ruleset, 3–4 Medium, 5 and up Hard — the
          target rises {TARGETS_UP_STEP} points every level, without end.
        </p>
      </section>

      <div className={styles.startBar}>
        <div>
          <div className={styles.startingLabel}>
            {save ? 'Continuing' : 'Starting'}
          </div>
          <div
            className={styles.startingName}
            style={{ '--tone': tone } as CSSProperties}
          >
            Level {level}{' '}
            <span className={styles.startingTarget}>
              · {target} to clear · {NAME[difficulty]} ruleset
            </span>
          </div>
          <div className={styles.startingMeta}>
            {save
              ? `${save.wins} win${save.wins === 1 ? '' : 's'} this run` +
                (carries > 0
                  ? ` · ${carries} powered card${
                      carries === 1 ? '' : 's'
                    } riding the deck`
                  : '')
              : 'A fresh deck, a fresh ladder — nothing carries in.'}
          </div>
        </div>
        <div className={styles.startRight}>
          {save && (
            <button
              type="button"
              className={styles.abandon}
              onClick={clearProgress}
            >
              Abandon run
            </button>
          )}
          <Link to="/targets/play" className={styles.startBtn}>
            {save ? `Continue — level ${level}` : 'Start the climb'}{' '}
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>

      <div className={styles.explain}>
        <section className={styles.explainCard}>
          <h2 className={styles.explainTitle}>How it works</h2>
          <p className={styles.explainBody}>
            Each level is one full game. Beat the target to advance; the next
            level&apos;s target is {TARGETS_UP_STEP} higher, and the ruleset
            stiffens with it. Lose once — miss a single target — and the run
            ends where it stands.
          </p>
        </section>
        <section className={styles.explainCard}>
          <h2 className={styles.explainTitle}>Reward tiers</h2>
          <p className={styles.explainBody}>
            Finish a level at <strong>S tier</strong> (1.3× the target) to
            earn a reward: supercharge a card from your final board for the
            next deck, or power up a held bonus card.{' '}
            <strong>SS tier</strong> (1.6×) earns both.
          </p>
        </section>
      </div>
    </div>
  );
}
