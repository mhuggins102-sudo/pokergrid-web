import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ScoredLine, bonusShapleyValues, scoreGrid } from '../../game/scoring';
import { dailyTargetFor } from '../../game/daily/recipe';
import { findChallenge } from '../../game/challenges';
import { tierForRun } from '../../lib/stats';
import { Button, Chevron } from '../../design/primitives';
import { LineRails } from '../game/components/LineRails';
import { computeScoreBreakdown, computeScoreBuild } from '../game/scoreBreakdown';
import { ScoreBuildSheet } from '../game/components/ScoreBuildSheet';
import { ScoreBreakdown } from '../game/components/ScoreBreakdown';
import { LinesPanel } from '../game/components/LinesPanel';
import { LineDetailSheet } from '../game/components/LineDetailSheet';
import { BonusCardStrip } from '../game/components/BonusCardStrip';
import { bonusCardLiveContext } from '../game/bonusCardLiveContext';
import { RankCorner } from './RankPanel';
import { nextIncompleteDaily } from './dailyDates';
import { ShareButton } from '../game/components/ShareButton';
import { ScoreDetailsSheet } from '../game/components/ScoreDetailsSheet';
import { TierBreakdownSheet } from '../game/components/TierBreakdownSheet';
import { DailyPlay, usePlaysStore } from './sync/playsStore';
// Shares the result screen's layout/styles so a revisited daily looks
// exactly like the moment it was finished.
import styles from '../game/components/ResultView.module.css';

/**
 * Read-only result for an already-played daily, rebuilt from the
 * stored GameState. Shareable / revisitable: this is what
 * /daily/:date renders once the date is played.
 */
export function DailyResultStatic({ play }: { play: DailyPlay }) {
  const [detailLine, setDetailLine] = useState<ScoredLine | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [tiersOpen, setTiersOpen] = useState(false);
  const [buildOpen, setBuildOpen] = useState(false);
  const plays = usePlaysStore(s => s.plays);
  const nextDaily = nextIncompleteDaily(play.dateISO, plays);
  const state = play.state;
  const target = dailyTargetFor(play.recipe.difficulty, play.recipe.twist);
  const twist = play.recipe.twist ? findChallenge(play.recipe.twist) : null;

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

  const tier = tierForRun({ score: play.score, target, won: play.won });

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
    <div className={styles.wrap}>
      <section className={`${styles.hero} ${styles.heroSlot}`} aria-label="Daily result">
        {/* Same corner as the live result: leaderboard podium +
            standing beside the ⓘ. A revisit has nothing to spoil, so
            no reveal gating here. */}
        <div className={styles.heroCorner}>
          <RankCorner dateISO={play.dateISO}>
            <button
              type="button"
              className={styles.heroInfo}
              aria-label="Score details"
              onClick={() => setDetailsOpen(true)}
            >
              ⓘ
            </button>
          </RankCorner>
        </div>
        <ScoreBreakdown breakdown={breakdown} onOpen={() => setBuildOpen(true)} />
        <span className={`${styles.verdict} ${play.won ? styles.win : styles.loss}`}>
          {play.won ? 'Daily solved' : 'Daily missed'}
        </span>
        <button
          type="button"
          className={`${styles.finalScore} ${styles.finalScoreBtn}`}
          data-testid="final-score"
          aria-label={`Score ${play.score} — show tier thresholds`}
          onClick={() => setTiersOpen(true)}
        >
          {play.score}
        </button>
        <span className={`text-body ${styles.targetLine}`}>
          {play.dateISO} · target {target} · {play.recipe.difficulty}
          {twist ? ` · ${twist.name}` : ''} · tier {tier}
        </span>
      </section>

      <div className={styles.boardSlot}>
        <LineRails
          grid={state.grid}
          report={report}
          onLineTap={setDetailLine}
          tally={{ baseTotals, stage: 'boosted' }}
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
          {nextDaily && (
            <Link to={`/daily/${nextDaily}`} className={styles.dockLink}>
              Next daily
            </Link>
          )}
          <ShareButton
            score={play.score}
            mode="daily"
            difficulty={play.recipe.difficulty}
            grid={state.grid}
          />
          <Link to="/" className={styles.dockLink}>
            Home
          </Link>
        </div>
        <Link to="/daily/archive" className={styles.commitLink}>
          <Button variant="primary" className={styles.commitButton}>
            Daily archive
          </Button>
        </Link>
      </div>

      <ScoreBuildSheet
        open={buildOpen}
        onClose={() => setBuildOpen(false)}
        build={build}
      />

      <TierBreakdownSheet
        open={tiersOpen}
        onClose={() => setTiersOpen(false)}
        target={target}
        score={play.score}
      />

      <ScoreDetailsSheet
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        report={report}
        bonusCards={state.bonusCards}
        shapley={shapley}
        liveContext={card => bonusCardLiveContext(card, state, { final: true })}
      />

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
