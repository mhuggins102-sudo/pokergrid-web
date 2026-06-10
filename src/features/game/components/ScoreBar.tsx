import { useMemo } from 'react';
import { scoreGrid } from '../../../game/scoring';
import { INCOMPLETE_LINE_PENALTY } from '../../../game/scoring';
import { Button } from '../../../design/primitives';
import { useGameSession } from '../GameSessionProvider';
import styles from './ScoreBar.module.css';

export interface ScoreBarProps {
  onShowHandValues: () => void;
}

/**
 * Live score / target readout. The live number ignores the incomplete-line
 * penalty (it only applies at game end); once the deck runs low a warning
 * spells out what the open lines would cost.
 */
export function ScoreBar({ onShowHandValues }: ScoreBarProps) {
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

  const hasPatience = state.bonusCards.some(c => c.negatesIncompletePenalty);
  const openLines = report.lines.filter(l => l.incomplete).length;
  const showPenalty =
    state.deck.length <= 10 && openLines > 0 && !hasPatience;

  return (
    <div className={styles.bar}>
      <div className={styles.scoreBlock}>
        <span className={styles.kicker}>{state.difficulty}</span>
        <div className={styles.scoreRow}>
          <span className={styles.score} aria-label={`Score ${report.total}`}>
            {report.total}
          </span>
          <span className={`text-label ${styles.target}`}>
            / {state.target} target
          </span>
        </div>
        {showPenalty && (
          <span className={styles.penalty} role="status">
            {openLines} line{openLines === 1 ? '' : 's'} open ·{' '}
            {openLines * INCOMPLETE_LINE_PENALTY} at game end
          </span>
        )}
      </div>
      <div className={styles.controls}>
        {maxUndos > 0 && (
          <Button
            size="sm"
            variant="secondary"
            disabled={!canUndo}
            onClick={() => dispatch({ type: 'UNDO' })}
          >
            Undo{maxUndos > 1 ? '' : ` (${maxUndos - state.undoCount} left)`}
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
