import { useMemo } from 'react';
import { scoreGrid } from '../../../game/scoring';
import { Button } from '../../../design/primitives';
import { useGameSession } from '../GameSessionProvider';
import styles from './ScoreBar.module.css';

export interface ScoreBarProps {
  onShowHandValues: () => void;
  /** Opens the line-breakdown sheet (mobile/tablet only — the desktop
   *  layout shows the panel persistently instead). */
  onShowLines: () => void;
}

/**
 * Live score / target readout. The live number ignores the
 * incomplete-line penalty — it only applies at game end, and the
 * Lines view shows which lines are still open.
 */
export function ScoreBar({ onShowHandValues, onShowLines }: ScoreBarProps) {
  const { state, dispatch, canUndo, maxUndos } = useGameSession();

  const report = useMemo(
    () =>
      scoreGrid(state.grid, state.bonusCards, {
        ignoreIncompletePenalty: true,
        deckRemaining: state.deck.length,
        discards: state.discards,
        perkSpent: state.perkSpent,
      }),
    [state]
  );

  return (
    <div className={styles.bar}>
      <div className={styles.scoreBlock}>
        <div className={styles.scoreRow}>
          <span className={styles.score} aria-label={`Score ${report.total}`}>
            {report.total}
          </span>
          <span className={`text-label ${styles.target}`}>
            / {state.target} target
          </span>
          <span className={styles.kicker}>{state.difficulty}</span>
        </div>
      </div>
      <div className={styles.controls}>
        <Button
          size="sm"
          variant="ghost"
          className={styles.linesBtn}
          onClick={onShowLines}
        >
          Lines
        </Button>
        {maxUndos > 0 && (
          <Button
            size="sm"
            variant="secondary"
            disabled={!canUndo}
            onClick={() => dispatch({ type: 'UNDO' })}
            aria-label={`Undo (${Math.max(0, maxUndos - state.undoCount)} left)`}
          >
            Undo
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={onShowHandValues}
          aria-label="Hand values"
        >
          ⓘ
        </Button>
      </div>
    </div>
  );
}
