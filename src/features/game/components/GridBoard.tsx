import { useEffect, useRef } from 'react';
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
   * Slots seated by the engine before the first paint (from
   * useOpeningDeal, hosted in GameScreen for the same remount reason).
   * Those cards deal in with a staggered pop.
   */
  openingDeal?: ReadonlySet<number>;
}

const cellLabel = (idx: number, card: Card | null, role: CellRole): string => {
  const row = Math.floor(idx / GRID_SIZE) + 1;
  const col = (idx % GRID_SIZE) + 1;
  const pos = `row ${row} column ${col}`;
  const content = card ? cardAriaLabel(card) : 'empty';
  const hint =
    role === 'next'
      ? ', next card lands here'
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
 * went up): those get a delayed, springy pop-in with a glow, so the
 * "free card appeared out of nowhere" moment reads. A joker merely
 * MOVED by a perk keeps the normal entrance. Arrival slots stick in
 * the ref so re-renders mid-animation don't strip the styling; they
 * clear when the slot stops holding a joker.
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
  // later board remount (the ♣-panel toggle) would replay the pop for
  // a joker that has been sitting there for minutes.
  useEffect(() => {
    if (arrivedSlots.size === 0) return;
    const t = window.setTimeout(() => arrivedSlots.clear(), 2500);
    return () => window.clearTimeout(t);
  });
  return arrivedSlots;
}

/**
 * Slots already filled when the session's board first renders — the
 * engine seats the opening card (and Gridlock's pre-scatter, and any
 * pre-render auto-placed jokers) before React ever paints, so without
 * this they'd just pop into existence. GameScreen mounts exactly once
 * per run, so "filled at mount" IS the opening deal. Marks expire so
 * later board remounts don't replay the deal.
 */
export function useOpeningDeal(grid: Grid): ReadonlySet<number> {
  const slotsRef = useRef<Set<number> | null>(null);
  if (slotsRef.current === null) {
    slotsRef.current = new Set(grid.flatMap((c, i) => (c ? [i] : [])));
  }
  const slots = slotsRef.current;
  useEffect(() => {
    if (slots.size === 0) return;
    const t = window.setTimeout(() => slots.clear(), 2500);
    return () => window.clearTimeout(t);
  });
  return slots;
}

export function GridBoard({
  grid,
  roleOf,
  isTappable,
  onCellTap,
  instantLayout = false,
  jokerArrivals = NO_ARRIVALS,
  openingDeal = NO_ARRIVALS,
}: GridBoardProps) {
  const dealOrder = [...openingDeal];
  return (
    <div className={styles.board} role="grid" aria-label="Game board">
      {grid.map((card, idx) => {
        const role = roleOf?.(idx) ?? null;
        const tappable = isTappable?.(idx) ?? false;
        const cls = [
          styles.cell,
          card ? styles.filled : null,
          role === 'target' ? styles.target : null,
          role === 'selected' ? styles.selected : null,
          role === 'next' ? styles.next : null,
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
          >
            <AnimatePresence initial={false}>
              {card &&
                (jokerArrivals.has(idx) ? (
                  // Auto-placed joker: pop in late with a wobble + glow.
                  // The entrance is pure CSS — the board remounts in
                  // this same commit (♣ toggle) and AnimatePresence's
                  // initial={false} would swallow a motion entrance.
                  <motion.div
                    key={`joker-${idx}`}
                    className={`${styles.cardWrap} ${styles.jokerArrive}`}
                    exit={{ opacity: 0, scale: 0.6 }}
                  >
                    <CardFace card={card} />
                  </motion.div>
                ) : openingDeal.has(idx) ? (
                  // Opening deal: seated pre-paint by the engine, so the
                  // entrance is CSS (AnimatePresence's initial={false}
                  // suppresses mount animations). Staggered by slot.
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
                  <motion.div
                    key={cardLayoutId(card) ?? `joker-${idx}`}
                    layoutId={instantLayout ? undefined : cardLayoutId(card)}
                    className={styles.cardWrap}
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
          </button>
        );
      })}
    </div>
  );
}
