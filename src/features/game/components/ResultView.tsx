import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { ScoredLine, bonusShapleyValues, scoreGrid } from '../../../game/scoring';
import { Button } from '../../../design/primitives';
import { useGameSession } from '../GameSessionProvider';
import { useRecordResult } from '../../progress/useRecordResult';
import { useTargetsStore } from '../../targets/targetsStore';
import { recordDailyCompletion } from '../../daily/sync/sync';
import { RankPanel } from '../../daily/RankPanel';
import { LineRails } from './LineRails';
import { LinesPanel } from './LinesPanel';
import { LineDetailSheet } from './LineDetailSheet';
import { BonusCardStrip } from './BonusCardStrip';
import { bonusCardLiveContext } from '../bonusCardLiveContext';
import { RewardsResult, RewardsSheet } from './RewardsSheet';
import { ScoreDetailsSheet } from './ScoreDetailsSheet';
import { ShareButton } from './ShareButton';
import styles from './ResultView.module.css';

export interface ResultViewProps {
  onReplay: () => void;
}

/**
 * Game-over view, verdict first. The board carries its ten line totals
 * as rails (tap any total for the full hand breakdown); score math and
 * the Shapley attribution of each bonus card follow; the commit action
 * is pinned in the bottom dock on phones. Mode-aware: free play offers
 * a replay, challenges report completion, Targets-Up runs the S/SS
 * reward picks and advances (or ends) the ladder.
 */
export function ResultView({ onReplay }: ResultViewProps) {
  const { state, mode, setup } = useGameSession();
  const targets = useTargetsStore();
  const [detailLine, setDetailLine] = useState<ScoredLine | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const { report, shapley } = useMemo(() => {
    const options = {
      deckRemaining: state.deck.length,
      discards: state.discards,
      perkSpent: state.perkSpent,
    };
    return {
      report: scoreGrid(state.grid, state.bonusCards, options),
      shapley: bonusShapleyValues(state.grid, state.bonusCards, options),
    };
  }, [state]);

  const { won, tier, newAchievements } = useRecordResult(report, shapley);

  // ---- Daily: save locally, then queue-first submit ----
  const dailyRecordedRef = useRef(false);
  useEffect(() => {
    if (mode.kind !== 'daily' || dailyRecordedRef.current) return;
    dailyRecordedRef.current = true;
    recordDailyCompletion(mode.dateISO, mode.recipe, state, report.total, won);
  }, [mode, state, report.total, won]);

  // ---- Targets-Up ladder lifecycle ----
  const isTargets = mode.kind === 'targets';
  const wantsRewards = isTargets && won && (tier === 'SS' || tier === 'S');
  const [rewardsPending, setRewardsPending] = useState(wantsRewards);
  const tuDoneRef = useRef(false);

  const finishTargets = (result: RewardsResult) => {
    if (mode.kind !== 'targets' || tuDoneRef.current) return;
    tuDoneRef.current = true;
    const extras = result.poweredBonus
      ? [...mode.deckExtras, result.poweredBonus]
      : mode.deckExtras;
    const charged = result.superchargedCard
      ? [...mode.superchargedDeckCards, result.superchargedCard]
      : mode.superchargedDeckCards;
    const lastKept = result.poweredBonus
      ? result.poweredBonus.id.replace(/-pwr\d+$/, '')
      : (targets.save?.lastKeptBaseId ?? null);
    targets.saveProgress(
      mode.level + 1,
      (targets.save?.wins ?? mode.level - 1) + 1,
      extras,
      charged,
      lastKept
    );
    setRewardsPending(false);
  };
  const finishRef = useRef(finishTargets);
  finishRef.current = finishTargets;

  useEffect(() => {
    if (!isTargets || tuDoneRef.current) return;
    if (won && !wantsRewards) finishRef.current({});
    if (!won) {
      tuDoneRef.current = true;
      useTargetsStore.getState().clearProgress();
    }
  }, [isTargets, won, wantsRewards]);

  // ---- Mode-specific copy + commit actions ----
  const verdict =
    mode.kind === 'challenge'
      ? won
        ? `${setup.challenge?.name} — complete!`
        : `${setup.challenge?.name} — failed`
      : mode.kind === 'targets'
        ? won
          ? `Level ${mode.level} cleared`
          : `Run over at level ${mode.level}`
        : mode.kind === 'daily'
          ? won
            ? 'Daily solved'
            : 'Daily missed'
          : won
            ? 'Target beaten'
            : 'Target missed';

  const contextLine =
    mode.kind === 'challenge'
      ? `goal ${state.target} · hard ruleset`
      : mode.kind === 'targets'
        ? `level ${mode.level} · target ${state.target} · ${state.difficulty}`
        : mode.kind === 'daily'
          ? `${mode.dateISO} · target ${state.target} · ${state.difficulty}${
              setup.challenge ? ` · ${setup.challenge.name}` : ''
            }`
          : `target ${state.target} · ${state.difficulty}`;

  const commit =
    mode.kind === 'targets' ? (
      won ? (
        <Button
          variant="primary"
          className={styles.commitButton}
          disabled={rewardsPending}
          onClick={onReplay}
        >
          Next level — {mode.level + 1}
        </Button>
      ) : (
        <Link to="/targets" className={styles.commitLink}>
          <Button variant="primary" className={styles.commitButton}>
            Back to Targets Up
          </Button>
        </Link>
      )
    ) : mode.kind === 'daily' ? (
      // One play per day — the commit action moves the player on.
      <Link to="/daily/archive" className={styles.commitLink}>
        <Button variant="primary" className={styles.commitButton}>
          Daily archive
        </Button>
      </Link>
    ) : (
      <Button variant="primary" className={styles.commitButton} onClick={onReplay}>
        {mode.kind === 'challenge' ? (won ? 'Play it again' : 'Retry challenge') : 'Play again'}
      </Button>
    );

  const secondary =
    mode.kind === 'challenge' ? (
      <Link to="/challenges" className={styles.dockLink}>
        All challenges
      </Link>
    ) : mode.kind === 'targets' ? (
      <Link to="/targets" className={styles.dockLink}>
        Targets Up home
      </Link>
    ) : mode.kind === 'daily' ? (
      <Link to="/daily" className={styles.dockLink}>
        Today&apos;s daily
      </Link>
    ) : (
      <Link to="/play" className={styles.dockLink}>
        Change difficulty
      </Link>
    );

  const isDaily = mode.kind === 'daily';

  // Score math + bonus contribution, rendered in the desktop side
  // panel — and, on phones, inside the details sheet behind the thin
  // bar (so the whole result fits one viewport with zero scrolling).
  const scoreMath = (
    <section className={styles.math} aria-label="Score math">
      <h2 className="text-section">Score math</h2>
      <details className={styles.linesDetails}>
        <summary className={styles.linesSummary}>
          <span className={styles.summaryLabel}>
            <span className={styles.summaryCaret} aria-hidden="true">
              ▸
            </span>
            Lines subtotal
          </span>
          <span>{report.subtotal}</span>
        </summary>
        <div className={styles.linesBody}>
          <LinesPanel report={report} bare />
        </div>
      </details>
      {report.incompletePenalty !== 0 && (
        <div className={`${styles.mathRow} ${styles.mathPenalty}`}>
          <span>Unfinished lines</span>
          <span>{report.incompletePenalty}</span>
        </div>
      )}
      {report.gridMultiplier !== 1 && (
        <div className={styles.mathRow}>
          <span>Grid multiplier</span>
          <span>×{report.gridMultiplier.toFixed(2)}</span>
        </div>
      )}
      {report.gridFlat !== 0 && (
        <div className={styles.mathRow}>
          <span>Grid flat bonus</span>
          <span>+{report.gridFlat}</span>
        </div>
      )}
      <div className={`${styles.mathRow} ${styles.mathTotal}`}>
        <span>Total</span>
        <span>{report.total}</span>
      </div>
    </section>
  );

  return (
    <div className={`${styles.wrap} ${isDaily ? styles.hasRank : ''}`}>
      <section className={`${styles.hero} ${styles.heroSlot}`} aria-label="Final result">
        <button
          type="button"
          className={styles.heroInfo}
          aria-label="Score details"
          onClick={() => setDetailsOpen(true)}
        >
          ⓘ
        </button>
        <span className={`${styles.verdict} ${won ? styles.win : styles.loss}`}>
          {verdict}
        </span>
        <span className={styles.finalScore} data-testid="final-score">
          {report.total}
        </span>
        <span className={`text-body ${styles.targetLine}`}>
          {contextLine} · tier {tier}
        </span>
        {newAchievements.length > 0 && (
          <span className={styles.achievements} role="status">
            🏆 {newAchievements.map(a => a.name).join(' · ')}
          </span>
        )}
      </section>

      {isDaily && mode.kind === 'daily' && (
        <div className={styles.rankSlot}>
          <RankPanel dateISO={mode.dateISO} />
        </div>
      )}

      <div className={styles.boardSlot}>
        <LineRails grid={state.grid} report={report} onLineTap={setDetailLine} />
      </div>

      <div className={styles.mathSlot}>{scoreMath}</div>

      {state.bonusCards.length > 0 && (
        <div className={styles.bonusPanelSlot}>
          <BonusCardStrip
            cards={state.bonusCards}
            values={shapley}
            title="Bonus contribution"
            liveContext={card => bonusCardLiveContext(card, state)}
          />
        </div>
      )}

      <div className={styles.linesPanelSlot}>
        <LinesPanel report={report} title="Line breakdown" />
      </div>

      <div className={styles.dock}>
        <div className={styles.dockRow}>
          {secondary}
          {/* No share for the tutorial — the deal is rigged. */}
          {mode.kind !== 'tutorial' && (
            <ShareButton
              score={report.total}
              mode={
                mode.kind === 'targets'
                  ? 'targets-up'
                  : mode.kind === 'challenge'
                    ? 'challenge'
                    : mode.kind === 'daily'
                      ? 'daily'
                      : 'free'
              }
              difficulty={state.difficulty}
              grid={state.grid}
            />
          )}
          <Link to="/" className={styles.dockLink}>
            Home
          </Link>
        </div>
        {commit}
      </div>

      <ScoreDetailsSheet
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        report={report}
        bonusCards={state.bonusCards}
        shapley={shapley}
        liveContext={card => bonusCardLiveContext(card, state)}
      />

      {rewardsPending && (tier === 'SS' || tier === 'S') && (
        <RewardsSheet
          tier={tier}
          grid={state.grid}
          bonusCards={state.bonusCards}
          blockedBaseId={targets.save?.lastKeptBaseId ?? null}
          onDone={finishTargets}
        />
      )}

      <LineDetailSheet
        line={detailLine}
        bonusCards={state.bonusCards}
        allLines={report.lines}
        gridBonusesApplied={report.gridMultiplier !== 1 || report.gridFlat !== 0}
        onClose={() => setDetailLine(null)}
      />
    </div>
  );
}
