import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { ScoredLine, bonusShapleyValues, scoreGrid } from '../../../game/scoring';
import { baseId } from '../../../game/bonusCards';
import { rngStep } from '../../../game/deck';
import { Button, Chevron, Sheet } from '../../../design/primitives';
import { useGameSession } from '../GameSessionProvider';
import { useRecordResult } from '../../progress/useRecordResult';
import type { Achievement } from '../../../game/achievements';
import { useTargetsStore } from '../../targets/targetsStore';
import { recordDailyCompletion } from '../../daily/sync/sync';
import { nextIncompleteDaily } from '../../daily/dailyDates';
import { usePlaysStore } from '../../daily/sync/playsStore';
import { RankPanel } from '../../daily/RankPanel';
import { useSettingsStore } from '../../settings/settingsStore';
import { prefersReducedMotion, useAnimatedNumber } from '../useAnimatedNumber';
import { computeScoreBreakdown } from '../scoreBreakdown';
import { ScoreBreakdown } from './ScoreBreakdown';
import { LineRails } from './LineRails';
import { LinesPanel } from './LinesPanel';
import { LineDetailSheet } from './LineDetailSheet';
import { BonusCardStrip } from './BonusCardStrip';
import { bonusCardLiveContext } from '../bonusCardLiveContext';
import { RewardsResult, RewardsSheet } from './RewardsSheet';
import { ScoreDetailsSheet } from './ScoreDetailsSheet';
import { TierBreakdownSheet } from './TierBreakdownSheet';
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
  const [tiersOpen, setTiersOpen] = useState(false);
  // Tapped just-earned achievement → explainer sheet.
  const [achInfo, setAchInfo] = useState<Achievement | null>(null);
  const plays = usePlaysStore(s => s.plays);
  const nextDaily =
    mode.kind === 'daily' ? nextIncompleteDaily(mode.dateISO, plays) : null;

  const { report, shapley, breakdown, baseTotals } = useMemo(() => {
    const options = {
      deckRemaining: state.deck.length,
      discards: state.discards,
      perkSpent: state.perkSpent,
      handBoost: state.handBoost,
    };
    const fullReport = scoreGrid(state.grid, state.bonusCards, options);
    const bd = computeScoreBreakdown(
      state.grid,
      state.bonusCards,
      fullReport,
      options
    );
    return {
      report: fullReport,
      shapley: bonusShapleyValues(state.grid, state.bonusCards, options),
      breakdown: bd,
      baseTotals: new Map(
        bd.baseReport.lines.map(l => [`${l.kind}${l.index}`, l.total])
      ),
    };
  }, [state]);

  const { won, tier, newAchievements } = useRecordResult(report, shapley);

  // Game-end tally, three beats told by the rail chips:
  //   1. 'assemble' — chips pop in with their BASE totals while the
  //      hero counts 0 → base (pure poker, green corner row).
  //   2. 'boosted'  — gold-touched chips re-pop gold with their final
  //      totals; hero counts base → subtotal (+N gold corner row).
  //   3. 'final'    — the purple multiplier kicks the hero from
  //      subtotal → total (×N purple corner row + scale pulse).
  // Beats without a factor are skipped; with neither factor it's a
  // single classic 0 → total count. Reduced motion (setting or OS)
  // renders the end state immediately — which also keeps tests
  // reading the true final score.
  const reduceMotion = useSettingsStore(s => s.reduceMotion);
  const staticTally =
    reduceMotion ||
    prefersReducedMotion() ||
    (!breakdown.hasGold && !breakdown.hasPurple);
  type TallyStage = 'assemble' | 'boosted' | 'final';
  const [stage, setStage] = useState<TallyStage>(
    staticTally ? 'final' : 'assemble'
  );
  useEffect(() => {
    if (staticTally) return;
    const timers: number[] = [];
    const GOLD_AT = 1650;
    const PURPLE_AT = 2350;
    if (breakdown.hasGold) {
      timers.push(window.setTimeout(() => setStage('boosted'), GOLD_AT));
      timers.push(
        window.setTimeout(
          () => setStage('final'),
          breakdown.hasPurple ? PURPLE_AT : GOLD_AT
        )
      );
    } else {
      timers.push(window.setTimeout(() => setStage('final'), GOLD_AT));
    }
    return () => timers.forEach(t => window.clearTimeout(t));
    // Run once for the mounted result — breakdown is stable per state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const stageTarget =
    stage === 'assemble'
      ? breakdown.base
      : stage === 'boosted'
        ? report.subtotal
        : report.total;
  const displayTotal = useAnimatedNumber(stageTarget, !staticTally, {
    durationMs: staticTally ? 0 : stage === 'assemble' ? 1200 : 400,
    initial: staticTally ? undefined : 0,
  });
  // Corner-row fade-in beats, aligned with the stage flips (base row
  // lands as the assemble count finishes).
  const beatDelays = staticTally
    ? undefined
    : [
        1150,
        ...(breakdown.hasGold ? [1650] : []),
        ...(breakdown.hasPurple ? [breakdown.hasGold ? 2350 : 1650] : []),
      ];

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
  // Let the final result land first, then bring up the perks picker — it
  // used to pop on the same frame as the verdict, hiding the result.
  const [rewardsRevealed, setRewardsRevealed] = useState(false);
  useEffect(() => {
    if (!wantsRewards) return;
    const t = window.setTimeout(() => setRewardsRevealed(true), 1500);
    return () => window.clearTimeout(t);
  }, [wantsRewards]);
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
      ? baseId(result.poweredBonus)
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
          ? // The date lives on the rank bar below — no need twice.
            `target ${state.target} · ${state.difficulty}${
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
      nextDaily && (
        <Link to={`/daily/${nextDaily}`} className={styles.dockLink}>
          Next daily
        </Link>
      )
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
            <Chevron direction="right" size={18} className={styles.summaryCaret} />
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
        <ScoreBreakdown breakdown={breakdown} beatDelays={beatDelays} />
        <button
          type="button"
          className={`${styles.finalScore} ${styles.finalScoreBtn} ${
            !staticTally && stage === 'final' && breakdown.hasPurple
              ? styles.scoreKick
              : ''
          }`}
          data-testid="final-score"
          aria-label={`Score ${report.total} — show tier thresholds`}
          onClick={() => setTiersOpen(true)}
        >
          {displayTotal}
        </button>
        <span className={`text-body ${styles.targetLine}`}>
          {contextLine} · tier {tier}
        </span>
        {newAchievements.length > 0 && (
          <span className={styles.achievements} role="status">
            🏆{' '}
            {newAchievements.map(a => (
              <button
                key={a.id}
                type="button"
                className={styles.achievementBtn}
                onClick={() => setAchInfo(a)}
              >
                {a.name}
              </button>
            ))}
          </span>
        )}
      </section>

      {isDaily && mode.kind === 'daily' && (
        <div className={styles.rankSlot}>
          <RankPanel dateISO={mode.dateISO} />
        </div>
      )}

      <div className={styles.boardSlot}>
        <LineRails
          grid={state.grid}
          report={report}
          onLineTap={setDetailLine}
          stagger={!staticTally}
          tally={{
            baseTotals,
            stage: stage === 'assemble' ? 'base' : 'boosted',
            animate: !staticTally,
          }}
        />
      </div>

      <div className={styles.mathSlot}>{scoreMath}</div>

      {state.bonusCards.length > 0 && (
        <div className={styles.bonusPanelSlot}>
          <BonusCardStrip
            cards={state.bonusCards}
            values={shapley}
            title="Bonus contribution"
            liveContext={card => bonusCardLiveContext(card, state, { final: true })}
            hideEach
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

      <Sheet
        open={achInfo !== null}
        onClose={() => setAchInfo(null)}
        title={achInfo ? `🏆 ${achInfo.name}` : ''}
      >
        {achInfo && <p className="text-body">{achInfo.description}</p>}
      </Sheet>

      <TierBreakdownSheet
        open={tiersOpen}
        onClose={() => setTiersOpen(false)}
        target={state.target}
        showRewards={mode.kind === 'targets'}
        score={report.total}
      />

      <ScoreDetailsSheet
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        report={report}
        bonusCards={state.bonusCards}
        shapley={shapley}
        liveContext={card => bonusCardLiveContext(card, state, { final: true })}
      />

      {rewardsPending && rewardsRevealed && (tier === 'SS' || tier === 'S') && (
        <RewardsSheet
          tier={tier}
          grid={state.grid}
          bonusCards={state.bonusCards}
          blockedBaseId={targets.save?.lastKeptBaseId ?? null}
          // Derived from the finished run's RNG word (not Math.random) so
          // a seeded run's reward roll is reproducible too.
          superchargeRoll={rngStep(state.rngState >>> 0).value}
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
