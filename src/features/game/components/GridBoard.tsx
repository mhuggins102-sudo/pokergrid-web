import { CSSProperties, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Card, isJoker } from '../../../game/cards';
import { GRID_SIZE, Grid } from '../../../game/grid';
import { CardFace, cardAriaLabel, cardLayoutId } from './CardFace';
import { CellRole } from '../usePhaseUI';
import styles from './GridBoard.module.css';

export interface GridBoardProps {
  grid: Grid;
  roleOf?: (idx: number) => CellRole;
  isTappable?: (idx: number) => boolean;
  onCellTap?: (idx: number) => void;
  /**
   * Snap layout corrections instead of animating them. Used while the
   * board container is being resized (the ♣-draw shrink): cards must
   * move WITH their cells, not glide across the screen from their old
   * positions.
   */
  instantLayout?: boolean;
  /**
   * Slots whose joker just auto-placed (from useJokerArrivals, which
   * must live in a component that survives this board's ♣-toggle
   * remounts). Those jokers enter with a delayed pop + glow.
   */
  jokerArrivals?: ReadonlySet<number>;
  /**
   * Slots seated by the engine on pre-scattered boards (from
   * useAutoPlaceFlights' cssDeal). Those cards deal in with a
   * staggered CSS cascade instead of the per-card well flight.
   */
  openingDeal?: ReadonlySet<number>;
  /**
   * Slots whose card is currently staged in the well by
   * useAutoPlaceFlights — rendered empty until the flight releases.
   */
  hiddenSlots?: ReadonlySet<number>;
  /**
   * Line spotlight: highlight this slot's row + column and dim the
   * rest. With rowText/colText set, floating line tags (e.g. "R3 · 25")
   * render at the row/column edges — the answer to "which line is R3?"
   * when the line rails are hidden. Rails-on mode omits the texts and
   * lights the rail chips instead (LineRails highlight).
   */
  spotlight?: { idx: number; rowText?: string; colText?: string } | null;
  /**
   * Slots on a line that just completed with a scoring hand (from
   * GameScreen's useLineCompletions): each flashes a solid ring,
   * staggered along the line by the mapped index so the sweep reads
   * in line order. The "you finished a poker hand" moment.
   */
  sweepSlots?: ReadonlyMap<number, number>;
  /**
   * Desktop hover model (mouse-only; mobile never passes these).
   * hoverState paints each cell 'lit' (active-line accent ring) or
   * 'dim' (faded back) while any hover is live; onCellHover reports
   * enter/leave on SEATED cards (null on leave).
   */
  hoverState?: (idx: number) => 'lit' | 'dim' | null;
  onCellHover?: (idx: number | null) => void;
  /** Desktop: cells this predicate marks (current placement/targeting
   *  cells) get a hover outline (the mockup's .placeable), gated
   *  behind @media (hover: hover) in CSS. */
  hoverOutline?: (idx: number) => boolean;
  /** Desktop: centered text inside the pulsing next slot (the
   *  mockup's "PLACE"). Follows the role — a staged flight suppresses
   *  the 'next' role and this label with it. */
  nextSlotLabel?: string;
}

const cellLabel = (idx: number, card: Card | null, role: CellRole): string => {
  const row = Math.floor(idx / GRID_SIZE) + 1;
  const col = (idx % GRID_SIZE) + 1;
  const pos = `row ${row} column ${col}`;
  const content = card ? cardAriaLabel(card) : 'empty';
  const hint =
    role === 'next'
      ? ', next card lands here — tap to place'
      : role === 'selected'
        ? ', selected'
        : role === 'target'
          ? ', valid target'
          : '';
  return `${pos}: ${content}${hint}`;
};

/**
 * The 5×5 board. Cards carry motion layoutIds so placement and moves
 * animate as FLIP travel; destroys exit via AnimatePresence. With
 * instantLayout, cards drop out of the projection system entirely
 * (no layoutId) — pure CSS positioning, immune to stale-measurement
 * bugs while the container resizes.
 */
const jokerCount = (g: Grid): number =>
  g.reduce((n, c) => n + (c && isJoker(c) ? 1 : 0), 0);

const NO_ARRIVALS: ReadonlySet<number> = new Set();

/**
 * Slots whose joker ARRIVED (auto-placed on draw — the joker count
 * went up): those bloom a gold glow as the flight staged by
 * useAutoPlaceFlights lands, so the "free card" moment reads. A joker
 * merely MOVED by a perk keeps the normal entrance. Arrival slots
 * stick in the ref so re-renders mid-animation don't strip the
 * styling; they clear when the slot stops holding a joker.
 *
 * Lives in GameScreen, NOT GridBoard — the board remounts on the
 * ♣-panel toggle (the exact commit a ♣-triggered joker lands in),
 * which would wipe a board-local previous-grid ref.
 */
export function useJokerArrivals(grid: Grid): ReadonlySet<number> {
  const prevGridRef = useRef<Grid | null>(null);
  const prevGrid = prevGridRef.current;
  useEffect(() => {
    prevGridRef.current = grid;
  });
  const arrivedSlots = useRef<Set<number>>(new Set()).current;
  for (const i of [...arrivedSlots]) {
    const c = grid[i];
    if (!(c && isJoker(c))) arrivedSlots.delete(i);
  }
  if (prevGrid !== null && jokerCount(grid) > jokerCount(prevGrid)) {
    grid.forEach((c, i) => {
      const was = prevGrid[i];
      if (c && isJoker(c) && !(was && isJoker(was))) arrivedSlots.add(i);
    });
  }
  // Expire arrival marks once the moment has played out — otherwise a
  // later board remount (the ♣-panel toggle) would replay the glow for
  // a joker that has been sitting there for minutes.
  useEffect(() => {
    if (arrivedSlots.size === 0) return;
    const t = window.setTimeout(() => arrivedSlots.clear(), 4000);
    return () => window.clearTimeout(t);
  });
  return arrivedSlots;
}

const NO_SWEEP: ReadonlyMap<number, number> = new Map();

export function GridBoard({
  grid,
  roleOf,
  isTappable,
  onCellTap,
  instantLayout = false,
  jokerArrivals = NO_ARRIVALS,
  openingDeal = NO_ARRIVALS,
  hiddenSlots = NO_ARRIVALS,
  spotlight = null,
  sweepSlots = NO_SWEEP,
  hoverState,
  onCellHover,
  hoverOutline,
  nextSlotLabel,
}: GridBoardProps) {
  const dealOrder = [...openingDeal];
  const spotRow = spotlight ? Math.floor(spotlight.idx / GRID_SIZE) : -1;
  const spotCol = spotlight ? spotlight.idx % GRID_SIZE : -1;
  return (
    <div className={styles.board} role="grid" aria-label="Game board">
      {grid.map((realCard, idx) => {
        // A staged card renders as empty here — it's posing in the
        // well, and lands (with FLIP travel) when its flight releases.
        const card = hiddenSlots.has(idx) ? null : realCard;
        const role = roleOf?.(idx) ?? null;
        const tappable = isTappable?.(idx) ?? false;
        const dimmed =
          spotlight !== null &&
          Math.floor(idx / GRID_SIZE) !== spotRow &&
          idx % GRID_SIZE !== spotCol;
        const sweepIdx = sweepSlots.get(idx);
        const hover = hoverState?.(idx) ?? null;
        const cls = [
          styles.cell,
          card ? styles.filled : null,
          role === 'target' ? styles.target : null,
          role === 'selected' ? styles.selected : null,
          role === 'next' ? styles.next : null,
          dimmed ? styles.dimmed : null,
          sweepIdx !== undefined ? styles.sweep : null,
          hover === 'lit' ? styles.hoverLit : null,
          hover === 'dim' ? styles.hoverDim : null,
          tappable && hoverOutline?.(idx) ? styles.hoverable : null,
        ]
          .filter(Boolean)
          .join(' ');
        return (
          <button
            key={idx}
            type="button"
            className={cls}
            disabled={!tappable}
            aria-label={cellLabel(idx, card, role)}
            onClick={tappable ? () => onCellTap?.(idx) : undefined}
            onMouseEnter={
              card && onCellHover ? () => onCellHover(idx) : undefined
            }
            // Re-reported on movement too: after the post-targeting
            // hover grace expires, the first pointer twitch re-lights
            // the cell even though no new mouseenter fires. The
            // consumer identity-guards its state, so this is cheap.
            onMouseMove={
              card && onCellHover ? () => onCellHover(idx) : undefined
            }
            onMouseLeave={
              card && onCellHover ? () => onCellHover(null) : undefined
            }
            style={
              sweepIdx !== undefined
                ? ({ '--sweep-delay': `${sweepIdx * 60}ms` } as CSSProperties)
                : undefined
            }
          >
            <AnimatePresence initial={false}>
              {card &&
                (openingDeal.has(idx) ? (
                  // Pre-scattered board: seated pre-paint by the engine,
                  // so the entrance is CSS (AnimatePresence's
                  // initial={false} suppresses mount animations).
                  <motion.div
                    key={cardLayoutId(card) ?? `joker-${idx}`}
                    className={`${styles.cardWrap} ${styles.dealIn}`}
                    style={{
                      animationDelay: `${0.1 + dealOrder.indexOf(idx) * 0.06}s`,
                    }}
                    exit={{ opacity: 0, scale: 0.6 }}
                  >
                    <CardFace card={card} />
                  </motion.div>
                ) : (
                  // Jokers carry a slot-keyed layoutId so an auto-place
                  // flight (staged in the well under the same id) FLIPs
                  // here exactly like a manual Place; arrived jokers
                  // bloom a glow on touchdown.
                  <motion.div
                    key={cardLayoutId(card) ?? `joker-${idx}`}
                    layoutId={
                      instantLayout
                        ? undefined
                        : (cardLayoutId(card) ?? `joker-slot-${idx}`)
                    }
                    className={`${styles.cardWrap}${
                      jokerArrivals.has(idx) ? ` ${styles.jokerArrive}` : ''
                    }`}
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.6 }}
                    transition={
                      instantLayout
                        ? { duration: 0 }
                        : { type: 'spring', stiffness: 420, damping: 32 }
                    }
                  >
                    <CardFace card={card} />
                  </motion.div>
                ))}
            </AnimatePresence>
            {!card && role === 'next' && nextSlotLabel !== undefined && (
              <span className={styles.nextLabel} aria-hidden="true">
                {nextSlotLabel}
              </span>
            )}
          </button>
        );
      })}
      {spotlight?.rowText !== undefined && (
        <span
          className={styles.lineTag}
          style={{
            top: `calc(${spotRow} * 20% + 10%)`,
            left: '4px',
            transform: 'translateY(-50%)',
          }}
        >
          {spotlight.rowText}
        </span>
      )}
      {spotlight?.colText !== undefined && (
        <span
          className={styles.lineTag}
          style={{
            left: `calc(${spotCol} * 20% + 10%)`,
            top: '4px',
            transform: 'translateX(-50%)',
          }}
        >
          {spotlight.colText}
        </span>
      )}
    </div>
  );
}
