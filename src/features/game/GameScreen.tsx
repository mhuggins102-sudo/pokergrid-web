import {
  CSSProperties,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNavigate } from 'react-router';
import { LayoutGroup, MotionConfig } from 'motion/react';
import {
  ScoredLine,
  ScoreReport,
  bonusShapleyValues,
  scoreGrid,
} from '../../game/scoring';
import { JOKERS_BY_DIFFICULTY } from '../../game/rules';
import { TARGETS_UP_STEP } from '../../game/challenges';
import { canPreviewDeck } from '../../game/state';
import { targetsUpReached, tierForRun } from '../../lib/stats';
import {
  Button,
  Sheet,
  useTapPopover,
  useTapPopoverCloseAll,
  useToast,
} from '../../design/primitives';
import { difficultyColors } from '../../design/tokens';
import { useNavExtras } from '../../app/DesktopNav';
import { useGameSession } from './GameSessionProvider';
import { useGameFamily } from './useGameFamily';
import { useTier } from '../../app/useTier';
import { useCoachHighlight } from './coach';
import { usePhaseUI } from './usePhaseUI';
import { useGameSfx } from './useGameSfx';
import { useSettingsStore } from '../settings/settingsStore';
import { useStatsStore } from '../progress/statsStore';
import { bonusCardLiveContext } from './bonusCardLiveContext';
import { lineLabel } from './handLabels';
import {
  cardFiresOnLine,
  endgameRows as computeEndgameRows,
  purpleProgress,
} from './lineInsights';
import { GridBoard, useJokerArrivals } from './components/GridBoard';
import {
  TIER_RULES,
  requirementFor,
} from './components/TierBreakdownSheet';
import { LineRails } from './components/LineRails';
import { LineDetailSheet } from './components/LineDetailSheet';
import { useAutoPlaceFlights } from './useAutoPlaceFlights';
import { NextCardWell } from './components/NextCardWell';
import { ScoreBar } from './components/ScoreBar';
import { LinesPanel } from './components/LinesPanel';
import { BonusCardStrip } from './components/BonusCardStrip';
import { DeckPreviewDialog } from './components/DeckPreviewDialog';
import { BonusResolvePanel } from './components/BonusResolveDialog';
import {
  DailyLeaderboardPanel,
  DeskStatsPanel,
  DesktopBonusPanel,
  EdgeRails,
  ScoringPanel,
} from './components/DesktopRails';
import { InvestWheel } from './components/InvestWheel';
import {
  DeskHandValuesPanel,
  HandValuesDialog,
} from './components/HandValuesDialog';
import { ReviveSheet } from './components/ReviveSheet';
import { ResultView } from './components/ResultView';
import { BonusDrawModal } from './components/BonusDrawModal';
import { DesktopResultDialog } from './components/DesktopResultDialog';
import styles from './GameScreen.module.css';

export interface GameScreenProps {
  onReplay: () => void;
  /** Tutorial coach panel; floats over the header + score strip on
   *  phones (rides the right column on desktop) so the board keeps
   *  its full size. */
  coach?: ReactNode;
}

const lineKeyOf = (kind: 'row' | 'col', index: number) => `${kind}${index}`;

// Desktop hover model (the mockup's `hv`, lines 625–646): what the
// pointer is on — a line (edge chip / SCORING row), a seated card's
// cell, or a held bonus card. null = nothing hovered.
type HoverTarget =
  | { type: 'line'; tag: string }
  | { type: 'cell'; r: number; c: number }
  | { type: 'bonus'; idx: number };

const NO_TAGS: ReadonlySet<string> = new Set();
// Desk families: the completion sweep never runs (revision item — the
// column family keeps it); the empty map suppresses it per board render.
const NO_SWEEP: ReadonlyMap<number, number> = new Map();

// Vertical slack (px, each side) reserved around the board frame for
// Card Room's felt bleed — see the frame-width computation below and
// the matching -12px in GameScreen.module.css's CSS fallbacks.
const FELT_BLEED = 6;

// On-device layout forensics: any game URL + `?layoutdebug=1` paints a
// live readout of every quantity in the board-sizing pipeline — the
// tutorial mis-layout only reproduces on physical iOS Safari, so this
// is how a user screenshot pinpoints which number goes wrong. Plain
// DOM (no React state): updated from the same measure pipeline it
// reports on.
function debugReport(area: HTMLElement, frame: HTMLElement): void {
  if (!new URLSearchParams(window.location.search).has('layoutdebug')) return;
  let box = document.getElementById('pg-layout-debug');
  if (!box) {
    box = document.createElement('div');
    box.id = 'pg-layout-debug';
    Object.assign(box.style, {
      position: 'fixed',
      top: '4px',
      left: '4px',
      zIndex: '9999',
      background: 'rgba(0, 0, 0, 0.75)',
      color: '#9f9',
      font: '10px/1.5 monospace',
      padding: '4px 6px',
      borderRadius: '4px',
      pointerEvents: 'none',
      whiteSpace: 'pre',
    } as Partial<CSSStyleDeclaration>);
    document.body.appendChild(box);
  }
  const fmt = (r: DOMRect) =>
    `${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}×${Math.round(r.height)}`;
  const vv = window.visualViewport;
  box.textContent = [
    `inner ${window.innerWidth}×${window.innerHeight}`,
    `vv ${vv ? `${Math.round(vv.width)}×${Math.round(vv.height)}` : 'n/a'}`,
    `area ${fmt(area.getBoundingClientRect())}`,
    `frame ${fmt(frame.getBoundingClientRect())}`,
    `applied ${frame.style.width || '(css fallback)'}`,
  ].join('\n');
}

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
  const { state, dispatch, mode, setup, canUndo, maxUndos, viewOnly } =
    useGameSession();
  const ui = usePhaseUI();
  const familyRaw = useGameFamily();
  // Tutorial pins COLUMN below the desktop tier (plan C): the coach flow
  // is column-tuned; ≥1024 keeps the desk tree (coach in the right rail).
  const family = coach && familyRaw === 'desk-lite' ? 'column' : familyRaw;
  const isDesk = family !== 'column';
  // The raw tier (not the game family) drives the column measure cap:
  // tablet-portrait is column too, but earns the higher ~600px board cap.
  const tier = useTier();
  const navigate = useNavigate();
  const coachHighlight = useCoachHighlight();
  const [peekOpen, setPeekOpen] = useState(false);
  const [handsOpen, setHandsOpen] = useState(false);
  const [linesOpen, setLinesOpen] = useState(false);
  // Rail chip tapped → that line's full scoring breakdown.
  const [detailLine, setDetailLine] = useState<ScoredLine | null>(null);
  // Desktop hover model — line / cell / bonus-card hover (mockup hv).
  const [hover, setHover] = useState<HoverTarget | null>(null);
  // Desktop result dialog visibility (View Grid closes; the dock's
  // Show result reopens — the agreed reopen path the mockup lacks).
  // A re-hydrated archive view opens in the post-View-Grid state: the
  // finished board first, the dialog one click away.
  const [resultOpen, setResultOpen] = useState(!viewOnly);
  // Rails stay off for the whole tutorial regardless of the setting:
  // the guided deal never references line totals, and the plain board
  // is one less thing to explain — the extra ~30px goes to the grid.
  const lineRails = useSettingsStore(s => s.lineRails) && !coach;
  // Desktop edge chips ride their own persisted key (default ON, the
  // mockup's pg-rails default) so the phone rails choice stays
  // independent — see settingsStore.deskLineChips.
  const deskLineChips = useSettingsStore(s => s.deskLineChips);

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

  // Desktop keeps rendering the three-column view once the game ends
  // (the result arrives as an overlay dialog instead of a screen swap)
  // — the panels then show the FINAL math, incomplete-line penalties
  // included, so the frozen board reconciles with the verdict.
  const finished = ui.isGameOver;
  const finalReport = useMemo(
    () =>
      finished
        ? scoreGrid(state.grid, state.bonusCards, {
            deckRemaining: state.deck.length,
            discards: state.discards,
            perkSpent: state.perkSpent,
            handBoost: state.handBoost,
          })
        : null,
    [finished, state]
  );
  const activeReport = finalReport ?? liveReport;

  // Desktop nav pill cluster (per the mockup's header, lines 80–90):
  // an optional ✦ twist pill (challenge runs / twisted dailies) and
  // the difficulty/score pill, each with a hover/focus rules menu.
  // Memoized so the nav only re-renders when a value actually changes;
  // the hook clears the slot when the game unmounts. The column family
  // passes null — the pill rides the desk families' nav header only.
  const twist = setup.challenge;
  // Targets-Up runs wear a ✦ ladder pill before the difficulty pill —
  // the twist-pill pattern reused: same chrome, same hover/focus menu,
  // but carrying the rung's numbers instead of a challenge goal.
  const tuLevel = mode.kind === 'targets' ? mode.level : null;
  const tuBest = useStatsStore(s => s.stats.targetsUpBest);
  const navScore = activeReport.total;

  // Touch tap-toggles for the four in-game nav-pill hover menus
  // (decision E): the ✦ twist pill, the ✦ Targets-Up ladder pill, and
  // the split pill's two segments (difficulty rules, score tiers). Hooks
  // can't live inside the navPill useMemo, so they're called here and
  // closed over below. The pills render into the desk nav's extras slot
  // (still inside the TapPopover provider), so registry / outside-tap /
  // route / game-commit dismissal all reach them.
  const twistPop = useTapPopover('pill-twist');
  const ladderPop = useTapPopover('pill-ladder');
  const diffPop = useTapPopover('pill-diff');
  const scorePop = useTapPopover('pill-score');

  // Game-commit dismissal (decision E): every committed action produces a
  // NEW state object (the reducer is pure — GameSessionProvider), so this
  // closes any open tap-popover on each commit. View-only archive runs
  // never dispatch, so they never trigger it.
  const closeAllPopovers = useTapPopoverCloseAll();
  useEffect(() => {
    closeAllPopovers();
  }, [state, closeAllPopovers]);

  const navPill = useMemo(() => {
    const tone = difficultyColors[state.difficulty];
    const ladderRows: [string, string][] =
      tuLevel === null
        ? []
        : [
            [
              'Ruleset',
              state.difficulty.charAt(0).toUpperCase() +
                state.difficulty.slice(1),
            ],
            ['Next level target', String(state.target + TARGETS_UP_STEP)],
            ['Wins this run', String(tuLevel - 1)],
            // Stored = highest beaten; shown = highest REACHED (+1).
            ...(tuBest > 0
              ? ([
                  ['Best level reached', `L${targetsUpReached(tuBest)}`],
                ] as [string, string][])
              : []),
          ];
    // Game over (including view-only revisits): the earned tier's row
    // lights up in the score segment's tier menu.
    const earnedTier = finished
      ? tierForRun({
          score: navScore,
          target: state.target,
          won: navScore >= state.target,
        })
      : null;
    const rules: [string, string][] = [
      ['Jokers in deck', String(JOKERS_BY_DIFFICULTY[state.difficulty])],
      ['Deck peek', canPreviewDeck(state.difficulty) ? 'Available' : '—'],
      ['Undo', maxUndos > 0 ? `${maxUndos} per game` : '—'],
      ['Discards', state.noDiscards ? 'Off' : 'On'],
      ['Target score', String(state.target)],
    ];
    return (
      <span className={styles.navPillGroup}>
        {twist && (
          <span
            ref={twistPop.wrapRef}
            className={`${styles.navMenuWrap} ${
              twistPop.open ? styles.navMenuWrapOpen : ''
            }`}
            tabIndex={0}
            {...twistPop.toggleProps}
          >
            <span className={styles.twistPill}>
              <span className={styles.twistStar} aria-hidden="true">
                ✦
              </span>
              {twist.name}
            </span>
            <div className={`${styles.navMenu} ${styles.navMenuWide}`}>
              <div className={`${styles.navMenuHead} ${styles.navMenuHeadAccent}`}>
                Twist · {twist.synopsis.replace(/^Twist:\s*/i, '')}
              </div>
              <div className={styles.navMenuGoal}>{twist.goal}</div>
            </div>
          </span>
        )}
        {tuLevel !== null && (
          <span
            ref={ladderPop.wrapRef}
            className={`${styles.navMenuWrap} ${
              ladderPop.open ? styles.navMenuWrapOpen : ''
            }`}
            tabIndex={0}
            {...ladderPop.toggleProps}
          >
            <span className={styles.twistPill}>
              <span className={styles.twistStar} aria-hidden="true">
                ✦
              </span>
              Targets Up · L{tuLevel}
            </span>
            <div className={styles.navMenu}>
              <div
                className={`${styles.navMenuHead} ${styles.navMenuHeadAccent}`}
              >
                Ladder · level {tuLevel}
              </div>
              {ladderRows.map(([k, v]) => (
                <div key={k} className={styles.navMenuRow}>
                  <span>{k}</span>
                  <b>{v}</b>
                </div>
              ))}
            </div>
          </span>
        )}
        {/* One pill, two hover zones: the difficulty segment keeps the
            rules menu, the score segment opens the tier thresholds for
            this run's target. The zones are position: static, so both
            menus anchor to the pill itself (its right edge). */}
        <span
          className={`${styles.navPill} ${styles.navPillSplit}`}
          style={{ '--pill-tone': tone } as CSSProperties}
        >
          <span
            ref={diffPop.wrapRef}
            className={`${styles.navPillSeg} ${
              diffPop.open ? styles.navPillSegOpen : ''
            }`}
            tabIndex={0}
            {...diffPop.toggleProps}
          >
            <span className={styles.navPillDot} aria-hidden="true" />
            <span className={styles.navPillDiff}>{state.difficulty}</span>
            <div className={styles.navMenu}>
              <div className={styles.navMenuHead} style={{ color: tone }}>
                {state.difficulty} · rules
              </div>
              {rules.map(([k, v]) => (
                <div key={k} className={styles.navMenuRow}>
                  <span>{k}</span>
                  <b>{v}</b>
                </div>
              ))}
            </div>
          </span>
          <span
            ref={scorePop.wrapRef}
            className={`${styles.navPillSeg} ${
              scorePop.open ? styles.navPillSegOpen : ''
            }`}
            tabIndex={0}
            {...scorePop.toggleProps}
          >
            <span
              className={styles.navPillScore}
              aria-label={`Score ${navScore} of ${state.target}`}
            >
              {navScore}
              <span className={styles.navPillTarget}>/ {state.target}</span>
            </span>
            <div className={styles.navMenu}>
              <div className={styles.navMenuHead}>
                Score tiers · target {state.target}
              </div>
              {TIER_RULES.map(rule => (
                <div
                  key={rule.tier}
                  className={`${styles.navMenuRow} ${
                    rule.tier === earnedTier ? styles.navMenuRowOn : ''
                  }`}
                >
                  <span>
                    {rule.tier} · {rule.label}
                  </span>
                  <b>{requirementFor(rule, state.target)}</b>
                </div>
              ))}
            </div>
          </span>
        </span>
      </span>
    );
  }, [
    state.difficulty,
    navScore,
    state.target,
    state.noDiscards,
    maxUndos,
    twist,
    tuLevel,
    tuBest,
    finished,
    twistPop,
    ladderPop,
    diffPop,
    scorePop,
  ]);
  useNavExtras(isDesk ? navPill : null);

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

  // View-only archive revisits stay silent — no replayed place ticks,
  // no win/lose sting (revision item 17).
  useGameSfx(state, liveReport.total, viewOnly);
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
  // A re-hydrated archive view renders its finished board seated.
  const { flight, hiddenSlots, cssDeal } = useAutoPlaceFlights(
    state,
    viewOnly
  );
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
    // A commit can change any line's math — close a stale detail sheet
    // and drop any live hover (the mockup clears hv on every move).
    setDetailLine(null);
    setHover(null);
  }, [state]);
  useEffect(() => {
    if (spotlight === null) return;
    const t = window.setTimeout(() => setSpotlight(null), 3000);
    return () => window.clearTimeout(t);
  }, [spotlight]);

  // Board sizing source of truth: a ResizeObserver (plus late-signal
  // re-reads) measures .boardArea and sets .boardFrame's width as a
  // PLAIN INLINE PIXEL VALUE — no min(), no custom properties, no
  // container-query units anywhere in the applied style. The CSS
  // min(var…, cq…) rule remains only as the no-JS / first-paint
  // fallback. History: cq units alone broke on iOS Safari (no
  // re-resolution on rotation/first layout), and a build that fed
  // measured px through CSS custom properties + min() STILL mis-sized
  // the tutorial on device — so the applied width now leaves CSS
  // entirely. Re-reads happen on every signal iOS's late layout passes
  // emit: double-rAF after mount, visualViewport resize, orientation
  // change, pageshow, fonts.ready.
  const measureCleanupRef = useRef<(() => void) | null>(null);
  const boardFrameRef = useRef<HTMLDivElement | null>(null);
  // Rails add ~30px to the frame; caps mirror the CSS per breakpoint.
  const railsRef = useRef(lineRails);
  railsRef.current = lineRails;
  // Family + tier mirrored into refs so the measure pipeline (a stable
  // callback) reads today's value in lockstep with the render that set
  // it: family gates whether JS sizes the board at all (column only);
  // tier lifts the column cap at the tablet tier.
  const familyRef = useRef(family);
  familyRef.current = family;
  const tierRef = useRef(tier);
  tierRef.current = tier;
  const remeasureRef = useRef<(() => void) | null>(null);
  const boardAreaRef = useCallback((el: HTMLDivElement | null) => {
    measureCleanupRef.current?.();
    measureCleanupRef.current = null;
    remeasureRef.current = null;
    if (!el) return;
    const apply = (w: number, h: number) => {
      el.style.setProperty('--avail-w', `${w}px`);
      el.style.setProperty('--avail-h', `${h}px`);
      const frame = boardFrameRef.current;
      if (!frame) return;
      if (familyRef.current !== 'column') {
        // Desk families (desk / desk-lite): the grid column sizes the
        // board (CSS width), so JS backs off — release the inline width.
        frame.style.removeProperty('width');
        if (el.style.getPropertyValue('--avail-w')) debugReport(el, frame);
        return;
      }
      // Column caps mirror the CSS fallbacks per breakpoint. The tablet
      // tier (portrait column) earns the higher ~600px board cap; below
      // it the legacy 640 width-step splits the phone caps. The 640
      // query is a size step INSIDE the column family, not a family
      // decision.
      const cap =
        tierRef.current === 'tablet'
          ? railsRef.current
            ? 630
            : 600
          : window.matchMedia?.('(min-width: 640px)').matches
            ? railsRef.current
              ? 550
              : 520
            : railsRef.current
              ? 470
              : 440;
      // Card Room's felt panel bleeds --board-pad (6px) past the cells
      // on every side (GridBoard ::before, negative inset). Reserve that
      // bleed on the height axis so a height-constrained board never
      // lets the felt eat the layout gap to the score bar / bonus row.
      // Constant across themes (not read from the token) so switching
      // themes never resizes the grid.
      frame.style.width = `${Math.min(w, h - FELT_BLEED * 2, cap)}px`;
      debugReport(el, frame);
    };
    const remeasure = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) apply(r.width, r.height);
    };
    remeasureRef.current = remeasure;
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(entries => {
        const r = entries[0]?.contentRect;
        if (r && r.width > 0 && r.height > 0) apply(r.width, r.height);
      });
      ro.observe(el);
    }
    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(remeasure);
    });
    const vv = window.visualViewport;
    vv?.addEventListener('resize', remeasure);
    window.addEventListener('orientationchange', remeasure);
    window.addEventListener('pageshow', remeasure);
    document.fonts?.ready.then(remeasure, () => {});
    measureCleanupRef.current = () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      vv?.removeEventListener('resize', remeasure);
      window.removeEventListener('orientationchange', remeasure);
      window.removeEventListener('pageshow', remeasure);
    };
  }, []);
  // The rails toggle changes the cap (and the frame's contents) — the
  // observer won't fire for that, so re-apply explicitly.
  useEffect(() => {
    remeasureRef.current?.();
  }, [lineRails]);
  // Rotation / tier flips change whether JS sizes the board and which
  // column cap applies — the observer won't fire for a family change on
  // a same-size area, so re-apply (setting the width) or release it
  // (removing the inline width) explicitly.
  useEffect(() => {
    remeasureRef.current?.();
  }, [family]);

  // Desktop hover model gate: cell hover is disabled while a perk /
  // green action is targeting. When targeting CLEARS, board-cell
  // highlights only resume after a short grace (~600ms) — the commit
  // click leaves the pointer parked on a cell, and lighting it up the
  // same instant startles. Any pointer movement after the grace
  // re-reports the cell (GridBoard's mousemove), so nothing sticks
  // dark. Chips / table rows resume immediately (they gate on
  // hoverEnabled alone).
  const hoverEnabled = ui.phaseKind === 'awaiting-action' || finished;
  const [cellHoverArmed, setCellHoverArmed] = useState(true);
  useEffect(() => {
    if (!hoverEnabled) {
      setCellHoverArmed(false);
      return;
    }
    const t = window.setTimeout(() => setCellHoverArmed(true), 600);
    return () => window.clearTimeout(t);
  }, [hoverEnabled]);

  const spotlightEnabled = ui.phaseKind === 'awaiting-action';
  const lineText = (kind: 'row' | 'col', index: number): string => {
    const line = liveReport.lines.find(
      l => l.kind === kind && l.index === index
    );
    const label = lineLabel(kind, index);
    if (!line || line.incomplete) return `${label} · open`;
    return `${label} · ${line.total}`;
  };
  // Desktop shows the board edge chips (the mockup's line totals)
  // unless the Line Rails setting turns them off — and never during
  // the tutorial: the guided deal never references line totals,
  // matching the mobile rails-off rationale.
  const chipsShown = isDesk && !coach && deskLineChips;
  // With chips/rails showing, the spotlight lights those chips instead
  // of floating text tags — the values are already on screen. Rails
  // off restores the tags (they're the only per-line readout then).
  const spotlightProp =
    spotlight !== null
      ? chipsShown || lineRails
        ? { idx: spotlight }
        : {
            idx: spotlight,
            rowText: lineText('row', Math.floor(spotlight / 5)),
            colText: lineText('col', spotlight % 5),
          }
      : null;
  const railHighlight =
    (chipsShown || lineRails) && spotlight !== null
      ? { row: Math.floor(spotlight / 5), col: spotlight % 5 }
      : null;

  // Game over: every desk-family run except the tutorial stays on the
  // three-column view with the result dialog overlaid (mockup lines
  // 228–260) — free, daily, challenges, and Targets-Up alike. The
  // Targets-Up ladder lifecycle (record → save advance/clear → the
  // S/SS RewardsSheet picks) lives in useTargetsResult, shared with the
  // column family's ResultView and guarded so the commit has exactly
  // one owner — the guard the live rotation family-flip exercises. The
  // column family (and the tutorial's bespoke wrap-up) keeps the full
  // ResultView exactly as before.
  const deskResult = isDesk && mode.kind !== 'tutorial';
  if (ui.isGameOver && !deskResult) {
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

  // The interactive board, shared by both layout forks; the desktop
  // fork layers its hover-model props on top via `extra`.
  const board = (extra?: Partial<Parameters<typeof GridBoard>[0]>) => (
    <GridBoard
      // Remount on the ♣ open/close toggle: a fresh mount renders
      // seated cards exactly where CSS puts them, so motion's
      // LayoutGroup never pins them to stale geometry (the "board slid
      // right until I left and came back" bug — stripping layoutIds
      // alone didn't purge the stale projection). Mid-draw resizes are
      // pure CSS while every layoutId is stripped, so no per-size
      // remount is needed.
      // The remount exists for the COLUMN resize on the club toggle —
      // the desk families never change board size for the draw (♣ is a
      // modal / in-dock panel there), so remounting would only replay
      // entrances. desk-lite's CSS-sized board must never remount on ♣:
      // the remount is purely a column-resize workaround.
      key={family === 'column' && bonusOpen ? 'board-bonus' : 'board-full'}
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
      {...extra}
    />
  );

  // Sheets/dialogs shared by both forks.
  const overlays = (
    <>
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
        <InvestWheel hand={ui.clubInvest.hand} amount={ui.clubInvest.amount} />
      )}
    </>
  );

  // ---- Desk families: the three-column redesign ----
  // Left rail = SCORING + leaderboard/stats; center = board with edge
  // chips; right rail = deck/actions + bonus cards. Same engine, same
  // phase UI — only the seating changes. Both desk families render the
  // full three-column tree: desk (≥1024) at full width, desk-lite
  // (tablet-landscape) as the same grid compressed via track widths and
  // paddings (see .deskLite) — text sizes stay put.
  if (isDesk) {
    const discardAction = ui.actions.find(a => a.id === 'discard');
    const stackActions = ui.actions.filter(a => a.id !== 'discard');
    const deskBanner = ui.banner && (
      <span className={styles.deskBanner} role="status" aria-live="polite">
        {ui.banner}
      </span>
    );

    // ---- Shared hover model (mockup lines 625–693) ----
    // Everything derives from `hover`: the set of line tags currently
    // "active". A line hover is itself; a cell hover is its row+column;
    // a bonus hover is every line that card fires on (in-game) or its
    // purple progress tags (end-game). Touch-primary devices at this
    // width (iPad landscape) never get the JS handlers — taps must not
    // strand a phantom hover.
    const hoverCapable =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(hover: hover)').matches;
    const lines = activeReport.lines;
    const purpleInputs = {
      grid: state.grid,
      lines,
      deckRemaining: state.deck.length,
      discards: state.discards,
      perkSpent: state.perkSpent,
    };
    const activeTags: ReadonlySet<string> = (() => {
      if (!hover) return NO_TAGS;
      if (hover.type === 'line') return new Set([hover.tag]);
      if (hover.type === 'cell') {
        return new Set([`R${hover.r + 1}`, `C${hover.c + 1}`]);
      }
      const card = state.bonusCards[hover.idx];
      if (!card) return NO_TAGS;
      if (card.lineEffect) {
        return new Set(
          lines
            .filter(l => cardFiresOnLine(card, l, lines))
            .map(l => lineLabel(l.kind, l.index))
        );
      }
      return purpleProgress(card, purpleInputs)?.tags ?? NO_TAGS;
    })();
    const anyHover = hover !== null;
    // Cell hover is disabled while a perk / green action is targeting
    // (mockup lines 736–737); edge chips mute then too (railMute).
    // hoverEnabled + the cellHoverArmed grace live above the game-over
    // early return (hooks).
    const lineIsActive = (line: ScoredLine) =>
      activeTags.has(lineLabel(line.kind, line.index));
    const lineHover = {
      any: anyHover,
      muted: !hoverEnabled,
      isActive: lineIsActive,
      onEnter: (line: ScoredLine) =>
        setHover({ type: 'line', tag: lineLabel(line.kind, line.index) }),
      onLeave: () => setHover(null),
    };
    const lineHovered =
      hover?.type === 'line'
        ? lines.find(l => lineLabel(l.kind, l.index) === hover.tag)
        : undefined;
    const bonusHover = {
      isActive: (i: number) => {
        if (hover?.type === 'bonus') return hover.idx === i;
        const card = state.bonusCards[i];
        return (
          !!lineHovered &&
          !!card?.lineEffect &&
          cardFiresOnLine(card, lineHovered, lines)
        );
      },
      isDim: (i: number) => hover?.type === 'bonus' && hover.idx !== i,
      onEnter: (i: number) => setHover({ type: 'bonus', idx: i }),
      onLeave: () => setHover(null),
      progress: (i: number) => {
        const card = state.bonusCards[i];
        return card ? purpleProgress(card, purpleInputs) : null;
      },
    };
    const cellHoverState = (idx: number): 'lit' | 'dim' | null => {
      if (!anyHover) return null;
      const r = Math.floor(idx / 5);
      const c = idx % 5;
      return activeTags.has(`R${r + 1}`) || activeTags.has(`C${c + 1}`)
        ? 'lit'
        : 'dim';
    };
    const endgame = computeEndgameRows(state.bonusCards, purpleInputs);
    const playAgain = () =>
      mode.kind === 'daily' ? navigate('/daily/archive') : onReplay();
    const deskBoard = board({
      // No completion sweep on desktop (revision item 11).
      sweepSlots: NO_SWEEP,
      hoverState: hoverCapable ? cellHoverState : undefined,
      onCellHover: hoverCapable && hoverEnabled
        ? idx => {
            if (idx === null) {
              // Leave only clears a CELL hover — a chip/bonus hover in
              // flight must not be wiped by a stray board leave.
              setHover(h => (h?.type === 'cell' ? null : h));
              return;
            }
            if (!cellHoverArmed) return; // post-targeting grace
            const r = Math.floor(idx / 5);
            const c = idx % 5;
            // Identity-guarded: mousemove re-reports the same cell on
            // every pixel — returning the previous state skips the
            // re-render.
            setHover(h =>
              h?.type === 'cell' && h.r === r && h.c === c
                ? h
                : { type: 'cell', r, c }
            );
          }
        : undefined,
      hoverOutline: idx => ui.isTappable(idx) || boardRole(idx) === 'next',
      // The pulsing next slot names its action (mockup line 746).
      nextSlotLabel: 'PLACE',
      // The finished board stays explorable: seated cards keep the
      // spotlight tap and (being enabled) their hover affordance.
      ...(finished
        ? {
            isTappable: idx => state.grid[idx] !== null,
            onCellTap: idx => setSpotlight(s => (s === idx ? null : idx)),
          }
        : {}),
    });

    return (
      <MotionConfig reducedMotion={reduceMotion ? 'always' : 'user'}>
        <LayoutGroup>
          <div
            className={`${styles.desk} ${
              family === 'desk-lite' ? styles.deskLite : ''
            }`}
          >
            {/* Both desk families render the left rail; desk-lite
                (tablet-landscape) just compresses the grid tracks (see
                .deskLite). The tutorial still empties it via `!coach`. */}
            {isDesk && (
              <div className={styles.deskRail}>
                {/* While the tutorial coach is up the left rail stays
                    empty — the guided deal never references the SCORING
                    numbers or the stats, exactly why the column
                    suppresses its rails (and this fork its edge chips)
                    on the same `!coach` condition. The panels arrive
                    with the chips when the free tail dismisses the
                    coach. */}
                {!coach && (
                  <>
                    <ScoringPanel
                      report={activeReport}
                      onLineTap={setDetailLine}
                      investBoost={
                        state.investHands ? state.handBoost : undefined
                      }
                      bonusCards={state.bonusCards}
                      handBoost={state.handBoost}
                      endgame={endgame}
                      hover={hoverCapable ? lineHover : undefined}
                    />
                    {mode.kind === 'daily' ? (
                      <DailyLeaderboardPanel
                        dateISO={mode.dateISO}
                        finished={finished}
                        finalScore={activeReport.total}
                      />
                    ) : (
                      <DeskStatsPanel difficulty={state.difficulty} />
                    )}
                  </>
                )}
              </div>
            )}

            <div className={styles.deskCenter}>
              <div className={styles.deskBoard}>
                {chipsShown ? (
                  <EdgeRails
                    report={activeReport}
                    onLineTap={setDetailLine}
                    highlight={railHighlight}
                    bonusCards={state.bonusCards}
                    handBoost={state.handBoost}
                    hover={hoverCapable ? lineHover : undefined}
                  >
                    {deskBoard}
                  </EdgeRails>
                ) : (
                  deskBoard
                )}
              </div>
            </div>

            <div className={styles.deskRail}>
              {coach && !ui.bonusDialog && (
                <div className={styles.deskCoach}>{coach}</div>
              )}
              <section className={styles.deskDock} aria-label="Deck and actions">
                {finished ? (
                  // Game over, dialog dismissed via View Grid: the dock
                  // offers only the way back in (and the replay).
                  // Targets-Up WINS get no dock replay — the continue
                  // actions (Choose Reward(s) / Next Round) live in the
                  // dialog, where the ladder commit can gate them. A
                  // LOSS has nothing to gate (the save is already
                  // cleared), so its dock offers Play Again → a fresh
                  // level-1 run, matching the dialog's lost-path
                  // restart.
                  <div className={styles.deskDockStage}>
                    <div className={styles.deskActions}>
                      <Button
                        variant="primary"
                        className={styles.deskStackBtn}
                        onClick={() => setResultOpen(true)}
                      >
                        Show result
                      </Button>
                      {(mode.kind !== 'targets' ||
                        activeReport.total < state.target) && (
                        <Button
                          variant="secondary"
                          className={styles.deskStackBtn}
                          onClick={playAgain}
                        >
                          Play Again
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div
                    className={
                      // 'center-stage' = the mockup's hero arrangement;
                      // 'hand-stack' and 'classic' both map to the
                      // compact card-beside-buttons variant.
                      dockLayout === 'center-stage'
                        ? styles.deskDockStage
                        : styles.deskDockCompact
                    }
                  >
                    <NextCardWell
                      onPeekDeck={() => {}}
                      instantLayout={instantLayout}
                      stacked
                      meta="deck"
                      peek="hover"
                      flight={flight}
                    />
                    <div className={styles.deskActions}>
                      {deskBanner}
                      {stackActions.map(a =>
                        actionBtn(
                          a,
                          a.id === 'perk'
                            ? `${styles.deskStackBtn} ${styles.deskPerkBtn}`
                            : styles.deskStackBtn
                        )
                      )}
                      <div className={styles.deskBtnRow}>
                        {discardAction ? (
                          actionBtn(discardAction)
                        ) : (
                          <Button variant="secondary" disabled>
                            Discard
                          </Button>
                        )}
                        <Button
                          variant="secondary"
                          disabled={!canUndo || flight !== null}
                          onClick={() => dispatch({ type: 'UNDO' })}
                          aria-label={`Undo (${Math.max(
                            0,
                            maxUndos - state.undoCount
                          )} left)`}
                        >
                          {/* Icon-only in the compressed desk-lite rail
                              so Discard keeps a full-word button. */}
                          {family === 'desk-lite' ? '↺' : '↺ Undo'}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </section>
              {state.bonusCards.length > 0 || !state.noBonusCards ? (
                <DesktopBonusPanel
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
                  hover={hoverCapable ? bonusHover : undefined}
                />
              ) : state.investHands ? (
                // Bull Market: no bonus cards exist (♣ invests into
                // hand values instead), so the panel slot shows the
                // live hand-value table the twist is mutating. Bonus
                // cards would take precedence if a mode ever combined
                // them (none does — investHands pairs noBonusCards).
                <DeskHandValuesPanel handBoost={state.handBoost} />
              ) : null}
            </div>
          </div>
        </LayoutGroup>
        {overlays}
        {ui.bonusDialog && <BonusDrawModal ui={ui.bonusDialog} />}
        {finished && (
          <DesktopResultDialog
            open={resultOpen}
            onViewGrid={() => setResultOpen(false)}
            onReplay={onReplay}
          />
        )}
      </MotionConfig>
    );
  }

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

          <div className={styles.boardArea} ref={boardAreaRef}>
            <div
              ref={boardFrameRef}
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
                {board()}
              </MaybeRails>
            </div>
          </div>

          {/* Stays mounted during the ♣ draw: the compact panel fits
              inside the dock's pinned height, so nothing needs to
              yield space — and the held cards staying visible is
              exactly what the swap decision wants. */}
          {(state.bonusCards.length > 0 || !state.noBonusCards) && (
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

          <div
            className={`${styles.dock} ${
              dockLayout === 'hand-stack' ? styles.dockHandPad : ''
            }`}
          >
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
      {overlays}
    </MotionConfig>
  );
}
