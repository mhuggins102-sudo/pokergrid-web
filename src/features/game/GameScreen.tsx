import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutGroup, MotionConfig } from 'motion/react';
import {
  ScoredLine,
  ScoreReport,
  bonusShapleyValues,
  scoreGrid,
} from '../../game/scoring';
import { Button, Sheet, useToast } from '../../design/primitives';
import { useGameSession } from './GameSessionProvider';
import { useCoachHighlight } from './coach';
import { usePhaseUI } from './usePhaseUI';
import { useGameSfx } from './useGameSfx';
import { useSettingsStore } from '../settings/settingsStore';
import { bonusCardLiveContext } from './bonusCardLiveContext';
import { lineLabel } from './handLabels';
import { GridBoard, useJokerArrivals } from './components/GridBoard';
import { LineRails } from './components/LineRails';
import { LineDetailSheet } from './components/LineDetailSheet';
import { useAutoPlaceFlights } from './useAutoPlaceFlights';
import { NextCardWell } from './components/NextCardWell';
import { ScoreBar } from './components/ScoreBar';
import { LinesPanel } from './components/LinesPanel';
import { BonusCardStrip } from './components/BonusCardStrip';
import { DeckPreviewDialog } from './components/DeckPreviewDialog';
import { BonusResolvePanel } from './components/BonusResolveDialog';
import { InvestWheel } from './components/InvestWheel';
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

const lineKeyOf = (kind: 'row' | 'col', index: number) => `${kind}${index}`;

/**
 * Slots on lines that JUST completed with a scoring hand (Pair+),
 * mapped to their stagger position along the line, so the board can
 * flash a sweep across them. High Card completions stay silent — they
 * score 0 and celebrating them would teach the wrong thing. Clears
 * itself once the flash has played; lives here (not in GridBoard) so
 * the board's ♣-toggle remounts can't replay it.
 */
function useLineCompletions(report: ScoreReport): ReadonlyMap<number, number> {
  const [sweep, setSweep] = useState<ReadonlyMap<number, number>>(
    () => new Map()
  );
  const prevRef = useRef<ReadonlySet<string> | null>(null);
  const completed = useMemo(() => {
    const set = new Set<string>();
    for (const l of report.lines) {
      if (l.hand && l.hand !== 'HIGH_CARD') set.add(lineKeyOf(l.kind, l.index));
    }
    return set;
  }, [report]);

  // Kept in a ref so unrelated state changes re-running the effect
  // can't cancel a pending clear (the flash must always expire).
  const timerRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = completed;
    if (prev === null) return; // opening state — nothing "just" completed
    const slots = new Map<number, number>();
    for (const l of report.lines) {
      const key = lineKeyOf(l.kind, l.index);
      if (!completed.has(key) || prev.has(key)) continue;
      for (let pos = 0; pos < 5; pos++) {
        const idx = l.kind === 'row' ? l.index * 5 + pos : pos * 5 + l.index;
        // A cell on two newly-completed lines keeps the earlier flash.
        const existing = slots.get(idx);
        if (existing === undefined || pos < existing) slots.set(idx, pos);
      }
    }
    if (slots.size === 0) return;
    setSweep(slots);
    // 250ms landing hold + 4 × 60ms stagger + 500ms flash ≈ 1s.
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setSweep(new Map()), 1100);
  }, [completed, report]);
  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  return sweep;
}

// Rails on → wrap the board with LineRails; off → board as-is.
function MaybeRails({
  enabled,
  children,
  ...rails
}: {
  enabled: boolean;
  children: ReactNode;
} & Omit<Parameters<typeof LineRails>[0], 'children'>) {
  return enabled ? <LineRails {...rails}>{children}</LineRails> : <>{children}</>;
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
  // Rail chip tapped → that line's full scoring breakdown.
  const [detailLine, setDetailLine] = useState<ScoredLine | null>(null);
  const lineRails = useSettingsStore(s => s.lineRails);

  const liveReport = useMemo(
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

  // Live per-card Shapley contribution, shown as a corner badge on each
  // held bonus card so the points it's adding are visible without opening
  // the popup. Mirrors the result-screen attribution but live (incomplete
  // lines ignored); only positive values are surfaced.
  const liveShapley = useMemo(
    () =>
      bonusShapleyValues(state.grid, state.bonusCards, {
        ignoreIncompletePenalty: true,
        deckRemaining: state.deck.length,
        discards: state.discards,
        perkSpent: state.perkSpent,
        handBoost: state.handBoost,
      }).map(v => (v > 0 ? v : undefined)),
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
  // Cells of a line that just completed with a scoring hand — flashed
  // as a staggered sweep on the board.
  const sweepSlots = useLineCompletions(liveReport);

  // Tap-to-place: during normal play the pulsing next slot commits a
  // PLACE directly (same dispatch path as the dock button, so tutorial
  // gating applies unchanged). Tapping any other empty cell nudges — a
  // first-run rescue for the universal "tap the board" instinct.
  const { toast } = useToast();
  const lastNudgeRef = useRef(0);

  // Line spotlight: tapping a seated card (outside perk targeting)
  // lights up its row + column with their R/C names and live values —
  // the in-place reference for bonus cards that talk about "R1"/"C3".
  // Clears on its own, on a second tap, or on any game commit.
  const [spotlight, setSpotlight] = useState<number | null>(null);
  useEffect(() => {
    setSpotlight(null);
    // A commit can change any line's math — close a stale detail sheet.
    setDetailLine(null);
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
  // With the rails showing, the spotlight lights the rail chips instead
  // of floating text tags — the values are already on screen. Rails
  // off restores the tags (they're the only per-line readout then).
  const spotlightProp =
    spotlight !== null
      ? lineRails
        ? { idx: spotlight }
        : {
            idx: spotlight,
            rowText: lineText('row', Math.floor(spotlight / 5)),
            colText: lineText('col', spotlight % 5),
          }
      : null;
  const railHighlight =
    lineRails && spotlight !== null
      ? { row: Math.floor(spotlight / 5), col: spotlight % 5 }
      : null;

  if (ui.isGameOver) {
    return <ResultView onReplay={onReplay} />;
  }

  // The dock's commit action (Place while deciding, Cancel while
  // targeting); remaining actions arrange per the dock-layout setting.
  const placeAction = ui.actions.find(a => a.id === 'place');
  const commitAction = placeAction ?? ui.actions.find(a => a.id === 'cancel');
  const rowActions = ui.actions.filter(a => a !== commitAction);

  // Mirrors the dock's pause: while an engine flight is posing in the
  // well, a board tap must not commit the drawn card either.
  const placeArmed =
    placeAction !== undefined && flight === null && hiddenSlots.size === 0;
  const boardRole = (idx: number) => {
    const role = ui.roleOf(idx);
    // Hold the next-slot ring until any staged flight (opening pose,
    // joker arrival) has landed — otherwise it highlights the SECOND
    // slot while the first card is still posing in the well.
    if (role === 'next' && (flight !== null || hiddenSlots.size > 0)) {
      return null;
    }
    return role;
  };
  const nudgePlacement = () => {
    const now = Date.now();
    if (now - lastNudgeRef.current < 4000) return;
    lastNudgeRef.current = now;
    toast('Cards land on the pulsing slot — tap it (or press Place).');
  };

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
            <div
              className={`${styles.boardFrame} ${
                lineRails ? '' : styles.boardFrameBare
              }`}
            >
              {/* Live line rails (optional, Settings): each row/column's
                  running total rides the board edge; tapping a chip
                  opens that line's full scoring breakdown. The spotlight
                  lights the tapped card's rail chips. */}
              <MaybeRails
                enabled={lineRails}
                grid={state.grid}
                report={liveReport}
                onLineTap={setDetailLine}
                highlight={railHighlight}
              >
              <GridBoard
                // Remount on the ♣ open/close toggle: a fresh mount
                // renders seated cards exactly where CSS puts them, so
                // motion's LayoutGroup never pins them to stale geometry
                // (the "board slid right until I left and came back"
                // bug — stripping layoutIds alone didn't purge the stale
                // projection). Mid-draw resizes are pure CSS while every
                // layoutId is stripped, so no per-size remount is needed.
                key={bonusOpen ? 'board-bonus' : 'board-full'}
                grid={state.grid}
                roleOf={boardRole}
                isTappable={idx =>
                  ui.isTappable(idx) ||
                  (spotlightEnabled && state.grid[idx] !== null) ||
                  // Normal play: every empty cell responds — the pulsing
                  // next slot places, the rest nudge toward it.
                  (spotlightEnabled && placeArmed && state.grid[idx] === null)
                }
                onCellTap={idx => {
                  if (spotlightEnabled && state.grid[idx] !== null) {
                    setSpotlight(s => (s === idx ? null : idx));
                    return;
                  }
                  if (spotlightEnabled && placeArmed && state.grid[idx] === null) {
                    // Same dispatch path as the dock's Place button, so
                    // tutorial gating and sfx behave identically.
                    if (boardRole(idx) === 'next') placeAction?.onPress();
                    else nudgePlacement();
                    return;
                  }
                  ui.onCellTap(idx);
                }}
                instantLayout={instantLayout}
                jokerArrivals={jokerArrivals}
                openingDeal={cssDeal}
                hiddenSlots={hiddenSlots}
                spotlight={spotlightProp}
                sweepSlots={sweepSlots}
              />
              </MaybeRails>
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
                values={liveShapley}
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
              // fates flanking it, commit full-width beneath. The banner
              // only takes space when a suit action is prompting — no
              // reserved slot, so there's no empty gap during normal play;
              // when it IS shown, the deck card shrinks to absorb the line
              // so the dock height (and the board) stays put.
              <div
                className={`${styles.stage} ${banner ? styles.stageHasBanner : ''}`}
              >
                {banner}
                <div className={styles.stageRow}>
                  <div className={styles.stageSide}>
                    {/* A 3rd+ secondary action (Double Duty's Flip)
                        stacks under the perk on the left side. */}
                    {rowActions[0] && actionBtn(rowActions[0], styles.stageBtn)}
                    {rowActions.slice(2).map(a => actionBtn(a, styles.stageBtn))}
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
                values={liveShapley}
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
      <LineDetailSheet
        line={detailLine}
        bonusCards={state.bonusCards}
        allLines={liveReport.lines}
        gridBonusesApplied={
          liveReport.gridMultiplier !== 1 || liveReport.gridFlat !== 0
        }
        onClose={() => setDetailLine(null)}
      />
      <DeckPreviewDialog open={peekOpen} onClose={() => setPeekOpen(false)} />
      <HandValuesDialog
        open={handsOpen}
        onClose={() => setHandsOpen(false)}
        handBoost={state.investHands ? state.handBoost : undefined}
      />
      <ReviveSheet open={ui.reviveOpen} />
      {ui.clubInvest && (
        <InvestWheel
          hand={ui.clubInvest.hand}
          amount={ui.clubInvest.amount}
        />
      )}
    </MotionConfig>
  );
}
