import { useMemo, useState } from 'react';
import { LayoutGroup, MotionConfig } from 'motion/react';
import { scoreGrid } from '../../game/scoring';
import { Button } from '../../design/primitives';
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
 */
export function GameScreen({ onReplay }: GameScreenProps) {
  const { state } = useGameSession();
  const ui = usePhaseUI();
  const [peekOpen, setPeekOpen] = useState(false);
  const [handsOpen, setHandsOpen] = useState(false);

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

  return (
    <MotionConfig reducedMotion="user">
      <LayoutGroup>
        <div className={styles.layout}>
          <div className={styles.scoreSlot}>
            <ScoreBar onShowHandValues={() => setHandsOpen(true)} />
          </div>

          <div className={styles.linesSlot}>
            <LinesPanel report={liveReport} />
          </div>

          <div className={styles.boardArea}>
            <div className={styles.banner} role="status" aria-live="polite">
              {ui.banner}
            </div>
            <GridBoard
              grid={state.grid}
              roleOf={ui.roleOf}
              isTappable={ui.isTappable}
              onCellTap={ui.onCellTap}
            />
            <div className={styles.actionBar}>
              {ui.actions.map(a => (
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
          </div>

          <div className={styles.wellSlot}>
            <NextCardWell onPeekDeck={() => setPeekOpen(true)} />
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

      <DeckPreviewDialog open={peekOpen} onClose={() => setPeekOpen(false)} />
      <HandValuesDialog open={handsOpen} onClose={() => setHandsOpen(false)} />
      {ui.bonusDialog && <BonusResolveDialog ui={ui.bonusDialog} />}
    </MotionConfig>
  );
}
