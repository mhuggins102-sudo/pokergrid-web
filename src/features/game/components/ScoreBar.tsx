import { useEffect, useMemo, useRef, useState } from 'react';
import { scoreGrid } from '../../../game/scoring';
import { Button } from '../../../design/primitives';
import { useGameSession } from '../GameSessionProvider';
import { useSettingsStore } from '../../settings/settingsStore';
import { useAnimatedNumber } from '../useAnimatedNumber';
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
 * Lines view shows which lines are still open. Score changes tick in
 * with a floating +N/−N delta chip so each move's worth is legible,
 * and a polite live region announces the new score to screen readers.
 */
export function ScoreBar({ onShowHandValues, onShowLines }: ScoreBarProps) {
  const { state, dispatch, mode, canUndo, maxUndos } = useGameSession();
  const [tiersOpen, setTiersOpen] = useState(false);
  const reduceMotion = useSettingsStore(s => s.reduceMotion);

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

  // Floating delta chip: keyed by a counter so consecutive changes
  // retrigger the CSS animation; expires on its own.
  const prevTotalRef = useRef(report.total);
  const [delta, setDelta] = useState<{ amount: number; key: number } | null>(
    null
  );
  useEffect(() => {
    const prev = prevTotalRef.current;
    prevTotalRef.current = report.total;
    const amount = report.total - prev;
    if (amount === 0) return;
    setDelta(d => ({ amount, key: (d?.key ?? 0) + 1 }));
    const t = window.setTimeout(() => setDelta(null), 1000);
    return () => window.clearTimeout(t);
  }, [report.total]);

  const displayTotal = useAnimatedNumber(report.total, !reduceMotion);

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
          <span className={styles.score}>{displayTotal}</span>
          <span className={`text-label ${styles.target}`}>
            / {state.target} target
          </span>
          <span className={styles.kicker}>{state.difficulty}</span>
          {delta && (
            <span
              key={delta.key}
              className={`${styles.delta} ${
                delta.amount < 0 ? styles.deltaDown : ''
              }`}
              aria-hidden
            >
              {delta.amount > 0 ? `+${delta.amount}` : `${delta.amount}`}
            </span>
          )}
        </button>
        {/* Placements are otherwise silent to screen readers — announce
            the running score politely as it changes. */}
        <span className="sr-only" role="status" aria-live="polite">
          Score {report.total} of {state.target}
        </span>
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
