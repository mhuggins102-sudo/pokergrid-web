import { Link } from 'react-router';
import { difficultyForLevel, targetForLevel } from '../../game/challenges';
import { Button } from '../../design/primitives';
import { useStatsStore } from '../progress/statsStore';
import { useIsDesktop } from '../game/useIsDesktop';
import { useTargetsStore } from './targetsStore';
import { TargetsDesk } from './TargetsDesk';
import styles from './TargetsPage.module.css';

/** Targets-Up home: resume (or start) the ladder. */
export function TargetsPage() {
  const save = useTargetsStore(s => s.save);
  const clearProgress = useTargetsStore(s => s.clearProgress);
  const best = useStatsStore(s => s.stats.targetsUpBest);
  // ≥1024px renders the desktop ladder page INSTEAD of the phone card
  // (same JSX-fork pattern as ChallengesPage / HomePage) — below the
  // breakpoint nothing changes.
  const isDesktop = useIsDesktop();
  if (isDesktop) return <TargetsDesk />;

  const level = save?.level ?? 1;
  const target = targetForLevel(level);
  const difficulty = difficultyForLevel(level);
  const carries =
    (save?.deckExtras?.length ?? 0) + (save?.superchargedDeckCards?.length ?? 0);

  return (
    <section className={styles.wrap}>
      <header className={styles.header}>
        <h1 className="text-title">Targets Up</h1>
        <p className="text-body" style={{ color: 'var(--ink-2)' }}>
          Climb the ladder — the target rises 25 points every level. One
          loss ends the run.
        </p>
      </header>

      <div className={styles.card}>
        <div className={styles.levelRow}>
          <span className={styles.level}>L{level}</span>
          <span className={styles.levelMeta}>
            <span>target {target}</span>
            <span>{difficulty} ruleset</span>
            {save && <span>{save.wins} win{save.wins === 1 ? '' : 's'} this run</span>}
          </span>
        </div>
        {carries > 0 && (
          <span className={styles.carry}>
            {carries} powered card{carries === 1 ? '' : 's'} carried into this
            level&apos;s decks.
          </span>
        )}
        <div className={styles.buttons}>
          <Link to="/targets/play">
            <Button variant="primary">
              {save ? `Continue — level ${level}` : 'Start the climb'}
            </Button>
          </Link>
          {save && (
            <Button variant="ghost" onClick={clearProgress}>
              Abandon run
            </Button>
          )}
        </div>
        {best > 0 && <span className={styles.best}>Best level reached: {best}</span>}
      </div>

      <div className={styles.explain}>
        <p>
          Each level is one full game. Beat the target to advance; the next
          level&apos;s target is 25 higher, and the ruleset stiffens with it
          (levels 1–2 play Easy, 3–4 Medium, 5+ Hard).
        </p>
        <p>
          Finish a level at <strong>S tier</strong> (1.3× the target) to earn
          a reward: supercharge a card from your final board for the next
          deck, or power up a held bonus card.{' '}
          <strong>SS tier</strong> (1.6×) earns both.
        </p>
      </div>
    </section>
  );
}
