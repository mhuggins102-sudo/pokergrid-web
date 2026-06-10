import { AnimatePresence, motion } from 'motion/react';
import { canPreviewDeck } from '../../../game/state';
import { Button } from '../../../design/primitives';
import { useGameSession } from '../GameSessionProvider';
import { CardFace, cardAriaLabel, cardLayoutId } from './CardFace';
import styles from './NextCardWell.module.css';

export interface NextCardWellProps {
  onPeekDeck: () => void;
}

/**
 * The drawn-card well. Shares motion layoutIds with the grid, so placing
 * a card visibly travels from here to its cell.
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
        <span className="text-label">Next card</span>
        <span className={`text-value ${styles.deckCount}`}>
          {state.deck.length} left
        </span>
        {canPeek && (
          <Button size="sm" variant="ghost" className={styles.peek} onClick={onPeekDeck}>
            Peek deck
          </Button>
        )}
      </div>
    </div>
  );
}
