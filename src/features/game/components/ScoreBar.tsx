import { useMemo, useState } from 'react';
import { scoreGrid } from '../../../game/scoring';
import { Button } from '../../../design/primitives';
import { useGameSession } from '../GameSessionProvider';
import { TierBreakdownSheet } from './TierBreakdownSheet';
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
  const { state, dispatch, mode, canUndo, maxUndos } = useGameSession();
  const [tiersOpen, setTiersOpen] = useState(false);

  const report = useMemo(
    () =>
      scoreGrid(state.grid, state.bonusCards, {
        ignoreIncompletePenalty: true,
        deckRemaining: state.deck.length,
        discards: state.discards,
        perkSpent: state.perkSpent,
        handBoost: state.handBoost,
      }),
    [state]
  );

  return (
    <div className={styles.bar}>
      <div className={styles.scoreBlock}>
        {/* The score doubles as the door to the tier breakdown. */}
        <button
          type="button"
          className={styles.scoreRow}
          onClick={() => setTiersOpen(true)}
          aria-label={`Score ${report.total} — show tier thresholds`}
        >
          <span className={styles.score}>{report.total}</span>
          <span className={`text-label ${styles.target}`}>
            / {state.target} target
          </span>
          <span className={styles.kicker}>{state.difficulty}</span>
        </button>
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
      <TierBreakdownSheet
        open={tiersOpen}
        onClose={() => setTiersOpen(false)}
        target={state.target}
        showRewards={mode.kind === 'targets'}
      />
    </div>
  );
}
