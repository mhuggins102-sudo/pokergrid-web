import { AnimatePresence, motion } from 'motion/react';
import { Card } from '../../../game/cards';
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
 * animate as FLIP travel; destroys exit via AnimatePresence.
 */
export function GridBoard({
  grid,
  roleOf,
  isTappable,
  onCellTap,
  instantLayout = false,
}: GridBoardProps) {
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
            <AnimatePresence>
              {card && (
                <motion.div
                  key={cardLayoutId(card) ?? `joker-${idx}`}
                  layoutId={cardLayoutId(card)}
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
              )}
            </AnimatePresence>
          </button>
        );
      })}
    </div>
  );
}
