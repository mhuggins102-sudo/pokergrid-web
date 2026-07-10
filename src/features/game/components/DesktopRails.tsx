import { CSSProperties, ReactNode, useMemo, useState } from 'react';
import { ScoreReport, ScoredLine } from '../../../game/scoring';
import { evaluatePartialLine } from '../../../game/hands';
import {
  BonusCard,
  isPlaceholder,
  isSpecialCard,
} from '../../../game/bonusCards';
import { Difficulty } from '../../../game/rules';
import { TIER_ORDER } from '../../../lib/stats';
import { styleFor } from '../../../lib/bonusCardCategory';
import { isBackendConfigured } from '../../../lib/supabaseRpc';
import { Button } from '../../../design/primitives';
import { useStatsStore } from '../../progress/statsStore';
import { usePlaysStore } from '../../daily/sync/playsStore';
import {
  useDailyHistogram,
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
import { DetailSheet } from './BonusCardStrip';
import styles from './DesktopRails.module.css';

/*
 * The ≥1024px game screen's rail panels + board edge chips, per the
 * desktop-redesign mockup (design-refs/desktop/Play.dc.html). Pure
 * presentation — every number comes from the live ScoreReport /
 * stores GameScreen already owns.
 */

// ---------------------------------------------------------------- //
// SCORING — the left rail's ten-line breakdown.                     //
// ---------------------------------------------------------------- //

export interface ScoringPanelProps {
  report: ScoreReport;
  /** Row tap → that line's full scoring breakdown (LineDetailSheet). */
  onLineTap: (line: ScoredLine) => void;
  /** The header's ⓘ — opens the hand-values reference. */
  onShowHandValues?: () => void;
}

// What a line is "doing" right now: Empty, the hand-so-far name from
// the partial evaluator (In Progress when it makes nothing yet), or
// the made hand once complete.
const lineStatus = (line: ScoredLine): { text: string; muted: boolean } => {
  const filled = line.cards.filter(c => c !== null).length;
  if (filled === 0) return { text: 'Empty', muted: true };
  if (line.hand) {
    return { text: HAND_LABEL[line.hand], muted: line.total <= 0 };
  }
  const partial = evaluatePartialLine(line.cards);
  if (partial && partial !== 'HIGH_CARD') {
    return { text: HAND_LABEL[partial], muted: false };
  }
  return { text: 'In Progress', muted: true };
};

const linePoints = (line: ScoredLine): string => {
  const filled = line.cards.filter(c => c !== null).length;
  if (filled === 0) return '–';
  return line.total > 0 ? `+${line.total}` : String(line.total);
};

export function ScoringPanel({
  report,
  onLineTap,
  onShowHandValues,
}: ScoringPanelProps) {
  const endgame = report.gridMultiplier !== 1 || report.gridFlat !== 0;
  return (
    <section className={styles.panel} aria-label="Scoring">
      <header className={styles.head}>
        <h2 className={styles.title}>Scoring</h2>
        {onShowHandValues && (
          <button
            type="button"
            className={styles.headBtn}
            onClick={onShowHandValues}
            aria-label="Hand values"
          >
            ⓘ
          </button>
        )}
      </header>
      <div className={styles.lineRows}>
        {report.lines.map(line => {
          const status = lineStatus(line);
          return (
            <button
              key={`${line.kind}-${line.index}`}
              type="button"
              className={styles.lineRow}
              onClick={() => onLineTap(line)}
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
              {line.hand !== null && line.multiplier !== 1 && (
                <span className={styles.lineMult}>
                  {fmtMult(line.multiplier)}
                </span>
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
      {endgame && (
        <>
          <div className={styles.subRow}>
            <span>Subtotal</span>
            <span className={styles.subPts}>{report.subtotal}</span>
          </div>
          <div className={styles.subRow}>
            <span className={styles.endgameLabel}>End-game bonus</span>
            <span className={`${styles.subPts} ${styles.endgameLabel}`}>
              {report.gridMultiplier !== 1 ? fmtMult(report.gridMultiplier) : ''}
              {report.gridFlat !== 0
                ? `${report.gridMultiplier !== 1 ? ' ' : ''}+${report.gridFlat}`
                : ''}
            </span>
          </div>
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
// Board edge chips — row totals on the RIGHT, column totals BELOW.  //
// ---------------------------------------------------------------- //

export interface EdgeRailsProps {
  report: ScoreReport;
  onLineTap?: (line: ScoredLine) => void;
  /** Spotlight: light this row + column's chips. */
  highlight?: { row: number; col: number } | null;
  /** The live board. */
  children: ReactNode;
}

// Live boards score incomplete lines as 0 (the -25 penalty only exists
// at game end) — a quiet dot beats a misleading "0" (mirrors
// LineRails' mobile chips); a fully empty line shows the mockup's "–".
const chipText = (line: ScoredLine): string => {
  if (line.cards.every(c => c === null)) return '–';
  if (line.incomplete && line.total === 0) return '·';
  return String(line.total);
};

/**
 * The desktop replacement for LineRails: the same tap-a-total behavior
 * with row chips along the board's right edge and column chips along
 * the bottom, per the mockup. Chip labels/highlighting match LineRails
 * so the spotlight flow reads identically on both breakpoints.
 */
export function EdgeRails({
  report,
  onLineTap,
  highlight = null,
  children,
}: EdgeRailsProps) {
  const rows = report.lines.filter(l => l.kind === 'row');
  const cols = report.lines.filter(l => l.kind === 'col');

  const isLit = (line: ScoredLine): boolean =>
    highlight !== null &&
    (line.kind === 'row'
      ? line.index === highlight.row
      : line.index === highlight.col);

  const chip = (line: ScoredLine) => (
    <button
      key={`${line.kind}-${line.index}`}
      type="button"
      className={`${styles.chip} ${
        line.total > 0
          ? styles.chipPos
          : line.total < 0
            ? styles.chipNeg
            : ''
      } ${isLit(line) ? styles.chipLit : ''}`}
      onClick={() => onLineTap?.(line)}
      aria-label={`${lineLabel(line.kind, line.index)}: ${
        line.hand ? HAND_LABEL[line.hand] : 'no hand'
      }, ${line.total} points`}
      aria-current={isLit(line) || undefined}
    >
      {chipText(line)}
    </button>
  );

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

export function DailyLeaderboardPanel({ dateISO }: { dateISO: string }) {
  const backend = isBackendConfigured();
  const stats = useDailyStats(dateISO, backend);
  const histo = useDailyHistogram(dateISO, backend);
  // Mockup behavior: hovering the panel crossfades the top-5 list into
  // the day's score distribution.
  const [hover, setHover] = useState(false);

  if (!backend) return null;

  const top5 = (stats.data?.topScores ?? []).slice(0, 5);
  const bins = histo.data?.bins ?? [];
  const maxCount = Math.max(1, ...bins.map(b => b.count));
  const showHist = hover && bins.length > 0;

  return (
    <section
      className={styles.panel}
      aria-label="Leaderboard"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <header className={styles.head}>
        <h2 className={styles.title}>Leaderboard</h2>
        <span className={styles.headNote}>
          {stats.data
            ? `${stats.data.total} players today`
            : stats.isLoading
              ? 'Loading…'
              : ''}
        </span>
      </header>
      <div className={styles.lbBody}>
        <div
          className={`${styles.lbLayer} ${showHist ? styles.lbFaded : ''}`}
          aria-hidden={showHist}
        >
          {top5.length === 0 ? (
            <span className={styles.emptyNote}>
              {stats.isLoading
                ? ''
                : stats.isError
                  ? 'Leaderboard unavailable right now.'
                  : 'No scores posted yet — go first.'}
            </span>
          ) : (
            top5.map(t => (
              <div
                key={`${t.rank}-${t.displayName}`}
                className={`${styles.lbRow} ${t.isOwn ? styles.lbOwn : ''}`}
              >
                <span className={styles.lbRank}>{t.rank}</span>
                <span className={styles.lbName}>{t.displayName}</span>
                <span className={styles.lbScore}>{t.score}</span>
              </div>
            ))
          )}
        </div>
        <div
          className={`${styles.lbLayer} ${styles.lbHistLayer} ${
            showHist ? '' : styles.lbFaded
          }`}
          aria-hidden={!showHist}
        >
          <span className={styles.histTitle}>Score distribution</span>
          <div className={styles.histBars}>
            {bins.map((b, i) => (
              <div
                key={i}
                className={styles.histSlot}
                title={`${b.lo}–${b.hi}: ${b.count}`}
              >
                {b.count > 0 && (
                  <div
                    className={styles.histBar}
                    style={{ height: `${(b.count / maxCount) * 100}%` }}
                  />
                )}
              </div>
            ))}
          </div>
          <div className={styles.histLabels}>
            {bins.map((b, i) => (
              <span key={i}>
                {bins.length <= 6 || i % 2 === 0 ? b.lo : ''}
              </span>
            ))}
          </div>
        </div>
      </div>
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

export interface DesktopBonusPanelProps {
  cards: BonusCard[];
  /** Shapley contributions aligned with `cards` (positive only). */
  values?: (number | undefined)[];
  /** Mixed Bag slot pick: tapping an entry reports its slot index. */
  onSlotTap?: (slot: number) => void;
  /** awaiting-action + Three Tricks: activate the special at index. */
  onUse?: (index: number) => void;
  liveContext?: (card: BonusCard) => string[];
}

export function DesktopBonusPanel({
  cards,
  values,
  onSlotTap,
  onUse,
  liveContext,
}: DesktopBonusPanelProps) {
  const [detail, setDetail] = useState<{
    card: BonusCard;
    index: number;
  } | null>(null);
  const held = cards.filter(c => !isPlaceholder(c)).length;

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
        {cards.map((card, i) => {
          const cat = styleFor(card);
          const dimmed = card.used || isPlaceholder(card);
          const usable =
            onUse !== undefined &&
            isSpecialCard(card) &&
            !card.used &&
            !isPlaceholder(card);
          return (
            <div
              key={`${card.id}-${i}`}
              className={`${styles.bonusEntry} ${dimmed ? styles.bonusDim : ''}`}
              style={{ '--entry-tone': cat.borderColor } as CSSProperties}
            >
              <button
                type="button"
                className={styles.bonusMain}
                onClick={() =>
                  onSlotTap ? onSlotTap(i) : setDetail({ card, index: i })
                }
                aria-label={`Bonus card: ${card.name}${card.used ? ' (used)' : ''}${
                  values?.[i] !== undefined
                    ? `, contributing ${values[i]} points`
                    : ''
                }`}
              >
                <span className={styles.bonusTitle}>
                  {card.title}
                  {card.used ? ' ✓' : ''}
                </span>
                <span className={styles.bonusMult}>
                  {card.mult}
                  {values?.[i] !== undefined && (
                    <span className={styles.bonusValue}>
                      +{values[i]} pts
                    </span>
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
