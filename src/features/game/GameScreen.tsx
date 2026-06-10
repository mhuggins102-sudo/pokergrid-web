import { useMemo, useState } from 'react';
import { LayoutGroup, MotionConfig } from 'motion/react';
import { scoreGrid } from '../../game/scoring';
import { Button, Sheet } from '../../design/primitives';
import { useGameSession } from './GameSessionProvider';
import { usePhaseUI } from './usePhaseUI';
import { GridBoard } from './components/GridBoard';
import { NextCardWell } from './components/NextCardWell';
import { ScoreBar } from './components/ScoreBar';
import { LinesPanel } from './components/LinesPanel';
import { BonusCardStrip } from './components/BonusCardStrip';
import { DeckPreviewDialog } from './components/DeckPreviewDialog';
import { BonusResolveDialog } from './components/BonusResolveDialog';
import { HandValuesDialog } from './components/HandValuesDialog';
import { ResultView } from './components/ResultView';
import styles from './GameScreen.module.css';

export interface GameScreenProps {
  onReplay: () => void;
}

/**
 * One running game. Composition only — all phase logic lives in
 * usePhaseUI, all rules in the ported reducer.
 *
 * Phone layout (portrait-first): status strip, square board, bonus
 * hand row, and a bottom control dock pinned in the thumb zone. The
 * dock swaps its contents with the game state — drawn card + actions
 * while deciding, instruction + cancel while targeting. Desktop
 * re-seats the same pieces into the three-panel spread.
 */
export function GameScreen({ onReplay }: GameScreenProps) {
  const { state } = useGameSession();
  const ui = usePhaseUI();
  const [peekOpen, setPeekOpen] = useState(false);
  const [handsOpen, setHandsOpen] = useState(false);
  const [linesOpen, setLinesOpen] = useState(false);

  const liveReport = useMemo(
    () =>
      scoreGrid(state.grid, state.bonusCards, {
        ignoreIncompletePenalty: true,
        deckRemaining: state.deck.length,
        discards: state.discards,
        perkSpent: state.perkSpent,
      }),
    [state]
  );

  if (ui.isGameOver) {
    return <ResultView onReplay={onReplay} />;
  }

  // The dock's bottom row holds the single "commit" action (Place while
  // deciding, Cancel while targeting) as a full-width thumb target; any
  // remaining actions sit beside the drawn card in the top row.
  const commitAction =
    ui.actions.find(a => a.id === 'place') ??
    ui.actions.find(a => a.id === 'cancel');
  const rowActions = ui.actions.filter(a => a !== commitAction);

  return (
    <MotionConfig reducedMotion="user">
      <LayoutGroup>
        <div className={styles.layout}>
          <div className={styles.scoreSlot}>
            <ScoreBar
              onShowHandValues={() => setHandsOpen(true)}
              onShowLines={() => setLinesOpen(true)}
            />
          </div>

          <div className={styles.linesSlot}>
            <LinesPanel report={liveReport} />
          </div>

          <div className={styles.boardArea}>
            <GridBoard
              grid={state.grid}
              roleOf={ui.roleOf}
              isTappable={ui.isTappable}
              onCellTap={ui.onCellTap}
            />
          </div>

          {!state.noBonusCards && (
            <div className={styles.bonusRowSlot}>
              <BonusCardStrip
                layout="row"
                cards={state.bonusCards}
                bonusDeckSize={state.bonusDeck.length}
              />
            </div>
          )}

          <div className={styles.dock}>
            <div className={styles.dockRow}>
              <NextCardWell onPeekDeck={() => setPeekOpen(true)} />
              <span className={styles.dockText} role="status" aria-live="polite">
                {ui.banner}
              </span>
              {rowActions.map(a => (
                <Button
                  key={a.id}
                  variant={a.variant}
                  disabled={a.disabled}
                  onClick={a.onPress}
                >
                  {a.label}
                </Button>
              ))}
            </div>
            {commitAction && (
              <Button
                key={commitAction.id}
                variant={commitAction.id === 'cancel' ? 'secondary' : commitAction.variant}
                disabled={commitAction.disabled}
                onClick={commitAction.onPress}
                className={styles.commitButton}
              >
                {commitAction.label}
              </Button>
            )}
          </div>

          {!state.noBonusCards && (
            <div className={styles.bonusSlot}>
              <BonusCardStrip
                cards={state.bonusCards}
                bonusDeckSize={state.bonusDeck.length}
              />
            </div>
          )}
        </div>
      </LayoutGroup>

      <Sheet open={linesOpen} onClose={() => setLinesOpen(false)} title="Lines">
        <LinesPanel report={liveReport} />
      </Sheet>
      <DeckPreviewDialog open={peekOpen} onClose={() => setPeekOpen(false)} />
      <HandValuesDialog open={handsOpen} onClose={() => setHandsOpen(false)} />
      {ui.bonusDialog && <BonusResolveDialog ui={ui.bonusDialog} />}
    </MotionConfig>
  );
}
