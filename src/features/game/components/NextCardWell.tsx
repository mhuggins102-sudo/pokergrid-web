import { AnimatePresence, motion } from 'motion/react';
import { canPreviewDeck } from '../../../game/state';
import { useGameSession } from '../GameSessionProvider';
import { CardFace, cardAriaLabel, cardLayoutId } from './CardFace';
import styles from './NextCardWell.module.css';

export interface NextCardWellProps {
  onPeekDeck: () => void;
}

/**
 * The drawn-card well — a slim chip that lives in the controls row right
 * under the board, so the card being decided on is never off-screen.
 * Shares motion layoutIds with the grid: placing a card visibly travels
 * from here to its cell.
 */
export function NextCardWell({ onPeekDeck }: NextCardWellProps) {
  const { state } = useGameSession();
  const drawn = state.drawn;
  const canPeek = canPreviewDeck(state.difficulty);

  return (
    <div className={styles.well}>
      <div
        className={styles.cardSlot}
        aria-label={drawn ? `Drawn card: ${cardAriaLabel(drawn)}` : 'No card drawn'}
      >
        <AnimatePresence>
          {drawn && (
            <motion.div
              key={cardLayoutId(drawn)}
              layoutId={cardLayoutId(drawn)}
              className={styles.cardWrap}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            >
              <CardFace card={drawn} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className={styles.meta}>
        <span className={styles.label}>Next</span>
        <span className={styles.deckCount}>{state.deck.length} left</span>
        {canPeek && (
          <button type="button" className={styles.peek} onClick={onPeekDeck}>
            Peek deck
          </button>
        )}
      </div>
    </div>
  );
}
