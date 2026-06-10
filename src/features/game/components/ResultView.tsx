import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { bonusShapleyValues, scoreGrid } from '../../../game/scoring';
import { Button, Sheet } from '../../../design/primitives';
import { useGameSession } from '../GameSessionProvider';
import { LineRails } from './LineRails';
import { LinesPanel } from './LinesPanel';
import { BonusCardStrip } from './BonusCardStrip';
import styles from './ResultView.module.css';

export interface ResultViewProps {
  onReplay: () => void;
}

/**
 * Game-over view, verdict first. The board carries its ten line totals
 * as rails (tap any total for the full hand breakdown); score math and
 * the Shapley attribution of each bonus card follow; Play again is
 * pinned in the bottom dock on phones. Desktop spreads the same pieces
 * across the three-panel layout.
 */
export function ResultView({ onReplay }: ResultViewProps) {
  const { state } = useGameSession();
  const [linesOpen, setLinesOpen] = useState(false);

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

  const won = report.total >= state.target;

  return (
    <div className={styles.wrap}>
      <section className={`${styles.hero} ${styles.heroSlot}`} aria-label="Final result">
        <span className={`${styles.verdict} ${won ? styles.win : styles.loss}`}>
          {won ? 'Target beaten' : 'Target missed'}
        </span>
        <span className={styles.finalScore} data-testid="final-score">
          {report.total}
        </span>
        <span className={`text-body ${styles.targetLine}`}>
          target {state.target} · {state.difficulty}
        </span>
      </section>

      <div className={styles.boardSlot}>
        <LineRails
          grid={state.grid}
          report={report}
          onLineTap={() => setLinesOpen(true)}
        />
      </div>

      <section className={`${styles.math} ${styles.mathSlot}`} aria-label="Score math">
        <h2 className="text-section">Score math</h2>
        <div className={styles.mathRow}>
          <span>Lines subtotal</span>
          <span>{report.subtotal}</span>
        </div>
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

      {state.bonusCards.length > 0 && (
        <>
          <div className={styles.bonusRowSlot}>
            <BonusCardStrip
              layout="row"
              cards={state.bonusCards}
              values={shapley}
            />
          </div>
          <div className={styles.bonusPanelSlot}>
            <BonusCardStrip
              cards={state.bonusCards}
              values={shapley}
              title="Bonus contribution"
            />
          </div>
        </>
      )}

      <div className={styles.linesPanelSlot}>
        <LinesPanel report={report} title="Line breakdown" />
      </div>

      <div className={styles.dock}>
        <div className={styles.dockRow}>
          <Link to="/play" className={styles.dockLink}>
            Change difficulty
          </Link>
          <Link to="/" className={styles.dockLink}>
            Home
          </Link>
        </div>
        <Button
          variant="primary"
          className={styles.commitButton}
          onClick={onReplay}
        >
          Play again
        </Button>
      </div>

      <Sheet open={linesOpen} onClose={() => setLinesOpen(false)} title="Lines">
        <LinesPanel report={report} />
      </Sheet>
    </div>
  );
}
