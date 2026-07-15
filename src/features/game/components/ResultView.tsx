import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { ScoredLine, bonusShapleyValues, scoreGrid } from '../../../game/scoring';
import { Button, Chevron, Sheet } from '../../../design/primitives';
import { useGameSession } from '../GameSessionProvider';
import { useRecordResult } from '../../progress/useRecordResult';
import { useLevelUp } from '../../progress/usePlayerLevel';
import type { Achievement } from '../../../game/achievements';
import { useTargetsResult } from '../useTargetsResult';
import { recordDailyCompletion } from '../../daily/sync/sync';
import { nextIncompleteDaily } from '../../daily/dailyDates';
import { usePlaysStore } from '../../daily/sync/playsStore';
import { RankCorner } from '../../daily/RankPanel';
import { useSettingsStore } from '../../settings/settingsStore';
import { sfxTallyCount } from '../../../lib/sfx';
import { prefersReducedMotion, useAnimatedNumber } from '../useAnimatedNumber';
import { computeScoreBreakdown, computeScoreBuild } from '../scoreBreakdown';
import { ScoreBreakdown } from './ScoreBreakdown';
import { ScoreBuildSheet } from './ScoreBuildSheet';
import { LineRails } from './LineRails';
import { LinesPanel } from './LinesPanel';
import { LineDetailSheet } from './LineDetailSheet';
import { BonusCardStrip } from './BonusCardStrip';
import { bonusCardLiveContext } from '../bonusCardLiveContext';
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
  const { state, mode, setup, seed, viewOnly } = useGameSession();
  const [detailLine, setDetailLine] = useState<ScoredLine | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [tiersOpen, setTiersOpen] = useState(false);
  // Corner breakdown tapped → the per-card score build-up.
  const [buildOpen, setBuildOpen] = useState(false);
  // Tapped just-earned achievement → explainer sheet.
  const [achInfo, setAchInfo] = useState<Achievement | null>(null);
  const plays = usePlaysStore(s => s.plays);
  const nextDaily =
    mode.kind === 'daily' ? nextIncompleteDaily(mode.dateISO, plays) : null;

  const { report, shapley, breakdown, build, baseTotals } = useMemo(() => {
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
      build: computeScoreBuild(state.grid, state.bonusCards, fullReport, options),
      baseTotals: new Map(
        bd.baseReport.lines.map(l => [`${l.kind}${l.index}`, l.total])
      ),
    };
  }, [state]);

  const { won, tier, newAchievements } = useRecordResult(report, shapley);
  // Non-null only when THIS run crossed a new XP level (see useLevelUp).
  const levelUp = useLevelUp();

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
  // Reduced motion only — a game with neither factor still gets the
  // classic 0 → total count (the corner rows just don't render).
  const staticTally = reduceMotion || prefersReducedMotion();
  type TallyStage = 'assemble' | 'boosted' | 'final';
  const [stage, setStage] = useState<TallyStage>(
    staticTally ? 'final' : 'assemble'
  );
  // True once the hero number has finished counting — the verdict line
  // and the daily rank / leaderboard corner stay hidden until then, so
  // neither the win/loss call nor the standing can spoil the final
  // score mid-tally.
  const [tallyDone, setTallyDone] = useState(staticTally);
  useEffect(() => {
    if (staticTally) return;
    // Count-up ticks ride the same effect as the stage flips so sound
    // and visuals can't desync; each color segment gets its own pitch.
    const sounds = useSettingsStore.getState().sounds;
    const timers: number[] = [];
    const GOLD_AT = 3300;
    const PURPLE_AT = 4700;
    if (sounds) sfxTallyCount(2.4, 'base');
    const toFinal = () => {
      setStage('final');
      if (sounds && breakdown.hasPurple) sfxTallyCount(0.8, 'purple');
      // The final segment counts for 800ms — reveal the rank corner
      // just after it lands.
      timers.push(window.setTimeout(() => setTallyDone(true), 850));
    };
    if (breakdown.hasGold) {
      timers.push(
        window.setTimeout(() => {
          setStage('boosted');
          if (sounds) sfxTallyCount(0.8, 'gold');
        }, GOLD_AT)
      );
      timers.push(
        window.setTimeout(toFinal, breakdown.hasPurple ? PURPLE_AT : GOLD_AT)
      );
    } else {
      timers.push(window.setTimeout(toFinal, GOLD_AT));
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
    durationMs: staticTally ? 0 : stage === 'assemble' ? 2400 : 800,
    initial: staticTally ? undefined : 0,
  });
  // Corner-row fade-in beats: each color row reveals at the START of
  // its counting segment, so the hero number visibly counts alongside
  // the row that explains it (green with the base count, gold with
  // base→subtotal, purple with subtotal→total).
  const beatDelays = staticTally
    ? undefined
    : [
        150,
        ...(breakdown.hasGold ? [3300] : []),
        ...(breakdown.hasPurple ? [breakdown.hasGold ? 4700 : 3300] : []),
      ];

  // ---- Daily: save locally, then queue-first submit ----
  const dailyRecordedRef = useRef(false);
  useEffect(() => {
    // viewOnly = a re-hydrated stored play (archive view) — it was
    // saved and submitted when it actually finished.
    if (mode.kind !== 'daily' || dailyRecordedRef.current || viewOnly) return;
    dailyRecordedRef.current = true;
    recordDailyCompletion(mode.dateISO, mode.recipe, state, report.total, won);
  }, [mode, state, report.total, won, viewOnly]);

  // ---- Targets-Up ladder lifecycle (shared with the desktop result
  // dialog — the hook owns the advance/clear commit exactly once). ----
  const { rewardsPending, rewardsSheet } = useTargetsResult(won, tier, {
    autoReveal: true,
  });

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

  // Challenges use the shared default line — "target N · hard", same
  // wording as every other mode (the verdict already names the
  // challenge).
  const contextLine =
    mode.kind === 'targets'
        ? `level ${mode.level} · target ${state.target} · ${state.difficulty}`
        : mode.kind === 'daily'
          ? // No date here — it lives in the leaderboard sheet's title
            // (behind the corner's podium icon).
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

  const infoBtn = (
    <button
      type="button"
      className={styles.heroInfo}
      aria-label="Score details"
      onClick={() => setDetailsOpen(true)}
    >
      ⓘ
    </button>
  );

  return (
    <div className={styles.wrap}>
      <section className={`${styles.hero} ${styles.heroSlot}`} aria-label="Final result">
        {/* Top-right corner: the daily leaderboard (podium icon +
            standing) joins the ⓘ once the tally has landed — never
            before, so the rank can't spoil the final score. */}
        <div className={styles.heroCorner}>
          {mode.kind === 'daily' && tallyDone ? (
            <RankCorner dateISO={mode.dateISO}>{infoBtn}</RankCorner>
          ) : (
            infoBtn
          )}
        </div>
        <span
          className={`${styles.verdict} ${won ? styles.win : styles.loss} ${
            tallyDone ? styles.verdictIn : styles.verdictPending
          }`}
        >
          {verdict}
        </span>
        <ScoreBreakdown
          breakdown={breakdown}
          beatDelays={beatDelays}
          onOpen={() => setBuildOpen(true)}
        />
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
        {levelUp !== null && (
          <span className={styles.levelUp} role="status">
            ⬆ Level {levelUp} reached
          </span>
        )}
      </section>

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
              dateISO={mode.kind === 'daily' ? mode.dateISO : undefined}
              seed={mode.kind === 'free' ? seed : undefined}
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

      <ScoreBuildSheet
        open={buildOpen}
        onClose={() => setBuildOpen(false)}
        build={build}
      />

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

      {rewardsSheet}

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
