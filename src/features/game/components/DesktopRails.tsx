import { CSSProperties, ReactNode, useMemo, useState } from 'react';
import {
  HAND_BASE_VALUE,
  INCOMPLETE_LINE_PENALTY,
  ScoreReport,
  ScoredLine,
} from '../../../game/scoring';
import { HandRank } from '../../../game/hands';
import {
  BonusCard,
  isPlaceholder,
  isSpecialCard,
  isSpentSlot,
} from '../../../game/bonusCards';
import { Difficulty } from '../../../game/rules';
import { TIER_ORDER } from '../../../lib/stats';
import {
  categoryIconStyle,
  styleFor,
} from '../../../lib/bonusCardCategory';
import { useSettingsStore } from '../../settings/settingsStore';
import { isBackendConfigured } from '../../../lib/supabaseRpc';
import { Button, useTapPopover } from '../../../design/primitives';
import { useStatsStore } from '../../progress/statsStore';
import { usePlaysStore } from '../../daily/sync/playsStore';
import { useHandle } from '../../daily/sync/handleStore';
import {
  useDailyHistogram,
  useDailyRank,
  useDailyStats,
} from '../../daily/sync/useDailyRank';
import {
  addCell,
  addTiers,
  avgOf,
  buildModeStats,
} from '../../stats/modeStats';
import { ScoreTrend } from '../../stats/ScoreTrend';
import { HAND_LABEL, lineLabel } from '../handLabels';
import { fmtMult } from '../lineBonuses';
import { EndgameRow, linePotential } from '../lineInsights';
import { DetailSheet } from './BonusCardStrip';
import styles from './DesktopRails.module.css';

/*
 * The ≥1024px game screen's rail panels + board edge chips, per the
 * desktop-redesign mockup (design-refs/desktop/Play.dc.html). Pure
 * presentation — every number comes from the live ScoreReport /
 * stores GameScreen already owns, and the shared hover model arrives
 * pre-derived through the hover props.
 */

/** The shared line-hover contract (GameScreen owns the hv state). */
export interface LineHoverProps {
  /** True while ANY hover (line / cell / bonus) is live. */
  any: boolean;
  /** True while a perk or green action is targeting — chips go inert. */
  muted: boolean;
  isActive: (line: ScoredLine) => boolean;
  onEnter: (line: ScoredLine) => void;
  onLeave: () => void;
}

// ---------------------------------------------------------------- //
// SCORING — the left rail's ten-line breakdown.                     //
// ---------------------------------------------------------------- //

// The ⓘ popover's hand order — highest first (HandValuesDialog's).
const HAND_ORDER: HandRank[] = [
  'FIVE_OF_A_KIND',
  'ROYAL_FLUSH',
  'STRAIGHT_FLUSH',
  'FOUR_OF_A_KIND',
  'FULL_HOUSE',
  'FLUSH',
  'STRAIGHT',
  'THREE_OF_A_KIND',
  'TWO_PAIR',
  'PAIR',
  'HIGH_CARD',
];

/**
 * The hand → base value table (with any Bull Market boosts folded in and
 * flagged) — the shared content of the SCORING panel's ⓘ fly-out. Lifted
 * out so the streamlined phone game's "Hands" popover shows the BYTE-SAME
 * table as the desk flyout (no drift). Carries only content; the caller
 * supplies the positioned surface (.handsPop on desk, .rowHandsPop on
 * the phone row).
 */
export function HandValuesTable({
  investBoost,
}: {
  investBoost?: Partial<Record<HandRank, number>>;
}) {
  return (
    <>
      <span className={styles.handsTitle}>Hand values</span>
      <div className={styles.handsRows}>
        {HAND_ORDER.map(hand => {
          const boost = investBoost?.[hand] ?? 0;
          return (
            <div key={hand} className={styles.handsRow}>
              <span>{HAND_LABEL[hand]}</span>
              <b>
                {HAND_BASE_VALUE[hand] + boost}
                {boost > 0 && (
                  <span className={styles.handsBoost}> (+{boost})</span>
                )}
              </b>
            </div>
          );
        })}
        <div className={`${styles.handsRow} ${styles.handsPenalty}`}>
          <span>Unfinished line at game end</span>
          <b>{INCOMPLETE_LINE_PENALTY}</b>
        </div>
      </div>
    </>
  );
}

export interface ScoringPanelProps {
  report: ScoreReport;
  /** Row tap → that line's full scoring breakdown (LineDetailSheet). */
  onLineTap: (line: ScoredLine) => void;
  /** Bull Market ♣ invests — folded into (and flagged in) the ⓘ
   *  hand-values popover, mirroring HandValuesDialog. */
  investBoost?: Partial<Record<HandRank, number>>;
  /** Held cards — the gold mult chip shows on incomplete lines too. */
  bonusCards?: BonusCard[];
  handBoost?: Partial<Record<HandRank, number>>;
  /** One row per end-game card currently firing (purple). */
  endgame?: EndgameRow[];
  hover?: LineHoverProps;
  /** Hide the header's ⓘ hand-values fly-out. Set when the panel is
   *  reused inside the streamlined phone game's "Scoring" popover, where
   *  the row's own "Hands" control already owns that door — desk usage
   *  leaves it unset (the flyout shows). */
  hideHandsInfo?: boolean;
}

// Status column per the mockup: Empty, In Progress (partial names live
// on the edge chips, not here), High Card, or the made hand name.
const lineStatus = (line: ScoredLine): { text: string; muted: boolean } => {
  const filled = line.cards.filter(c => c !== null).length;
  if (filled === 0) return { text: 'Empty', muted: true };
  if (line.hand) {
    return { text: HAND_LABEL[line.hand], muted: line.total <= 0 };
  }
  return { text: 'In Progress', muted: true };
};

// Points column: '–' empty, '+N' made, '0' in-progress during play,
// the red negative once the final report carries penalties.
const linePoints = (line: ScoredLine): string => {
  const filled = line.cards.filter(c => c !== null).length;
  if (filled === 0) return '–';
  if (line.total > 0) return `+${line.total}`;
  if (line.total < 0) return String(line.total);
  return '0';
};

const NO_ROWS: EndgameRow[] = [];

export function ScoringPanel({
  report,
  onLineTap,
  investBoost,
  bonusCards = [],
  handBoost,
  endgame = NO_ROWS,
  hover,
  hideHandsInfo = false,
}: ScoringPanelProps) {
  // Touch tap-toggle for the ⓘ hand-values fly-out (decision E). Called
  // unconditionally (hooks rule) even when the ⓘ is hidden.
  const handsPop = useTapPopover('scoring-hands');
  return (
    <section className={styles.panel} aria-label="Scoring">
      <header className={styles.head}>
        <h2 className={styles.title}>Scoring</h2>
        {/* Hand-values reference: hover/focus fly-out off the panel
            (the dialog stays mobile-only), tap-toggled on touch. The
            popover is a child of the wrap, so pointing into it keeps it
            open (scrollable). Suppressed when the panel is reused inside
            the phone game's Scoring popover (its own Hands control owns
            this door). */}
        {!hideHandsInfo && (
          <span
            ref={handsPop.wrapRef}
            className={`${styles.handsWrap} ${
              handsPop.open ? styles.handsWrapOpen : ''
            }`}
          >
            <button
              type="button"
              className={styles.headBtn}
              aria-label="Hand values"
              {...handsPop.toggleProps}
            >
              ⓘ
            </button>
            <div className={styles.handsPop} role="tooltip">
              <HandValuesTable investBoost={investBoost} />
            </div>
          </span>
        )}
      </header>
      <div className={styles.lineRows}>
        {report.lines.map(line => {
          const status = lineStatus(line);
          const p = linePotential(line, bonusCards, report.lines, handBoost);
          const active = hover?.isActive(line) ?? false;
          return (
            <button
              key={`${line.kind}-${line.index}`}
              type="button"
              className={[
                styles.lineRow,
                active ? styles.lineRowActive : null,
                hover?.any && !active ? styles.lineRowDim : null,
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => onLineTap(line)}
              onMouseEnter={hover ? () => hover.onEnter(line) : undefined}
              onMouseLeave={hover ? hover.onLeave : undefined}
            >
              <span className={styles.lineTag}>
                {lineLabel(line.kind, line.index)}
              </span>
              <span
                className={`${styles.lineStatus} ${
                  status.muted ? styles.lineMuted : ''
                }`}
              >
                {status.text}
              </span>
              {p.mult > 1 && (
                <span className={styles.lineMult}>{fmtMult(p.mult)}</span>
              )}
              <span
                className={`${styles.linePts} ${
                  line.total < 0
                    ? styles.linePtsNeg
                    : line.total <= 0
                      ? styles.lineMuted
                      : ''
                }`}
              >
                {linePoints(line)}
              </span>
            </button>
          );
        })}
      </div>
      {endgame.length > 0 && (
        <>
          <div className={styles.subRow}>
            <span>Subtotal</span>
            <span className={styles.subPts}>{report.subtotal}</span>
          </div>
          {endgame.map(row => (
            <div key={row.name} className={styles.subRow}>
              <span className={styles.endgameLabel}>{row.name}</span>
              <span className={`${styles.subPts} ${styles.endgameLabel}`}>
                {row.value}
              </span>
            </div>
          ))}
        </>
      )}
      <div className={styles.totalRow}>
        <span>Total</span>
        <span
          className={`${styles.totalPts} ${
            report.total > 0 ? styles.totalPtsPos : ''
          }`}
        >
          {report.total}
        </span>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- //
// Board edge chips — rows on the RIGHT, columns BELOW (mockup).     //
// ---------------------------------------------------------------- //

export interface EdgeRailsProps {
  report: ScoreReport;
  onLineTap?: (line: ScoredLine) => void;
  /** Spotlight: light this row + column's chips. */
  highlight?: { row: number; col: number } | null;
  /** Held cards — potentials include hand-independent multipliers. */
  bonusCards?: BonusCard[];
  handBoost?: Partial<Record<HandRank, number>>;
  hover?: LineHoverProps;
  /** The live board. */
  children: ReactNode;
}

/**
 * The desktop replacement for LineRails, redesigned per the mockup:
 * each chip shows the line's POTENTIAL (+N — what its current
 * made/partial hand would pay if finished as-is, gold multipliers
 * included), toned by state, with a dark hand-name tooltip below on
 * hover. Hovering a chip drives the shared line-hover model; clicking
 * keeps the LineDetailSheet breakdown.
 */
export function EdgeRails({
  report,
  onLineTap,
  highlight = null,
  bonusCards = [],
  handBoost,
  hover,
  children,
}: EdgeRailsProps) {
  const rows = report.lines.filter(l => l.kind === 'row');
  const cols = report.lines.filter(l => l.kind === 'col');

  const isLit = (line: ScoredLine): boolean =>
    highlight !== null &&
    (line.kind === 'row'
      ? line.index === highlight.row
      : line.index === highlight.col);

  const toneClass = (tone: string): string => {
    switch (tone) {
      case 'gold':
        return styles.pillGold;
      case 'goldPotential':
        return styles.pillGoldPotential;
      case 'made':
        return styles.pillMade;
      case 'potential':
        return styles.pillPotential;
      case 'wip':
        return styles.pillWip;
      default:
        return styles.pillEmpty;
    }
  };

  const chip = (line: ScoredLine) => {
    const p = linePotential(line, bonusCards, report.lines, handBoost);
    const off = p.filled === 0 || (hover?.muted ?? false);
    const active = hover?.isActive(line) ?? false;
    const dim = (hover?.any ?? false) && !active;
    return (
      <button
        key={`${line.kind}-${line.index}`}
        type="button"
        className={[
          styles.chip,
          off ? styles.chipOff : null,
          dim ? styles.chipDim : null,
          isLit(line) ? styles.chipLit : null,
        ]
          .filter(Boolean)
          .join(' ')}
        onClick={() => onLineTap?.(line)}
        onMouseEnter={!off && hover ? () => hover.onEnter(line) : undefined}
        onMouseLeave={!off && hover ? hover.onLeave : undefined}
        onFocus={!off && hover ? () => hover.onEnter(line) : undefined}
        onBlur={!off && hover ? hover.onLeave : undefined}
        aria-label={`${lineLabel(line.kind, line.index)}: ${
          p.name || 'no hand'
        }, ${line.total} points`}
        aria-current={isLit(line) || undefined}
      >
        <span className={`${styles.chipPill} ${toneClass(p.tone)}`}>
          {p.label}
        </span>
        {!off && p.name !== '' && (
          <span className={styles.chipName} aria-hidden="true">
            {p.name}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className={styles.edgeWrap}>
      <div className={styles.edgeBoard}>{children}</div>
      <div className={styles.edgeRows} aria-label="Row totals">
        {rows.map(chip)}
      </div>
      <div className={styles.edgeCols} aria-label="Column totals">
        {cols.map(chip)}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- //
// LEADERBOARD — the left rail's second panel on daily runs.         //
// ---------------------------------------------------------------- //

export function DailyLeaderboardPanel({
  dateISO,
  finished = false,
  finalScore,
}: {
  dateISO: string;
  /** Game over — the player's bar/row light up in the distribution. */
  finished?: boolean;
  /** The finished run's score (fallback while the rank RPC lands). */
  finalScore?: number;
}) {
  const backend = isBackendConfigured();
  const stats = useDailyStats(dateISO, backend);
  const histo = useDailyHistogram(dateISO, backend);
  const rank = useDailyRank(dateISO);
  // Reactive — a first-time handle save in the result dialog renames
  // the synthesized own row without waiting for the refetch.
  const handle = useHandle();
  // Touch tap-toggle for the score-distribution fly-out (decision E).
  // Called before the no-backend early return so hook order stays stable.
  const lbPop = useTapPopover('daily-lb');

  if (!backend) return null;

  const top = stats.data?.topScores ?? [];
  const own = finished ? (rank.data?.score ?? finalScore) : undefined;

  // The player's own standing once the run is finished. The top-5 list
  // refetches after the submit lands, but until it does (or if the two
  // snapshots disagree) the row is synthesized from the rank RPC — and
  // SEATED AT ITS RANK: a top-5 own score splices into position rather
  // than dangling under scores it beat; only ranks past #5 append below
  // (RankPanel's top5 + ownRow pattern).
  let top5 = top.slice(0, 5);
  let ownRow: (typeof top)[number] | null = null;
  if (finished && !top5.some(t => t.isOwn)) {
    const synthesized = top.find(t => t.isOwn) ??
      (rank.data
        ? {
            rank: rank.data.rank,
            displayName: handle ?? 'you',
            score: rank.data.score,
            isOwn: true,
          }
        : null);
    if (synthesized !== null) {
      if (synthesized.rank <= 5) {
        top5 = [...top5];
        top5.splice(synthesized.rank - 1, 0, synthesized);
        top5 = top5.slice(0, 5);
      } else {
        ownRow = synthesized;
      }
    }
  }

  const bins = histo.data?.bins ?? [];
  // The player's bar must never read as absent: while the histogram
  // snapshot predates their submit, their bin counts them anyway.
  const binCount = (b: (typeof bins)[number]): number =>
    own !== undefined && own >= b.lo && own <= b.hi
      ? Math.max(b.count, 1)
      : b.count;
  const maxCount = Math.max(1, ...bins.map(binCount));

  const note =
    finished && rank.data
      ? `#${rank.data.rank} / ${rank.data.total}`
      : stats.data
        ? `${stats.data.total} players today`
        : stats.isLoading
          ? 'Loading…'
          : '';

  return (
    <section
      ref={lbPop.wrapRef}
      className={`${styles.panel} ${styles.lbWrap} ${
        lbPop.open ? styles.lbWrapOpen : ''
      }`}
      aria-label="Leaderboard"
      tabIndex={0}
      {...lbPop.toggleProps}
    >
      <header className={styles.head}>
        <h2 className={styles.title}>Leaderboard</h2>
        <span className={styles.headNote}>{note}</span>
      </header>
      <div className={styles.lbList}>
        {top5.length === 0 ? (
          <span className={styles.emptyNote}>
            {stats.isLoading
              ? ''
              : stats.isError
                ? 'Leaderboard unavailable right now.'
                : 'No scores posted yet — go first.'}
          </span>
        ) : (
          <>
            {top5.map(t => (
              <div
                key={`${t.rank}-${t.displayName}`}
                className={`${styles.lbRow} ${t.isOwn ? styles.lbOwn : ''}`}
              >
                <span className={styles.lbRank}>{t.rank}</span>
                <span className={styles.lbName}>{t.displayName}</span>
                <span className={styles.lbScore}>{t.score}</span>
              </div>
            ))}
            {ownRow && (
              <div className={`${styles.lbRow} ${styles.lbOwn}`}>
                <span className={styles.lbRank}>#{ownRow.rank}</span>
                <span className={styles.lbName}>{ownRow.displayName}</span>
                <span className={styles.lbScore}>{ownRow.score}</span>
              </div>
            )}
          </>
        )}
      </div>
      {/* Side fly-out: the day's score distribution, revealed on
          hover/focus (mockup .lbpop) — the top-5 list stays put. */}
      {bins.length > 0 && (
        <div className={styles.lbPop}>
          <span className={styles.histTitle}>Score distribution</span>
          <div className={styles.histBars}>
            {bins.map((b, i) => {
              const isOwn = own !== undefined && own >= b.lo && own <= b.hi;
              return (
                <div
                  key={i}
                  className={styles.histSlot}
                  title={`${b.lo}–${b.hi}: ${binCount(b)}${isOwn ? ' · you' : ''}`}
                >
                  <div
                    className={`${styles.histBar} ${isOwn ? styles.histBarOwn : ''}`}
                    style={{
                      height: `${Math.max(6, (binCount(b) / maxCount) * 100)}%`,
                    }}
                  />
                </div>
              );
            })}
          </div>
          <div className={styles.histLabels}>
            {bins.map((b, i) => (
              <span key={i}>{b.lo}</span>
            ))}
          </div>
          <div className={styles.histLegend}>
            {finished && own !== undefined && (
              <span className={styles.legendYou}>
                <span className={styles.legendSwatchOwn} aria-hidden="true" />
                You · {own}
              </span>
            )}
            <span className={styles.legendField}>
              <span className={styles.legendSwatch} aria-hidden="true" />
              Field
            </span>
            {!finished && (
              <span className={styles.legendNote}>
                Your bar highlights once you finish
              </span>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- //
// STATS — the left rail's second panel on non-daily runs.           //
// ---------------------------------------------------------------- //

export function DeskStatsPanel({ difficulty }: { difficulty: Difficulty }) {
  const stats = useStatsStore(s => s.stats);
  const plays = usePlaysStore(s => s.plays);
  // Expanded view: tier-rating bars or the recent-scores trend; the
  // header's icon buttons toggle (tap the active one to collapse).
  const [view, setView] = useState<'bars' | 'trend' | null>(null);

  const data = useMemo(() => buildModeStats(stats, plays), [stats, plays]);
  const cell = addCell(data.cells.free[difficulty], data.cells.daily[difficulty]);
  const tiers = addTiers(data.tiers.free[difficulty], data.tiers.daily[difficulty]);
  const history = data.history.filter(p => p.difficulty === difficulty).slice(-20);
  const tierMax = Math.max(1, ...TIER_ORDER.map(t => tiers[t]));
  const winPct =
    cell.totalRuns > 0 ? Math.round((cell.wins / cell.totalRuns) * 100) : null;

  const toggle = (v: 'bars' | 'trend') =>
    setView(cur => (cur === v ? null : v));

  return (
    <section className={styles.panel} aria-label="Stats">
      <header className={styles.head}>
        <h2 className={styles.title}>Stats · {difficulty}</h2>
        <div className={styles.chartToggle} role="group" aria-label="Chart type">
          <button
            type="button"
            className={`${styles.chartBtn} ${view === 'bars' ? styles.chartBtnOn : ''}`}
            aria-label="Tier breakdown"
            aria-pressed={view === 'bars'}
            onClick={() => toggle('bars')}
          >
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none"
              stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"
              aria-hidden="true">
              <line x1="6" y1="20" x2="6" y2="11" />
              <line x1="12" y1="20" x2="12" y2="5" />
              <line x1="18" y1="20" x2="18" y2="14" />
            </svg>
          </button>
          <button
            type="button"
            className={`${styles.chartBtn} ${view === 'trend' ? styles.chartBtnOn : ''}`}
            aria-label="Recent scores"
            aria-pressed={view === 'trend'}
            onClick={() => toggle('trend')}
          >
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none"
              stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"
              strokeLinejoin="round" aria-hidden="true">
              <polyline points="3 17 9 11 13 15 21 6" />
            </svg>
          </button>
        </div>
      </header>
      <div className={styles.statCells}>
        <div className={styles.statCell}>
          <span className={styles.statValue}>{cell.best ?? '—'}</span>
          <span className={styles.statLabel}>Best</span>
        </div>
        <div className={styles.statCell}>
          <span className={styles.statValue}>{avgOf(cell) ?? '—'}</span>
          <span className={styles.statLabel}>Avg</span>
        </div>
        <div className={styles.statCell}>
          <span className={styles.statValue}>
            {winPct !== null ? `${winPct}%` : '—'}
          </span>
          <span className={styles.statLabel}>Win</span>
        </div>
        <div className={styles.statCell}>
          <span className={styles.statValue}>{cell.totalRuns}</span>
          <span className={styles.statLabel}>Games</span>
        </div>
      </div>
      {view === 'bars' && (
        <div className={styles.expand}>
          <span className={styles.expandTitle}>Tier breakdown</span>
          {TIER_ORDER.map(tier => (
            <div key={tier} className={styles.tierRow}>
              <span className={styles.tierName}>{tier}</span>
              <div className={styles.tierTrack}>
                <div
                  className={styles.tierFill}
                  style={{
                    width: `${Math.max(
                      tiers[tier] > 0 ? 4 : 0,
                      (tiers[tier] / tierMax) * 100
                    )}%`,
                  }}
                />
              </div>
              <span className={styles.tierCount}>{tiers[tier]}</span>
            </div>
          ))}
        </div>
      )}
      {view === 'trend' && (
        <div className={styles.expand}>
          <span className={styles.expandTitle}>Recent scores</span>
          {history.length === 0 ? (
            <span className={styles.emptyNote}>
              Finish a {difficulty} game to see your score timeline.
            </span>
          ) : (
            <ScoreTrend points={history} />
          )}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- //
// BONUS CARDS — the right rail's held-cards panel.                  //
// ---------------------------------------------------------------- //

/** GameScreen-derived bonus-hover contract (mockup .bcard/.bpop). */
export interface BonusHoverProps {
  /** Hovered itself, or an in-game card firing on the hovered line. */
  isActive: (idx: number) => boolean;
  /** Another bonus card is hovered. */
  isDim: (idx: number) => boolean;
  onEnter: (idx: number) => void;
  onLeave: () => void;
  /** End-game (purple) cards: popover progress line + met flag. */
  progress: (idx: number) => { label: string; ok: boolean } | null;
}

export interface DesktopBonusPanelProps {
  cards: BonusCard[];
  /** Shapley contributions aligned with `cards` (positive only). */
  values?: (number | undefined)[];
  /** Mixed Bag slot pick: tapping an entry reports its slot index. */
  onSlotTap?: (slot: number) => void;
  /** awaiting-action + Three Tricks: activate the special at index. */
  onUse?: (index: number) => void;
  liveContext?: (card: BonusCard) => string[];
  hover?: BonusHoverProps;
  /**
   * Phone "Desktop" dock mode. The panel becomes a fixed 3-slot column
   * that fills its (stretched) container to match the deck/actions dock:
   *   • no header, no hover/focus popover, no tap focus ring;
   *   • held cards render as entries, missing slots as dotted placeholders
   *     (the first "♣ draws fill these", mirroring the horizontal strip);
   *   • the three slots flex equally so three held cards fit exactly.
   * The desk/desk-lite fork leaves this off (its normal list behavior).
   */
  dockColumn?: boolean;
}

export function DesktopBonusPanel({
  cards,
  values,
  onSlotTap,
  onUse,
  liveContext,
  hover,
  dockColumn = false,
}: DesktopBonusPanelProps) {
  const [detail, setDetail] = useState<{
    card: BonusCard;
    index: number;
  } | null>(null);
  // Colorblind assist (phase 4 port): the entry's category is
  // otherwise color-only (border tone) — the glyph is the non-color
  // cue, same contract as the phone chip strip.
  const assist = useSettingsStore(s => s.colorBlindAssist);
  const held = cards.filter(c => !isPlaceholder(c)).length;

  const renderEntry = (card: BonusCard, i: number) => {
    const cat = styleFor(card);
    const dimmed = card.used || isPlaceholder(card);
    const usable =
      onUse !== undefined &&
      isSpecialCard(card) &&
      !card.used &&
      !isPlaceholder(card);
    const active = !dimmed && (hover?.isActive(i) ?? false);
    const hoverDim = hover?.isDim(i) ?? false;
    const prog = dimmed ? null : (hover?.progress(i) ?? null);
    return (
      <div
        key={`${card.id}-${i}`}
        // The entry is focusable only for the desk hover model (focus →
        // popover). The dock column has no popover, so drop tabIndex there
        // — a focused entry div drew a ring on tap.
        tabIndex={dockColumn || dimmed ? undefined : 0}
        className={[
          styles.bonusEntry,
          dockColumn ? styles.dockEntry : null,
          dimmed ? styles.bonusDim : null,
          active ? styles.bonusActive : null,
          hoverDim ? styles.bonusFaded : null,
        ]
          .filter(Boolean)
          .join(' ')}
        style={{ '--entry-tone': cat.borderColor } as CSSProperties}
        onMouseEnter={hover && !dimmed ? () => hover.onEnter(i) : undefined}
        onMouseLeave={hover && !dimmed ? hover.onLeave : undefined}
      >
        <button
          type="button"
          className={styles.bonusMain}
          onClick={() =>
            // Slot pick never targets a spent one-time slot — the
            // used card blocks that position for the whole game.
            onSlotTap && !isSpentSlot(card)
              ? onSlotTap(i)
              : setDetail({ card, index: i })
          }
          aria-label={`Bonus card: ${card.name}${card.used ? ' (used)' : ''}${
            values?.[i] !== undefined
              ? `, contributing ${values[i]} points`
              : ''
          }`}
        >
          <span className={styles.bonusTitle}>
            {assist && (
              <>
                <span
                  style={{
                    color: cat.iconColor,
                    ...categoryIconStyle(cat),
                  }}
                  aria-hidden="true"
                >
                  {cat.icon}
                </span>{' '}
              </>
            )}
            {card.title}
            {card.used ? ' ✓' : ''}
          </span>
          <span className={styles.bonusMult}>
            {card.mult}
            {values?.[i] !== undefined && (
              <span className={styles.bonusValue}>+{values[i]} pts</span>
            )}
          </span>
        </button>
        {usable && (
          <Button
            variant="primary"
            size="sm"
            className={styles.bonusUse}
            onClick={() => onUse(i)}
          >
            Use
          </Button>
        )}
        {/* Hover/focus popover: full description (+ purple progress).
            Never renders for used/placeholder cards — or in dock mode,
            where the tap focus would pop it open uninvited (the tap-opened
            DetailSheet carries the description instead). */}
        {!dimmed && !dockColumn && (
          <div className={styles.bonusPop} role="tooltip">
            {card.description}
            {prog && (
              <div
                className={`${styles.bonusProg} ${
                  prog.ok ? styles.bonusProgOk : ''
                }`}
              >
                {prog.label}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Phone "Desktop" dock: a fixed 3-slot column (held entries + dotted
  // placeholders) that flexes to fill the container.
  if (dockColumn) {
    return (
      <section
        className={`${styles.panel} ${styles.dockCol}`}
        aria-label="Bonus cards"
      >
        <div className={`${styles.bonusList} ${styles.dockList}`}>
          {Array.from({ length: 3 }, (_, i) => {
            const card = cards[i];
            if (card) return renderEntry(card, i);
            // Dotted placeholder for a not-yet-held slot; the first one
            // (only when nothing is held) names what fills them.
            return (
              <div key={`empty-${i}`} className={styles.dockEmpty}>
                {cards.length === 0 && i === 0 ? '♣ draws fill these' : 'empty'}
              </div>
            );
          })}
        </div>
        <DetailSheet
          detail={detail}
          onClose={() => setDetail(null)}
          onUse={onUse}
          liveContext={liveContext}
        />
      </section>
    );
  }

  return (
    <section className={styles.panel} aria-label="Bonus cards">
      <header className={styles.head}>
        <h2 className={styles.title}>Bonus Cards</h2>
        <span className={styles.headNote}>{held} / 3</span>
      </header>
      <div className={styles.bonusList}>
        {cards.length === 0 && (
          <span className={styles.emptyNote}>None held — a ♣ draw adds one.</span>
        )}
        {cards.map((card, i) => renderEntry(card, i))}
      </div>
      <DetailSheet
        detail={detail}
        onClose={() => setDetail(null)}
        onUse={onUse}
        liveContext={liveContext}
      />
    </section>
  );
}
