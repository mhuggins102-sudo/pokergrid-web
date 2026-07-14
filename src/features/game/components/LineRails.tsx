import { ReactNode } from 'react';
import { BonusCard } from '../../../game/bonusCards';
import { Grid } from '../../../game/grid';
import { HandRank } from '../../../game/hands';
import { ScoreReport, ScoredLine } from '../../../game/scoring';
import { HAND_LABEL, lineLabel } from '../handLabels';
import { ChipTone, LinePotential, linePotential } from '../lineInsights';
import { GridBoard } from './GridBoard';
import styles from './LineRails.module.css';

// Result-screen tally: which values the chips show and how boosted
// lines dress. 'base' shows each line's no-bonus-cards total; 'boosted'
// shows the final totals with gold styling on every line the gold
// cards changed. The stage flip re-pops the changed chips.
export interface RailTally {
  /** Per-line base totals keyed by `${kind}${index}` (no-bonus report). */
  baseTotals: ReadonlyMap<string, number>;
  stage: 'base' | 'boosted';
  /** Animate the base→boosted flip (re-pop). Off = static end state. */
  animate?: boolean;
}

export interface LineRailsProps {
  grid: Grid;
  report: ScoreReport;
  /** Tapping a total opens that line's calculation. */
  onLineTap?: (line: ScoredLine) => void;
  /**
   * Result-screen entrance: chips pop in staggered (rows R1–R5, then
   * columns C1–C5) so the score visibly assembles line by line.
   * Reduced motion collapses it to instant via the global reset.
   */
  stagger?: boolean;
  /** Base/boosted tally staging (see RailTally). Omit = live behavior. */
  tally?: RailTally;
  /**
   * Custom board to wrap (the live GameScreen board with its targeting
   * props). Defaults to a plain read-only GridBoard of `grid`.
   */
  children?: ReactNode;
  /**
   * Spotlight: light up the chips for this row + column (the in-place
   * replacement for the floating line tags while rails are showing).
   */
  highlight?: { row: number; col: number } | null;
  /**
   * Which edge the row-total chips ride. 'left' (default) is the classic
   * phone placement; 'right' matches the desk edge chips and is used by
   * the streamlined column game. Column totals always sit underneath.
   */
  side?: 'left' | 'right';
  /**
   * Held bonus cards. When provided (the LIVE game), each chip is toned by
   * its line's potential — the SAME made / gold / potential / wip / empty
   * scheme (solid-filled, dashed, plain borders) the desk edge chips use.
   * Omit (the result screen) to keep the plain sign-based tone + tally
   * gold dressing.
   */
  bonusCards?: readonly BonusCard[];
  handBoost?: Partial<Record<HandRank, number>>;
}

const toneOf = (line: ScoredLine): string =>
  line.total > 0 ? styles.pos : line.total < 0 ? styles.neg : styles.zero;

// Desk edge-chip tone → LineRails chip class (mirrors DesktopRails
// .pillGold / .pillMade / .pillPotential / .pillWip / .pillEmpty so the
// phone rails read with the same coloring + dashed/solid borders).
const POTENTIAL_TONE: Record<ChipTone, string> = {
  gold: styles.toneGold,
  goldPotential: styles.toneGoldPotential,
  made: styles.toneMade,
  potential: styles.tonePotential,
  wip: styles.toneWip,
  none: styles.toneNone,
};

const chipLabel = (line: ScoredLine, p: LinePotential | null): string => {
  // Live game: read the potential's hand name + anticipated label so a
  // forming line announces what it WOULD pay (matches the desk edge chip).
  if (p) {
    return `${lineLabel(line.kind, line.index)}: ${p.name || 'no hand'}, ${
      p.label === '–' ? 'no points yet' : `${p.label} points`
    }`;
  }
  const hand = line.hand ? HAND_LABEL[line.hand] : 'no hand';
  return `${lineLabel(line.kind, line.index)}: ${hand}, ${line.total} points`;
};

// Live in-game boards score incomplete lines as 0 (the -25 penalty only
// exists at game end) — show a quiet dot instead of a misleading "0".
// Completed 0-point lines (High Card) still show the number.
const chipText = (line: ScoredLine): string =>
  line.incomplete && line.total === 0 ? '·' : String(line.total);

/**
 * A board with its ten line totals attached as rails — row totals down
 * the edge, column totals underneath. Board and scores read as one
 * visual instead of a board plus a separate table. Used live on the
 * game screen (wrapping the interactive board) and on the result
 * screen (with the entrance stagger + base/boosted tally).
 */
export function LineRails({
  grid,
  report,
  onLineTap,
  stagger = false,
  tally,
  children,
  highlight = null,
  side = 'left',
  bonusCards,
  handBoost,
}: LineRailsProps) {
  const rows = report.lines.filter(l => l.kind === 'row');
  const cols = report.lines.filter(l => l.kind === 'col');

  const isLit = (line: ScoredLine): boolean =>
    highlight !== null &&
    (line.kind === 'row'
      ? line.index === highlight.row
      : line.index === highlight.col);

  const chip = (line: ScoredLine, tallyIndex: number) => {
    const key = `${line.kind}${line.index}`;
    const baseTotal = tally?.baseTotals.get(key) ?? line.total;
    const boosted = tally !== undefined && baseTotal !== line.total;
    const showBase = tally?.stage === 'base';
    // Gold dressing (and its re-pop) belongs to the boosted stage.
    const goldNow = boosted && tally?.stage === 'boosted';
    // Live game: tone AND text come from the line's potential (the desk
    // edge-chip scheme) — a forming line shows its ANTICIPATED score (+N,
    // the partial hand's value with any gold mult), not a bare "·". Result
    // screen (no bonusCards): plain sign tone + the numeric tally.
    const p = bonusCards
      ? linePotential(line, bonusCards, report.lines, handBoost)
      : null;
    const tone = p ? POTENTIAL_TONE[p.tone] : toneOf(line);
    const text = p ? p.label : showBase ? String(baseTotal) : chipText(line);
    return (
      <button
        key={`${line.kind}-${line.index}`}
        type="button"
        className={`${styles.chip} ${
          line.kind === 'row' ? styles.rowChip : ''
        } ${tone} ${stagger ? styles.tallyIn : ''} ${
          goldNow ? styles.chipGold : ''
        } ${goldNow && tally?.animate ? styles.chipGoldIn : ''} ${
          isLit(line) ? styles.chipLit : ''
        }`}
        style={
          // The gold re-pop supersedes the entrance stagger — the
          // entrance has finished by the time the stage flips, and the
          // flip swaps the animation property wholesale.
          goldNow && tally?.animate
            ? { animationDelay: `${tallyIndex * 160}ms` }
            : stagger
              ? { animationDelay: `${tallyIndex * 220}ms` }
              : undefined
        }
        onClick={() => onLineTap?.(line)}
        aria-label={chipLabel(line, p)}
        aria-current={isLit(line) || undefined}
      >
        <span className={styles.chipVal}>{text}</span>
      </button>
    );
  };

  return (
    <div className={`${styles.wrap} ${side === 'right' ? styles.railsRight : ''}`}>
      <div className={styles.board}>
        {children ?? <GridBoard grid={grid} />}
      </div>
      <div className={styles.rowRail} aria-label="Row totals">
        {rows.map((l, i) => chip(l, i))}
      </div>
      <div className={styles.colRail} aria-label="Column totals">
        {cols.map((l, i) => chip(l, 5 + i))}
      </div>
      <div className={styles.corner} aria-hidden="true" />
    </div>
  );
}
