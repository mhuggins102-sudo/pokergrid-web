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
  const dockLayout = useSettingsStore(s => s.dockLayout);

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

  // The dock's commit action (Place while deciding, Cancel while
  // targeting); remaining actions arrange per the dock-layout setting.
  const commitAction =
    ui.actions.find(a => a.id === 'place') ??
    ui.actions.find(a => a.id === 'cancel');
  const rowActions = ui.actions.filter(a => a !== commitAction);

  const actionBtn = (a: (typeof ui.actions)[number], cls?: string) => (
    <Button
      key={a.id}
      variant={a.variant}
      // While an auto-placed card poses in the well, the dock pauses —
      // committing then would act on the drawn card while the well
      // shows the flight card.
      disabled={a.disabled || flight !== null}
      onClick={a.onPress}
      className={
        [a.id === coachHighlight ? styles.coachPulse : null, cls]
          .filter(Boolean)
          .join(' ') || undefined
      }
    >
      {a.label}
    </Button>
  );

  const commitBtn = (variantOverride?: 'secondary') =>
    commitAction &&
    actionBtn(
      variantOverride
        ? { ...commitAction, variant: variantOverride }
        : commitAction,
      styles.commitButton
    );

  const banner = ui.banner && (
    <span className={styles.dockText} role="status" aria-live="polite">
      {ui.banner}
    </span>
  );

  return (
    <MotionConfig reducedMotion={reduceMotion ? 'always' : 'user'}>
      <LayoutGroup>
        <div
          className={[
            styles.layout,
            dockLayout === 'classic' ? styles.dockClassic : null,
            dockLayout === 'center-stage' ? styles.dockStage : null,
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
            <div className={styles.boardSquare}>
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
          </div>

          {/* Hidden during the ♣ draw — the panel lists held cards
              itself when the choice involves them (replace flow), and
              the row's height goes to the board instead. */}
          {!ui.bonusDialog &&
            (state.bonusCards.length > 0 || !state.noBonusCards) && (
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
            {ui.bonusDialog ? (
              // ♣ draw takes over the whole dock — the well hides so the
              // board keeps as much room as possible. Safe to unmount:
              // instantLayout strips every shared layoutId while the
              // panel is open, so no FLIP pair gets stranded.
              <BonusResolvePanel ui={ui.bonusDialog} />
            ) : dockLayout === 'classic' ? (
              // Classic: slim card + meta row with the secondary actions,
              // full-width commit beneath.
              <>
                <div className={styles.dockRow}>
                  <NextCardWell
                    onPeekDeck={() => setPeekOpen(true)}
                    instantLayout={instantLayout}
                    flight={flight}
                  />
                  {banner}
                  {rowActions.map(a => actionBtn(a))}
                </div>
                {commitBtn(
                  commitAction?.id === 'cancel' ? 'secondary' : undefined
                )}
              </>
            ) : dockLayout === 'center-stage' ? (
              // Center stage: the card front and center, its two "spend"
              // fates flanking it, commit full-width beneath. While
              // targeting (a banner is showing), the well card shrinks by
              // the banner's height so the dock — and therefore the board
              // above it — keeps the exact same size as while deciding.
              <div
                className={[styles.stage, banner ? styles.stageTargeting : null]
                  .filter(Boolean)
                  .join(' ')}
              >
                {banner}
                <div className={styles.stageRow}>
                  <div className={styles.stageSide}>
                    {rowActions[0] && actionBtn(rowActions[0], styles.stageBtn)}
                  </div>
                  <div className={styles.stageWell}>
                    <NextCardWell
                      onPeekDeck={() => setPeekOpen(true)}
                      instantLayout={instantLayout}
                      stacked
                      flight={flight}
                    />
                  </div>
                  <div className={styles.stageSide}>
                    {rowActions[1] && actionBtn(rowActions[1], styles.stageBtn)}
                  </div>
                </div>
                {commitBtn(
                  commitAction?.id === 'cancel' ? 'secondary' : undefined
                )}
              </div>
            ) : (
              // Hand stack (default): the drawn card is the hero, with
              // the actions stacked by importance beside it. While
              // targeting, the banner takes the stack's top and Cancel
              // sinks to the bottom; while deciding, Place leads.
              <div className={styles.handStack}>
                <NextCardWell
                  onPeekDeck={() => setPeekOpen(true)}
                  instantLayout={instantLayout}
                  stacked
                  flight={flight}
                />
                <div className={styles.actionStack}>
                  {banner}
                  {commitAction?.id === 'place' && commitBtn()}
                  {rowActions.length > 0 && (
                    <div className={styles.actionRow}>
                      {rowActions.map(a => actionBtn(a))}
                    </div>
                  )}
                  {commitAction && commitAction.id !== 'place' && commitBtn('secondary')}
                </div>
              </div>
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
