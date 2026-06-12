import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutGroup, MotionConfig } from 'motion/react';
import { scoreGrid } from '../../game/scoring';
import { Button, Sheet } from '../../design/primitives';
import { useGameSession } from './GameSessionProvider';
import { useCoachHighlight } from './coach';
import { usePhaseUI } from './usePhaseUI';
import { useGameSfx } from './useGameSfx';
import { useSettingsStore } from '../settings/settingsStore';
import { bonusCardLiveContext } from './bonusCardLiveContext';
import { lineLabel } from './handLabels';
import { GridBoard, useJokerArrivals } from './components/GridBoard';
import { useAutoPlaceFlights } from './useAutoPlaceFlights';
import { NextCardWell } from './components/NextCardWell';
import { ScoreBar } from './components/ScoreBar';
import { LinesPanel } from './components/LinesPanel';
import { BonusCardStrip } from './components/BonusCardStrip';
import { DeckPreviewDialog } from './components/DeckPreviewDialog';
import { BonusResolvePanel } from './components/BonusResolveDialog';
import { HandValuesDialog } from './components/HandValuesDialog';
import { ReviveSheet } from './components/ReviveSheet';
import { ResultView } from './components/ResultView';
import styles from './GameScreen.module.css';

export interface GameScreenProps {
  onReplay: () => void;
  /** Tutorial coach panel; when present the board budget shrinks to
   *  make room (the same trick the ♣ panel uses). */
  coach?: ReactNode;
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
export function GameScreen({ onReplay, coach }: GameScreenProps) {
  const { state, dispatch } = useGameSession();
  const ui = usePhaseUI();
  const coachHighlight = useCoachHighlight();
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

  useGameSfx(state, liveReport.total);
  const reduceMotion = useSettingsStore(s => s.reduceMotion);

  // Layout corrections snap (no glide) on the renders where the ♣
  // panel opens or closes — the board and dock resize in those
  // commits, and cards must move with their containers. (Hook order:
  // this must run before the game-over early return.)
  const bonusOpen = !!ui.bonusDialog;
  const prevBonusOpen = useRef(bonusOpen);
  const bonusToggled = prevBonusOpen.current !== bonusOpen;
  prevBonusOpen.current = bonusOpen;
  const instantLayout = bonusOpen || bonusToggled;

  // Tracked here because the board below remounts on the ♣ toggle —
  // the same commit a ♣-triggered joker auto-places in.
  const jokerArrivals = useJokerArrivals(state.grid);
  // Engine-placed cards (opening deal, auto-placed jokers) pose in the
  // well, then fly to their cell via the same FLIP a manual Place gets.
  const { flight, hiddenSlots, cssDeal } = useAutoPlaceFlights(state);

  // Line spotlight: tapping a seated card (outside perk targeting)
  // lights up its row + column with their R/C names and live values —
  // the in-place reference for bonus cards that talk about "R1"/"C3".
  // Clears on its own, on a second tap, or on any game commit.
  const [spotlight, setSpotlight] = useState<number | null>(null);
  useEffect(() => {
    setSpotlight(null);
  }, [state]);
  useEffect(() => {
    if (spotlight === null) return;
    const t = window.setTimeout(() => setSpotlight(null), 3000);
    return () => window.clearTimeout(t);
  }, [spotlight]);

  const spotlightEnabled = ui.phaseKind === 'awaiting-action';
  const lineText = (kind: 'row' | 'col', index: number): string => {
    const line = liveReport.lines.find(
      l => l.kind === kind && l.index === index
    );
    const label = lineLabel(kind, index);
    if (!line || line.incomplete) return `${label} · open`;
    return `${label} · ${line.total}`;
  };
  const spotlightProp =
    spotlight !== null
      ? {
          idx: spotlight,
          rowText: lineText('row', Math.floor(spotlight / 5)),
          colText: lineText('col', spotlight % 5),
        }
      : null;

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
    <MotionConfig reducedMotion={reduceMotion ? 'always' : 'user'}>
      <LayoutGroup>
        <div
          className={[
            styles.layout,
            ui.bonusDialog ? styles.bonusOpen : null,
            // The coach yields entirely while the ♣ panel has the dock —
            // both don't fit a phone viewport, and the draw choice is
            // self-explanatory.
            coach && !ui.bonusDialog ? styles.coachOpen : null,
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <div className={styles.scoreSlot}>
            <ScoreBar
              onShowHandValues={() => setHandsOpen(true)}
              onShowLines={() => setLinesOpen(true)}
            />
          </div>

          {coach && !ui.bonusDialog && (
            <div className={styles.coachSlot}>{coach}</div>
          )}

          <div className={styles.linesSlot}>
            <LinesPanel report={liveReport} />
          </div>

          <div className={styles.boardArea}>
            <GridBoard
              // Remount on the ♣ toggle: a fresh mount renders seated
              // cards exactly where CSS puts them — no animation state
              // can carry stale geometry across the resize.
              key={bonusOpen ? 'board-compact' : 'board-full'}
              grid={state.grid}
              roleOf={ui.roleOf}
              isTappable={idx =>
                ui.isTappable(idx) ||
                (spotlightEnabled && state.grid[idx] !== null)
              }
              onCellTap={idx => {
                if (spotlightEnabled && state.grid[idx] !== null) {
                  setSpotlight(s => (s === idx ? null : idx));
                  return;
                }
                ui.onCellTap(idx);
              }}
              instantLayout={instantLayout}
              jokerArrivals={jokerArrivals}
              openingDeal={cssDeal}
              hiddenSlots={hiddenSlots}
              spotlight={spotlightProp}
            />
          </div>

          {(state.bonusCards.length > 0 || !state.noBonusCards) && (
            <div className={styles.bonusRowSlot}>
              <BonusCardStrip
                layout="row"
                cards={state.bonusCards}
                onSlotTap={
                  ui.bonusSlotPick
                    ? slot => dispatch({ type: 'BONUS_PICK_SLOT', slot })
                    : undefined
                }
                onUse={
                  ui.canActivateSpecials
                    ? idx => dispatch({ type: 'ACTIVATE_SPECIAL_CARD', idx })
                    : undefined
                }
                liveContext={card => bonusCardLiveContext(card, state)}
              />
            </div>
          )}

          <div className={styles.dock}>
            {/* The well stays mounted through the ♣ flow — unmounting it
                mid-phase strands the grid's shared card layoutIds (cards
                blink invisible), and the spent club is useful context. */}
            <div className={styles.dockRow}>
              <NextCardWell
                onPeekDeck={() => setPeekOpen(true)}
                instantLayout={instantLayout}
                flight={flight}
              />
              <span className={styles.dockText} role="status" aria-live="polite">
                {ui.banner}
              </span>
              {!ui.bonusDialog &&
                rowActions.map(a => (
                  <Button
                    key={a.id}
                    variant={a.variant}
                    // While an auto-placed card poses in the well, the
                    // dock pauses — committing then would act on the
                    // drawn card while the well shows the flight card.
                    disabled={a.disabled || flight !== null}
                    onClick={a.onPress}
                    className={
                      a.id === coachHighlight ? styles.coachPulse : undefined
                    }
                  >
                    {a.label}
                  </Button>
                ))}
            </div>
            {ui.bonusDialog ? (
              // ♣ draw takes over the dock — board stays fully visible.
              <BonusResolvePanel ui={ui.bonusDialog} />
            ) : (
              commitAction && (
                <Button
                  key={commitAction.id}
                  variant={commitAction.id === 'cancel' ? 'secondary' : commitAction.variant}
                  disabled={commitAction.disabled || flight !== null}
                  onClick={commitAction.onPress}
                  className={`${styles.commitButton}${
                    commitAction.id === coachHighlight
                      ? ` ${styles.coachPulse}`
                      : ''
                  }`}
                >
                  {commitAction.label}
                </Button>
              )
            )}
          </div>

          {(state.bonusCards.length > 0 || !state.noBonusCards) && (
            <div className={styles.bonusSlot}>
              <BonusCardStrip
                cards={state.bonusCards}
                onSlotTap={
                  ui.bonusSlotPick
                    ? slot => dispatch({ type: 'BONUS_PICK_SLOT', slot })
                    : undefined
                }
                onUse={
                  ui.canActivateSpecials
                    ? idx => dispatch({ type: 'ACTIVATE_SPECIAL_CARD', idx })
                    : undefined
                }
                liveContext={card => bonusCardLiveContext(card, state)}
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
      <ReviveSheet open={ui.reviveOpen} />
    </MotionConfig>
  );
}
