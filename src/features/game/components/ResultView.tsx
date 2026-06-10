import { useMemo } from 'react';
import { Link } from 'react-router';
import { bonusShapleyValues, scoreGrid } from '../../../game/scoring';
import { Button } from '../../../design/primitives';
import { useGameSession } from '../GameSessionProvider';
import { GridBoard } from './GridBoard';
import { LinesPanel } from './LinesPanel';
import { BonusCardStrip } from './BonusCardStrip';
import styles from './ResultView.module.css';

export interface ResultViewProps {
  onReplay: () => void;
}

/**
 * Game-over view: final verdict, the board as it ended, the full score
 * math (penalty included), and the Shapley attribution of each held
 * bonus card's contribution.
 */
export function ResultView({ onReplay }: ResultViewProps) {
  const { state } = useGameSession();

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
      <div className={styles.leftCol}>
        <LinesPanel report={report} title="Line breakdown" />
      </div>

      <div className={styles.heroCol}>
        <section className={styles.hero} aria-label="Final result">
          <span
            className={`${styles.verdict} ${won ? styles.win : styles.loss}`}
          >
            {won ? 'Target beaten' : 'Target missed'}
          </span>
          <span className={styles.finalScore} data-testid="final-score">
            {report.total}
          </span>
          <span className={`text-body ${styles.targetLine}`}>
            target {state.target} · {state.difficulty}
          </span>
        </section>

        <GridBoard grid={state.grid} />

        <div className={styles.buttons}>
          <Button variant="primary" onClick={onReplay}>
            Play again
          </Button>
          <Link to="/play">
            <Button variant="secondary">Change difficulty</Button>
          </Link>
          <Link to="/">
            <Button variant="ghost">Home</Button>
          </Link>
        </div>
      </div>

      <div className={styles.rightCol}>
        <section className={styles.math} aria-label="Score math">
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
          <BonusCardStrip
            cards={state.bonusCards}
            values={shapley}
            title="Bonus contribution"
          />
        )}
      </div>
    </div>
  );
}
